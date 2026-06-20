/**
 * input: isOpen, title, message, onConfirm/onCancel + 可选 destructive 标记 / 自定义按钮文案
 * output: 与 ImportModal 同款的轻量确认弹窗（毛玻璃背景 + 圆角卡片 + 主操作按钮）
 * pos: src/components/ui 基础组件 — 项目内所有需要二次确认的破坏性操作的统一入口
 * 一旦更新请同步同级 README。
 */
"use client";
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmCls = destructive
    ? 'bg-[#D94F30] text-white hover:brightness-110'
    : 'bg-primary text-on-primary hover:brightness-110';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-scrim/40 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-surface-container-lowest w-[440px] max-w-[92vw] rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${destructive ? 'bg-red-50 text-[#D94F30]' : 'bg-primary/10 text-primary'}`}>
              {destructive ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-lg font-bold text-on-surface">{title}</h2>
              <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed whitespace-pre-line">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 px-6 pb-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="whitespace-nowrap rounded-xl bg-surface-container-low px-4 py-2.5 text-sm font-bold text-on-surface transition-[background-color,transform] hover:bg-surface-container active:scale-95 cursor-pointer"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter,transform] active:scale-95 cursor-pointer shadow-sm ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
