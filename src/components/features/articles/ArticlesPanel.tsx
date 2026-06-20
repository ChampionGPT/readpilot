/**
 * input: /api/articles, useBookStore (openArticle, viewMode)
 * output: 侧边栏文章列表面板 — 展示文章卡片、阅读状态
 * pos: 左侧栏的 articles 视图，替代原有的 BookshelfPanel 占位
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBookStore } from "@/store/useBookStore";
import type { Article } from "@/types/progress";

const STATUS_DOT: Record<string, string> = {
  unread: "bg-stone-300",
  reading: "bg-amber-400",
  completed: "bg-emerald-500",
};

export function ArticlesPanel() {
  const router = useRouter();
  const { openArticle, currentArticleId, setViewMode } = useBookStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/articles");
      if (res.ok) setArticles(await res.json());
    } catch (err) {
      console.error("Failed to load articles:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // 监听文章列表刷新（导入后触发）
  useEffect(() => {
    const handler = () => fetchArticles();
    window.addEventListener("refresh_articles", handler);
    return () => window.removeEventListener("refresh_articles", handler);
  }, [fetchArticles]);

  const showArticles = () => {
    router.push("/");
    setViewMode("articles");
  };

  const handleOpenArticle = (articleId: string) => {
    router.push("/");
    openArticle(articleId);
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-pulse text-sm text-stone-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-4">
      <div className="flex justify-between items-center mb-4 px-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
          文章列表
        </span>
        <span className="text-[10px] text-stone-400">{articles.length} 篇</span>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-8 px-3">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-200/60 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9E9790" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-[11px] text-stone-400 font-sans mb-3">暂无文章</p>
          <button
            onClick={showArticles}
            className="text-[11px] text-[#D94F30] font-bold hover:underline cursor-pointer"
          >
            去导入文章
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {articles.map((article) => {
            const isActive = currentArticleId === article.id;
            const dotColor = STATUS_DOT[article.readStatus] || STATUS_DOT.unread;

            return (
              <div
                key={article.id}
                onClick={() => handleOpenArticle(article.id)}
                className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "bg-white shadow-sm ring-1 ring-[#D94F30]/20"
                    : "hover:bg-white/50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Status Dot */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />

                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium line-clamp-2 leading-snug ${
                      isActive ? "text-[#D94F30]" : "text-[#2C2A28]"
                    }`}>
                      {article.title}
                    </h4>

                    <div className="flex items-center gap-2 mt-1">
                      {article.author && (
                        <span className="text-[9px] text-stone-500 truncate max-w-[80px]">{article.author}</span>
                      )}
                      <span className="text-[9px] text-[#9E9790]">
                        {article.content.length} 字
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#D94F30] rounded-r-full" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
