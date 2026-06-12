// input: SDK 给的 tool 名字符串
// output: 8 类 ToolVariant 之一，决定前端走哪个专属渲染
// pos: 前后端共享的工具分类器 — 后端在 SSE 发送时打标，前端无需重新判断
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import type { ToolVariant } from '@/types/chat-blocks';

export function classifyTool(name: string): ToolVariant {
  if (name === 'TodoWrite') return 'todo_write';
  if (name === 'Task') return 'task';
  if (name === 'Skill' || name.startsWith('Skill') || name.startsWith('mcp__plugin_')) return 'skill';
  if (name === 'Read') return 'read';
  if (name === 'Edit' || name === 'MultiEdit') return 'edit';
  if (name === 'Write') return 'write';
  if (name === 'Bash' || name === 'PowerShell') return 'bash';
  return 'generic';
}
