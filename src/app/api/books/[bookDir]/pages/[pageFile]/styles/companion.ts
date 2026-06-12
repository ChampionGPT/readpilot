// input: 无
// output: 三套 companion 页主题 CSS（Modern / Magazine / Classic-Companion）
// pos: page route handler 拼装时按 theme 选择注入 — 仅在非 epub-chapter 路径使用
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

/** Modern 主题：读书笔记风格 — 单栏收窄、大行高、引用突出 */
export const MODERN_CSS = `
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap" rel="stylesheet" />
<style>
  /* Modern: Reading-Notes Style */
  body.theme-modern {
    background: #FAFAFA !important;
    background-image: none !important;
  }

  .theme-modern .module-content {
    max-width: 680px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .theme-modern .section-inner,
  .theme-modern .hero-inner,
  .theme-modern .footer-inner {
    max-width: 720px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .theme-modern .module {
    min-height: auto !important;
    padding-top: 2rem !important;
    padding-bottom: 2rem !important;
    background: transparent !important;
    scroll-snap-align: none !important;
  }

  /* 首个 module 需要额外 top padding 留给 nav */
  .theme-modern .module:first-of-type {
    padding-top: calc(var(--nav-height, 50px) + 3rem) !important;
  }

  .theme-modern p,
  .theme-modern .screen {
    line-height: 2.0 !important;
    font-size: 1.05rem !important;
  }

  .theme-modern .module-title {
    font-family: 'Playfair Display', var(--font-display, serif) !important;
    font-size: 1.75rem !important;
    border-bottom: 2px solid #E5DFD6;
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem !important;
  }

  .theme-modern .module-number {
    font-size: 2rem !important;
    opacity: 0.1 !important;
  }

  .theme-modern .callout {
    border-radius: 4px !important;
    border-left-width: 4px !important;
    background: #FFF8F6 !important;
    margin: 1.5em 0 !important;
  }

  .theme-modern .callout-accent {
    border-left-color: #D94F30 !important;
  }

  .theme-modern .translation-block {
    grid-template-columns: 1fr !important;
    border-radius: 4px !important;
    box-shadow: none !important;
    border: 1px solid #E5DFD6 !important;
  }

  .theme-modern .translation-quote {
    background: #2A2520 !important;
    border-radius: 4px 4px 0 0 !important;
    font-size: 0.95rem !important;
    line-height: 1.9 !important;
  }

  .theme-modern .translation-english {
    border-left: none !important;
    border-top: 3px solid #D94F30 !important;
    line-height: 1.9 !important;
  }

  .theme-modern .icon-row {
    box-shadow: none !important;
    border: 1px solid #E5DFD6 !important;
    border-radius: 6px !important;
  }

  .theme-modern .icon-row:hover {
    transform: none !important;
  }

  /* 段落间距加大 */
  .theme-modern .screen {
    margin-bottom: 2rem !important;
  }

  .theme-modern .hero-number {
    display: none !important;
  }

  .theme-modern .hero h1 {
    font-family: 'Playfair Display', serif !important;
    font-size: 2.5rem !important;
  }

  .theme-modern .hero .hook {
    font-size: 1.1rem !important;
    color: #6B6560 !important;
    font-style: italic !important;
  }

  .theme-modern .badge {
    background: #F5F0E8 !important;
    color: #6B6560 !important;
  }

  /* Quiz 去掉花哨效果 */
  .theme-modern .quiz-question-block {
    box-shadow: none !important;
    border: 1px solid #E5DFD6 !important;
  }

  .theme-modern .step-card {
    box-shadow: none !important;
    border: 1px solid #E5DFD6 !important;
    border-left: 3px solid #D94F30 !important;
  }

  .theme-modern .cta-section {
    border-radius: 4px !important;
  }

  /* Nav 简化 */
  .theme-modern .nav {
    border-bottom: 1px solid #E5DFD6 !important;
    background: rgba(250,250,250,0.95) !important;
  }
</style>
`;

