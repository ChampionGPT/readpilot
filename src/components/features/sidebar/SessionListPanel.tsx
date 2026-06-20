/**
 * input: bookId, currentSessionId, onSelectSession
 * output: 会话列表面板 - 显示当前书籍的所有对话会话，支持创建、切换、删除与重命名
 * pos: 左侧栏 AI Assistant 入口的子面板
 *
 * 功能：
 * - 显示会话标题、最后更新时间
 * - 乐观 UI(Optimistic UI)：重命名、删瞬间生效，不卡顿
 * - 内联重命名 (Inline Rename) 与浮动操作栏
 * - 自定义优雅的防误触删除浮窗
 */
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ChatSession {
  id: string;
  bookId: string;
  title: string;
  sdkSessionId: string;
  provider?: 'claude' | 'codex' | 'hermes';
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

function getPreferredProvider(): 'claude' | 'codex' {
  if (typeof window === 'undefined') return 'claude';
  return window.localStorage.getItem('readpilot.chat.provider') === 'codex' ? 'codex' : 'claude';
}

interface SessionListPanelProps {
  bookId: string;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function SessionListPanel({
  bookId,
  currentSessionId,
  onSelectSession,
}: SessionListPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // States for deleting & renaming
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions/${bookId}`);
      if (res.ok) {
        const data = await res.json();
        const sortedSessions = (data as ChatSession[]).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setSessions(sortedSessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [bookId]);

  // 加载会话列表
  useEffect(() => {
    if (!bookId) return;
    loadSessions();
  }, [bookId, loadSessions]);

  useEffect(() => {
    if (renamingSessionId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingSessionId]);

  // 创建新会话
  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/chat/sessions/${bookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `对话 ${new Date().toLocaleDateString('zh-CN')}`, provider: getPreferredProvider() }),
      });
      if (res.ok) {
        const newSession = await res.json();
        await loadSessions();
        onSelectSession(newSession.id);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // 乐观更新：删除会话
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const sessionId = sessionToDelete.id;
    setSessionToDelete(null); // 先关弹窗

    const previousSessions = [...sessions];
    
    // 乐观立即删除界面元素
    setSessions(s => s.filter(s => s.id !== sessionId));
    
    // 乐观切换当前 Session（如果删除的是正在看的）
    if (sessionId === currentSessionId && previousSessions.length > 1) {
      const remaining = previousSessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        onSelectSession(remaining[0].id);
      }
    } else if (sessionId === currentSessionId && previousSessions.length === 1) {
      // 最后一个也删了，切换为空或触发ChatPanel自己重新生成
      onSelectSession("");
    }

    try {
      const res = await fetch(`/api/chat/sessions/detail/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Delete failed on server");
    } catch (err) {
      console.error('Failed to delete session:', err);
      // 回滚
      setSessions(previousSessions);
      if (sessionId === currentSessionId) onSelectSession(sessionId);
    }
  };

  // 重命名相关处理
  const startRenaming = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setRenamingSessionId(session.id);
    setRenameTitle(session.title);
  };

  const handleRenameSubmit = async () => {
    if (!renamingSessionId) return;
    const sessionId = renamingSessionId;
    const newTitle = renameTitle.trim();
    setRenamingSessionId(null);
    setRenameTitle("");

    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession || targetSession.title === newTitle || newTitle === "") return;

    const previousSessions = [...sessions];
    // 乐观立即修改标题
    setSessions(s => s.map(session => session.id === sessionId ? { ...session, title: newTitle } : session));

    try {
        const res = await fetch(`/api/chat/sessions/detail/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        if (!res.ok) throw new Error("Rename failed on server");
    } catch (err) {
        console.error('Failed to rename session:', err);
        // 回滚
        setSessions(previousSessions);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-pulse text-sm text-on-surface-variant">加载中...</div>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-4 relative">
      <div className="flex justify-between items-center mb-4 px-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
          对话会话
        </span>
        <button
          onClick={handleCreateSession}
          disabled={isCreating}
          className="text-[#D94F30] hover:text-[#C4432A] transition-colors cursor-pointer disabled:opacity-50"
          title="新建会话"
        >
          {isCreating ? (
            <span className="text-xs animate-pulse">创建中...</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 px-3">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-200/60 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9E9790" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-[11px] text-stone-400 font-sans mb-3">暂无对话会话</p>
          <button onClick={handleCreateSession} className="text-[11px] text-[#D94F30] font-bold hover:underline cursor-pointer">
            开始第一个对话
          </button>
        </div>
      ) : (
        <div className="space-y-1 pr-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => {
                // 如果没有在重命名，才允许点击切换会话
                if(renamingSessionId !== session.id) onSelectSession(session.id);
              }}
              className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 overflow-hidden ${
                currentSessionId === session.id
                  ? 'bg-white shadow-sm ring-1 ring-[#D94F30]/20'
                  : 'hover:bg-white/50'
              }`}
            >
              <div className="pr-12">
                {renamingSessionId === session.id ? (
                  <input
                    ref={inputRef}
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') {
                        setRenamingSessionId(null);
                        setRenameTitle("");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-stone-50 border border-[#D94F30]/40 rounded-sm px-1 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#D94F30] text-[#D94F30] transition-colors"
                  />
                ) : (
                  <h4 className={`text-sm font-medium line-clamp-1 ${
                    currentSessionId === session.id ? 'text-[#D94F30]' : 'text-[#2C2A28]'
                  }`}>
                    {session.title}
                  </h4>
                )}
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[#9E9790]">
                    {formatTime(session.updatedAt)}
                  </span>
                </div>
              </div>

              {/* 操作按钮区，只有 hover 且 不在重命名 状态下才显示 */}
              {renamingSessionId !== session.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-l from-white/90 via-white/80 pl-2 rounded-l-md">
                  <button
                    onClick={(e) => startRenaming(e, session)}
                    className="p-1.5 rounded-lg hover:bg-stone-200/80 transition-colors text-stone-400 hover:text-stone-700 cursor-pointer"
                    title="重命名"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-stone-400 hover:text-red-500 cursor-pointer"
                    title="删除会话"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              )}

              {currentSessionId === session.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#D94F30] rounded-r-full" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 优雅的统一删除弹窗 */}
      <ConfirmDialog
        isOpen={!!sessionToDelete}
        title="删除会话记录"
        message={sessionToDelete ? `《${sessionToDelete.title}》将被永久删除，一旦删除将无法恢复。` : ''}
        confirmLabel="确认删除"
        cancelLabel="取消"
        destructive
        onConfirm={confirmDeleteSession}
        onCancel={() => setSessionToDelete(null)}
      />
    </div>
  );
}
