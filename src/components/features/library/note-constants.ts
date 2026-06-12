// Shared visual labels for the reading notes workspace.
export const PAGE_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  overview: { bg: "bg-sky-50", text: "text-sky-700", dot: "#0284C7", label: "全书" },
  chapter: { bg: "bg-stone-100", text: "text-stone-700", dot: "#57534E", label: "章节" },
  deepdive: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "#4F46E5", label: "深读" },
  theme: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "#059669", label: "主题" },
  synthesis: { bg: "bg-amber-50", text: "text-amber-700", dot: "#D97706", label: "综合" },
};

export const CONTEXT_LABELS: Record<string, string> = {
  heading: "标题",
  section: "章节",
  callout: "要点",
  quote: "引文",
  concept: "概念",
};
