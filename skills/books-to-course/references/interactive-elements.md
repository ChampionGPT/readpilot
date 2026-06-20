# 交互式元素参考指南

本指南提供了书籍转课程中使用的所有交互式元素的完整实现模式。请根据每个模块的教学目标（如：理解词汇、梳理逻辑、批判性思考、实际应用）选择最合适的元素。

## 目录
1. [原著原文与大白话解析区块](#1-原著原文与大白话解析区块)
2. [批判性应用测验](#2-批判性应用测验)
3. [概念拖拽匹配](#3-概念拖拽匹配)
4. [思想碰撞群聊动画](#4-思想碰撞群聊动画)
5. [逻辑推演/论证流动画](#5-逻辑推演论证流动画)
6. [交互式全书架构图](#6-交互式全书架构图)
7. [认知深度切换演示](#7-认知深度切换演示)
8. [寻找逻辑漏洞挑战](#8-寻找逻辑漏洞挑战)
9. [现实情境测验](#9-现实情境测验)
10. [顿悟提示框](#10-顿悟提示框)
11. [心智模型卡片](#11-心智模型卡片)
12. [因果关系流程图](#12-因果关系流程图)
13. [时代背景/前提条件标签](#13-时代背景前提条件标签)
14. [核心词汇提示框](#14-核心词汇提示框)
15. [视觉化知识树](#15-视觉化知识树)
16. [核心要素列举行](#16-核心要素列举行)
17. [行动指南步骤卡片](#17-行动指南步骤卡片)

---

## 1. 原著原文与大白话解析区块

最重要的教学元素。左侧展示书中真实、密集的原文引用，右侧逐句进行大白话翻译和深度剖析。

**HTML:**
```html
<div class="translation-block animate-in">
  <div class="translation-quote">
    <span class="translation-label">原著原文 (ORIGINAL TEXT)</span>
    <blockquote class="book-quote">
      <p class="quote-line">"The word 'good' has many meanings. For example, if a man were to shoot his grandmother at a range of five hundred yards, I should call him a good shot, but not necessarily a good man."</p>
      <p class="quote-line">"No book is really worth reading at the age of ten which is not equally – and often far more – worth reading at the age of fifty and beyond."</p>
    </blockquote>
  </div>
  <div class="translation-english">
    <span class="translation-label">大白话解析 (PLAIN ENGLISH)</span>
    <div class="translation-lines">
      <p class="tl">作者在这里玩了一个文字游戏，区分了“技能上的好”（枪法准）和“道德上的好”（人品好）。这暗示了我们在评价事物时，必须明确评价的标准。</p>
      <p class="tl">真正伟大的思想是没有年龄限制的。如果一本书只能骗骗小孩，那它就不具备普世的智慧。好书会随着你阅历的增加而展现出更深的内涵。</p>
    </div>
  </div>
</div>
```

**CSS:**
```css
.translation-block {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  margin: var(--space-8) 0;
}
.translation-quote {
  background: var(--color-bg-quote); /* 建议使用深邃的阅读背景色，如深炭灰 */
  color: #EAE4D9;
  padding: var(--space-6);
  font-family: var(--font-display); /* 使用经典的衬线体 */
  font-size: var(--text-base);
  line-height: 1.8;
  position: relative;
  overflow-x: hidden;
}
.translation-quote blockquote,
.translation-quote p {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: var(--space-4);
}
.translation-english {
  background: var(--color-surface-warm);
  padding: var(--space-6);
  font-size: var(--text-sm);
  line-height: 1.7;
  border-left: 3px solid var(--color-accent);
}
.translation-label {
  position: absolute;
  top: var(--space-2);
  right: var(--space-3);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.5;
}
.translation-english .translation-label {
  color: var(--color-text-muted);
}
/* 响应式：移动端垂直堆叠 */
@media (max-width: 768px) {
  .translation-block { grid-template-columns: 1fr; }
  .translation-english { border-left: none; border-top: 3px solid var(--color-accent); }
}
```

**规则:**
- 每一句大白话解析应对应 1-2 句原文。
- 使用对话式的语言，不要使用学术黑话。
- 强调“为什么这么说”而不是仅仅复述字面意思。

---

## 2. 批判性应用测验

用于测试用户是否真正理解了作者的逻辑，并能将其应用于新情境。包含选项、唯一正确答案和详细解析。

**HTML:**
```html
<div class="quiz-container">
  <div class="quiz-question-block" data-question="q1" data-correct="option-b">
    <h3 class="quiz-question">根据作者对“反脆弱”的定义，以下哪个系统是反脆弱的？</h3>
    <div class="quiz-options">
      <button class="quiz-option" data-value="option-a" onclick="selectOption(this)">
        <div class="quiz-option-radio"></div>
        <span>一个坚固的保险箱（掉在地上不会坏）</span>
      </button>
      <button class="quiz-option" data-value="option-b" onclick="selectOption(this)">
        <div class="quiz-option-radio"></div>
        <span>人类的免疫系统（接触少量病毒后会变得更强）</span>
      </button>
      <button class="quiz-option" data-value="option-c" onclick="selectOption(this)">
        <div class="quiz-option-radio"></div>
        <span>一个精密的机械钟表（需要定期小心维护）</span>
      </button>
    </div>
    <div class="quiz-feedback" id="q1-feedback"></div>
  </div>

  <button class="quiz-check-btn" onclick="checkQuiz('section-id')">验证你的思考</button>
  <button class="quiz-reset-btn" onclick="resetQuiz('section-id')">再试一次</button>
  <div class="quiz-overall-feedback" id="section-overall"></div>
</div>
```

**JS 逻辑:**
```javascript
window.selectOption = function(btn) {
  // 取消选择其他兄弟节点
  const block = btn.closest('.quiz-question-block');
  block.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
  btn.classList.add('selected');
};

window.checkQuiz = function(sectionId) {
  const container = document.querySelector(`#${sectionId} .quiz-container`);
  const questions = container.querySelectorAll('.quiz-question-block');
  let correct = 0;

  questions.forEach(q => {
    const selected = q.querySelector('.quiz-option.selected');
    const feedback = q.querySelector('.quiz-feedback');
    const correctValue = q.dataset.correct;

    if (!selected) {
      feedback.textContent = '请先选择一个答案！';
      feedback.className = 'quiz-feedback show warning';
      return;
    }

    if (selected.dataset.value === correctValue) {
      correct++;
      selected.classList.add('correct');
      feedback.innerHTML = '<strong>完全正确！</strong> ' + getExplanation(q, true);
      feedback.className = 'quiz-feedback show success';
    } else {
      selected.classList.add('incorrect');
      // 高亮正确答案
      q.querySelector(`[data-value="${correctValue}"]`).classList.add('correct');
      feedback.innerHTML = '<strong>再想想。</strong> ' + getExplanation(q, false);
      feedback.className = 'quiz-feedback show error';
    }

    // 禁用进一步交互
    q.querySelectorAll('.quiz-option').forEach(o => o.disabled = true);
  });
};
```

**CSS 测验状态:**
```css
.quiz-option {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer; width: 100%;
  transition: border-color var(--duration-fast), background var(--duration-fast);
}
.quiz-option:hover { border-color: var(--color-accent-muted); }
.quiz-option.selected { border-color: var(--color-accent); background: var(--color-accent-light); }
.quiz-option.correct { border-color: var(--color-success); background: var(--color-success-light); }
.quiz-option.incorrect { border-color: var(--color-error); background: var(--color-error-light); }
.quiz-option-radio {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--color-border);
  transition: all var(--duration-fast);
}
.quiz-option.selected .quiz-option-radio {
  border-color: var(--color-accent);
  background: var(--color-accent);
  box-shadow: inset 0 0 0 3px white;
}
.quiz-feedback {
  max-height: 0; overflow: hidden; opacity: 0;
  transition: max-height var(--duration-normal), opacity var(--duration-normal);
}
.quiz-feedback.show { max-height: 200px; opacity: 1; padding: var(--space-3); margin-top: var(--space-2); border-radius: var(--radius-sm); }
.quiz-feedback.success { background: var(--color-success-light); color: var(--color-success); }
.quiz-feedback.error { background: var(--color-error-light); color: var(--color-error); }
```

---

## 3. 概念拖拽匹配

用于将书中的抽象概念（如：系统1/系统2）与现实生活中的具体案例进行匹配。支持鼠标（HTML5 Drag API）和触摸屏。

**HTML:**
```html
<div class="dnd-container">
  <div class="dnd-chips">
    <div class="dnd-chip" draggable="true" data-answer="concept-a">系统1 (快思考)</div>
    <div class="dnd-chip" draggable="true" data-answer="concept-b">系统2 (慢思考)</div>
  </div>
  <div class="dnd-zones">
    <div class="dnd-zone" data-correct="concept-a">
      <p class="dnd-zone-label">看到别人愤怒的表情，立刻意识到危险</p>
      <div class="dnd-zone-target">拖拽到这里</div>
    </div>
    <div class="dnd-zone" data-correct="concept-b">
      <p class="dnd-zone-label">计算 17 乘以 24 的结果</p>
      <div class="dnd-zone-target">拖拽到这里</div>
    </div>
  </div>
  <button onclick="checkDnD()">验证匹配</button>
  <button onclick="resetDnD()">重置</button>
</div>
```

**JS (鼠标 + 触摸屏完整实现):**
```javascript
// 鼠标：HTML5 Drag API
chips.forEach(chip => {
  chip.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', chip.dataset.answer);
    chip.classList.add('dragging');
  });
  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
});

zones.forEach(zone => {
  const target = zone.querySelector('.dnd-zone-target');
  target.addEventListener('dragover', (e) => { e.preventDefault(); target.classList.add('drag-over'); });
  target.addEventListener('dragleave', () => target.classList.remove('drag-over'));
  target.addEventListener('drop', (e) => {
    e.preventDefault();
    target.classList.remove('drag-over');
    const answer = e.dataTransfer.getData('text/plain');
    const chip = document.querySelector(`[data-answer="${answer}"]`);
    target.textContent = chip.textContent;
    target.dataset.placed = answer;
    chip.classList.add('placed');
  });
});

// 触摸屏：自定义实现 (HTML5 drag 在移动端无效)
chips.forEach(chip => {
  chip.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const clone = chip.cloneNode(true);
    clone.classList.add('touch-ghost');
    clone.style.cssText = `position:fixed; z-index:1000; pointer-events:none;
      left:${touch.clientX - 40}px; top:${touch.clientY - 20}px;`;
    document.body.appendChild(clone);
    chip._ghost = clone;
    chip._answer = chip.dataset.answer;
  }, { passive: false });

  chip.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (chip._ghost) {
      chip._ghost.style.left = (touch.clientX - 40) + 'px';
      chip._ghost.style.top = (touch.clientY - 20) + 'px';
    }
    // 高亮手指下方的区域
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    zones.forEach(z => z.querySelector('.dnd-zone-target').classList.remove('drag-over'));
    if (el && el.closest('.dnd-zone-target')) {
      el.closest('.dnd-zone-target').classList.add('drag-over');
    }
  }, { passive: false });

  chip.addEventListener('touchend', (e) => {
    if (chip._ghost) { chip._ghost.remove(); chip._ghost = null; }
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.closest('.dnd-zone-target')) {
      const target = el.closest('.dnd-zone-target');
      target.textContent = chip.textContent;
      target.dataset.placed = chip._answer;
      chip.classList.add('placed');
    }
  });
});
```

---

## 4. 思想碰撞群聊动画

模拟微信/iMessage聊天界面。用于展示书中不同流派的观点冲突，或者作者与反对者之间的“跨时空对话”。

**HTML:**
```html
<div class="chat-window">
  <div class="chat-messages" id="chat-messages">
    <div class="chat-message" data-msg="0" data-sender="author" style="display:none">
      <div class="chat-avatar" style="background: var(--color-actor-1)">塔</div>
      <div class="chat-bubble">
        <span class="chat-sender" style="color: var(--color-actor-1)">塔勒布 (作者)</span>
        <p>预测黑天鹅事件是不可能的，我们应该做的是建立反脆弱系统。</p>
      </div>
    </div>
    <div class="chat-message" data-msg="1" data-sender="skeptic" style="display:none">
      <div class="chat-avatar" style="background: var(--color-actor-2)">专</div>
      <div class="chat-bubble">
        <span class="chat-sender" style="color: var(--color-actor-2)">传统风险专家</span>
        <p>但这不符合我们的统计模型！我们可以通过历史数据计算出标准差啊。</p>
      </div>
    </div>
    <!-- 更多消息... -->
  </div>

  <div class="chat-typing" id="chat-typing" style="display:none">
    <div class="chat-avatar" id="typing-avatar">?</div>
    <div class="chat-typing-dots">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  </div>

  <div class="chat-controls">
    <button onclick="playChatNext()">下一条</button>
    <button onclick="playChatAll()">自动播放</button>
    <button onclick="resetChat()">重置</button>
    <span class="chat-progress">0 / N 条消息</span>
  </div>
</div>
```

**JS:**
```javascript
let chatIndex = 0;
const chatMessages = document.querySelectorAll('#chat-messages .chat-message');

// 角色颜色/头像映射
const actors = {
  'author': { initials: '塔', color: 'var(--color-actor-1)' },
  'skeptic': { initials: '专', color: 'var(--color-actor-2)' },
};

window.playChatNext = function() {
  if (chatIndex >= chatMessages.length) return;
  const msg = chatMessages[chatIndex];
  const sender = msg.dataset.sender;

  // 显示带有正确头像的输入中指示器
  const typing = document.getElementById('chat-typing');
  const avatar = document.getElementById('typing-avatar');
  avatar.textContent = actors[sender].initials;
  avatar.style.background = actors[sender].color;
  typing.style.display = 'flex';

  setTimeout(() => {
    typing.style.display = 'none';
    msg.style.display = 'flex';
    msg.style.animation = 'fadeSlideUp 0.3s var(--ease-out)';
    chatIndex++;
    updateChatProgress();
  }, 800);
};

window.playChatAll = function() {
  const interval = setInterval(() => {
    if (chatIndex >= chatMessages.length) { clearInterval(interval); return; }
    playChatNext();
  }, 1200);
};
```

**CSS 输入中动画:**
```css
.typing-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-text-muted);
  animation: typingBounce 1.4s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
```

---

## 5. 逻辑推演/论证流动画

逐步可视化作者的论证过程。用户点击“推演下一步”来推进逻辑链条。

**HTML:**
```html
<div class="flow-animation">
  <div class="flow-actors">
    <div class="flow-actor" id="flow-premise">
      <div class="flow-actor-icon">A</div>
      <span>大前提</span>
    </div>
    <div class="flow-actor" id="flow-evidence">
      <div class="flow-actor-icon">B</div>
      <span>现实证据</span>
    </div>
    <div class="flow-actor" id="flow-conclusion">
      <div class="flow-actor-icon">C</div>
      <span>核心结论</span>
    </div>
  </div>

  <div class="flow-packet" id="flow-packet"></div>

  <div class="flow-step-label" id="flow-label">点击“推演下一步”开始</div>

  <div class="flow-controls">
    <button onclick="flowNext()">推演下一步</button>
    <button onclick="flowReset()">重新推演</button>
    <span class="flow-progress">步骤 0 / N</span>
  </div>
</div>
```

**JS 逻辑:**
```javascript
const flowSteps = [
  { from: 'premise', to: 'evidence', label: '前提：人类天生厌恶损失', highlight: 'premise' },
  { from: 'premise', to: 'evidence', label: '结合现实：股市下跌时散户容易恐慌抛售', highlight: 'evidence', packet: true },
  { from: 'evidence', to: 'conclusion', label: '结论：投资需要逆人性的系统设计', highlight: 'conclusion', packet: true },
];

let flowStep = 0;
window.flowNext = function() {
  if (flowStep >= flowSteps.length) return;
  const step = flowSteps[flowStep];

  // 移除之前的高亮
  document.querySelectorAll('.flow-actor').forEach(a => a.classList.remove('active'));

  // 高亮当前节点
  document.getElementById(`flow-${step.highlight}`).classList.add('active');

  // 如果需要，执行连接动画
  if (step.packet) {
    animatePacket(step.from, step.to);
  }

  // 更新标签
  document.getElementById('flow-label').textContent = step.label;
  flowStep++;
};
```

**CSS 激活状态发光效果:**
```css
.flow-actor.active {
  box-shadow: 0 0 0 3px var(--color-accent), 0 0 20px rgba(217, 79, 48, 0.2);
  transform: scale(1.05);
  transition: all var(--duration-normal) var(--ease-out);
}
```

---

## 6. 交互式全书架构图

全书的宏观地图。鼠标悬停或点击某个“篇章”或“核心概念”时，显示该部分的详细说明。

**HTML:**
```html
<div class="arch-diagram">
  <div class="arch-zone arch-zone-foundation">
    <h4 class="arch-zone-label">第一部分：提出问题</h4>
    <div class="arch-component" data-desc="作者在这里指出了传统时间管理法的致命缺陷：把人当成机器。"
         onclick="showArchDesc(this)">
      <div class="arch-icon">⏱️</div>
      <span>效率陷阱</span>
    </div>
    <!-- 更多组件 -->
  </div>
  <div class="arch-zone arch-zone-external">
    <h4 class="arch-zone-label">第二部分：解决方案</h4>
    <!-- 解决方案卡片 -->
  </div>
  <div class="arch-description" id="arch-desc">点击任意概念查看它在全书中的作用</div>
</div>
```

---

## 7. 认知深度切换演示

展示对同一事物的不同认知层次。三个选项卡在不同视图之间切换。

**HTML:**
```html
<div class="layer-demo">
  <div class="layer-tabs">
    <button class="layer-tab active" onclick="showLayer('surface')">表层现象 (普通人视角)</button>
    <button class="layer-tab" onclick="showLayer('mechanism')">底层机制 (作者视角)</button>
    <button class="layer-tab" onclick="showLayer('action')">行动指南 (如何破局)</button>
  </div>
  <div class="layer-viewport">
    <div class="layer" id="layer-surface" style="display:block">
      <!-- 表层现象内容 -->
    </div>
    <div class="layer" id="layer-mechanism" style="display:none">
      <!-- 底层机制内容 -->
    </div>
    <div class="layer" id="layer-action" style="display:none">
      <!-- 行动指南内容 -->
    </div>
  </div>
  <p class="layer-description" id="layer-desc">普通人看到的往往只是冰山一角...</p>
</div>
```

---

## 8. 寻找逻辑漏洞挑战

展示一段看似合理的论述（可能是书中提到的反面教材）。用户点击存在逻辑谬误的那一行，揭示解释。

**HTML:**
```html
<div class="bug-challenge">
  <h3>找出这段论述中的“幸存者偏差”：</h3>
  <div class="bug-code">
    <div class="bug-line" data-line="1" onclick="checkBugLine(this, false)">
      <span class="line-num">1</span>
      <code>我们调查了100位成功的创业者，发现他们都有早起的习惯。</code>
    </div>
    <div class="bug-line bug-target" data-line="2" onclick="checkBugLine(this, true)">
      <span class="line-num">2</span>
      <code>因此，只要你坚持每天早上5点起床，你也能取得巨大的商业成功。</code>
    </div>
    <div class="bug-line" data-line="3" onclick="checkBugLine(this, false)">
      <span class="line-num">3</span>
      <code>这就是早起的奇迹。</code>
    </div>
  </div>
  <div class="bug-feedback" id="bug-feedback"></div>
</div>
```

**JS:**
```javascript
window.checkBugLine = function(el, isCorrect) {
  const feedback = el.closest('.bug-challenge').querySelector('.bug-feedback');
  if (isCorrect) {
    el.classList.add('correct');
    feedback.innerHTML = '<strong>找对了！</strong> 这句话犯了因果倒置和幸存者偏差的错误。早起可能是成功的结果，或者两者根本没有必然因果关系。作者在第三章专门驳斥了这种成功学鸡汤。';
    feedback.className = 'bug-feedback show success';
  } else {
    el.classList.add('incorrect');
    feedback.innerHTML = '不是这句——仔细看看哪句话得出了绝对的结论...';
    feedback.className = 'bug-feedback show error';
    setTimeout(() => { el.classList.remove('incorrect'); feedback.className = 'bug-feedback'; }, 2000);
  }
};
```

---

## 9. 现实情境测验

“如果是作者，他会怎么做？”——带有详细解释的情境问题。

与“批判性应用测验”使用相同的 HTML/CSS/JS 模式，但带有更长的情境描述。将每个问题包裹在情境上下文块中：

```html
<div class="scenario-block">
  <div class="scenario-context">
    <span class="scenario-label">现实挑战 (Scenario)</span>
    <p>你的公司正面临行业技术颠覆，利润下滑。根据《创新者的窘境》中的理论，作为CEO，你现在最应该做什么？</p>
  </div>
  <!-- 测验选项放在这里 -->
</div>
```

---

## 10. 顿悟提示框

用于强调书中普世的智慧、反直觉的洞见或核心金句。每个模块最多使用 1-2 次。

```html
<div class="callout callout-accent">
  <div class="callout-icon">💡</div>
  <div class="callout-content">
    <strong class="callout-title">核心洞见 (Key Insight)</strong>
    <p>“动机是短暂的，环境是持久的。”作者在这里彻底推翻了依靠意志力改变习惯的传统观点，指出系统设计大于个人努力。</p>
  </div>
</div>
```

**变体:**
- `callout-accent`: 朱红色左边框，浅色强调背景（用于核心洞见）
- `callout-info`: 蓝绿色左边框，浅色信息背景（用于“补充背景知识”）
- `callout-warning`: 红色左边框，浅色错误背景（用于“作者指出的常见误区”）

---

## 11. 心智模型卡片

网格状卡片，用于高亮书中的核心思维模型、原则或关键要素。

```html
<div class="pattern-cards">
  <div class="pattern-card" style="border-top: 3px solid var(--color-actor-1)">
    <div class="pattern-icon" style="background: var(--color-actor-1)">🪞</div>
    <h4 class="pattern-title">达克效应</h4>
    <p class="pattern-desc">能力越低的人，越容易产生对自己能力的虚幻优越感。知道自己不知道，是智慧的开始。</p>
  </div>
  <!-- 更多卡片 -->
</div>
```

```css
.pattern-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}
.pattern-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal);
}
.pattern-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}
```

---

## 12. 因果关系流程图

用于替代枯燥的步骤说明文字，视觉化地展示事物发展的因果链条。

**水平流向 (桌面端):**
```html
<div class="flow-steps">
  <div class="flow-step">
    <div class="flow-step-num">1</div>
    <p>收到外部刺激 (提示)</p>
  </div>
  <div class="flow-arrow">→</div>
  <div class="flow-step">
    <div class="flow-step-num">2</div>
    <p>产生内心渴望 (渴求)</p>
  </div>
  <div class="flow-arrow">→</div>
  <!-- 更多步骤 -->
</div>
```

在移动端，箭头会通过 CSS transform 旋转为 `↓`。

---

## 13. 时代背景/前提条件标签

用于标注某个理论适用的前提条件、时代背景或局限性：

```html
<div class="badge-list">
  <div class="badge-item">
    <code class="badge-code">适用边界</code>
    <span class="badge-desc">此理论仅适用于“复杂且非线性”的系统，不适用于简单的机械系统。</span>
  </div>
  <div class="badge-item">
    <code class="badge-code">时代局限</code>
    <span class="badge-desc">成书于互联网普及前，部分关于信息传播的论断已过时。</span>
  </div>
</div>
```

```css
.badge-item {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  transition: border-color var(--duration-fast);
}
.badge-item:hover { border-color: var(--color-accent-muted); }
.badge-code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background: var(--color-bg-quote);
  color: #CBA6F7;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
```

---

## 14. 核心词汇提示框

**非技术读者/初学者最重要的辅助工具。** 按照《如何阅读一本书》中“与作者达成共识”的原则，书中任何特有的黑话、术语，在模块中首次出现时，都必须包裹在 tooltip 中。用户悬停（桌面端）或点击（移动端）即可看到大白话定义。

**HTML — 在行内标记术语:**
```html
<p>为了实现深度工作，我们需要进入一种
  <span class="term" data-definition="心流：一种将个人精神力完全投注在某种活动上的感觉，此时人会产生高度的兴奋及充实感。">心流</span>
  状态，并屏蔽所有的外部干扰。
</p>
```

**CSS:**
```css
.term {
  border-bottom: 1.5px dashed var(--color-accent-muted);
  cursor: pointer;    /* 必须是 pointer，让人感觉可以点击 */
  position: relative;
}
.term:hover, .term.active {
  border-bottom-color: var(--color-accent);
  color: var(--color-accent);
}

/* 提示框气泡 — 使用 position: fixed 并通过 JS 挂载到 document.body
   这样它永远不会被祖先元素的 overflow: hidden 裁切掉。 */
.term-tooltip {
  position: fixed;        /* 关键：fixed 而不是 absolute — 防止裁切 */
  background: var(--color-bg-quote);
  color: #EAE4D9;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-family: var(--font-body);
  line-height: var(--leading-normal);
  width: max(200px, min(320px, 80vw));
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast);
  z-index: 10000;        /* 确保在最上层 */
}
/* 向下的箭头 */
.term-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-bg-quote);
}
.term-tooltip.visible {
  opacity: 1;
}

