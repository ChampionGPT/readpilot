/**
 * input: currentArticleId (from useBookStore), /api/articles/[id]
 * output: 文章沉浸式阅读视图 — 优质排版 + 面包屑导航 + 阅读状态标记
 * pos: ReaderApp 中 viewMode === "article-read" 时的主渲染组件
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState, useEffect } from "react";
import { useBookStore } from "@/store/useBookStore";
import type { Article } from "@/types/progress";

export function ArticleReadView() {
  const { currentArticleId, setViewMode, setCurrentArticleId } = useBookStore();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentArticleId) return;

    const fetchArticle = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/articles/${currentArticleId}`);
        if (res.ok) {
          const data = await res.json();
          setArticle(data);

          // 自动标记为"阅读中"
          if (data.readStatus === "unread") {
            fetch(`/api/articles/${currentArticleId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ readStatus: "reading" }),
            });
          }
        }
      } catch (err) {
        console.error("Failed to load article:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [currentArticleId]);

  const handleBack = () => {
    setCurrentArticleId(null);
    setViewMode("articles");
  };

  const handleMarkComplete = async () => {
    if (!article) return;
    const newStatus = article.readStatus === "completed" ? "reading" : "completed";

    // Optimistic
    setArticle({ ...article, readStatus: newStatus });

    try {
      await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readStatus: newStatus }),
      });
    } catch {
      setArticle({ ...article, readStatus: article.readStatus });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#FAF7F2]">
        <div className="max-w-3xl mx-auto animate-pulse">
          <div className="h-4 bg-stone-200 rounded w-32 mb-8" />
          <div className="h-8 bg-stone-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-stone-100 rounded w-1/3 mb-10" />
          <div className="space-y-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-4 bg-stone-100 rounded w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAF7F2]">
        <div className="text-center">
          <p className="text-stone-500 mb-4">文章未找到</p>
          <button onClick={handleBack} className="text-[#D94F30] font-bold hover:underline cursor-pointer">返回文章列表</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] hide-scrollbar">
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-10 px-8 py-3 bg-[#FAF7F2]/80 backdrop-blur-md border-b border-stone-200/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-2 text-xs text-stone-400">
            <button onClick={handleBack} className="hover:text-[#D94F30] transition-colors cursor-pointer font-medium">
              ← Articles
            </button>
            <span>/</span>
            <span className="text-stone-600 line-clamp-1 max-w-[300px]">{article.title}</span>
          </nav>

          <button
            onClick={handleMarkComplete}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              article.readStatus === "completed"
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {article.readStatus === "completed" ? "已读完" : "标记为已读"}
          </button>
        </div>
      </div>

      {/* Article Content */}
      <div className="px-8 py-10">
        <article className="max-w-3xl mx-auto">
          {/* Title Block */}
          <header className="mb-10">
            <h1 className="font-serif text-4xl md:text-[2.75rem] font-bold text-stone-800 leading-tight mb-4">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-stone-400">
              {article.author && (
                <span className="font-medium text-stone-600">{article.author}</span>
              )}
              <span>{new Date(article.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
              <span>{article.content.length} 字</span>
            </div>
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-xs text-[#D94F30] hover:underline"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                查看原文
              </a>
            )}
            <div className="h-px bg-stone-200 mt-8" />
          </header>

          {/* Body Text — premium typography */}
          <div className="font-serif text-[1.125rem] text-stone-700 leading-[1.9] whitespace-pre-wrap tracking-wide">
            {article.content}
          </div>

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="text-sm text-stone-400 hover:text-[#D94F30] transition-colors cursor-pointer flex items-center gap-1"
              >
                ← 返回文章列表
              </button>
              <button
                onClick={handleMarkComplete}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  article.readStatus === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#D94F30] text-white hover:brightness-110 shadow-sm"
                }`}
              >
                {article.readStatus === "completed" ? "✓ 已读完" : "标记为已读"}
              </button>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
