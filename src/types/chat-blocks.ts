// input: 无外部依赖
// output: ChatBlock 完整类型族 + AssistantMessage 结构
// pos: 对话面板数据契约 — 前后端共享
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

export type BlockStatus = 'streaming' | 'complete' | 'error' | 'aborted';

export type ToolVariant =
  | 'generic' | 'read' | 'write' | 'edit' | 'bash'
  | 'todo_write' | 'skill' | 'task';

interface BaseBlock {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: BlockStatus;
}

export interface ThinkingBlock extends BaseBlock {
  kind: 'thinking';
  text: string;
}

export interface TextBlock extends BaseBlock {
  kind: 'text';
  text: string;
}

export interface ToolUseBlock extends BaseBlock {
  kind: 'tool_use';
  toolUseId: string;
  name: string;
  input: Record<string, any>;
  variant: ToolVariant;
}

export interface ToolResultBlock extends BaseBlock {
  kind: 'tool_result';
  toolUseId: string;
  output: string;
  previewLength: number;
  isError: boolean;
  truncated?: boolean;
}

export interface SystemBlock extends BaseBlock {
  kind: 'system';
  subtype: 'init' | 'resume_fallback' | 'note';
  model?: string;
  cwd?: string;
  tools?: string[];
  mcpServers?: string[];
  message?: string;
}

export interface DiagnosticBlock extends BaseBlock {
  kind: 'diagnostic';
  text: string;
}

export interface ErrorBlock extends BaseBlock {
  kind: 'error';
  category?: string;
  userMessage: string;
  actionHint?: string;
  retryable?: boolean;
}

export interface InteractiveQuestionItem {
  question: string;
  header?: string;
  multiSelect: boolean;
  options: Array<{ label: string; description?: string }>;
}

export interface InteractiveQuestionBlock extends BaseBlock {
  kind: 'interactive_question';
  permissionRequestId: string;
  toolName: string;
  questions: InteractiveQuestionItem[];
  answers?: Record<string, string>;
}

export type ChatBlock =
  | ThinkingBlock | TextBlock | ToolUseBlock | ToolResultBlock
  | SystemBlock | DiagnosticBlock | ErrorBlock | InteractiveQuestionBlock;

export interface AssistantMessage {
  id?: string;
  role: 'assistant';
  blocks: ChatBlock[];
  isStreaming: boolean;
  provider?: 'claude' | 'codex' | 'hermes';
  metrics?: {
    tokensIn?: number;
    tokensOut?: number;
    durationMs?: number;
    costUSD?: number;
  };
}

export interface UserMessage {
  id?: string;
  role: 'user';
  content: string;
  provider?: 'claude' | 'codex' | 'hermes';
}

export type ChatMessage = AssistantMessage | UserMessage;
