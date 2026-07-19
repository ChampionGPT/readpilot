/**
 * input: bookDir + pageId + 活动 iframe 引用（用于滚动回原文）
 * output: 本章标注抽屉（列表、跳回原文、删除）+ 右侧悬浮开关按钮
 * pos: 阅读页 page 模式的标注面板 — 与 annotator iframe 通过 postMessage 协作
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Highlighter, MessageSquareQuote, Trash2, X } from "lucide-react";
import type { Annotation, AnnotationSemanticType } from "@/types/progress";

const SEM_LABELS: Record<AnnotationSemanticType, string> = {
  case: "案例", quote: "金句", question: "疑问", resonance: "共鸣",
  objection: "反对", action: "行动", insight: "洞察",
};

interface AnnotationDrawerProps {
  bookDir: string;
  pageId: string;
  getActiveFrame: () => HTMLIFrameElement | null;
}

export function AnnotationDrawer({ bookDir, pageId, getActiveFrame }: AnnotationDrawerProps) {
  const [open, setOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  // 微信读书未定位标注可能属于其他章节：只显示本页归属或 annotator 实际渲染成功的
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const visible = annotations.filter((a) => a.pageId === pageId || resolvedIds.has(a.id));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/books/${encodeURIComponent(bookDir)}/annotations?pageId=${encodeURIComponent(pageId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setAnnotations(data.annotations ?? []);
    } catch {
      /* 静默：抽屉打开时会重试 */
    }
  }, [bookDir, pageId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // iframe 内 annotator 的变更通知
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.source !== "rp-annotator") return;
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
  }, [refresh, getActiveFrame]);

  const scrollTo = (annotationId: string) => {
    const frame = getActiveFrame();
    frame?.contentWindow?.postMessage(
      { source: "rp-host", type: "rp-scroll-to", payload: { annotationId } },
      "*"
    );
  };

  const remove = async (annotationId: string) => {
    await fetch(
      `/api/books/${encodeURIComponent(bookDir)}/annotations/${annotationId}`,
      { method: "DELETE" }
    );
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    getActiveFrame()?.contentWindow?.postMessage(
      { source: "rp-host", type: "rp-reload" },
      "*"
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="本章标注"
        className="absolute right-4 top-4 z-20 inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3 text-xs font-semibold text-stone-700 shadow-sm hover:border-[#D94F30]/40"
      >
        <Highlighter size={14} className="text-[#D94F30]" />
        标注 {visible.length > 0 && <span className="text-[#D94F30]">{visible.length}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-0 z-30 flex h-full w-[320px] flex-col border-l border-stone-200 bg-[#FFFDF9] shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-900">本章标注（{visible.length}）</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700">
              <X size={16} />
            </button>
          </div>
          <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
            {visible.length === 0 && (
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
        </div>
      )}
    </>
  );
}