/* 如果提示框超出屏幕顶部，翻转到下方 */
.term-tooltip.flip {
  bottom: auto;
  top: calc(100% + 8px);
}
.term-tooltip.flip::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: var(--color-bg-quote);
}
```

**JS — 将 position: fixed 提示框挂载到 body (防止 overflow 裁切):**
```javascript
// 提示框容器 — 挂载到 body 防止裁切
let activeTooltip = null;

function positionTooltip(term, tip) {
  const rect = term.getBoundingClientRect();
  const tipWidth = 300; // 预估宽度
  let left = rect.left + rect.width / 2 - tipWidth / 2;
  // 限制在视口内
  left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));

  // 默认尝试在上方显示
  let top = rect.top - 8;
  tip.style.left = left + 'px';

  document.body.appendChild(tip);
  const tipHeight = tip.offsetHeight;
  if (rect.top - tipHeight - 8 < 0) {
    // 空间不足，翻转到下方
    tip.style.top = (rect.bottom + 8) + 'px';
    tip.classList.add('flip');
  } else {
    tip.style.top = (rect.top - tipHeight - 8) + 'px';
    tip.classList.remove('flip');
  }
}

document.querySelectorAll('.term').forEach(term => {
  const tip = document.createElement('span');
  tip.className = 'term-tooltip';
  tip.textContent = term.dataset.definition;

  // 桌面端悬停
  term.addEventListener('mouseenter', () => {
    if (activeTooltip && activeTooltip !== tip) {
      activeTooltip.classList.remove('visible');
      activeTooltip.remove();
    }
    positionTooltip(term, tip);
    requestAnimationFrame(() => tip.classList.add('visible'));
    activeTooltip = tip;
  });

  term.addEventListener('mouseleave', () => {
    tip.classList.remove('visible');
    setTimeout(() => { if (!tip.classList.contains('visible')) tip.remove(); }, 150);
    activeTooltip = null;
  });

  // 移动端点击
  term.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTooltip && activeTooltip !== tip) {
      activeTooltip.classList.remove('visible');
      activeTooltip.remove();
    }
    if (tip.classList.contains('visible')) {
      tip.classList.remove('visible');
      tip.remove();
      activeTooltip = null;
    } else {
      positionTooltip(term, tip);
      requestAnimationFrame(() => tip.classList.add('visible'));
      activeTooltip = tip;
    }
  });
});

