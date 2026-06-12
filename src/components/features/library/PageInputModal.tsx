/**
 * input: bookDir, bookTitle, currentProgress, onClose, onSave
 * output: 允许用户输入书籍总页数和当前阅读页数的弹窗
 * pos: 书架页面和分析面板的附属功能弹窗
 *
 * 功能：
 * - 用户输入纸质版/电子版书籍的实际总页数
 * - 用户输入当前阅读进度页数
 * - 实时显示计算预估的进度百分比
 * - 保存到 progress.json
 */
import React, { useState, useEffect } from 'react';

interface PageInputModalProps {
  isOpen: boolean;
  bookDir: string;
  bookTitle: string;
  initialTotalPages: number | null;
  initialCurrentPage: number | null;
  onClose: () => void;
  onSave: (totalPages: number, currentPage: number) => void;
}

export function PageInputModal({
  isOpen,
  bookDir,
  bookTitle,
  initialTotalPages,
  initialCurrentPage,
  onClose,
  onSave,
}: PageInputModalProps) {
  const [totalPages, setTotalPages] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 初始化输入值
  useEffect(() => {
    if (isOpen) {
      setTotalPages(initialTotalPages?.toString() || '');
      setCurrentPage(initialCurrentPage?.toString() || '');
    }
  }, [isOpen, initialTotalPages, initialCurrentPage]);

  if (!isOpen) return null;

  // 计算进度百分比
  const total = parseInt(totalPages, 10);
  const current = parseInt(currentPage, 10);
  const progressPercent = (
    !isNaN(total) && !isNaN(current) && total > 0
      ? Math.round((current / total) * 100)
      : null
  );

  // 验证输入
  const isValid = !isNaN(total) && !isNaN(current) && total > 0 && current >= 0 && current <= total;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 调用保存 API
      const res = await fetch(`/api/books/${bookDir}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalPages: total,
          currentPage: current,
        }),
      });

      if (res.ok) {
        onSave(total, current);
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || '保存失败');
      }
    } catch (err) {
      console.error(err);
      alert('保存时出错');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 生成预览渐变封面
  const generateGradient = (title: string) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 55%, 25%) 0%, hsl(${h2}, 50%, 15%) 100%)`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-scrim/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 弹窗核心 */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-surface-container-lowest w-[480px] max-w-[90vw] rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-5 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="font-serif text-xl font-bold text-on-surface">设置阅读进度</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* 书籍预览 */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-surface-container-low rounded-2xl">
            <div
              className="w-14 h-20 rounded-lg flex-shrink-0 shadow-md"
              style={{ background: generateGradient(bookTitle) }}
            />
            <div className="min-w-0">
              <h3 className="font-serif font-bold text-on-surface truncate">{bookTitle}</h3>
              <p className="text-xs text-on-surface-variant mt-1">输入书籍页数以跟踪阅读进度</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {/* 总页数输入 */}
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">
                书籍总页数
              </label>
              <input
                type="number"
                min="1"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-outline-variant/50 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
                placeholder="例如：320"
              />
              <p className="text-xs text-on-surface-variant mt-1.5">纸质版或电子版书籍的实际页数</p>
            </div>

            {/* 当前页数输入 */}
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">
                当前阅读页数
              </label>
              <input
                type="number"
                min="0"
                max={totalPages || undefined}
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-outline-variant/50 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
                placeholder="例如：120"
              />
              <p className="text-xs text-on-surface-variant mt-1.5">目前已阅读到的页码</p>
            </div>
          </div>

          {/* 进度预览 */}
          {isValid && progressPercent !== null && (
            <div className="mb-6 p-4 bg-surface-container rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-on-surface">进度预览</span>
                <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D94F30] to-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-on-surface-variant mt-2">
                已阅读 {current} / {total} 页
              </p>
            </div>
          )}

          {/* 无效输入提示 */}
          {totalPages && currentPage && !isValid && (
            <div className="mb-6 p-3 bg-error-container rounded-xl flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span className="text-sm text-on-error">当前页数不能大于总页数</span>
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-surface-container text-on-surface font-bold rounded-xl text-sm hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-on-primary font-bold rounded-xl text-sm hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all shadow-sm cursor-pointer flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <span className="animate-pulse">保存中...</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  保存进度
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}