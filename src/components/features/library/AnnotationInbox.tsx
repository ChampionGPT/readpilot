/**
 * input: bookDir + pages + 当前章节/笔记 + 微信绑定状态
 * output: 唯一标注素材入口 — 默认当前章节、可切全书，展示来源/章节并支持回原文和转入 Cornell
 * pos: BookNotesView 右侧面板 — 康奈尔笔记的素材入口（计划 6.1 一级界面）
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CornerUpLeft, ExternalLink, Inbox, RefreshCw } from "lucide-react";
import type { Annotation, AnnotationSemanticType, CornellSection, NoteAnnotationLink } from "@/types/progress";
import type { ProgressPage } from "@/types/progress-data";

const SEM_LABELS: Record<AnnotationSemanticType, string> = {
  case: "案例", quote: "金句", question: "疑问", resonance: "共鸣",
  objection: "反对", action: "行动", insight: "洞察",
  viewpoint: "观点", fact: "事实",
};

type Filter = "all" | "unorganized" | "weread" | AnnotationSemanticType;

interface AnnotationInboxProps {
  bookDir: string;
  pages: ProgressPage[];
  activePageId: string | null;
  hasWereadBinding: boolean;
  wereadBookId: string | null;
  /** 当前打开的康奈尔笔记；null 时禁用转入按钮 */
  activeNoteId: string | null;
  onSendTo: (annotation: Annotation, section: CornellSection) => Promise<void>;
  onOpenSource: (annotation: Annotation) => void;
}

