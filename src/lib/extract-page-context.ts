// input: 伴读页面 HTML 字符串
// output: { items: PageContextItem[], aiCues: string[] } — 从 HTML 中提取的关键内容条目（标题、引用等）和 AI 生成的复习提示
// pos: 纯前端工具函数 — 为康奈尔笔记 Cue 区域提供自动注入的页面上下文与提示词
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

export type ContextItemType = "heading" | "section" | "callout" | "quote" | "concept";

export interface PageContextItem {
  type: ContextItemType;
  content: string;
}

export interface PageContextData {
  items: PageContextItem[];
  aiCues: string[];
}

/** 从伴读页面 HTML 中提取关键内容条目，以及预先生成的 AI Cues，供康奈尔笔记区域使用 */
export function extractPageContext(html: string): PageContextData {
  const result: PageContextData = { items: [], aiCues: [] };
  if (!html) return result;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const seen = new Set<string>();

  // 0. 尝试提取 AI 预生成的 Cues
  const cuesScript = doc.getElementById("ai-cues");
  if (cuesScript && cuesScript.textContent) {
    try {
      const parsed = JSON.parse(cuesScript.textContent);
      if (Array.isArray(parsed)) {
        result.aiCues = parsed.filter(i => typeof i === "string");
      }
    } catch (e) {
      console.warn("Failed to parse ai-cues JSON from HTML", e);
    }
  }

  const addUnique = (type: ContextItemType, raw: string) => {
    const content = raw.replace(/\s+/g, " ").trim();
    if (!content || content.length < 3 || seen.has(content)) return;
    seen.add(content);
    result.items.push({ type, content: content.slice(0, 120) });
  };

  // 1. 模块级标题（.module-title）
  doc.querySelectorAll(".module-title").forEach((el) => {
    addUnique("section", el.textContent || "");
  });

  // 2. 页面标题层级（h1, h2, h3）
  doc.querySelectorAll("h1, h2, h3").forEach((el) => {
    // 排除导航和模块编号
    if (el.closest(".nav") || el.classList.contains("module-number")) return;
    addUnique("heading", el.textContent || "");
  });

  // 3. 高亮/引用块（.callout）
  doc.querySelectorAll(".callout").forEach((el) => {
    const title = el.querySelector(".callout-title");
    if (title?.textContent) {
      addUnique("callout", title.textContent);
    } else {
      addUnique("callout", (el.textContent || "").slice(0, 100));
    }
  });

  // 4. 引文块（blockquote, .translation-quote）
  doc.querySelectorAll("blockquote, .translation-quote").forEach((el) => {
    addUnique("quote", (el.textContent || "").slice(0, 100));
  });

  // 5. 关键概念（.badge, .keyword, strong 在特定容器内）
  doc.querySelectorAll(".badge, .keyword").forEach((el) => {
    addUnique("concept", el.textContent || "");
  });

  result.items = result.items.slice(0, 15); // 最多 15 条
  return result;
}
