/**
 * input: 无
 * output: 共享 base CSS、三主题 CSS 变量、纸纹 SVG dataURL
 * pos: page route handler 注入到所有 iframe 的全局样式底层
 */

export const WEBFONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Inter:wght@400;600;700&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />
`;

const PAPER_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.1, 0 0 0 0 0.08, 0 0 0 0 0.05, 0 0 0 0.4 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
export const PAPER_TEXTURE_DATAURL = `data:image/svg+xml;utf8,${PAPER_SVG}`;

export const BASE_CSS = `
${WEBFONT_LINKS}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  a { color: var(--accent, #D94F30); text-decoration: none; }
  a:hover { text-decoration: underline; }
  img, svg, video, canvas { max-width: 100%; height: auto; }
  figure { margin: 1.75rem auto; text-align: center; }
  figcaption { margin-top: 0.5rem; color: var(--text-secondary, #6B6560); font-size: 0.85rem; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.95em; }
  th, td { border: 1px solid var(--rule, #D6CFC2); padding: 0.5rem 0.65rem; vertical-align: top; }
  .chapter-aftermath { max-width: var(--max-width, 640px); margin: 3rem auto 0; padding-top: 1.5rem; border-top: 1px solid var(--rule, #D6CFC2); }
  .chapter-aftermath h2 { font-family: var(--font-display, serif); font-size: 1rem; margin: 0 0 0.8rem; color: var(--text-secondary, #6B6560); }
  .chapter-aftermath ul { list-style: none; padding: 0; margin: 0; }
  .chapter-aftermath li { margin: 0.5rem 0; }
  .chapter-aftermath-empty p { color: var(--text-secondary, #6B6560); font-style: italic; margin: 0; }
</style>
`;

export const CLASSIC_VARS = `
<style>
:root {
  --accent: #D94F30;
  --bg: #F8F4ED;
  --text: #2A2520;
  --text-secondary: #6B6560;
  --rule: #D6CFC2;
  --font-display: 'Lora', 'Source Han Serif SC', 'Noto Serif CJK SC', 'PingFang SC', serif;
  --font-body: 'Lora', 'PingFang SC', 'Microsoft YaHei', serif;
  --max-width: 640px;
  --line-height: 1.9;
}
body { background: var(--bg); color: var(--text); font-family: var(--font-body); line-height: var(--line-height); position: relative; }
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.04; z-index: 0;
  background-image: url("${PAPER_TEXTURE_DATAURL}");
  background-repeat: repeat;
}
body > * { position: relative; z-index: 1; }
</style>
`;

export const MODERN_VARS = `
<style>
:root {
  --accent: #D94F30;
  --bg: #FAFAFA;
  --text: #2A2A2A;
  --text-secondary: #6B6560;
  --rule: #E5DFD6;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  --max-width: 720px;
  --line-height: 2.0;
}
body { background: var(--bg); color: var(--text); font-family: var(--font-body); line-height: var(--line-height); }
</style>
`;

export const MAGAZINE_VARS = `
<style>
:root {
  --accent: #D94F30;
  --bg: #FFFFFF;
  --text: #1A1A1A;
  --text-secondary: #6B6560;
  --rule: #EEEBE5;
  --font-display: 'Playfair Display', 'Source Han Serif SC', 'Noto Serif CJK SC', Georgia, serif;
  --font-body: 'Lora', 'PingFang SC', Georgia, serif;
  --max-width: 1040px;
  --line-height: 1.75;
}
body { background: var(--bg); color: var(--text); font-family: var(--font-body); line-height: var(--line-height); }
</style>
`;
