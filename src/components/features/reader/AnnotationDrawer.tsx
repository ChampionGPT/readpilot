/**
 * input: bookDir + pageId + pages + active iframe reference + parent close/navigate callbacks
 * output: Annotation panel with chapter/book scope, semantic-type grouped display, jump, and delete
 * pos: ReaderApp shared auxiliary panel slot, coordinated with TOC and typography
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, MessageSquareQuote, Trash2, X } from "lucide-react";
import type { Annotation, AnnotationSemanticType } from "@/types/progress";
import type { ProgressPage } from "@/types/progress-data";

const SEM_LABELS: Record<AnnotationSemanticType, string> = {
  case: "案例", quote: "金句", question: "疑问", resonance: "共鸣",
  objection: "反对", action: "行动", insight: "洞察",
  viewpoint: "观点", fact: "事实",
};

/** 分组展示顺序：九种语义类型在前，未标记的划线/想法归入最后一组 */
const GROUP_ORDER: (AnnotationSemanticType | "unmarked")[] = [
  "question", "insight", "viewpoint", "fact", "case", "quote", "resonance", "objection", "action", "unmarked",
];

interface AnnotationDrawerProps {
  bookDir: string;
  pageId: string;
  pages?: ProgressPage[];
  getActiveFrame: () => HTMLIFrameElement | null;
  onClose: () => void;
  /** 全书模式下点击其他章节的标注：跳转到该章并定位 */
  onOpenAnnotation?: (annotation: Annotation) => void;
}