// 点击其他地方关闭提示框
document.addEventListener('click', () => {
  if (activeTooltip) {
    activeTooltip.classList.remove('visible');
    activeTooltip.remove();
    activeTooltip = null;
  }
});
```

**规则:**
- 在每个模块中，首次出现的专有名词都必须标记。
- 定义必须控制在 1-2 句话内，使用日常语言。
- 如果有帮助，可以在定义中使用比喻。

---

## 15. 视觉化知识树

用于替代“第一章讲了X，第二章讲了Y”这种枯燥的段落。让书籍的目录结构一目了然。

```html
<div class="file-tree">
  <div class="ft-folder open">
    <span class="ft-name">第一篇：习惯的养成</span>
    <span class="ft-desc">探讨习惯背后的神经学机制</span>
    <div class="ft-children">
      <div class="ft-file">
        <span class="ft-name">提示 (Cue)</span>
        <span class="ft-desc">让它显而易见</span>
      </div>
      <div class="ft-file">
        <span class="ft-name">渴求 (Craving)</span>
        <span class="ft-desc">让它有吸引力</span>
      </div>
    </div>
  </div>
  <div class="ft-folder">
    <span class="ft-name">第二篇：习惯的改变</span>
    <span class="ft-desc">如何打破坏习惯</span>
  </div>
