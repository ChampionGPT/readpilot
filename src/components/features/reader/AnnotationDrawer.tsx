/**
 * input: bookDir + pageId + active iframe reference + parent close callback
 * output: Page-isolated annotation panel with loading skeleton, trusted refresh messages, jump, and delete actions
 * pos: ReaderApp shared auxiliary panel slot, coordinated with TOC and typography
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquareQuote, Trash2, X } from "lucide-react";
import type { Annotation, AnnotationSemanticType } from "@/types/progress";

const SEM_LABELS: Record<AnnotationSemanticType, string> = {
  case: "案例", quote: "金句", question: "疑问", resonance: "共鸣",
  objection: "反对", action: "行动", insight: "洞察",
  viewpoint: "观点", fact: "事实",
};

interface AnnotationDrawerProps {
  bookDir: string;
  pageId: string;
  getActiveFrame: () => HTMLIFrameElement | null;
  onClose: () => void;
}

export function AnnotationDrawer({ bookDir, pageId, getActiveFrame, onClose }: AnnotationDrawerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef<{ controller: AbortController; generation: number } | null>(null);
  const generationRef = useRef(0);
  // 微信读书未定位标注可能属于其他章节：只显示本页归属或 annotator 实际渲染成功的
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const visible = annotations.filter((a) => a.pageId === pageId || resolvedIds.has(a.id));

  const refresh = useCallback(async () => {
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const generation = ++generationRef.current;
    requestRef.current = { controller, generation };
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/books/${encodeURIComponent(bookDir)}/annotations?pageId=${encodeURIComponent(pageId)}`,
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
  }, [bookDir, pageId]);

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
      // 采集箱「回原文」：页面标注加载完成后滚动定位
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

  const scrollTo = (annotationId: string) => {
    const frame = getActiveFrame();
    frame?.contentWindow?.postMessage(
      { source: "rp-host", type: "rp-scroll-to", payload: { annotationId } },
      "*"
    );
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
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-900">本章标注（{visible.length}）</h3>
            <button autoFocus type="button" aria-label="关闭标注面板" onClick={onClose} className="rounded text-stone-400 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94F30]">
              <X size={16} />
            </button>
          </div>
          <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
            {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><p>{error}</p><button type="button" onClick={() => refresh()} className="mt-2 font-semibold underline">重试</button></div>}
            {loading && (
              <div role="status" aria-label="正在加载标注" className="space-y-3 px-1 py-2">
                {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg border border-stone-200 bg-stone-100/80" />)}
              </div>
            )}
            {!loading && !error && visible.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-stone-500">
                选中正文任意文字即可高亮、写想法或添加智能标记。
              </p>
            )}
            {visible.map((ann) => (
              <div key={ann.id} className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-stone-500">
                  {ann.semanticType && (
                    <span className="rounded bg-[#D94F30]/10 px-1.5 py-0.5 font-semibold text-[#B3402A]">
                      {SEM_LABELS[ann.semanticType]}
                    </span>
                  )}
                  <span>{ann.origin === "weread" ? "微信读书" : "本地"}</span>
                  <span className="ml-auto">{new Date(ann.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => scrollTo(ann.id)}
                  className="block w-full border-l-2 border-[#D94F30]/60 pl-2 text-left text-xs leading-5 text-stone-700 hover:text-stone-950"
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
        </aside>
  );
}