/** Magazine 主题：杂志风格 — 双栏、首字下沉、分节线 */
export const MAGAZINE_CSS = `
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap" rel="stylesheet" />
<style>
  /* Magazine: Editorial Layout */
  body.theme-magazine {
    background: #FFFFFF !important;
    background-image: none !important;
  }

  .theme-magazine .module {
    min-height: auto !important;
    scroll-snap-align: none !important;
    padding: 3rem 2rem !important;
    border-bottom: 1px solid #E5DFD6;
  }

  .theme-magazine .module:first-of-type {
    padding-top: calc(var(--nav-height, 50px) + 4rem) !important;
  }

  .theme-magazine .module-content {
    max-width: 960px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  /* Hero 杂志封面风格 */
  .theme-magazine .hero h1 {
    font-family: 'Playfair Display', serif !important;
    font-size: 3.5rem !important;
    letter-spacing: -0.02em !important;
    line-height: 1.1 !important;
  }

  .theme-magazine .hero-number {
    font-family: 'Playfair Display', serif !important;
    font-size: 8rem !important;
    opacity: 0.06 !important;
  }

  .theme-magazine .hero .author {
    font-family: 'Playfair Display', serif !important;
    text-transform: uppercase !important;
    letter-spacing: 0.15em !important;
    font-size: 0.9rem !important;
    font-style: normal !important;
  }

  /* 双栏排版 */
  .theme-magazine .screen {
    column-count: 1 !important;
    column-gap: normal !important;
    column-rule: none !important;
    max-width: 760px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  @media (max-width: 768px) {
    .theme-magazine .screen {
      column-count: 1 !important;
    }
  }

  .theme-magazine .section-inner,
  .theme-magazine .hero-inner,
  .theme-magazine .footer-inner {
    max-width: 760px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .theme-magazine .section-inner > p,
  .theme-magazine .footer-inner > p,
  .theme-magazine .screen > p {
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  /* 首字下沉 */
  .theme-magazine .screen > p:first-of-type::first-letter {
    float: left;
    font-family: 'Playfair Display', serif;
    font-size: 4.5rem;
    line-height: 1;
    padding-right: 0.5rem;
    padding-top: 0.15rem;
    color: #D94F30;
    font-weight: 900;
  }

  .theme-magazine p {
    text-align: justify !important;
    hyphens: auto !important;
    line-height: 1.75 !important;
  }

  /* 模块标题：杂志 section header */
  .theme-magazine .module-header {
    margin-bottom: 2rem !important;
    padding-bottom: 1rem !important;
    border-bottom: 3px double #2C2A28 !important;
  }

  .theme-magazine .module-number {
    font-family: 'Playfair Display', serif !important;
    font-size: 4rem !important;
    opacity: 0.08 !important;
    line-height: 0.8 !important;
  }

  .theme-magazine .module-title {
    font-family: 'Playfair Display', serif !important;
    font-size: 2.2rem !important;
    text-transform: none !important;
  }

  .theme-magazine .module-subtitle {
    font-style: italic !important;
    font-family: 'Playfair Display', serif !important;
  }

  /* Callout = Pull Quote 风格 */
  .theme-magazine .callout {
    break-inside: avoid;
    border-left: none !important;
    border-top: 3px solid #D94F30 !important;
    border-bottom: 3px solid #D94F30 !important;
    background: transparent !important;
    padding: 1.5rem 0 !important;
    margin: 2rem 0 !important;
    text-align: center !important;
  }

  .theme-magazine .callout-icon {
    display: none !important;
  }

  .theme-magazine .callout-title {
    font-family: 'Playfair Display', serif !important;
    font-size: 1.1rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
  }

  /* Translation block 保持单栏（column-span: all 会 break multi-col） */
  .theme-magazine .translation-block {
    column-span: all;
    break-inside: avoid;
  }

  /* Icon rows 横向布局 */
  .theme-magazine .icon-rows {
    column-span: all;
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 1rem !important;
  }

  @media (max-width: 768px) {
    .theme-magazine .icon-rows {
      grid-template-columns: 1fr !important;
    }
  }

  .theme-magazine .icon-row {
    border-radius: 4px !important;
  }

  /* 文件树横跨双栏 */
  .theme-magazine .file-tree {
    column-span: all;
  }

  /* Quiz 横跨双栏 */
  .theme-magazine .quiz-container {
    column-span: all;
  }

  .theme-magazine .step-cards {
    column-span: all;
  }

  .theme-magazine .cta-section {
    column-span: all;
  }

  /* Badge 风格调整 */
  .theme-magazine .badge {
    background: #2A2520 !important;
    color: #FFFFFF !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
  }

  /* Nav 杂志风 */
  .theme-magazine .nav {
    background: rgba(255,255,255,0.95) !important;
    border-bottom: 2px solid #2C2A28 !important;
  }

  .theme-magazine .nav-badge {
    background: #2A2520 !important;
    color: #FFFFFF !important;
  }
</style>
`;

/** Classic 主题：companion 页（米色 + 衬线 + § 章节符） */
export const CLASSIC_COMPANION_CSS = `
<style>
  body.companion-page,
  body:not(.epub-chapter):not(.theme-modern):not(.theme-magazine) {
    background: var(--bg) !important;
    background-image: none !important;
  }
  /* 只钳制内容容器并居中；绝不钳制 section 级 .module-wide（否则整块被压窄且无 margin:auto 会贴左、背景断裂） */
  body .module-content { max-width: var(--max-width) !important; margin-left: auto !important; margin-right: auto !important; }
  body .section-inner,
  body .hero-inner,
  body .footer-inner { max-width: var(--max-width) !important; margin-left: auto !important; margin-right: auto !important; }
  body .module-title,
  body .hero h1 {
    font-family: var(--font-display) !important;
  }
  body .module-title::before {
    content: '§'; color: var(--accent); margin-right: 0.4rem; opacity: 0.7;
  }
  body .callout {
    background: #FBF6EE !important;
    border-left-color: var(--accent) !important;
  }
</style>
`;
