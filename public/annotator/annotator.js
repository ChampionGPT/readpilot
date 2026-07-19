// input: window.__RP_ANNOT__ ({bookDir, pageId})，页面 DOM 与用户选区
// output: 选区浮动工具栏、标注保存/渲染/恢复、postMessage 与父窗口通信
// pos: 阅读页标注运行时 — 注入到章节 iframe 内执行
(function () {
  'use strict';
  var CFG = window.__RP_ANNOT__;
  if (!CFG || !CFG.bookDir || !CFG.pageId) return;

  var API = '/api/books/' + encodeURIComponent(CFG.bookDir) + '/annotations';
  var SEM = {
    case: '案例', quote: '金句', question: '疑问', resonance: '共鸣',
    objection: '反对', action: '行动', insight: '洞察',
  };
  var COLORS = ['yellow', 'blue', 'red', 'green'];
  var CONTEXT_LEN = 30;

  var state = {
    annotations: {},      // id -> annotation
    spans: {},            // id -> [wrapped span elements]
    toolbar: null,
    panel: null,
    idea: null,
    toast: null,
    currentRange: null,   // 待保存的选区 Range
    editingId: null,      // 正在编辑的已有标注
    unresolved: [],
  };

  // ── 工具 ──

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function api(method, path, body) {
    return fetch(API + (path || ''), {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error('annotation api ' + r.status);
      return r.json();
    });
  }

  function notifyParent(type, payload) {
    try {
      window.parent.postMessage({ source: 'rp-annotator', type: type, payload: payload || {} }, '*');
    } catch (_e) { /* noop */ }
  }

  // ── 文本遍历（跳过角标节点） ──

  function isIgnored(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (p.hasAttribute && p.hasAttribute('data-rp-ignore')) return true;
      p = p.parentNode;
    }
    return false;
  }

  function textNodesIn(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (!isIgnored(n)) nodes.push(n);
    }
    return nodes;
  }

  function blockOf(node) {
    var e = node.nodeType === 1 ? node : node.parentNode;
    while (e && e !== document.body) {
      if (e.hasAttribute && e.hasAttribute('data-rp-block')) return e;
      e = e.parentNode;
    }
    return null;
  }

  /** 计算 node 内某偏移在 block 纯文本中的绝对偏移 */
  function absOffset(block, node, offset) {
    var nodes = textNodesIn(block);
    var acc = 0;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] === node) return acc + offset;
      acc += nodes[i].data.length;
    }
    return -1;
  }

  /** 由 block 纯文本偏移还原 (node, offset) */
  function posAt(block, target) {
    var nodes = textNodesIn(block);
    var acc = 0;
    for (var i = 0; i < nodes.length; i++) {
      var len = nodes[i].data.length;
      if (acc + len >= target) return { node: nodes[i], offset: target - acc };
      acc += len;
    }
    return null;
  }

  function blockText(block) {
    return textNodesIn(block).map(function (n) { return n.data; }).join('');
  }

  // ── 锚点捕获与恢复 ──

  function captureAnchor(range) {
    var quote = range.toString();
    var block = blockOf(range.startContainer);
    var endBlock = blockOf(range.endContainer);
    var anchor = { locator: {}, quote: quote, quotePrefix: '', quoteSuffix: '' };
    if (block && block === endBlock) {
      var start = absOffset(block, range.startContainer, range.startOffset);
      var end = absOffset(block, range.endContainer, range.endOffset);
      if (start >= 0 && end >= start) {
        anchor.locator = {
          blockId: block.getAttribute('data-rp-block'),
          startOffset: start,
          endOffset: end,
        };
        var full = blockText(block);
        anchor.quotePrefix = full.slice(Math.max(0, start - CONTEXT_LEN), start);
        anchor.quoteSuffix = full.slice(end, end + CONTEXT_LEN);
      }
    }
    if (!anchor.quotePrefix && !anchor.quoteSuffix) {
      // 跨段或无 block id：用全文上下文兜底
      var body = document.querySelector('.chapter-body') || document.body;
      var all = blockText(body);
      var idx = all.indexOf(quote);
      if (idx >= 0) {
        anchor.quotePrefix = all.slice(Math.max(0, idx - CONTEXT_LEN), idx);
        anchor.quoteSuffix = all.slice(idx + quote.length, idx + quote.length + CONTEXT_LEN);
      }
    }
    return anchor;
  }

  function rangeFromOffsets(block, start, end) {
    var s = posAt(block, start);
    var e = posAt(block, end);
    if (!s || !e) return null;
    var range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    return range;
  }

  /** 恢复标注定位：blockId+offset 优先，quote+前后文兜底 */
  function resolveRange(ann) {
    var loc = ann.locator || {};
    if (loc.blockId != null) {
      var block = document.querySelector('[data-rp-block="' + CSS.escape(loc.blockId) + '"]');
      if (block && typeof loc.startOffset === 'number') {
        var r = rangeFromOffsets(block, loc.startOffset, loc.endOffset);
        if (r && r.toString() === ann.quote) return r;
        // 偏移失效：在该 block 内按文本搜索
        var found = findQuoteIn(block, ann);
        if (found) return found;
      }
    }
    var body = document.querySelector('.chapter-body') || document.body;
    return findQuoteIn(body, ann);
  }

  /** 在 root 纯文本中搜索 quote，用前后文消歧后转 Range */
  function findQuoteIn(root, ann) {
    if (!ann.quote) return null;
    var full = blockText(root);
    var candidates = [];
    var idx = full.indexOf(ann.quote);
    while (idx >= 0) {
      candidates.push(idx);
      idx = full.indexOf(ann.quote, idx + 1);
    }
    if (candidates.length === 0) return null;
    var best = candidates[0];
    if (candidates.length > 1 && (ann.quotePrefix || ann.quoteSuffix)) {
      var bestScore = -1;
      candidates.forEach(function (c) {
        var pre = full.slice(Math.max(0, c - CONTEXT_LEN), c);
        var suf = full.slice(c + ann.quote.length, c + ann.quote.length + CONTEXT_LEN);
        var score = sharedSuffix(pre, ann.quotePrefix) + sharedPrefix(suf, ann.quoteSuffix);
        if (score > bestScore) { bestScore = score; best = c; }
      });
    }
    return rangeFromOffsets(root, best, best + ann.quote.length);
  }

  function sharedPrefix(a, b) {
    var i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }
  function sharedSuffix(a, b) {
    var i = 0;
    while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    return i;
  }

  // ── 标注渲染 ──

  function classFor(ann) {
    var cls = 'rp-ann rp-vs-' + (ann.visualStyle || 'highlight');
    cls += ' rp-c-' + (ann.color || 'yellow');
    if (ann.body) cls += ' rp-has-body';
    return cls;
  }

  function wrapRange(range, ann) {
    var root = range.commonAncestorContainer;
    if (root.nodeType === 3) root = root.parentNode;
    var nodes = textNodesIn(root).filter(function (n) {
      var r = document.createRange();
      r.selectNodeContents(n);
      return range.compareBoundaryPoints(Range.END_TO_START, r) < 0 &&
             range.compareBoundaryPoints(Range.START_TO_END, r) > 0;
    });
    var spans = [];
    nodes.forEach(function (n) {
      var startOff = (n === range.startContainer && n.nodeType === 3) ? range.startOffset : 0;
      var endOff = (n === range.endContainer && n.nodeType === 3) ? range.endOffset : n.data.length;
      if (endOff <= startOff) return;
      var target = n;
      if (startOff > 0) target = n.splitText(startOff);
      if (endOff - startOff < target.data.length) target.splitText(endOff - startOff);
      var span = el('span', classFor(ann));
      span.setAttribute('data-rp-ann', ann.id);
      target.parentNode.insertBefore(span, target);
      span.appendChild(target);
      spans.push(span);
    });
    if (spans.length > 0) decorate(spans[spans.length - 1], ann);
    state.spans[ann.id] = spans;
    return spans.length > 0;
  }

  function decorate(lastSpan, ann) {
    if (ann.semanticType && SEM[ann.semanticType]) {
      var badge = el('span', 'rp-sem-badge', SEM[ann.semanticType]);
      badge.setAttribute('data-rp-ignore', '1');
      lastSpan.appendChild(badge);
    } else if (ann.body) {
      var dot = el('span', 'rp-body-dot');
      dot.setAttribute('data-rp-ignore', '1');
      lastSpan.appendChild(dot);
    }
  }

  function unwrap(annId) {
    (state.spans[annId] || []).forEach(function (span) {
      var parent = span.parentNode;
      if (!parent) return;
      // 移除角标
      Array.prototype.slice.call(span.querySelectorAll('[data-rp-ignore]')).forEach(function (b) { b.remove(); });
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    });
    delete state.spans[annId];
  }

  function renderAnnotation(ann) {
    if (ann.visualStyle === 'none' && !ann.body && !ann.semanticType) return true;
    var range = resolveRange(ann);
    if (!range) return false;
    return wrapRange(range, ann);
  }

  function rerender(ann) {
    unwrap(ann.id);
    state.annotations[ann.id] = ann;
    renderAnnotation(ann);
  }

  // ── 加载 ──

  function loadAll() {
    api('GET', '?pageId=' + encodeURIComponent(CFG.pageId)).then(function (data) {
      state.unresolved = [];
      (data.annotations || []).forEach(function (ann) {
        state.annotations[ann.id] = ann;
        if (!renderAnnotation(ann)) state.unresolved.push(ann.id);
      });
      notifyParent('rp-annotations-loaded', {
        pageId: CFG.pageId,
        count: (data.annotations || []).length,
        unresolved: state.unresolved,
      });
    }).catch(function (e) { console.warn('[annotator] load failed', e); });
  }

  // ── 浮层管理 ──

  function closeFloats(keepToolbar) {
    if (state.panel) { state.panel.remove(); state.panel = null; }
    if (state.idea) { state.idea.remove(); state.idea = null; }
    if (!keepToolbar && state.toolbar) { state.toolbar.remove(); state.toolbar = null; }
    if (!keepToolbar) { state.currentRange = null; state.editingId = null; }
  }

  function positionFloat(node, rect) {
    document.body.appendChild(node);
    var margin = 8;
    var top = rect.top + window.scrollY - node.offsetHeight - margin;
    if (top < window.scrollY + 4) top = rect.bottom + window.scrollY + margin;
    var left = rect.left + window.scrollX + rect.width / 2 - node.offsetWidth / 2;
    left = Math.max(4, Math.min(left, window.scrollX + document.documentElement.clientWidth - node.offsetWidth - 4));
    node.style.top = top + 'px';
    node.style.left = left + 'px';
  }

  function toast(msg, undoFn) {
    if (state.toast) state.toast.remove();
    var t = el('div', 'rp-toast');
    t.appendChild(el('span', null, msg));
    if (undoFn) {
      var undo = el('button', null, '撤销');
      undo.addEventListener('click', function () { undoFn(); t.remove(); });
      t.appendChild(undo);
    }
    document.body.appendChild(t);
    state.toast = t;
    setTimeout(function () { if (state.toast === t) { t.remove(); state.toast = null; } }, 4000);
  }

  // ── 保存动作 ──

  function saveNew(fields, cb) {
    var range = state.currentRange;
    if (!range) return;
    var anchor = captureAnchor(range);
    var payload = Object.assign({
      pageId: CFG.pageId,
      locator: anchor.locator,
      quote: anchor.quote,
      quotePrefix: anchor.quotePrefix,
      quoteSuffix: anchor.quoteSuffix,
      visualStyle: 'highlight',
      color: 'yellow',
    }, fields || {});
    api('POST', '', payload).then(function (ann) {
      state.annotations[ann.id] = ann;
      wrapRange(range, ann);
      window.getSelection().removeAllRanges();
      closeFloats();
      notifyParent('rp-annotations-changed', { pageId: CFG.pageId });
      toast('已保存', function () {
        api('DELETE', '/' + ann.id).then(function () {
          unwrap(ann.id);
          delete state.annotations[ann.id];
          notifyParent('rp-annotations-changed', { pageId: CFG.pageId });
        });
      });
      if (cb) cb(ann);
    }).catch(function (e) {
      console.warn('[annotator] save failed', e);
      toast('保存失败，请重试');
    });
  }

  function patchAnn(annId, fields) {
    api('PATCH', '/' + annId, fields).then(function (ann) {
      rerender(ann);
      closeFloats();
      notifyParent('rp-annotations-changed', { pageId: CFG.pageId });
      toast('已保存');
    }).catch(function () { toast('保存失败，请重试'); });
  }

  function removeAnn(annId) {
    var ann = state.annotations[annId];
    api('DELETE', '/' + annId).then(function () {
      unwrap(annId);
      delete state.annotations[annId];
      closeFloats();
      notifyParent('rp-annotations-changed', { pageId: CFG.pageId });
      toast('已删除', ann && function () {
        api('PATCH', '/' + annId, { deletedAt: null }).then(function (restored) {
          state.annotations[annId] = restored;
          renderAnnotation(restored);
          notifyParent('rp-annotations-changed', { pageId: CFG.pageId });
        });
      });
    });
  }

  // ── 想法编辑器 ──

  function openIdeaEditor(rect, quote, initial, onSave) {
    closeFloats(true);
    var box = el('div', 'rp-idea');
    var q = el('div', 'rp-idea-quote', quote.length > 120 ? quote.slice(0, 120) + '…' : quote);
    var ta = document.createElement('textarea');
    ta.placeholder = '写下你的想法…';
    ta.value = initial || '';
    var actions = el('div', 'rp-idea-actions');
    var cancel = el('button', 'rp-cancel', '取消');
    var save = el('button', 'rp-save', '保存');
    cancel.addEventListener('click', function () { closeFloats(); });
    save.addEventListener('click', function () { onSave(ta.value.trim()); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(ta.value.trim());
      e.stopPropagation();
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    box.appendChild(q);
    box.appendChild(ta);
    box.appendChild(actions);
    positionFloat(box, rect);
    state.idea = box;
    ta.focus();
  }

  // ── 二级面板 ──

  function openSemanticPanel(rect, activeType, onPick) {
    if (state.panel) { state.panel.remove(); state.panel = null; return; }
    var panel = el('div', 'rp-panel');
    Object.keys(SEM).forEach(function (key) {
      var b = el('button', key === activeType ? 'rp-active' : null, SEM[key]);
      b.addEventListener('click', function () { onPick(key === activeType ? null : key); });
      panel.appendChild(b);
    });
    positionFloat(panel, rect);
    state.panel = panel;
  }

  function openMorePanel(rect, ann) {
    if (state.panel) { state.panel.remove(); state.panel = null; return; }
    var panel = el('div', 'rp-panel');
    var styles = [['straight', '直线'], ['wavy', '波浪线'], ['highlight', '高亮'], ['none', '无样式']];
    styles.forEach(function (pair) {
      var b = el('button', ann && ann.visualStyle === pair[0] ? 'rp-active' : null, pair[1]);
      b.addEventListener('click', function () {
        if (ann) patchAnn(ann.id, { visualStyle: pair[0] });
        else saveNew({ visualStyle: pair[0] });
      });
      panel.appendChild(b);
    });
    COLORS.forEach(function (color) {
      var b = el('button', ann && ann.color === color ? 'rp-active' : null);
      b.appendChild(el('span', 'rp-swatch rp-c-' + color));
      b.addEventListener('click', function () {
        if (ann) patchAnn(ann.id, { color: color });
        else saveNew({ color: color });
      });
      panel.appendChild(b);
    });
    if (ann) {
      var del = el('button', null, '删除标注');
      del.addEventListener('click', function () { removeAnn(ann.id); });
      panel.appendChild(del);
    }
    positionFloat(panel, rect);
    state.panel = panel;
  }

  // ── 工具栏 ──

  function buildToolbar(rect, opts) {
    closeFloats();
    var ann = opts.ann || null;
    var quote = ann ? ann.quote : (state.currentRange ? state.currentRange.toString() : '');
    var bar = el('div', 'rp-toolbar');
    bar.setAttribute('role', 'toolbar');

    function add(label, handler, title) {
      var b = el('button', null, label);
      if (title) b.title = title;
      b.addEventListener('click', function (e) { e.stopPropagation(); handler(bar.getBoundingClientRect()); });
      bar.appendChild(b);
      return b;
    }

    if (!ann) {
      add('高亮', function () { saveNew({ visualStyle: 'highlight', color: 'yellow' }); });
    }
    add('想法', function (r) {
      openIdeaEditor(r, quote, ann ? ann.body : '', function (text) {
        if (ann) patchAnn(ann.id, { body: text });
        else saveNew({ body: text, visualStyle: 'none', color: null });
      });
    });
    add('标记', function (r) {
      openSemanticPanel(r, ann ? ann.semanticType : null, function (type) {
        if (ann) patchAnn(ann.id, { semanticType: type });
        else saveNew({ semanticType: type });
      });
    });
    add('复制', function () {
      var text = quote;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
        function () { toast('已复制'); closeFloats(); },
        function () {
          var sel = window.getSelection();
          if (sel && !sel.isCollapsed) { document.execCommand('copy'); toast('已复制'); closeFloats(); }
        }
      );
    });
    add('问AI', function () {
      notifyParent('rp-ask-ai', {
        quote: quote,
        pageId: CFG.pageId,
        semanticType: ann ? ann.semanticType : null,
        body: ann ? ann.body : '',
      });
      closeFloats();
      window.getSelection().removeAllRanges();
    });
    bar.appendChild(el('span', 'rp-sep'));
    add('更多', function (r) { openMorePanel(r, ann); });

    positionFloat(bar, rect);
    state.toolbar = bar;
  }

  // ── 事件绑定 ──

  function onSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    var range = sel.getRangeAt(0);
    // 只处理正文选区
    var block = blockOf(range.startContainer);
    var body = document.querySelector('.chapter-body');
    if (!block && body && !body.contains(range.commonAncestorContainer)) return;
    state.currentRange = range.cloneRange();
    state.editingId = null;
    buildToolbar(range.getBoundingClientRect(), {});
  }

  document.addEventListener('mouseup', function (e) {
    if (state.toolbar && state.toolbar.contains(e.target)) return;
    if (state.idea && state.idea.contains(e.target)) return;
    if (state.panel && state.panel.contains(e.target)) return;
    setTimeout(onSelection, 10);
  });

  // 移动端长按选择
  document.addEventListener('touchend', function () { setTimeout(onSelection, 150); });

  document.addEventListener('mousedown', function (e) {
    if (state.toolbar && !state.toolbar.contains(e.target) &&
        (!state.panel || !state.panel.contains(e.target)) &&
        (!state.idea || !state.idea.contains(e.target))) {
      closeFloats();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeFloats(); window.getSelection().removeAllRanges(); }
  });

  // 点击已有标注 → 编辑工具栏
  document.addEventListener('click', function (e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.hasAttribute && target.hasAttribute('data-rp-ann')) {
        var annId = target.getAttribute('data-rp-ann');
        var ann = state.annotations[annId];
        if (ann) {
          e.preventDefault();
          e.stopPropagation();
          state.editingId = annId;
          state.currentRange = null;
          buildToolbar(target.getBoundingClientRect(), { ann: ann });
        }
        return;
      }
      target = target.parentNode;
    }
  }, true);

  window.addEventListener('scroll', function () { closeFloats(); }, { passive: true });
  window.addEventListener('resize', function () { closeFloats(); });

  // 父窗口指令：滚动到某条标注
  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || data.source !== 'rp-host') return;
    if (data.type === 'rp-scroll-to' && data.payload && data.payload.annotationId) {
      var spans = state.spans[data.payload.annotationId];
      var target = spans && spans[0];
      if (!target) {
        var ann = state.annotations[data.payload.annotationId];
        if (ann) {
          var range = resolveRange(ann);
          if (range) {
            target = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
          }
        }
      }
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (spans || [target]).forEach(function (s) {
          s.classList.add('rp-ann-flash');
          setTimeout(function () { s.classList.remove('rp-ann-flash'); }, 1700);
        });
      }
    }
    if (data.type === 'rp-reload') loadAll0();
  });

  function loadAll0() {
    Object.keys(state.spans).forEach(unwrap);
    state.annotations = {};
    loadAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll);
  } else {
    loadAll();
  }
})();
