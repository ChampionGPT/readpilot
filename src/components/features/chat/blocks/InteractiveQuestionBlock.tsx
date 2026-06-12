/**
 * input: InteractiveQuestionBlock 块 + onSubmit 回调（提交答案）
 * output: 内联问答表单 — 跟随 AI 气泡 stylistic，单/多选 chip 网格 + "其他" 文本框
 * pos: BlockRouter 下游，当 AI 调 AskUserQuestion 工具时由 canUseTool 通过 SSE permission_request 派发
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState } from 'react';
import type { InteractiveQuestionBlock as IQB } from '@/types/chat-blocks';

interface Props {
  block: IQB;
  onSubmit: (permissionRequestId: string, answers: Record<string, string>) => Promise<void> | void;
}

export function InteractiveQuestionBlock({ block, onSubmit }: Props) {
  const isResolved = block.status === 'complete' && !!block.answers;
  const [selections, setSelections] = useState<Record<number, Set<string>>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});
  const [useOther, setUseOther] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleOption = (qIdx: number, label: string, multi: boolean) => {
    setSelections((prev) => {
      const current = new Set(prev[qIdx] || []);
      if (multi) {
        if (current.has(label)) current.delete(label);
        else current.add(label);
      } else {
        current.clear();
        current.add(label);
      }
      return { ...prev, [qIdx]: current };
    });
    setUseOther((prev) => ({ ...prev, [qIdx]: false }));
  };

  const toggleOther = (qIdx: number, multi: boolean) => {
    if (!multi) {
      setSelections((prev) => ({ ...prev, [qIdx]: new Set() }));
    }
    setUseOther((prev) => ({ ...prev, [qIdx]: !prev[qIdx] }));
  };

  const hasAnyAnswer = block.questions.some((_, i) => {
    return (selections[i]?.size || 0) > 0 || (useOther[i] && otherTexts[i]?.trim());
  });

  const handleSubmit = async () => {
    if (submitting || isResolved) return;
    setSubmitError(null);
    const answers: Record<string, string> = {};
    block.questions.forEach((q, i) => {
      const selected = Array.from(selections[i] || []);
      if (useOther[i] && otherTexts[i]?.trim()) {
        selected.push(otherTexts[i].trim());
      }
      answers[q.question] = selected.join(', ');
    });
    setSubmitting(true);
    try {
      await onSubmit(block.permissionRequestId, answers);
    } catch (e: any) {
      setSubmitError(e?.message ?? '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 已答完 → 紧凑只读卡
  if (isResolved) {
    const answers = block.answers ?? {};
    return (
      <div className="bg-white border border-[#E5DFD6] shadow-md shadow-stone-200/30 rounded-2xl rounded-tl-sm px-4 py-3 opacity-80 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold tracking-wider uppercase mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>已回答</span>
        </div>
        <div className="space-y-2">
          {block.questions.map((q, i) => (
            <div key={i} className="text-xs">
              <div className="text-stone-500 mb-0.5">{q.question}</div>
              <div className="text-stone-800 font-medium">→ {answers[q.question] || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 未答 → 完整表单
  return (
    <div className="bg-white border border-[#E5DFD6] shadow-md shadow-stone-200/30 rounded-2xl rounded-tl-sm px-4 py-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-center gap-2 text-[10px] text-[#D94F30] font-bold tracking-wider uppercase mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D94F30] animate-pulse" />
        <span>需要你的回答</span>
      </div>

      <div className="space-y-4">
        {block.questions.map((q, i) => {
          const selected = selections[i] ?? new Set<string>();
          return (
            <div key={i} className="space-y-2">
              {q.header && (
                <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase text-stone-500">
                  {q.header}
                </span>
              )}
              <p className="text-sm font-medium text-stone-800 leading-snug">{q.question}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const isSelected = selected.has(opt.label);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => toggleOption(i, opt.label, q.multiSelect)}
                      title={opt.description}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#D94F30] bg-[#D94F30]/10 text-[#D94F30] font-semibold'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      {q.multiSelect && (
                        <span className="mr-1 opacity-70">{isSelected ? '☑' : '☐'}</span>
                      )}
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => toggleOther(i, q.multiSelect)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                    useOther[i]
                      ? 'border-[#D94F30] bg-[#D94F30]/10 text-[#D94F30] font-semibold'
                      : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:border-stone-300'
                  }`}
                >
                  其他
                </button>
              </div>
              {useOther[i] && (
                <input
                  type="text"
                  placeholder="自由输入..."
                  value={otherTexts[i] || ''}
                  onChange={(e) => setOtherTexts((prev) => ({ ...prev, [i]: e.target.value }))}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-[#D94F30]/40 focus:ring-2 focus:ring-[#D94F30]/10 focus:bg-white transition-all"
                />
              )}
            </div>
          );
        })}
      </div>

      {submitError && (
        <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg border border-red-100 text-[11px] text-red-600">
          {submitError}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasAnyAnswer || submitting}
          className="px-5 py-2 rounded-full bg-[#D94F30] text-white font-bold text-xs tracking-wide shadow-md shadow-[#D94F30]/20 hover:bg-[#C4432A] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? '提交中…' : '提交回答'}
        </button>
      </div>
    </div>
  );
}
