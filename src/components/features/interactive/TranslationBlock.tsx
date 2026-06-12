"use client";

import { type TranslationBlockProps, type AnnotationType } from "@/types/components";

const annotationClass: Record<AnnotationType, string> = {
  keyword: "text-purple-400 font-bold",
  emphasis: "text-amber-200 bg-amber-200/15",
  metaphor: "text-green-300 italic",
  data: "text-orange-300",
  debunked: "text-gray-400 line-through",
  warning: "text-pink-400",
};

function renderAnnotated(text: string, annotations?: { text: string; type: AnnotationType }[]) {
  if (!annotations?.length) return text;
  let result = text;
  const parts: (string | { text: string; className: string })[] = [];
  let remaining = result;

  for (const ann of annotations) {
    const idx = remaining.indexOf(ann.text);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push({ text: ann.text, className: annotationClass[ann.type] });
    remaining = remaining.slice(idx + ann.text.length);
  }
  if (remaining) parts.push(remaining);

  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className={p.className}>{p.text}</span>
        )
      )}
    </>
  );
}

export function TranslationBlock({
  originalLabel = "原著原文",
  plainLabel = "大白话解析",
  quotes,
}: TranslationBlockProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-xl overflow-hidden shadow-md my-8">
      {/* 左栏: 原文 */}
      <div className="relative bg-[#2A2520] text-[#EAE4D9] p-6 font-serif text-lg leading-[1.8]">
        <span className="absolute top-2 right-3 font-mono text-xs uppercase tracking-widest opacity-50">
          {originalLabel}
        </span>
        {quotes.map((q, i) => (
          <blockquote
            key={i}
            className="bg-[#352F2A] rounded-lg p-5 mb-4 last:mb-0 whitespace-pre-wrap break-words"
          >
            {renderAnnotated(q.original, q.annotations)}
          </blockquote>
        ))}
      </div>

      {/* 右栏: 解析 */}
      <div className="relative bg-[#FDF9F3] p-6 text-sm leading-[1.7] border-l-0 md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#D94F30]">
        <span className="absolute top-2 right-3 font-mono text-xs uppercase tracking-widest text-[#9E9790] opacity-50">
          {plainLabel}
        </span>
        {quotes.map((q, i) => (
          <p key={i} className="mb-4 last:mb-0 text-[#2C2A28]">
            {q.plain}
          </p>
        ))}
      </div>
    </div>
  );
}
