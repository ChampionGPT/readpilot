/**
 * input: isOpen, onClose callback
 * output: 文章导入浮层 — 表单含标题/URL/正文/作者
 * pos: 文章模块独立的导入入口，由侧边栏 "Import Article" 触发
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState } from "react";

interface ArticleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ArticleImportModal({ isOpen, onClose, onSuccess }: ArticleImportModalProps) {
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError("标题和正文内容为必填项");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceUrl: sourceUrl.trim(),
          content: content.trim(),
          author: author.trim(),
          summary: content.trim().slice(0, 200),
        }),
      });

      if (!res.ok) throw new Error("Failed to create article");

      // 清空表单
      setTitle("");
      setSourceUrl("");
      setContent("");
      setAuthor("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "导入失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-stone-800">导入文章</h2>
              <p className="text-xs text-stone-400 mt-1">粘贴文章内容，开始沉浸式阅读</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer text-stone-400 hover:text-stone-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文章标题"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F30]/30 focus:border-[#D94F30] transition-all"
            />
          </div>

          {/* Source URL */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              来源 URL（选填）
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F30]/30 focus:border-[#D94F30] transition-all font-mono text-stone-600"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              作者（选填）
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="文章作者"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F30]/30 focus:border-[#D94F30] transition-all"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              正文内容 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴文章正文..."
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#D94F30]/30 focus:border-[#D94F30] transition-all resize-none"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              {content.length > 0 ? `${content.length} 字` : "支持纯文本，可直接粘贴"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-[#D94F30] hover:bg-[#C4432A] transition-colors shadow-sm shadow-[#D94F30]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "导入中..." : "导入文章"}
          </button>
        </div>
      </div>
    </div>
  );
}
