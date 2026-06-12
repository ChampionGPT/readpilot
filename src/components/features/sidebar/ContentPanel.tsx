"use client";

import { useBookStore } from "@/store/useBookStore";
import type { ProgressPage } from "@/types/progress-data";

const statusColor: Record<string, string> = {
  completed: "text-emerald-600",
  "in-progress": "text-primary",
  new: "text-cyan-600",
};

const typeColor: Record<string, string> = {
  overview: "border-l-primary",
  chapter: "border-l-cyan-600",
  deepdive: "border-l-purple-600",
  theme: "border-l-amber-500",
  synthesis: "border-l-emerald-600",
};

export function ContentPanel() {
  const { progress, currentPage, setViewMode, setCurrentPage, selectedBookDir } = useBookStore();

  const handleSelectPage = (page: ProgressPage) => {
    if (!selectedBookDir) return;
    setCurrentPage(page);
    setViewMode("page");
  };

  const handleViewHub = () => {
    setViewMode("hub");
    setCurrentPage(null);
  };

  return (
    <div className="pt-2">
      <div className="flex justify-between items-center mb-4 px-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">Reading Journey</span>
      </div>
      
      {progress ? (
        <div className="space-y-1.5 pb-6">
          <button
            onClick={handleViewHub}
            className={`w-full text-left p-3 rounded-lg border-l-[3px] border-l-stone-300 transition-all cursor-pointer flex items-center gap-2 ${
              !currentPage ? "bg-white shadow-sm ring-1 ring-black/5" : "hover:bg-white/60 text-stone-600"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={!currentPage ? "text-[#D94F30]" : ""}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span className={`text-xs font-bold leading-none ${!currentPage ? "text-[#2C2A28]" : ""}`}>Book Dashboard</span>
          </button>

          {progress.pages?.map((page: ProgressPage) => (
            <button
              key={page.id}
              onClick={() => handleSelectPage(page)}
              className={`w-full text-left p-3 rounded-lg border-l-[3px] transition-all cursor-pointer ${
                typeColor[page.type] || "border-l-stone-300"
              } ${
                currentPage?.id === page.id
                  ? "bg-white shadow-sm ring-1 ring-[#D94F30]/20"
                  : "hover:bg-white/60"
              }`}
            >
              <div className="flex items-start gap-2">
                 <span className={`text-sm mt-0.5 shrink-0 ${statusColor[page.status]}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" fillOpacity="0.2"/><circle cx="12" cy="12" r="4"/></svg>
                 </span>
                 <div className="flex-1 min-w-0">
                   <p className={`text-xs font-bold leading-snug truncate ${currentPage?.id === page.id ? "text-[#D94F30]" : "text-stone-700"}`}>{page.title}</p>
                   <div className="flex gap-2 mt-1.5">
                     <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[#f0ede9] text-[#6B6560] block w-max">
                       {page.type}
                     </span>
                   </div>
                 </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center my-10 py-6 px-4 bg-white/40 rounded-xl border border-stone-200/50">
           <p className="text-xs text-stone-500 font-sans">Select a book from the Bookshelf to view contents.</p>
        </div>
      )}
    </div>
  );
}
