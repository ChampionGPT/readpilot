"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { GlossaryTooltipProps } from "@/types/components";

export function GlossaryTooltip({ terms }: GlossaryTooltipProps) {
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleTermClick = useCallback((term: string, e: React.MouseEvent) => {
    if (activeTerm === term) {
      setActiveTerm(null);
      return;
    }
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: Math.max(16, rect.left + rect.width / 2 - 150),
    });
    setActiveTerm(term);
  }, [activeTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setActiveTerm(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const termEntries = Object.entries(terms);

  return (
    <div className="my-6">
      <div className="flex flex-wrap gap-2">
        {termEntries.map(([term]) => (
          <button
            key={term}
            onClick={(e) => handleTermClick(term, e)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
              activeTerm === term
                ? "bg-[#D94F30] text-white shadow-sm"
                : "bg-[#FDEEE9] text-[#D94F30] hover:bg-[#D94F30]/15"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {term}
          </button>
        ))}
      </div>

      {/* Tooltip popup */}
      {activeTerm && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-[300px] bg-[#2A2520] text-[#EAE4D9] rounded-xl p-4 shadow-xl animate-[fadeSlideUp_0.2s_cubic-bezier(0.16,1,0.3,1)_both]"
          style={{ top: position.top, left: position.left }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">{activeTerm}</span>
            <button
              onClick={() => setActiveTerm(null)}
              className="text-[#9E9790] hover:text-white transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[#EAE4D9]/80">
            {terms[activeTerm]}
          </p>
        </div>
      )}
    </div>
  );
}
