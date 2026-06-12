/**
 * input: /api/articles, useBookStore (openArticle)
 * output: 文章列表视图 — 中央面板展示所有文章，支持导入、删除
 * pos: ReaderApp 中 viewMode === "articles" 时的主渲染组件
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useBookStore } from "@/store/useBookStore";
import { ArticleImportModal } from "./ArticleImportModal";
import type { Article } from "@/types/progress";

// 阅读状态标签配色
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  unread:    { bg: "bg-stone-100", text: "text-stone-500", label: "未读" },
  reading:   { bg: "bg-amber-50",  text: "text-amber-600", label: "阅读中" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-600", label: "已读" },
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 自定义删除确认框
function DeleteConfirmModal({ isOpen, title, onConfirm, onCancel }: { isOpen: boolean; title: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-center text-stone-800 mb-2">删除文章</h3>
          <p className="text-sm text-stone-500 text-center mb-6">
            确定要永久删除 <span className="font-semibold text-stone-700">"{title}"</span> 吗？
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer">取消</button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArticlesListView() {
  const { openArticle } = useBookStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/articles");
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (err) {
      console.error("Failed to load articles:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // 乐观删除
  const confirmDelete = async () => {
    if (!articleToDelete) return;
    const id = articleToDelete.id;
    setArticleToDelete(null);

    const previous = [...articles];
    setArticles(a => a.filter(a => a.id !== id));

    try {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setArticles(previous);
    }
  };

  // 空状态
  if (!isLoading && articles.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center p-8 text-center bg-[#FAF7F2]">
        <div className="w-24 h-24 bg-stone-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D94F30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h1 className="font-serif text-4xl font-bold text-stone-700 mb-4">深度文章库</h1>
        <p className="text-stone-500 text-base leading-relaxed max-w-lg mx-auto mb-8">
          将你收藏的长文、研报、深度分析导入这里，享受沉浸式无干扰阅读体验。
        </p>
        <button
          onClick={() => setIsImportOpen(true)}
          className="px-8 py-3.5 bg-[#D94F30] text-white font-bold rounded-full text-base hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          导入第一篇文章
        </button>
        <ArticleImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={fetchArticles} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-8 py-10 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex justify-between items-end mb-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#D94F30] mb-3">ReadPilot Articles</p>
          <h1 className="font-serif text-5xl font-bold text-stone-700 tracking-tight">深度文章</h1>
        </div>
        <button
          onClick={() => setIsImportOpen(true)}
          className="px-5 py-2.5 bg-stone-100 text-stone-600 font-bold rounded-xl text-sm hover:bg-stone-200 hover:text-stone-800 transition-all cursor-pointer flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          导入文章
        </button>
      </header>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-stone-200/60 animate-pulse">
              <div className="h-5 bg-stone-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-stone-100 rounded w-full mb-2" />
              <div className="h-3 bg-stone-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => {
            const status = STATUS_STYLES[article.readStatus] || STATUS_STYLES.unread;
            return (
              <div
                key={article.id}
                onClick={() => openArticle(article.id)}
                className="group relative bg-white rounded-2xl p-6 border border-stone-200/60 hover:border-[#D94F30]/30 hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                      {article.sourceUrl && (
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-stone-400 hover:text-[#D94F30] transition-colors truncate max-w-[200px]"
                        >
                          {new URL(article.sourceUrl).hostname}
                        </a>
                      )}
                    </div>
                    <h3 className="text-lg font-serif font-bold text-stone-800 group-hover:text-[#D94F30] transition-colors line-clamp-1 mb-1.5">
                      {article.title}
                    </h3>
                    <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">
                      {article.summary || article.content.slice(0, 150)}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-stone-400">
                      {article.author && <span className="font-medium">{article.author}</span>}
                      <span>{formatTime(article.updatedAt)}</span>
                      <span>{article.content.length} 字</span>
                    </div>
                  </div>

                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setArticleToDelete(article); }}
                    className="p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all cursor-pointer text-stone-300 hover:text-red-500"
                    title="删除文章"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ArticleImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={fetchArticles} />
      <DeleteConfirmModal
        isOpen={!!articleToDelete}
        title={articleToDelete?.title || ""}
        onConfirm={confirmDelete}
        onCancel={() => setArticleToDelete(null)}
      />
    </div>
  );
}
