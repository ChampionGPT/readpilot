/**
 * input: bookId, bookTitle, hidden context metadata, useBookStore (currentSessionId)
 * output: AI 对话面板 — block 路由 + SSE 流 + 历史 hydration（含 blocks_json 解码）
 * pos: 右栏核心组件 — 消费 useSSEStream block-based state，按 block.kind 路由到对应组件
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Circle, ListTodo, LoaderCircle, MinusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSSEStream, type ChatContextMeta, type ChatMessage, type ChatProviderId, type DerivedStatus } from "@/hooks/useSSEStream";
import { useBookStore } from "@/store/useBookStore";
import type { ChatBlock, AssistantMessage, ToolVariant } from "@/types/chat-blocks";
import { TextBlock } from "./blocks/TextBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { SystemBlock } from "./blocks/SystemBlock";
import { DiagnosticBlock } from "./blocks/DiagnosticBlock";
import { ErrorBlock } from "./blocks/ErrorBlock";
import { ToolUseBlock } from "./blocks/ToolUseBlock";
import { ToolResultBlock } from "./blocks/ToolResultBlock";
import { InteractiveQuestionBlock } from "./blocks/InteractiveQuestionBlock";
import { EditableUserBubble } from "./blocks/EditableUserBubble";

// 临时占位类型（Task 5 时由 reducer 实现 derivedStage 替换）
type StreamStatus = DerivedStatus;

type SlashCommandItem = {
  name: string;
  value: string;
  description: string;
  kind: 'slash_command' | 'skill' | 'sdk_command';
};

function commandName(value: unknown): string {
  if (typeof value === 'string') return value.replace(/^\//, '');
  if (value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string') {
    return (value as { name: string }).name.replace(/^\//, '');
  }
  return '';
}

function commandDescription(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && typeof (value as { description?: unknown }).description === 'string') {
    return (value as { description: string }).description;
  }
  return fallback;
}

function runtimeSlashCommands(messages: ChatMessage[]): SlashCommandItem[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    for (let j = msg.blocks.length - 1; j >= 0; j -= 1) {
      const block = msg.blocks[j];
      if (block.kind !== 'system' || block.subtype !== 'init') continue;
      const commands = (block.slashCommands ?? []).map((item) => {
        const name = commandName(item);
        return name ? { name, value: `/${name}`, description: commandDescription(item, `/${name}`), kind: 'sdk_command' as const } : null;
      }).filter(Boolean) as SlashCommandItem[];
      const skills = (block.skills ?? []).map((item) => {
        const name = commandName(item);
        return name ? { name, value: `/${name}`, description: commandDescription(item, `Skill: ${name}`), kind: 'skill' as const } : null;
      }).filter(Boolean) as SlashCommandItem[];
      return [...commands, ...skills];
    }
  }
  return [];
}

interface ChatPanelProps {
  contextMeta?: ChatContextMeta;
  bookTitle?: string;
  bookId?: string;
}

const ACTIVITY_COPY: Record<StreamStatus["stage"], string> = {
  idle: "",
  complete: "",
  thinking: "正在整理思路",
  calling: "正在读取上下文",
  streaming: "正在生成回答",
  waiting: "等待你的选择",
  error: "回答遇到问题",
};

const PROVIDER_STORAGE_KEY = 'readpilot.chat.provider';
const CHAT_PROVIDERS: Array<{ id: ChatProviderId; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
];

function isChatProvider(value: unknown): value is ChatProviderId {
  return value === 'claude' || value === 'codex' || value === 'hermes';
}

function getStoredProvider(): ChatProviderId {
  if (typeof window === 'undefined') return 'claude';
  const saved = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
  return isChatProvider(saved) && saved !== 'hermes' ? saved : 'claude';
}

function ProviderSwitch({
  value,
  disabled,
  onChange,
}: {
  value: ChatProviderId;
  disabled: boolean;
  onChange: (provider: ChatProviderId) => void;
}) {
  return (
    <div className="flex h-7 shrink-0 items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-[10px] font-semibold">
      {CHAT_PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(provider.id)}
          className={`h-6 whitespace-nowrap rounded-md px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            value === provider.id
              ? 'bg-white text-[#B4492F] shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
          title={`Use ${provider.label}`}
        >
          {provider.label}
        </button>
      ))}
    </div>
  );
}

function WaitingDots() {
  return (
    <span className="inline-flex w-4 items-center justify-between" aria-hidden="true">
      <span className="h-1 w-1 animate-pulse rounded-full bg-[#D94F30]/70" style={{ animationDelay: "0ms" }} />
      <span className="h-1 w-1 animate-pulse rounded-full bg-[#D94F30]/60" style={{ animationDelay: "160ms" }} />
      <span className="h-1 w-1 animate-pulse rounded-full bg-[#D94F30]/50" style={{ animationDelay: "320ms" }} />
    </span>
  );
}

type AgentTodoStatus = 'pending' | 'in_progress' | 'completed' | string;

interface AgentTodoItem {
  content: string;
  status: AgentTodoStatus;
  activeForm?: string;
}

function isAgentTodoItem(value: unknown): value is AgentTodoItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.content === 'string' && typeof item.status === 'string';
}

function getLatestAgentTodos(assistant?: AssistantMessage): AgentTodoItem[] {
  if (!assistant) return [];

  for (let i = assistant.blocks.length - 1; i >= 0; i -= 1) {
    const block = assistant.blocks[i];
    if (block.kind !== 'tool_use' || block.variant !== 'todo_write') continue;
    const rawTodos = block.input?.todos;
    if (!Array.isArray(rawTodos)) return [];
    return rawTodos.filter(isAgentTodoItem);
  }

  return [];
}

function TodoStatusIcon({ status }: { status: AgentTodoStatus }) {
  if (status === 'completed') {
    return <Check className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (status === 'in_progress') {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  }
  if (status === 'pending') {
    return <Circle className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  return <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function AgentTodoDock({ todos, active }: { todos: AgentTodoItem[]; active: boolean }) {
  if (todos.length === 0) return null;

  const completed = todos.filter((todo) => todo.status === 'completed').length;

  return (
    <section
      aria-label="Agent plan"
      className="shrink-0 border-b border-stone-200/60 bg-[#FAF7F2]/95 px-4 py-2 shadow-sm shadow-stone-200/30 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-stone-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#D94F30]/10 text-[#B4492F]">
            <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="truncate">Agent Todo</span>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-stone-400">
          {completed}/{todos.length}
          {active ? ' running' : ' done'}
        </span>
      </div>

      <ol className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
        {todos.map((todo, index) => {
          const isDone = todo.status === 'completed';
          const isCurrent = todo.status === 'in_progress';
          const label = isCurrent && todo.activeForm ? todo.activeForm : todo.content;

          return (
            <li
              key={`${todo.status}-${todo.content}-${index}`}
              className={`flex min-h-7 items-start gap-2 rounded-md px-2 py-1 text-[11px] leading-5 ${
                isCurrent
                  ? 'bg-white text-stone-800 ring-1 ring-[#D94F30]/15'
                  : isDone
                    ? 'text-stone-400'
                    : 'text-stone-600'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  isDone
                    ? 'bg-emerald-50 text-emerald-600'
                    : isCurrent
                      ? 'bg-[#D94F30]/10 text-[#B4492F]'
                      : 'text-stone-300'
                }`}
                title={todo.status}
              >
                <TodoStatusIcon status={todo.status} />
              </span>
              <span className={`min-w-0 flex-1 break-words ${isDone ? 'line-through decoration-stone-300' : ''}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RunStatusPill({ status, active, usageLabel }: { status: StreamStatus; active: boolean; usageLabel?: string | null }) {
  const copy = status.stage === "calling" ? status.message : ACTIVITY_COPY[status.stage] || status.message || "正在处理";

  return (
    <div
      aria-live="polite"
      className={`ml-auto flex h-5 min-w-0 max-w-[62%] items-center gap-1.5 rounded-full border border-[#E5DFD6]/80 bg-white/65 px-2 text-[10px] font-medium text-stone-500 shadow-sm shadow-stone-200/20 transition-opacity duration-150 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#D94F30]/75" />
      <span className="max-w-[112px] truncate">{copy}</span>
      {usageLabel && (
        <>
          <span className="text-stone-300">·</span>
          <span className="max-w-[96px] truncate text-stone-400">{usageLabel}</span>
        </>
      )}
      <WaitingDots />
    </div>
  );
}

const TOOL_ACTIVITY: Record<ToolVariant, { symbol: string; verb: string }> = {
  generic: { symbol: '•', verb: '调用工具' },
  read: { symbol: '↑', verb: '读取' },
  write: { symbol: '↓', verb: '写入' },
  edit: { symbol: '↓', verb: '编辑' },
  bash: { symbol: '$', verb: '执行命令' },
  todo_write: { symbol: '↓', verb: '更新计划' },
  skill: { symbol: '◇', verb: '运行技能' },
  task: { symbol: '•', verb: '启动任务' },
};

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1000) {
    const compact = value >= 10000 ? Math.round(value / 1000) : Math.round(value / 100) / 10;
    return `${compact}k`;
  }
  return `${Math.round(value)}`;
}

function estimateOutputTokens(assistant: AssistantMessage): number {
  const chars = assistant.blocks.reduce((sum, block) => {
    if ((block.kind === 'text' || block.kind === 'thinking') && block.text) return sum + block.text.length;
    return sum;
  }, 0);
  return Math.max(0, Math.ceil(chars / 3.8));
}

function formatUsageLabel(assistant: AssistantMessage, active: boolean): string | null {
  const metrics = assistant.metrics;
  if (metrics?.tokensIn || metrics?.tokensOut) {
    const parts = [];
    if (metrics.tokensIn) parts.push(`in ${formatCompactNumber(metrics.tokensIn)}`);
    if (metrics.tokensOut) parts.push(`out ${formatCompactNumber(metrics.tokensOut)}`);
    return parts.length > 0 ? `${parts.join(' / ')} tok` : null;
  }

  if (!active) return null;
  const estimate = estimateOutputTokens(assistant);
  return estimate > 0 ? `out ~${formatCompactNumber(estimate)} tok` : null;
}

function formatFinalMetrics(assistant: AssistantMessage): string | null {
  const parts: string[] = [];
  const usage = formatUsageLabel(assistant, false);
  if (usage) parts.push(usage);
  if (assistant.metrics?.durationMs) parts.push(`${(assistant.metrics.durationMs / 1000).toFixed(1)}s`);
  if (assistant.metrics?.costUSD) parts.push(`$${assistant.metrics.costUSD.toFixed(4)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function previewToolInput(input: Record<string, unknown>): string {
  if (!input || typeof input !== 'object') return '';
  const value =
    typeof input.file_path === 'string' ? input.file_path :
    typeof input.path === 'string' ? input.path :
    typeof input.pattern === 'string' ? input.pattern :
    typeof input.command === 'string' ? input.command :
    typeof input.query === 'string' ? input.query :
    typeof input.description === 'string' ? input.description :
    '';
  return value.length > 48 ? `…${value.slice(-48)}` : value;
}

function getActivityLine(assistant: AssistantMessage, status: StreamStatus): { symbol: string; label: string } {
  const streamingBlocks = assistant.blocks.filter((block) => block.status === 'streaming');
  const activeBlock = streamingBlocks.length > 0
    ? streamingBlocks[streamingBlocks.length - 1]
    : assistant.blocks[assistant.blocks.length - 1];

  if (!activeBlock) return { symbol: '•', label: '准备上下文' };

  if (activeBlock.kind === 'tool_use') {
    const meta = TOOL_ACTIVITY[activeBlock.variant] ?? TOOL_ACTIVITY.generic;
    const preview = previewToolInput(activeBlock.input);
    return { symbol: meta.symbol, label: preview ? `${meta.verb} ${preview}` : `${meta.verb} ${activeBlock.name}` };
  }

  if (activeBlock.kind === 'tool_result') return { symbol: '•', label: activeBlock.isError ? '工具返回错误' : '整理工具结果' };
  if (activeBlock.kind === 'text') return { symbol: '•', label: '输出回答' };
  if (activeBlock.kind === 'thinking') return { symbol: '•', label: '思考中' };
  if (activeBlock.kind === 'interactive_question') return { symbol: '?', label: '等待你的选择' };
  if (activeBlock.kind === 'diagnostic') return { symbol: '•', label: '处理运行日志' };
  return { symbol: '•', label: status.message || '处理中' };
}

function RunActivityLine({ assistant, status }: { assistant: AssistantMessage; status: StreamStatus }) {
  const activity = getActivityLine(assistant, status);
  const usageLabel = formatUsageLabel(assistant, true);

  return (
    <div
      aria-live="polite"
      className="flex min-h-8 max-w-full items-center gap-2 rounded-lg border border-[#E5DFD6]/70 bg-white/55 px-3 py-1.5 text-[11px] text-stone-500 shadow-sm shadow-stone-200/20"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D94F30]/10 font-bold text-[#B4492F]">
        {activity.symbol}
      </span>
      <span className="min-w-0 flex-1 truncate">{activity.label}</span>
      {usageLabel && <span className="shrink-0 text-[10px] text-stone-400">{usageLabel}</span>}
      <WaitingDots />
    </div>
  );
}

function AssistantMetricsLine({ assistant }: { assistant: AssistantMessage }) {
  const label = formatFinalMetrics(assistant);
  if (!label) return null;

  return (
    <div className="px-1 text-[10px] text-stone-400">
      {label}
    </div>
  );
}

function ProviderBadge({ provider }: { provider?: ChatProviderId }) {
  if (!provider || provider === 'hermes') return null;
  return (
    <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
      {provider === 'codex' ? 'Codex' : 'Claude'}
    </div>
  );
}

// ── 子组件：单个 block 路由器 ──
function BlockRouter({ block, onPermissionSubmit }: {
  block: ChatBlock;
  onPermissionSubmit: (permissionRequestId: string, answers: Record<string, string>) => Promise<void>;
}) {
  switch (block.kind) {
    case 'text':
      return <TextBlock block={block} />;
    case 'thinking':
      return <ThinkingBlock block={block} />;
    case 'system':
      return <SystemBlock block={block} />;
    case 'diagnostic':
      return <DiagnosticBlock block={block} />;
    case 'error':
      return <ErrorBlock block={block} />;
    case 'tool_use':
      return <ToolUseBlock block={block} />;
    case 'tool_result':
      return <ToolResultBlock block={block} />;
    case 'interactive_question':
      return <InteractiveQuestionBlock block={block} onSubmit={onPermissionSubmit} />;
    default:
      return null;
  }
}

// ── 子组件：单条消息 ──
function MessageBubble({ msg, index, userOrdinal, isLast, canEdit, status, onPermissionSubmit, onRequestRewind, onRewindSubmit }: {
  msg: ChatMessage;
  index: number;
  userOrdinal: number;
  isLast: boolean;
  canEdit: boolean;
  status: StreamStatus;
  onPermissionSubmit: (permissionRequestId: string, answers: Record<string, string>) => Promise<void>;
  onRequestRewind: () => Promise<boolean>;
  onRewindSubmit: (index: number, userOrdinal: number, messageId: string | undefined, originalContent: string, newContent: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <EditableUserBubble
        content={msg.content}
        canEdit={canEdit}
        onRequestEdit={onRequestRewind}
        onSubmit={(newContent) => onRewindSubmit(index, userOrdinal, msg.id, msg.content, newContent)}
      />
    );
  }

  const assistant = msg as AssistantMessage;
  const hasAnyContent = assistant.blocks.length > 0;
  const showActivity = isLast && assistant.isStreaming;

  if (!hasAnyContent && !showActivity) return null;

  return (
    <div className="flex justify-start mb-6">
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D94F30] to-[#E6785E] shadow-sm flex items-center justify-center text-white text-xs font-bold shrink-0 mr-3 mt-1">
        RP
      </div>

      <div className="max-w-[85%] flex flex-col flex-1 gap-2">
        <ProviderBadge provider={assistant.provider} />
        {assistant.blocks.map((block) => (
          <BlockRouter key={block.id} block={block} onPermissionSubmit={onPermissionSubmit} />
        ))}
        {showActivity && <RunActivityLine assistant={assistant} status={status} />}
        {!assistant.isStreaming && <AssistantMetricsLine assistant={assistant} />}
      </div>
    </div>
  );
}

// ── 工具函数：把 DB 里的 message row 转成 ChatMessage ──
function hydrateMessage(m: { role: 'user' | 'assistant'; content: string; blocks_json?: string | null; id?: string; provider?: ChatProviderId | null }): ChatMessage {
  if (m.role === 'user') return { id: m.id, role: 'user', content: m.content, provider: m.provider ?? undefined };

  if (m.blocks_json) {
    try {
      const blocks = JSON.parse(m.blocks_json) as ChatBlock[];
      if (Array.isArray(blocks) && blocks.length > 0) {
        return { id: m.id, role: 'assistant', blocks, isStreaming: false, provider: m.provider ?? undefined };
      }
    } catch {
      /* fall through to text fallback */
    }
  }

  // 老消息或 blocks_json 缺失/损坏 → 回退到单个 text block
  return {
    id: m.id,
    role: 'assistant',
    provider: m.provider ?? undefined,
    blocks: [{
      id: m.id ?? `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'text',
      text: m.content,
      status: 'complete',
      startedAt: 0,
      endedAt: 0,
    }],
    isStreaming: false,
  };
}

type HistoryMessageRow = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  blocks_json?: string | null;
  blocksJson?: string | null;
  provider?: ChatProviderId | null;
};

// ── 主组件 ──
function formatContextLabel(contextMeta?: ChatContextMeta) {
  if (!contextMeta) return "书库首页";
  if (contextMeta.pageTitle && contextMeta.bookTitle) {
    return `当前章节 · ${contextMeta.bookTitle} / ${contextMeta.pageTitle}`;
  }
  if (contextMeta.bookTitle) {
    return `当前书籍 · ${contextMeta.bookTitle}`;
  }
  if (contextMeta.viewMode === "articles" || contextMeta.viewMode === "article-read") {
    return "文章阅读";
  }
  return "书库首页";
}

export function ChatPanel({ contextMeta, bookTitle, bookId }: ChatPanelProps) {
  const { messages, sendMessage, isLoading, error, stop, replaceMessages, submitInteractiveAnswer, status, rewindTo } = useSSEStream();

  const [inputValue, setInputValue] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteNativeSession, setDeleteNativeSession] = useState(false);
  const [slashCommands, setSlashCommands] = useState<SlashCommandItem[]>([]);
  const [slashLoading, setSlashLoading] = useState(false);
  const [pendingRewindResolve, setPendingRewindResolve] = useState<((ok: boolean) => void) | null>(null);
  const [activeProvider, setActiveProvider] = useState<ChatProviderId>('claude');
  const [providerReady, setProviderReady] = useState(false);
  const currentSessionId = useBookStore((s) => s.currentSessionId);
  const setCurrentSessionId = useBookStore((s) => s.setCurrentSessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeBookIdRef = useRef<string | null>(null);
  const lastHydratedKeyRef = useRef<string | null>(null);
  // Sticky-bottom: 只有用户当前贴在底部时，新消息/流式 token 才自动滚到底
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const lastAutoScrollAtRef = useRef(0);
  const wasLoadingRef = useRef(false);
  const progressReloadTimerRef = useRef<number | null>(null);
  const activeProviderRef = useRef<ChatProviderId>(activeProvider);
  const slashFilter = inputValue.startsWith('/') && !inputValue.includes(' ') ? inputValue.slice(1).toLowerCase() : '';
  const slashOpen = activeProvider === 'claude' && !isLoading && inputValue.startsWith('/') && !inputValue.includes(' ');

  useEffect(() => {
    const saved = getStoredProvider();
    activeProviderRef.current = saved;
    setActiveProvider(saved);
    setProviderReady(true);
  }, []);

  useEffect(() => {
    activeProviderRef.current = activeProvider;
    if (providerReady) window.localStorage.setItem(PROVIDER_STORAGE_KEY, activeProvider);
  }, [activeProvider, providerReady]);

  useEffect(() => {
    if (!slashOpen) {
      setSlashCommands([]);
      return;
    }

    const controller = new AbortController();
    setSlashLoading(true);
    const params = new URLSearchParams({ provider: 'claude' });
    if (contextMeta?.bookDir) params.set('bookDir', contextMeta.bookDir);
    fetch(`/api/agent/commands?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : { commands: [] })
      .then((data) => setSlashCommands(Array.isArray(data.commands) ? data.commands : []))
      .catch((err) => {
        if (err.name !== 'AbortError') setSlashCommands([]);
      })
      .finally(() => setSlashLoading(false));

    return () => controller.abort();
  }, [slashOpen, contextMeta?.bookDir]);

  // 输入框自适应高度：单行起步，最高 6 行 (~140px)，超过出现内部滚动
  const adjustInputHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(140, el.scrollHeight) + 'px';
  }, []);

  useLayoutEffect(() => {
    adjustInputHeight();
  }, [inputValue, adjustInputHeight]);

  const requestRewindConfirm = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingRewindResolve(() => resolve);
    });
  }, []);

  const handleProviderChange = useCallback((provider: ChatProviderId) => {
    if (provider === 'hermes') return;
    setActiveProvider(provider);
    if (!currentSessionId) return;

    fetch(`/api/chat/sessions/detail/${currentSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    }).catch((err) => {
      console.error('[provider] failed to persist provider:', err);
    });
  }, [currentSessionId]);

  const handleRewindAndResend = useCallback(async (index: number, userOrdinal: number, messageId: string | undefined, originalContent: string, newContent: string) => {
    if (!currentSessionId) return;
    // 1) 中断当前流（如有）
    if (isLoading) stop();

    try {
      const res = await fetch('/api/chat/rewind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, fromIndex: index, messageId, userOrdinal, expectedContent: originalContent }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        console.error('[rewind] failed:', err);
        return;
      }
      rewindTo(index);
      // 紧跟一次新发送 — 因为 sdk_session_id 已被服务端清空，会自动开新会话
      sendMessage(newContent, currentSessionId, bookId || undefined, contextMeta, activeProviderRef.current);
    } catch (e) {
      console.error('[rewind] network error:', e);
    }
  }, [currentSessionId, isLoading, stop, rewindTo, sendMessage, bookId, contextMeta]);

  // 大模型回复结束后合并刷新进度；避免历史 hydration 或消息数变化误触发阅读页重拉。
  useEffect(() => {
    if (isLoading) {
      wasLoadingRef.current = true;
      if (progressReloadTimerRef.current !== null) {
        window.clearTimeout(progressReloadTimerRef.current);
        progressReloadTimerRef.current = null;
      }
      return;
    }

    if (!wasLoadingRef.current) return;
    wasLoadingRef.current = false;
    if (messages.length <= 2) return;

    progressReloadTimerRef.current = window.setTimeout(() => {
      window.dispatchEvent(new Event('reload_book_progress'));
      progressReloadTimerRef.current = null;
    }, 700);
  }, [isLoading, messages.length]);

  // 会话切换时拉历史
  useEffect(() => {
    let cancelled = false;

    if (!bookId) {
      activeBookIdRef.current = null;
      if (currentSessionId) setCurrentSessionId(null);
      if (lastHydratedKeyRef.current !== "empty") {
        lastHydratedKeyRef.current = "empty";
        replaceMessages([
          hydrateMessage({ role: 'assistant', content: '你好！请在左侧书库选择一本书开始阅读，然后在这里和我交流。' }),
        ]);
      }
      return;
    }

    const fetchSession = async () => {
      try {
        let targetSessionId = currentSessionId;

        if (activeBookIdRef.current !== bookId || !targetSessionId) {
          const res = await fetch(`/api/chat/sessions/${bookId}`);
          if (!res.ok) throw new Error(`Session list failed: ${res.status}`);
          const sessions = await res.json();
          if (sessions && sessions.length > 0) {
            targetSessionId = sessions[0].id;
            if (isChatProvider(sessions[0].provider) && sessions[0].provider !== 'hermes') {
              setActiveProvider(sessions[0].provider);
            }
          } else {
            const createRes = await fetch(`/api/chat/sessions/${bookId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ provider: activeProviderRef.current }),
            });
            if (!createRes.ok) throw new Error(`Session create failed: ${createRes.status}`);
            const newSession = await createRes.json();
            targetSessionId = newSession.id;
          }
          if (cancelled) return;
          activeBookIdRef.current = bookId;
          if (targetSessionId !== currentSessionId) setCurrentSessionId(targetSessionId);
        }

        if (!targetSessionId) return;
        const hydrationKey = `${bookId}:${targetSessionId}`;
        if (lastHydratedKeyRef.current === hydrationKey) return;

        const historyRes = await fetch(`/api/chat/sessions/detail/${targetSessionId}`);
        if (!historyRes.ok) throw new Error(`Session detail failed: ${historyRes.status}`);
        const historyData = await historyRes.json();
        if (cancelled) return;

        lastHydratedKeyRef.current = hydrationKey;
        if (isChatProvider(historyData.session?.provider) && historyData.session.provider !== 'hermes') {
          setActiveProvider(historyData.session.provider);
        }

        if (historyData.messages && historyData.messages.length > 0) {
          replaceMessages((historyData.messages as HistoryMessageRow[]).map((m) => hydrateMessage({
            id: m.id,
            role: m.role,
            content: m.content,
            blocks_json: m.blocks_json ?? m.blocksJson ?? null,
            provider: m.provider ?? null,
          })));
        } else {
          replaceMessages([
            hydrateMessage({ role: 'assistant', content: `你好！我是你的智能阅读伙伴。我们正在阅读《${bookTitle}》，在左侧选择章节，或直接向我提问。` }),
          ]);
        }
      } catch {
        if (!cancelled) {
          lastHydratedKeyRef.current = `fallback:${bookId}`;
          replaceMessages([
            hydrateMessage({ role: 'assistant', content: `你好！我是你的智能伴读伙伴。我们正在阅读《${bookTitle}》。` }),
          ]);
        }
      }
    };

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, [bookId, bookTitle, currentSessionId, replaceMessages, setCurrentSessionId]);

  const getScrollViewport = useCallback(() => {
    const anchor = scrollRef.current;
    return anchor?.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
  }, []);

  const scheduleScrollToBottom = useCallback((force = false) => {
    const viewport = viewportRef.current ?? getScrollViewport();
    if (!viewport) return;
    viewportRef.current = viewport;

    const now = performance.now();
    if (!force && now - lastAutoScrollAtRef.current < 160) return;

    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
      isAtBottomRef.current = true;
      lastAutoScrollAtRef.current = performance.now();
      scrollRafRef.current = null;
    });
  }, [getScrollViewport]);

  useLayoutEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    viewportRef.current = viewport;

    // 监听用户滚动 — 离底超过 80px 即视为"用户主动离开底部"
    const onScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = viewport;
      isAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 80;
    };

    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) scheduleScrollToBottom(false);
    });

    viewport.addEventListener('scroll', onScroll, { passive: true });
    if (messagesContainerRef.current) resizeObserver.observe(messagesContainerRef.current);

    return () => {
      viewport.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [getScrollViewport, scheduleScrollToBottom]);

  useLayoutEffect(() => {
    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    // New messages should be visible immediately; token-level growth is handled by ResizeObserver.
    if (isNewMessage) scheduleScrollToBottom(true);
  }, [messages.length, scheduleScrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
      if (progressReloadTimerRef.current !== null) window.clearTimeout(progressReloadTimerRef.current);
    };
  }, []);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    const userPrompt = inputValue.trim();
    setInputValue("");
    setSlashCommands([]);
    sendMessage(userPrompt, currentSessionId || undefined, bookId || undefined, contextMeta, activeProvider);
  };

  const handleDeleteSession = async () => {
    if (!currentSessionId) return;
    const shouldDeleteNative = deleteNativeSession;
    setShowClearConfirm(false);
    setDeleteNativeSession(false);

    try {
      await fetch(`/api/chat/sessions/detail/${currentSessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteNativeSession: shouldDeleteNative }),
      });
      const createRes = await fetch(`/api/chat/sessions/${bookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeProviderRef.current }),
      });
      const newSession = await createRes.json();
      setCurrentSessionId(newSession.id);
      replaceMessages([
        hydrateMessage({ role: 'assistant', content: '记录已清空，我们进入了一个全新的伴读空间！请随时向我提问。' }),
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const contextLabel = formatContextLabel(contextMeta);
  const quickPrompts = contextMeta?.pageTitle
    ? [
        { label: "帮我理解这一章", prompt: "帮我通俗易懂地概括当前章节的核心内容和思想。" },
        { label: "分析关键人物", prompt: "分析当前章节出现的关键人物及其性格演变。" },
        { label: "生成检测题", prompt: "针对当前章节的知识点，生成3道单选题来检测我的掌握度。" },
      ]
    : [];
  let latestAssistant: AssistantMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') {
      latestAssistant = messages[i] as AssistantMessage;
      break;
    }
  }
  const statusUsageLabel = latestAssistant ? formatUsageLabel(latestAssistant, isLoading) : null;
  const agentTodos = getLatestAgentTodos(latestAssistant);
  const allSlashCommands = Array.from(
    new Map([...slashCommands, ...runtimeSlashCommands(messages)].map((command) => [command.value, command])).values()
  );
  const visibleSlashCommands = allSlashCommands.filter((command) =>
    command.name.toLowerCase().includes(slashFilter) || command.description.toLowerCase().includes(slashFilter)
  ).slice(0, 8);

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2] relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200/50 shrink-0 bg-white/70 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
            <span className="truncate text-sm font-bold text-stone-800 tracking-wide">AI 伴读终端</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ProviderSwitch value={activeProvider} disabled={isLoading} onChange={handleProviderChange} />
            {currentSessionId && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-stone-400 hover:text-red-500 p-1.5 rounded-full hover:bg-stone-100 transition-colors"
                title="清空会话记录"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex min-h-5 items-center gap-2">
          {contextLabel && (
            <p className="min-w-0 flex-1 truncate text-[9.5px] font-semibold uppercase tracking-wider text-stone-500/80">
              {contextLabel}
            </p>
          )}
          <RunStatusPill status={status} active={isLoading} usageLabel={statusUsageLabel} />
        </div>
      </div>

      <AgentTodoDock todos={agentTodos} active={isLoading} />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden px-1">
        <div ref={messagesContainerRef} className="flex flex-col p-4 pb-6 [overflow-anchor:none]">
          {(() => {
            let userOrdinal = -1;
            return messages.map((msg, i) => {
              if (msg.role === "user") userOrdinal += 1;
              return (
                <MessageBubble
                  key={msg.id ?? `${msg.role}-${i}`}
                  msg={msg}
                  index={i}
                  userOrdinal={msg.role === "user" ? userOrdinal : -1}
                  isLast={i === messages.length - 1}
                  canEdit={!isLoading && msg.role === 'user'}
                  status={status}
                  onPermissionSubmit={submitInteractiveAnswer}
                  onRequestRewind={requestRewindConfirm}
                  onRewindSubmit={handleRewindAndResend}
                />
              );
            });
          })()}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600 shadow-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Quick prompts */}
      {quickPrompts.length > 0 && !isLoading && messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {quickPrompts.map((qp) => (
            <button
              key={qp.label}
              onClick={() => setInputValue(qp.prompt)}
              className="whitespace-nowrap text-[11px] px-3.5 py-2 rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:border-stone-300 shadow-sm transition-colors cursor-pointer font-medium"
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-sm border-t border-stone-200/60 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <div className="relative min-w-0 flex-1">
            {slashOpen && (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
                {slashLoading && slashCommands.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-stone-400">Loading commands...</div>
                ) : visibleSlashCommands.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-stone-400">No commands found</div>
                ) : (
                  visibleSlashCommands.map((command) => (
                    <button
                      key={`${command.kind}-${command.value}`}
                      type="button"
                      onClick={() => {
                        setInputValue(`${command.value} `);
                        setSlashCommands([]);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-stone-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-stone-800">{command.value}</span>
                        <span className="block truncate text-[11px] text-stone-500">{command.description}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                        {command.kind === 'skill' ? 'skill' : command.kind === 'sdk_command' ? 'native' : 'cmd'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={isLoading ? "请等待回答完毕..." : "在这里聊聊你的想法...（Enter 发送，Shift+Enter 换行）"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                // IME 拼写中（中文输入法选词）回车不发送
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              className="w-full pl-5 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200/80 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-[#D94F30]/40 focus:ring-2 focus:ring-[#D94F30]/10 focus:bg-white transition-colors shadow-inner shadow-stone-100/50 resize-none overflow-y-auto leading-6 disabled:opacity-60"
              style={{ minHeight: '44px', maxHeight: '140px' }}
            />
          </div>

          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-stone-800 text-white hover:bg-stone-700 transition-colors shadow-md"
              title="停止"
            >
              <div className="w-3 h-3 bg-white rounded-sm" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#D94F30] text-white hover:bg-[#C4432A] transition-colors shadow-md shadow-[#D94F30]/20 disabled:opacity-50 disabled:shadow-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </form>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="清空会话记录？"
        message={"当前阅读会话的全部历史记录将被永久清空，并自动开启一个全新的对话。\n此操作不可撤销。"}
        confirmLabel="清空"
        cancelLabel="取消"
        destructive
        onConfirm={handleDeleteSession}
        onCancel={() => { setShowClearConfirm(false); setDeleteNativeSession(false); }}
      >
        <label className="mt-4 flex items-start gap-2 rounded-xl bg-red-50/70 p-3 text-xs text-red-700">
          <input
            type="checkbox"
            checked={deleteNativeSession}
            onChange={(e) => setDeleteNativeSession(e.target.checked)}
            className="mt-0.5"
          />
          <span>同时移除 Claude/Codex 原生会话记录（会移入 ReadPilot 回收站）</span>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={pendingRewindResolve !== null}
        title="重新发送？"
        message={"重新发送会丢弃此条之后的所有对话，并开启一个全新的会话上下文。\n此操作不可撤销。"}
        confirmLabel="重发"
        cancelLabel="取消"
        destructive
        onConfirm={() => {
          if (pendingRewindResolve) pendingRewindResolve(true);
          setPendingRewindResolve(null);
        }}
        onCancel={() => {
          if (pendingRewindResolve) pendingRewindResolve(false);
          setPendingRewindResolve(null);
        }}
      />
    </div>
  );
}