export function AnnotationDrawer({ bookDir, pageId, pages = [], getActiveFrame, onClose, onOpenAnnotation }: AnnotationDrawerProps) {
  const [scope, setScope] = useState<"chapter" | "book">("chapter");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef<{ controller: AbortController; generation: number } | null>(null);
  const generationRef = useRef(0);
  // 微信读书未定位标注可能属于其他章节：本章视图只显示本页归属或 annotator 实际渲染成功的
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const pageTitleById = useMemo(() => {
    const map = new Map<string, string>();
    pages.forEach((page) => map.set(page.id, page.title));
    return map;
  }, [pages]);

  const visible = useMemo(() => {
    if (scope === "book") return annotations;
    return annotations.filter((a) => a.pageId === pageId || resolvedIds.has(a.id));
  }, [annotations, pageId, resolvedIds, scope]);

  const groups = useMemo(() => {
    const byKey = new Map<AnnotationSemanticType | "unmarked", Annotation[]>();
    for (const ann of visible) {
      const key = ann.semanticType ?? "unmarked";
      const list = byKey.get(key) ?? [];
      list.push(ann);
      byKey.set(key, list);
    }
    return GROUP_ORDER
      .filter((key) => (byKey.get(key)?.length ?? 0) > 0)
      .map((key) => ({
        key,
        label: key === "unmarked" ? "划线与想法" : SEM_LABELS[key],
        items: byKey.get(key)!,
      }));
  }, [visible]);

  const refresh = useCallback(async () => {
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const generation = ++generationRef.current;
    requestRef.current = { controller, generation };
    setLoading(true);
    setError(null);
    try {
      const query = scope === "chapter" ? `?pageId=${encodeURIComponent(pageId)}` : "";
      const res = await fetch(
        `/api/books/${encodeURIComponent(bookDir)}/annotations${query}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      if (generation !== generationRef.current) return;
      setAnnotations(data.annotations ?? []);
    } catch {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setError("标注加载失败，请重试。");
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [bookDir, pageId, scope]);

  useEffect(() => {
    refresh();
    return () => requestRef.current?.controller.abort();
  }, [refresh]);

  // iframe 内 annotator 的变更通知
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      const activeFrame = getActiveFrame();
      if (e.origin !== window.location.origin || e.source !== activeFrame?.contentWindow || data?.source !== "rp-annotator" || data.payload?.pageId !== pageId) return;
      if (data.type === "rp-annotations-changed" || data.type === "rp-annotations-loaded") {
        refresh();
      }
      if (data.type === "rp-annotations-loaded" && Array.isArray(data.payload?.resolved)) {
        setResolvedIds(new Set<string>(data.payload.resolved));
      }
      // 采集箱/全书视图「回原文」：页面标注加载完成后滚动定位
      if (data.type === "rp-annotations-loaded") {
        const w = window as unknown as { __rpPendingScroll?: string };
        if (w.__rpPendingScroll) {
          const annotationId = w.__rpPendingScroll;
          delete w.__rpPendingScroll;
          setTimeout(() => {
            getActiveFrame()?.contentWindow?.postMessage(
              { source: "rp-host", type: "rp-scroll-to", payload: { annotationId } },
              "*"
            );
          }, 120);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refresh, getActiveFrame, pageId]);

  const jumpTo = (ann: Annotation) => {
    if (!ann.pageId || ann.pageId === pageId) {
      getActiveFrame()?.contentWindow?.postMessage(
        { source: "rp-host", type: "rp-scroll-to", payload: { annotationId: ann.id } },
        "*"
      );
      return;
    }
    onOpenAnnotation?.(ann);
  };

  const remove = async (annotationId: string) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/books/${encodeURIComponent(bookDir)}/annotations/${annotationId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("delete failed");
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      getActiveFrame()?.contentWindow?.postMessage({ source: "rp-host", type: "rp-reload" }, "*");
    } catch {
      setError("删除失败，请稍后重试。");
    }
  };

  return (
    <aside aria-label="标注面板" className="flex h-full flex-col bg-[#FFFDF9]">
      <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-3.5">
        <h3 className="text-base font-semibold text-stone-900">标注</h3>
        <div className="grid grid-cols-2 rounded-lg border border-stone-200 bg-white p-0.5 text-xs font-semibold">
          <button
            type="button"
            aria-pressed={scope === "chapter"}
            onClick={() => setScope("chapter")}
            className={`rounded-md px-3 py-1 transition-colors ${scope === "chapter" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"}`}
          >
            本章
          </button>
          <button
            type="button"
            aria-pressed={scope === "book"}
            onClick={() => setScope("book")}
            className={`rounded-md px-3 py-1 transition-colors ${scope === "book" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"}`}
          >
            全书
          </button>
        </div>
        <span className="text-xs text-stone-400">{visible.length} 条</span>
        <a
          href={`/api/books/${encodeURIComponent(bookDir)}/notes/export${scope === "chapter" ? `?pageId=${encodeURIComponent(pageId)}` : ""}`}
          download
          title={scope === "chapter" ? "导出本章笔记与标注为 Markdown" : "导出全书笔记与标注为 Markdown"}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-[#B3402A] focus-visible:outline-2 focus-visible:outline-[#D94F30]"
        >
          <FileDown size={16} />
        </a>
        <button autoFocus type="button" aria-label="关闭标注面板" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-[#D94F30]">
          <X size={17} />
        </button>
      </div>
      <div className="hide-scrollbar flex-1 overflow-y-auto px-4 py-3">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><p>{error}</p><button type="button" onClick={() => refresh()} className="mt-2 font-semibold underline">重试</button></div>}
        {loading && (
          <div role="status" aria-label="正在加载标注" className="space-y-3 px-1 py-2">
            {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg border border-stone-200 bg-stone-100/80" />)}
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-stone-500">
            {scope === "chapter" ? "选中正文任意文字即可高亮、写想法或添加智能标记。" : "全书还没有标注。"}
          </p>
        )}
        {!loading && groups.map((group) => (
          <section key={group.key} className="mb-4">
            <h4 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-stone-500">
              <span className={group.key === "unmarked" ? "text-stone-500" : "text-[#B3402A]"}>{group.label}</span>
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{group.items.length}</span>
              <span className="h-px flex-1 bg-stone-200/80" />
            </h4>
            <div className="space-y-2.5">
              {group.items.map((ann) => (
                <div key={ann.id} className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] text-stone-500">
                    {scope === "book" && (
                      <span className="max-w-[12rem] truncate rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600">
                        {ann.pageId ? pageTitleById.get(ann.pageId) ?? ann.pageId : ann.quotePrefix.trim() || "未定位"}
                      </span>
                    )}
                    <span>{ann.origin === "weread" ? "微信读书" : "本地"}</span>
                    <span className="ml-auto">{new Date(ann.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => jumpTo(ann)}
                    className="block w-full border-l-2 border-[#D94F30]/60 pl-2 text-left text-[13px] leading-6 text-stone-700 hover:text-stone-950"
                    title="回到原文"
                  >
                    {ann.quote.length > 90 ? `${ann.quote.slice(0, 90)}…` : ann.quote}
                  </button>
                  {ann.body && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-stone-600">
                      <MessageSquareQuote size={12} className="mt-0.5 shrink-0 text-stone-400" />
                      {ann.body}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(ann.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
