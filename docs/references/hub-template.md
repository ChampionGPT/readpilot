# Hub 页面模板 (index.html)

阅读仪表盘的完整 HTML/CSS/JS 模板。每次生成新页面后，必须更新此文件。

## 数据注入方式

progress.json 的完整内容通过 `<script>` 标签嵌入为 JS 变量：

```javascript
const PROGRESS_DATA = {
  // progress.json 的完整内容粘贴在此
};
```

Hub 页面的所有内容（页面卡片、进度、时间线）都从 `PROGRESS_DATA` 动态渲染。

## 完整 HTML 模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>阅读仪表盘 — {{书名}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">

  <style>
    /* ====== Design Tokens (from design-system.md) ====== */
    :root {
      --color-bg: #FAF7F2;
      --color-bg-warm: #F5F0E8;
      --color-bg-quote: #2A2520;
      --color-text: #2C2A28;
      --color-text-secondary: #6B6560;
      --color-text-muted: #9E9790;
      --color-border: #E5DFD6;
      --color-border-light: #EEEBE5;
      --color-surface: #FFFFFF;
      --color-surface-warm: #FDF9F3;
      --color-accent: #D94F30;
      --color-accent-hover: #C4432A;
      --color-accent-light: #FDEEE9;
      --color-accent-muted: #E8836C;
      --color-success: #2D8B55;
      --color-success-light: #E8F5EE;
      --color-info: #2A7B9B;
      --color-info-light: #E4F2F7;

      --font-display: 'Merriweather', 'Noto Serif SC', serif;
      --font-body: 'DM Sans', 'Noto Sans SC', -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;

      --text-xs: 0.75rem;
      --text-sm: 0.875rem;
      --text-base: 1rem;
      --text-lg: 1.125rem;
      --text-xl: 1.25rem;
      --text-2xl: 1.5rem;
      --text-3xl: 1.875rem;
      --text-4xl: 2.25rem;
      --text-5xl: 3rem;

      --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
      --space-4: 1rem; --space-5: 1.25rem; --space-6: 1.5rem;
      --space-8: 2rem; --space-10: 2.5rem; --space-12: 3rem;
      --space-16: 4rem; --space-20: 5rem;

      --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-full: 9999px;
      --shadow-sm: 0 1px 2px rgba(44,42,40,0.05);
      --shadow-md: 0 4px 12px rgba(44,42,40,0.08);
      --shadow-lg: 0 8px 24px rgba(44,42,40,0.1);

      --ease-out: cubic-bezier(0.16,1,0.3,1);
      --duration-normal: 300ms;
      --duration-slow: 500ms;
      --stagger-delay: 80ms;
    }

    /* ====== Global Reset ====== */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-body);
      color: var(--color-text);
      background: var(--color-bg);
      background-image: radial-gradient(ellipse at 20% 50%, rgba(217,79,48,0.02) 0%, transparent 50%);
      line-height: 1.6;
      min-height: 100vh;
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: var(--radius-full); }

    /* ====== Header / Book Info ====== */
    .hub-header {
      text-align: center;
      padding: var(--space-16) var(--space-6) var(--space-12);
      max-width: 700px;
      margin: 0 auto;
    }
    .hub-header .book-genre {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-accent);
      margin-bottom: var(--space-3);
    }
    .hub-header h1 {
      font-family: var(--font-display);
      font-size: var(--text-4xl);
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: var(--space-2);
    }
    .hub-header .book-author {
      font-size: var(--text-lg);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-6);
    }
    .hub-header .book-meta {
      display: flex;
      justify-content: center;
      gap: var(--space-6);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .book-meta span { display: flex; align-items: center; gap: var(--space-1); }

    /* ====== Progress Overview ====== */
    .progress-section {
      max-width: 700px;
      margin: 0 auto var(--space-12);
      padding: 0 var(--space-6);
    }
    .progress-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: var(--space-8);
      box-shadow: var(--shadow-md);
      display: flex;
      align-items: center;
      gap: var(--space-8);
    }
    .progress-ring-container {
      position: relative;
      width: 120px;
      height: 120px;
      flex-shrink: 0;
    }
    .progress-ring {
      transform: rotate(-90deg);
      width: 120px;
      height: 120px;
    }
    .progress-ring-bg {
      fill: none;
      stroke: var(--color-border-light);
      stroke-width: 8;
    }
    .progress-ring-fill {
      fill: none;
      stroke: var(--color-accent);
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s var(--ease-out);
    }
    .progress-percent {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--color-accent);
    }
    .progress-stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .progress-stat {
      display: flex;
      flex-direction: column;
    }
    .progress-stat-value {
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.2;
    }
    .progress-stat-label {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* ====== Page Cards Grid ====== */
    .pages-section {
      max-width: 900px;
      margin: 0 auto var(--space-12);
      padding: 0 var(--space-6);
    }
    .section-title {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: 700;
      margin-bottom: var(--space-6);
    }
    .pages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--space-4);
    }
    .page-card {
      background: var(--color-surface);
      border-radius: var(--radius-md);
      padding: var(--space-5);
      box-shadow: var(--shadow-sm);
      border-left: 4px solid var(--color-border);
      transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal);
      text-decoration: none;
      color: inherit;
      display: block;
      cursor: pointer;
    }
    .page-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }
    .page-card[data-type="overview"] { border-left-color: var(--color-accent); }
    .page-card[data-type="chapter"] { border-left-color: var(--color-info); }
    .page-card[data-type="deepdive"] { border-left-color: #7B6DAA; }
    .page-card[data-type="theme"] { border-left-color: #D4A843; }
    .page-card[data-type="synthesis"] { border-left-color: var(--color-success); }

    .page-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .page-type-badge {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--color-bg-warm);
      color: var(--color-text-secondary);
    }
    .page-status {
      margin-left: auto;
      font-size: var(--text-xs);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page-status.completed { color: var(--color-success); }
    .page-status.in-progress { color: var(--color-accent); }
    .page-status.new { color: var(--color-info); }

    .page-card h3 {
      font-size: var(--text-base);
      font-weight: 600;
      margin-bottom: var(--space-2);
      line-height: 1.4;
    }
    .page-card p {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.5;
    }
    .page-card .mastery-bar {
      margin-top: var(--space-3);
      height: 4px;
      background: var(--color-border-light);
      border-radius: 2px;
      overflow: hidden;
    }
    .mastery-bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.8s var(--ease-out);
    }

    /* ====== Reading Timeline ====== */
    .timeline-section {
      max-width: 700px;
      margin: 0 auto var(--space-16);
      padding: 0 var(--space-6);
    }
    .timeline {
      position: relative;
      padding-left: var(--space-8);
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--color-border);
    }
    .timeline-item {
      position: relative;
      padding-bottom: var(--space-6);
    }
    .timeline-dot {
      position: absolute;
      left: calc(-1 * var(--space-8) + 4px);
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-accent);
      border: 2px solid var(--color-bg);
    }
    .timeline-date {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-bottom: var(--space-1);
    }
    .timeline-content {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    /* ====== Next Step Recommendation ====== */
    .next-step-section {
      max-width: 700px;
      margin: 0 auto var(--space-16);
      padding: 0 var(--space-6);
    }
    .next-step-card {
      background: var(--color-bg-quote);
      color: #EAE4D9;
      border-radius: var(--radius-lg);
      padding: var(--space-8);
      text-align: center;
    }
    .next-step-card h3 {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      margin-bottom: var(--space-3);
      color: #F5F0E8;
    }
    .next-step-card p {
      font-size: var(--text-sm);
      opacity: 0.8;
      margin-bottom: var(--space-6);
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
    .next-step-hint {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      padding: var(--space-3) var(--space-5);
      background: rgba(255,255,255,0.08);
      border-radius: var(--radius-sm);
      display: inline-block;
      color: var(--color-accent-muted);
    }

    /* ====== Footer ====== */
    .hub-footer {
      text-align: center;
      padding: var(--space-8) var(--space-6);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      border-top: 1px solid var(--color-border-light);
    }

    /* ====== Animation ====== */
    .animate-in {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out);
    }
    .animate-in.visible { opacity: 1; transform: translateY(0); }
    .stagger-children > * {
      opacity: 0;
      transform: translateY(12px);
      transition: opacity var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out);
    }
    .stagger-children > .visible { opacity: 1; transform: translateY(0); }

    /* ====== Responsive ====== */
    @media (max-width: 768px) {
      .hub-header h1 { font-size: var(--text-3xl); }
      .progress-card { flex-direction: column; text-align: center; }
      .progress-stats { flex-direction: row; gap: var(--space-6); }
      .pages-grid { grid-template-columns: 1fr; }
      .book-meta { flex-wrap: wrap; justify-content: center; }
    }
    @media (max-width: 480px) {
      .hub-header { padding: var(--space-10) var(--space-4) var(--space-8); }
      .hub-header h1 { font-size: var(--text-2xl); }
    }
  </style>
