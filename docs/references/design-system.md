# 设计系统参考指南

本指南提供了书籍转课程的完整 CSS 设计令牌（Design Tokens）。请将整个 `:root` 块复制到课程 HTML 中，并可根据书籍的基调（如：严肃历史、轻松商业、科幻小说）调整强调色。

## 目录
1. [色彩调色板](#1-色彩调色板)
2. [字体排版](#2-字体排版)
3. [间距与布局](#3-间距与布局)
4. [阴影与深度](#4-阴影与深度)
5. [动画与过渡](#5-动画与过渡)
6. [导航与进度](#6-导航与进度)
7. [模块结构](#7-模块结构)
8. [响应式断点](#8-响应式断点)
9. [滚动条与背景](#9-滚动条与背景)
10. [原著引用全局样式](#10-原著引用全局样式)
11. [文本批注与高亮系统](#11-文本批注与高亮系统)

---

## 1. 色彩调色板

```css
:root {
  /* --- 背景色 (BACKGROUNDS) --- 
     模拟高级纸张的质感，避免刺眼的纯白 */
  --color-bg:             #FAF7F2;       /* 温暖的灰白色，如陈年羊皮纸 */
  --color-bg-warm:        #F5F0E8;       /* 略暖的色调，用于交替模块产生节奏感 */
  --color-bg-quote:       #2A2520;       /* 深墨色/深炭灰，用于原著引用区块，让人专注 */
  --color-text:           #2C2A28;       /* 深炭灰正文，保护视力 */
  --color-text-secondary: #6B6560;       /* 暖灰色，用于次要文本 */
  --color-text-muted:     #9E9790;       /* 柔和色，用于标签、注释 */
  --color-border:         #E5DFD6;       /* 柔和的暖色边框 */
  --color-border-light:   #EEEBE5;       /* 更浅的边框 */
  --color-surface:        #FFFFFF;       /* 卡片表面色 */
  --color-surface-warm:   #FDF9F3;       /* 温暖的卡片表面色 */

  /* --- 强调色 (ACCENT) ---
     根据书籍气质选择一种自信的颜色。
     默认：朱红色（像批注用的红笔）。替换方案：珊瑚色 (#E06B56)、青色 (#2A7B9B) */
  --color-accent:         #D94F30;
  --color-accent-hover:   #C4432A;
  --color-accent-light:   #FDEEE9;
  --color-accent-muted:   #E8836C;

  /* --- 语义色 (SEMANTIC) --- */
  --color-success:        #2D8B55;
  --color-success-light:  #E8F5EE;
  --color-error:          #C93B3B;
  --color-error-light:    #FDE8E8;
  --color-info:           #2A7B9B;
  --color-info-light:     #E4F2F7;

  /* --- 概念/角色专属色 (CONCEPT/ACTOR COLORS) ---
     为书中的主要流派、核心概念或关键人物分配专属颜色，
     用于群聊动画、逻辑图和卡片高亮 */
  --color-actor-1:        #D94F30;       /* 朱红 */
  --color-actor-2:        #2A7B9B;       /* 蓝绿 */
  --color-actor-3:        #7B6DAA;       /* 柔紫 */
  --color-actor-4:        #D4A843;       /* 麦金 */
  --color-actor-5:        #2D8B55;       /* 森林绿 */
}
```

**规则:**
- 偶数模块使用 `--color-bg`，奇数模块使用 `--color-bg-warm`（交替背景创造视觉节奏）。
- 概念/角色颜色应在视觉上相互区分，并与主强调色区分开来。
- 原著引用区块始终使用 `--color-bg-quote` 搭配浅色文字，营造“沉浸式阅读”的焦点。

---

## 2. 字体排版

```css
:root {
  /* --- 字体族 (FONTS) ---
     Display (展示/引用): 经典衬线体，带有文学和权威感。
     Body (正文/解析): 干净易读的无衬线体，适合现代屏幕阅读。
     Mono (等宽): 用于标签、徽章或特定术语。 */
  --font-display:  'Merriweather', 'Noto Serif SC', 'Songti SC', serif;
  --font-body:     'DM Sans', 'Inter', 'Noto Sans SC', -apple-system, sans-serif;
  --font-mono:     'JetBrains Mono', 'Fira Code', monospace;

  /* --- 字号缩放比例 (TYPE SCALE - 1.25 ratio) --- */
  --text-xs:   0.75rem;    /* 12px — 标签、徽章 */
  --text-sm:   0.875rem;   /* 14px — 次要文本、辅助说明 */
  --text-base: 1rem;       /* 16px — 正文解析 */
  --text-lg:   1.125rem;   /* 18px — 原著引用、引导段落 */
  --text-xl:   1.25rem;    /* 20px — 屏幕内小标题 */
  --text-2xl:  1.5rem;     /* 24px — 子模块标题 */
  --text-3xl:  1.875rem;   /* 30px — 模块副标题 */
  --text-4xl:  2.25rem;    /* 36px — 模块主标题 */
  --text-5xl:  3rem;       /* 48px — 英雄区大字 */
  --text-6xl:  3.75rem;    /* 60px — 模块巨大编号 */

  /* --- 行高 (LINE HEIGHTS) --- */
  --leading-tight:  1.15;  /* 标题 */
  --leading-snug:   1.3;   /* 副标题 */
  --leading-normal: 1.6;   /* 正文解析 */
  --leading-loose:  1.8;   /* 原著引用（需要更宽松的呼吸感） */
}
```

**Google Fonts 链接 (放入 `<head>` 中):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Merriweather:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
```

**规则:**
- 模块编号: `--text-6xl`, font-display, 字重 800, `--color-accent` 配合 15% 透明度。
- 模块标题: `--text-4xl`, font-display, 字重 700。
- 屏幕内小标题: `--text-xl` 或 `--text-2xl`, font-display, 字重 700。
- 正文解析: `--text-base`, font-body, `--leading-normal`。
- 原著引用: `--text-lg`, font-display, `--leading-loose`。

---

## 3. 间距与布局

```css
:root {
  --space-1:  0.25rem;   /* 4px */
  --space-2:  0.5rem;    /* 8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */

  --content-width:     800px;   /* 标准阅读宽度，防止视线疲劳 */
  --content-width-wide: 1000px; /* 用于左右对照布局 */
  --nav-height:        50px;
  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-full: 9999px;
}
```

**模块布局 CSS:**
```css
.module {
  min-height: 100dvh;       /* 回退方案: 100vh */
  scroll-snap-align: start;
  padding: var(--space-16) var(--space-6);
  padding-top: calc(var(--nav-height) + var(--space-12));
}
.module-content {
  max-width: var(--content-width);
  margin: 0 auto;
}
```

---

## 4. 阴影与深度

```css
:root {
  --shadow-sm:  0 1px 2px rgba(44, 42, 40, 0.05);
  --shadow-md:  0 4px 12px rgba(44, 42, 40, 0.08);
  --shadow-lg:  0 8px 24px rgba(44, 42, 40, 0.1);
  --shadow-xl:  0 16px 48px rgba(44, 42, 40, 0.12);
}
```

使用带有暖色调的 RGBA (44, 42, 40) — 永远不要使用纯黑色的阴影，以保持纸张般的温润感。

---

## 5. 动画与过渡

```css
:root {
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast:   150ms;
  --duration-normal: 300ms;
  --duration-slow:   500ms;
  --stagger-delay:   120ms;
}
```

**滚动触发的揭示动画模式:**
```css
.animate-in {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}
.animate-in.visible {
  opacity: 1;
  transform: translateY(0);
}

/* 子元素交错动画 */
.stagger-children > .animate-in {
  transition-delay: calc(var(--stagger-index, 0) * var(--stagger-delay));
}
```

**JS 交错动画设置:**
```javascript
document.querySelectorAll('.stagger-children').forEach(parent => {
  Array.from(parent.children).forEach((child, i) => {
    child.style.setProperty('--stagger-index', i);
  });
});
```

**Intersection Observer (触发动画):**
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // 仅动画一次
    }
  });
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));
```

---

## 6. 导航与进度

**HTML 结构:**
```html
<nav class="nav">
  <div class="progress-bar" role="progressbar" aria-valuenow="0"></div>
  <div class="nav-inner">
    <span class="nav-title">《书名》深度解析</span>
    <div class="nav-dots">
      <button class="nav-dot" data-target="module-1" data-tooltip="第一章：核心概念"
              role="tab" aria-label="Module 1"></button>
      <!-- 每个模块一个 dot -->
    </div>
  </div>
</nav>
```

**进度条 JS:**
```javascript
const progressBar = document.querySelector('.progress-bar');
function updateProgressBar() {
  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = (scrollTop / scrollHeight) * 100;
  progressBar.style.width = progress + '%';
}
window.addEventListener('scroll', () => {
  requestAnimationFrame(updateProgressBar);
}, { passive: true });
```

**键盘导航 (方便沉浸式阅读):**
```javascript
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { nextModule(); e.preventDefault(); }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { prevModule(); e.preventDefault(); }
});
```

---

## 7. 模块结构

**每个模块的 HTML 模板:**
```html
<section class="module" id="module-N" style="background: var(--color-bg or --color-bg-warm)">
  <div class="module-content">
    <header class="module-header animate-in">
      <span class="module-number">0N</span>
      <h1 class="module-title">模块主标题 (如：系统1与系统2)</h1>
      <p class="module-subtitle">一句话描述本模块拆解的书籍核心逻辑</p>
    </header>

    <div class="module-body">
      <section class="screen animate-in">
        <h2 class="screen-heading">屏幕内小标题</h2>
        <p>正文解析内容...</p>
        <!-- 交互元素、原著翻译区块等 -->
      </section>

      <section class="screen animate-in">
        <!-- 下一个屏幕内容 -->
      </section>
    </div>
  </div>
</section>
```

---

## 8. 响应式断点

```css
/* 平板 (Tablet) */
@media (max-width: 768px) {
  :root {
    --text-4xl: 1.875rem;
    --text-5xl: 2.25rem;
    --text-6xl: 3rem;
  }
  .translation-block { grid-template-columns: 1fr; } /* 原著与解析垂直堆叠 */
  .pattern-cards { grid-template-columns: 1fr 1fr; }
}

/* 手机 (Mobile) */
@media (max-width: 480px) {
  :root {
    --text-4xl: 1.5rem;
    --text-5xl: 1.875rem;
    --text-6xl: 2.25rem;
  }
  .module { padding: var(--space-8) var(--space-4); }
  .pattern-cards { grid-template-columns: 1fr; }
  .flow-steps { flex-direction: column; }
  .flow-arrow { transform: rotate(90deg); }
}
```

---

## 9. 滚动条与背景

```css
/* 自定义滚动条，保持优雅 */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}

/* 微妙的氛围背景，模拟纸张的质感 */
body {
  background: var(--color-bg);
  background-image: radial-gradient(
    ellipse at 20% 50%,
    rgba(217, 79, 48, 0.02) 0%, /* 使用极其微弱的强调色晕染 */
    transparent 50%
  );
}

/* 页面滚动设置 */
html {
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}
```

---

## 10. 原著引用全局样式

课程中所有的原著引用区块——无论是位于左右对照翻译块中，还是独立的金句展示——都必须自动换行，**绝对不允许出现水平滚动条**。这是为了保证极致的阅读体验。

```css
blockquote, .book-quote p {
  white-space: pre-wrap;       /* 允许长文本自然换行 */
  word-break: break-word;      /* 极端情况下允许单词内换行 */
  overflow-x: hidden;          /* 永远不显示水平滚动条 */
  margin: 0;
}
/* 隐藏引用容器的滚动条 */
.translation-quote::-webkit-scrollbar {
  display: none;
}
```

引用的文本必须是**一字不差的原文**——永远不要修改、删减或简化作者的文字。相反，你应该从书中挑选出自然简短（3-5句）、最能说明核心概念的段落。

---

## 11. 文本批注与高亮系统

取代了原有的“代码语法高亮”。在深色的 `--color-bg-quote` 背景上，模拟读者使用不同颜色的荧光笔在书上做批注的效果。这能极大地帮助非技术读者抓住长段落中的重点。

**HTML 使用示例:**
```html
<p class="quote-line">"The <span class="quote-keyword">Black Swan</span> logic makes what you don't know <span class="quote-emphasis">far more relevant</span> than what you do know."</p>
```

**CSS:**
```css
/* 核心术语 (Keyword) - 柔和的紫色，代表专业概念 */
.quote-keyword  { 
  color: #CBA6F7; 
  font-weight: 700;
}  

/* 作者强调 (Emphasis) - 荧光黄/金色，模拟黄色高亮笔 */
.quote-emphasis { 
  color: #F9E2AF; 
  background: rgba(249, 226, 175, 0.15);
  padding: 0 4px;
  border-radius: 2px;
}  

/* 精妙比喻 (Metaphor) - 柔和的绿色，代表生动的意象 */
.quote-metaphor { 
  color: #A6E3A1; 
  font-style: italic;
}  

/* 关键数据/事实 (Data/Fact) - 桃红色，代表客观证据 */
.quote-data { 
  color: #FAB387; 
}  

/* 被驳斥的旧观点 (Debunked) - 带有删除线和暗灰色，代表作者反对的观点 */
.quote-debunked { 
  color: #6C7086; 
  text-decoration: line-through;
}

/* 强烈的警告/危险 (Warning) - 粉红色 */
.quote-warning { 
  color: #F38BA8; 
}  
```
