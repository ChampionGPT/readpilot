/**
 * input: { content, canEdit, onSubmit(newContent) }
 * output: 用户气泡 — hover 显示 ✎ 编辑按钮，编辑态内联 textarea + 重发/取消
 * pos: ChatPanel.MessageBubble 在 msg.role === 'user' 时渲染
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useEffect, useRef, useState } from 'react';

interface Props {
  content: string;
  canEdit: boolean;
  onRequestEdit: () => Promise<boolean>;   // 返回 true 表示用户确认了重发
  onSubmit: (newContent: string) => void;
}

export function EditableUserBubble({ content, canEdit, onRequestEdit, onSubmit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
      // auto-grow
      taRef.current.style.height = 'auto';
      taRef.current.style.height = `${taRef.current.scrollHeight}px`;
    }
  }, [editing]);

  const handleEnter = () => {
    if (!canEdit || editing) return;
    setDraft(content);
    setEditing(true);
  };
  const handleCancel = () => {
    setDraft(content);
    setEditing(false);
  };
  const handleResend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const ok = await onRequestEdit();
    if (!ok) return;
    setEditing(false);
    onSubmit(trimmed);
  };

  if (editing) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] w-full">
          <div className="bg-[#D94F30]/85 text-white rounded-2xl rounded-tr-sm shadow-md shadow-red-900/10 px-4 py-3">
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancel();
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleResend();
                }
              }}
              rows={1}
              className="w-full bg-transparent text-white placeholder-white/60 text-sm leading-relaxed resize-none focus:outline-none whitespace-pre-wrap"
              placeholder="编辑后重新发送…"
            />
            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-white/20">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1 rounded-full text-[11px] text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={!draft.trim() || draft.trim() === content}
                className="px-3 py-1 rounded-full text-[11px] bg-white text-[#D94F30] font-bold hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ctrl/⌘+Enter"
              >
                重发
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end mb-6 group">
      <div className="max-w-[85%] relative">
        <div className="max-w-full overflow-hidden break-words bg-[#D94F30] text-white rounded-2xl rounded-tr-sm shadow-md shadow-red-900/10 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleEnter}
            className="absolute -bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1/2 bg-white text-stone-600 hover:text-[#D94F30] shadow-md shadow-stone-300/30 rounded-full p-1.5 cursor-pointer border border-stone-200"
            title="编辑并重发"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