</div>
```

```css
.file-tree { font-family: var(--font-body); font-size: var(--text-sm); }
.ft-folder, .ft-file {
  padding: var(--space-2) var(--space-3);
  border-left: 2px solid var(--color-border-light);
  margin-left: var(--space-4);
}
.ft-folder > .ft-name { color: var(--color-accent); font-weight: 600; }
.ft-folder > .ft-name::before { content: '📖 '; }
.ft-file > .ft-name::before { content: '🔖 '; }
.ft-desc {
  color: var(--color-text-secondary);
  font-family: var(--font-body);
  margin-left: var(--space-2);
  font-size: var(--text-xs);
}
.ft-children { margin-left: var(--space-4); }
```

---

## 16. 核心要素列举行

用于视觉化地列举书中的核心要素、人物关系或对比项。取代枯燥的无序列表。

```html
<div class="icon-rows">
  <div class="icon-row">
    <div class="icon-circle" style="background: var(--color-actor-1)">🦊</div>
    <div>
      <strong>狐狸型人格</strong>
      <p>知道很多事情，思维灵活，善于根据新信息调整预测。</p>
    </div>
  </div>
  <div class="icon-row">
    <div class="icon-circle" style="background: var(--color-actor-2)">🦔</div>
    <div>
      <strong>刺猬型人格</strong>
      <p>只知道一件大事，用一个宏大的理论解释世界上所有的现象。</p>
    </div>
  </div>