export function AnnotationInbox({
  bookDir, pages, activePageId, hasWereadBinding, wereadBookId, activeNoteId, onSendTo, onOpenSource,
}: AnnotationInboxProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [links, setLinks] = useState<NoteAnnotationLink[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<"chapter" | "book">(activePageId ? "chapter" : "book");
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const pageTitleById = useMemo(() => {
    const map = new Map<string, string>();
    pages.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [pages]);

  const activeNoteLinks = useMemo(
    () => links.filter((link) => link.noteId === activeNoteId),
    [activeNoteId, links],
  );
  const linkedIds = useMemo(() => new Set(activeNoteLinks.map((link) => link.annotationId)), [activeNoteLinks]);
  const linkedKeys = useMemo(
    () => new Set(activeNoteLinks.map((link) => `${link.annotationId}:${link.section}`)),
    [activeNoteLinks],
  );

  const refresh = useCallback(async (syncWeread = false) => {
    setLoading(true);
    try {
      const sync = syncWeread && hasWereadBinding ? "?syncWeread=1" : "";
      const res = await fetch(`/api/books/${encodeURIComponent(bookDir)}/annotations${sync}`);
      if (!res.ok) return;
      const data = await res.json();
      setAnnotations(data.annotations ?? []);
      setLinks(data.links ?? []);
    } catch {
      /* 保留旧数据 */
    } finally {
      setLoading(false);
    }
  }, [bookDir, hasWereadBinding]);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    setScope(activePageId ? "chapter" : "book");
  }, [activePageId]);

  const scopedAnnotations = useMemo(() => {
    const activePageTitle = pages.find((page) => page.id === activePageId)?.title.trim();
    return annotations.filter((annotation) => {
      if (scope === "book") return true;
      if (annotation.pageId === activePageId) return true;
      return annotation.origin === "weread"
        && !annotation.pageId
        && !!activePageTitle
        && annotation.quotePrefix.trim() === activePageTitle;
    });
  }, [activePageId, annotations, pages, scope]);

  const filtered = useMemo(() => {
    return scopedAnnotations.filter((a) => {
      if (filter === "all") return true;
      if (filter === "unorganized") return !linkedIds.has(a.id);
      if (filter === "weread") return a.origin === "weread";
      return a.semanticType === filter;
    });
  }, [filter, linkedIds, scopedAnnotations]);

  const counts = useMemo(() => {
    const c = { unorganized: 0, weread: 0 } as Record<string, number>;
    scopedAnnotations.forEach((a) => {
      if (!linkedIds.has(a.id)) c.unorganized++;
      if (a.origin === "weread") c.weread++;
      if (a.semanticType) c[a.semanticType] = (c[a.semanticType] ?? 0) + 1;
    });
    return c;
  }, [linkedIds, scopedAnnotations]);

  const send = async (ann: Annotation, section: CornellSection) => {
    setSendingId(ann.id);
    try {
      await onSendTo(ann, section);
      await refresh();
    } catch {
      /* BookNotesView/NoteEditor owns the visible error state. */
    } finally {
      setSendingId(null);
    }
  };

  const filterChips: { key: Filter; label: string }[] = [
    { key: "all", label: `全部 ${scopedAnnotations.length}` },
    { key: "unorganized", label: `未转入当前笔记 ${counts.unorganized}` },
    ...(hasWereadBinding || counts.weread > 0 ? [{ key: "weread" as Filter, label: `微信读书 ${counts.weread}` }] : []),
    ...(Object.keys(SEM_LABELS) as AnnotationSemanticType[])
      .filter((k) => (counts[k] ?? 0) > 0)
      .map((k) => ({ key: k as Filter, label: `${SEM_LABELS[k]} ${counts[k]}` })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-stone-200/70 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <Inbox size={16} />
            标注采集箱
          </div>
          <button
            type="button"
            onClick={() => refresh(true)}
            title="刷新（含微信读书同步）"
            className="text-stone-400 hover:text-stone-700"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="mb-2 grid grid-cols-2 rounded-md border border-stone-200 bg-white p-0.5 text-[11px] font-semibold">
          <button type="button" onClick={() => setScope("chapter")} disabled={!activePageId} className={`rounded px-2 py-1 ${scope === "chapter" ? "bg-stone-900 text-white" : "text-stone-500"} disabled:opacity-40`}>
            当前章节
          </button>
          <button type="button" onClick={() => setScope("book")} className={`rounded px-2 py-1 ${scope === "book" ? "bg-stone-900 text-white" : "text-stone-500"}`}>
            全书
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                filter === chip.key
                  ? "border-[#D94F30]/40 bg-[#D94F30]/10 text-[#B3402A]"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-stone-300 bg-white/50 px-3 py-5 text-center text-xs leading-5 text-stone-500">
            {scopedAnnotations.length === 0
              ? "阅读时选中文字即可高亮、写想法或添加智能标记，它们会汇集到这里。"
              : "当前筛选下没有标注。"}
          </div>
        )}
        {filtered.map((ann) => {
          const organized = linkedIds.has(ann.id);
          return (
            <div key={ann.id} className="rounded-md border border-stone-200 bg-white p-2.5 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                {ann.semanticType && (
                  <span className="rounded bg-[#D94F30]/10 px-1.5 py-0.5 font-semibold text-[#B3402A]">
                    {SEM_LABELS[ann.semanticType]}
                  </span>
                )}
                {ann.origin === "weread" && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">微信读书</span>
                )}
                {organized && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-500">已转入当前笔记</span>
                )}
                <span className="ml-auto truncate">
                  {ann.pageId ? pageTitleById.get(ann.pageId) ?? ann.pageId : ann.quotePrefix || "全书"}
                </span>
              </div>
              <p className="border-l-2 border-[#D94F30]/50 pl-2 text-xs leading-5 text-stone-700">
                {ann.quote.length > 100 ? `${ann.quote.slice(0, 100)}…` : ann.quote}
              </p>
              {ann.body && <p className="mt-1.5 text-xs leading-5 text-stone-600">💭 {ann.body}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ann.pageId && (
                  <button
                    type="button"
                    onClick={() => onOpenSource(ann)}
                    className="inline-flex items-center gap-1 rounded border border-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:border-[#D94F30]/40"
                  >
                    <CornerUpLeft size={10} />
                    原文
                  </button>
                )}
                {ann.origin === "weread" && wereadBookId && (
                  <a
                    href={`weread://bestbookmark?bookId=${encodeURIComponent(wereadBookId)}`}
                    className="inline-flex items-center gap-1 rounded border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:border-emerald-300"
                  >
                    <ExternalLink size={10} />
                    在微信读书中打开
                  </a>
                )}
                {(["cue", "notes", "summary"] as CornellSection[]).map((section) => (
                  <button
                    key={section}
                    type="button"
                    disabled={!activeNoteId || sendingId === ann.id || linkedKeys.has(`${ann.id}:${section}`)}
                    onClick={() => send(ann, section)}
                    title={linkedKeys.has(`${ann.id}:${section}`) ? `已转入 ${section}` : activeNoteId ? undefined : "先在左侧打开一条笔记"}
                    className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:border-[#D94F30]/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {linkedKeys.has(`${ann.id}:${section}`) ? `✓ ${section === "cue" ? "Cue" : section === "notes" ? "Notes" : "Summary"}` : section === "cue"
                      ? ann.semanticType === "question" ? "转为 Cue" : "→ Cue"
                      : section === "notes"
                        ? ann.semanticType === "action" ? "提取行动" : "→ Notes"
                        : "→ Summary"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
