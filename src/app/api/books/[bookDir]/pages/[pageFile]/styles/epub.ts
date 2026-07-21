// input: 无
// output: 三套 EPUB chapter 主题 CSS（Classic / Modern / Magazine）
// pos: page route handler 在判定为 epub-chapter 时按 theme 选择注入，搭配 BASE_CSS + *_VARS
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

/** EPUB 章节 classic 主题：连续单栏印刷书风（依赖 BASE_CSS + CLASSIC_VARS） */
export const CLASSIC_EPUB_CSS = `
<style>
  body.epub-chapter { padding: 64px 40px 80px; }
  body.epub-chapter .chapter { max-width: var(--max-width); margin: 0 auto; }
  body.epub-chapter .chapter-title {
    font-family: var(--font-display);
    font-size: 2rem; font-weight: 700; text-align: center;
    margin: 0 0 2.5rem 0;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--rule);
    letter-spacing: 0.02em;
  }
  body.epub-chapter .chapter-title::before { content: '§'; display: block; color: var(--accent); font-size: 1.4rem; opacity: 0.7; margin-bottom: 0.4rem; }
  body.epub-chapter .chapter-body p {
    margin: 0 0 1.05em 0; text-indent: 2em;
    font-size: var(--rp-font-size, 1.05rem);
    line-height: var(--line-height);
    text-align: justify;
  }
  body.epub-chapter .chapter-body p:has(img),
  body.epub-chapter .chapter-body p:has(svg) {
    text-indent: 0;
    text-align: center;
  }
  body.epub-chapter .chapter-body img {
    display: block;
    max-height: min(72vh, 900px);
    margin: 1.5rem auto;
    object-fit: contain;
  }
  body.epub-chapter .chapter-body p:first-of-type { text-indent: 0; }
  body.epub-chapter blockquote {
    margin: 1.8rem 0; padding: 0.2rem 0 0.2rem 1.2rem;
    border-left: 3px solid var(--accent); color: var(--text-secondary);
  }
</style>
`;

/** EPUB 章节 modern 主题：净底文档风（依赖 BASE_CSS + MODERN_VARS） */
export const MODERN_EPUB_CSS = `
<style>
  body.epub-chapter { padding: 48px 32px 72px; }
  body.epub-chapter .chapter { max-width: var(--max-width); margin: 0 auto; }
  body.epub-chapter .chapter-title {
    font-family: var(--font-display);
    font-size: 1.75rem; font-weight: 700;
    margin: 0 0 1.5rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--accent);
    letter-spacing: -0.01em;
  }
  body.epub-chapter .chapter-body p {
    margin: 0 0 1.5em 0;
    font-size: var(--rp-font-size, 17px);
    letter-spacing: 0.01em;
    line-height: var(--line-height);
  }
  body.epub-chapter .chapter-body p:has(img),
  body.epub-chapter .chapter-body p:has(svg) {
    text-align: center;
  }
  body.epub-chapter .chapter-body img {
    display: block;
    max-height: min(72vh, 900px);
    margin: 1.5rem auto;
    object-fit: contain;
  }
  body.epub-chapter .chapter-body h2,
  body.epub-chapter .chapter-body h3 {
    font-family: var(--font-display);
    margin: 2rem 0 1rem;
    line-height: 1.25;
  }
  body.epub-chapter .chapter-aftermath {
    background: #FFFFFF; padding: 1.5rem; border-radius: 8px;
    border-top: none; border-left: 4px solid var(--accent);
  }
</style>
`;

/** EPUB 章节 magazine 主题：连续阅读 + 杂志化标题/首字下沉（依赖 BASE_CSS + MAGAZINE_VARS） */
export const MAGAZINE_EPUB_CSS = `
<style>
  body.epub-chapter { padding: 48px 48px 80px; }
  body.epub-chapter .chapter { max-width: 920px; margin: 0 auto; }
  body.epub-chapter .chapter-title {
    font-family: var(--font-display);
    font-size: clamp(2.4rem, 5vw, 4.5rem);
    font-weight: 900;
    max-width: 840px;
    margin: 0 auto 2.75rem;
    padding: 1rem 0 1.2rem;
    border-top: 3px double var(--text);
    border-bottom: 1px solid var(--text);
    letter-spacing: -0.02em;
    line-height: 1.05;
    text-align: left;
  }
  body.epub-chapter .chapter-body {
    max-width: 760px;
    margin: 0 auto;
  }
  body.epub-chapter .chapter-body p {
    margin: 0 0 1.25em 0;
    font-size: var(--rp-font-size, 1.08rem);
    line-height: 1.82;
    text-align: justify;
    hyphens: auto;
  }
  body.epub-chapter .chapter-body p:has(img),
  body.epub-chapter .chapter-body p:has(svg) {
    text-align: center;
  }
  body.epub-chapter .chapter-body img {
    display: block;
    max-height: min(74vh, 920px);
    margin: 2rem auto;
    object-fit: contain;
  }
  body.epub-chapter .chapter-body > p:first-of-type::first-letter {
    float: left;
    font-family: var(--font-display);
    font-size: 5.2rem;
    line-height: 0.9;
    padding: 0.08em 0.6rem 0 0;
    color: var(--accent);
    font-weight: 900;
  }
  body.epub-chapter blockquote {
    max-width: 840px;
    margin: 2.5rem auto;
    padding: 1.2rem 0;
    border-top: 3px double var(--text);
    border-bottom: 1px solid var(--rule);
    color: var(--text);
    font-family: var(--font-display);
    font-size: 1.35rem;
    line-height: 1.45;
  }
  body.epub-chapter .chapter-body h2,
  body.epub-chapter .chapter-body h3 {
    font-family: var(--font-display);
    margin: 2.5rem 0 1rem;
    line-height: 1.1;
  }
  body.epub-chapter .chapter-aftermath {
    max-width: 760px;
    text-align: left;
    border-top: 3px double var(--text);
    margin-top: 3rem;
  }
  body.epub-chapter .chapter-aftermath li { font-family: var(--font-display); }
  @media (max-width: 768px) {
    body.epub-chapter { padding: 32px 22px 56px; }
    body.epub-chapter .chapter-title { font-size: 2.25rem; }
    body.epub-chapter .chapter-body p { text-align: left; }
  }
</style>
`;