</div>
```

```css
.icon-rows { display: flex; flex-direction: column; gap: var(--space-4); }
.icon-row {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
.icon-row p { margin: 0; color: var(--color-text-secondary); font-size: var(--text-sm); }
.icon-circle {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.25rem; flex-shrink: 0;
}
```

---

## 17. 行动指南步骤卡片

用于将书中的理论转化为具体的、可执行的行动步骤。视觉化、易于扫描，且每个步骤独立成块。

```html
<div class="step-cards">
  <div class="step-card">
    <div class="step-num">1</div>
    <div class="step-body">
      <strong>清空大脑 (Capture)</strong>
      <p>将所有待办事项、想法和任务写下来，移出你的大脑，放入收件箱。</p>
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">2</div>
    <div class="step-body">
      <strong>理清头绪 (Clarify)</strong>
      <p>判断这些事项是否可以付诸行动。如果不行，丢弃或归档；如果可以，决定下一步行动。</p>
    </div>
  </div>
</div>
```

```css
.step-cards { display: flex; flex-direction: column; gap: var(--space-3); }
.step-card {
  display: flex; align-items: flex-start; gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-accent);
  box-shadow: var(--shadow-sm);
}
.step-num {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent);
  color: white; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  flex-shrink: 0;
}
.step-body p { margin: var(--space-1) 0 0; color: var(--color-text-secondary); font-size: var(--text-sm); }
```