</head>
<body>

  <!-- ====== HEADER ====== -->
  <header class="hub-header animate-in">
    <div class="book-genre" id="book-genre"></div>
    <h1 id="book-title"></h1>
    <p class="book-author" id="book-author"></p>
    <div class="book-meta" id="book-meta"></div>
  </header>

  <!-- ====== PROGRESS ====== -->
  <section class="progress-section animate-in">
    <div class="progress-card">
      <div class="progress-ring-container">
        <svg class="progress-ring" viewBox="0 0 120 120">
          <circle class="progress-ring-bg" cx="60" cy="60" r="52"></circle>
          <circle class="progress-ring-fill" cx="60" cy="60" r="52"
                  stroke-dasharray="326.73" stroke-dashoffset="326.73" id="progress-fill"></circle>
        </svg>
        <span class="progress-percent" id="progress-percent">0%</span>
      </div>
      <div class="progress-stats" id="progress-stats"></div>
    </div>
  </section>

  <!-- ====== PAGE CARDS ====== -->
  <section class="pages-section animate-in">
    <h2 class="section-title">阅读旅程</h2>
    <div class="pages-grid stagger-children" id="pages-grid"></div>
  </section>

  <!-- ====== TIMELINE ====== -->
  <section class="timeline-section animate-in">
    <h2 class="section-title">阅读记录</h2>
    <div class="timeline" id="timeline"></div>
  </section>

  <!-- ====== NEXT STEP ====== -->
  <section class="next-step-section animate-in" id="next-step-section">
    <div class="next-step-card">
      <h3 id="next-step-title">下一步</h3>
      <p id="next-step-desc"></p>
      <div class="next-step-hint" id="next-step-hint"></div>
    </div>
  </section>

  <!-- ====== FOOTER ====== -->
  <footer class="hub-footer">
    <p>Reading Companion — 伴随式阅读引擎 · 由 AI 生成</p>
  </footer>

  <script>
    // ====== DATA INJECTION POINT ======
    // 将 progress.json 内容嵌入此处
    const PROGRESS_DATA = {{PROGRESS_JSON}};

    // ====== TYPE LABELS & COLORS ======
    const TYPE_MAP = {
      overview: { label: '透视', color: '#D94F30' },
      chapter: { label: '伴读', color: '#2A7B9B' },
      deepdive: { label: '深入', color: '#7B6DAA' },
      theme: { label: '主题', color: '#D4A843' },
      synthesis: { label: '综合', color: '#2D8B55' }
    };

    const STATUS_MAP = {
      completed: { label: '已完成', icon: '✓' },
      'in-progress': { label: '进行中', icon: '◉' },
      new: { label: '新', icon: '★' }
    };

    // ====== RENDER HEADER ======
    function renderHeader() {
      const { book } = PROGRESS_DATA;
      document.getElementById('book-genre').textContent = book.genre || '文学';
      document.getElementById('book-title').textContent = `《${book.title}》`;
      document.getElementById('book-author').textContent = book.author;
      document.title = `阅读仪表盘 — 《${book.title}》`;

      const daysReading = Math.max(1, Math.ceil((Date.now() - new Date(book.startDate).getTime()) / 86400000));
      document.getElementById('book-meta').innerHTML = `
        <span>📅 开始于 ${book.startDate}</span>
        <span>📖 已阅读 ${daysReading} 天</span>
        <span>📄 ${PROGRESS_DATA.pages.length} 个页面</span>
      `;
    }

    // ====== RENDER PROGRESS ======
    function renderProgress() {
      const pages = PROGRESS_DATA.pages;
      const completed = pages.filter(p => p.status === 'completed').length;
      const total = pages.length || 1;
      const percent = Math.round((completed / total) * 100);

      // Ring
      const circumference = 2 * Math.PI * 52;
      const offset = circumference - (percent / 100) * circumference;
      const fill = document.getElementById('progress-fill');
      fill.style.strokeDasharray = circumference;
      setTimeout(() => { fill.style.strokeDashoffset = offset; }, 300);
      document.getElementById('progress-percent').textContent = percent + '%';

      // Stats
      const avgMastery = pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + (p.masteryScore || 0), 0) / pages.length)
        : 0;

      document.getElementById('progress-stats').innerHTML = `
        <div class="progress-stat">
          <span class="progress-stat-value">${completed} / ${total}</span>
          <span class="progress-stat-label">已完成页面</span>
        </div>
        <div class="progress-stat">
          <span class="progress-stat-value">${avgMastery}%</span>
          <span class="progress-stat-label">平均掌握度</span>
        </div>
      `;
    }

    // ====== RENDER PAGE CARDS ======
    function renderPages() {
      const grid = document.getElementById('pages-grid');
      grid.innerHTML = '';

      PROGRESS_DATA.pages.forEach((page, i) => {
        const type = TYPE_MAP[page.type] || TYPE_MAP.chapter;
        const status = STATUS_MAP[page.status] || STATUS_MAP.new;
        const masteryColor = (page.masteryScore || 0) >= 80 ? '#2D8B55'
                           : (page.masteryScore || 0) >= 50 ? '#D4A843' : '#C93B3B';

        const card = document.createElement('a');
        card.className = 'page-card';
        card.href = page.file;
        card.dataset.type = page.type;
        card.style.transitionDelay = (i * 80) + 'ms';

        card.innerHTML = `
          <div class="page-card-header">
            <span class="page-type-badge">${type.label}</span>
            <span class="page-status ${page.status}">${status.icon} ${status.label}</span>
          </div>
          <h3>${page.title}</h3>
          <p>${page.description || ''}</p>
          ${page.masteryScore != null ? `
            <div class="mastery-bar">
              <div class="mastery-bar-fill" style="width:${page.masteryScore}%; background:${masteryColor}"></div>
            </div>
          ` : ''}
        `;
        grid.appendChild(card);
      });
    }

    // ====== RENDER TIMELINE ======
    function renderTimeline() {
      const el = document.getElementById('timeline');
      el.innerHTML = '';
      const log = (PROGRESS_DATA.readingLog || []).slice().reverse();

      log.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
          <div class="timeline-dot"></div>
          <div class="timeline-date">${entry.date}</div>
          <div class="timeline-content">${entry.note || entry.action}</div>
        `;
        el.appendChild(item);
      });
    }

    // ====== RENDER NEXT STEP ======
    function renderNextStep() {
      const { nextRecommendation } = PROGRESS_DATA;
      if (!nextRecommendation) {
        document.getElementById('next-step-section').style.display = 'none';
        return;
      }
      document.getElementById('next-step-title').textContent = nextRecommendation.title || '下一步';
      document.getElementById('next-step-desc').textContent = nextRecommendation.description || '';
      document.getElementById('next-step-hint').textContent = nextRecommendation.hint || '回到对话中告诉你的阅读伴侣';
    }

    // ====== SCROLL ANIMATION ======
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Stagger children
          if (entry.target.classList.contains('stagger-children')) {
            Array.from(entry.target.children).forEach((child, i) => {
              setTimeout(() => child.classList.add('visible'), i * 80);
            });
          }
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.1 });

    document.querySelectorAll('.animate-in, .stagger-children').forEach(el => observer.observe(el));

    // ====== INIT ======
    renderHeader();
    renderProgress();
    renderPages();
    renderTimeline();
    renderNextStep();
  </script>
</body>
</html>
```

## 模板使用说明

生成 Hub 页面时：
1. 复制此模板
2. 将 `{{PROGRESS_JSON}}` 替换为 progress.json 的实际 JSON 内容
3. 确保所有页面卡片的 `href` 指向正确的相对路径（如 `pages/00_全书透视.html`）
4. 每次生成新的内容页后，必须更新此文件中嵌入的 PROGRESS_DATA

## 关键注意事项

- Hub 页面是**静态 HTML**，数据通过嵌入的 JS 变量驱动
- 每次新页面生成时，需要重新生成整个 index.html（更新嵌入数据）
- 页面卡片颜色由 `data-type` 属性控制，对应 CSS 中的类型配色
- 进度环形图使用 SVG stroke-dashoffset 动画
- 时间线按倒序排列（最新的在最前）
