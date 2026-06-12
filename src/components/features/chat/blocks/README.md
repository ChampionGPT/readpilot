# chat/blocks 组件声明

**一旦我所属的文件夹有所变化，请更新我。**

按 `ChatBlock.kind` 区分的 8 种 block 渲染器。`ChatPanel.tsx` 的 `BlockRouter` 根据 kind 派发到这里。

| 组件 | kind | 功能 |
|------|------|------|
| `TextBlock.tsx` | `text` | assistant 主要回答正文 — 白底气泡 + markdown 渲染 + 流式光标；长文本强制断行，避免撑宽右栏 |
| `ThinkingBlock.tsx` | `thinking` | 思考过程 — 可折叠灰底卡，流式时自动展开 |
| `SystemBlock.tsx` | `system` | session init / resume_fallback / note — 信息条 |
| `DiagnosticBlock.tsx` | `diagnostic` | stderr 节流输出 — 折叠 stderr 行数 |
| `ErrorBlock.tsx` | `error` | classifyError 错误 — 红色 alert + 可选重试按钮 |
| `ToolUseBlock.tsx` | `tool_use` | 单行内联卡：读写箭头 + variant 圆点 + 工具名 + 参数预览 |
| `ToolResultBlock.tsx` | `tool_result` | 挂在 ToolUse 脚下的折叠区，默认收起，展开后 mono 预览 |
| `InteractiveQuestionBlock.tsx` | `interactive_question` | AskUserQuestion 内联表单 — chip 网格 + Other 文本框 + 提交按钮 |

## 用户气泡（非 block）
| 组件 | 功能 |
|------|------|
| `EditableUserBubble.tsx` | user 消息气泡 — hover 显示 ✎ 编辑按钮，编辑态内联 textarea + 重发/取消，Ctrl/⌘+Enter 提交；长文本强制断行 |

## 文本辅助组件
| 组件 | 功能 |
|------|------|
| `MarkdownContent.tsx` | 安全轻量 markdown renderer：支持标题、段落、列表、引用、分隔线、代码块、行内 code/bold/em/link；不执行原始 HTML |

## 共享约定
- 所有 block 组件接受 `{ block }` props（除 `InteractiveQuestionBlock` 多一个 `onSubmit`）
- 入场动画统一 `animate-in fade-in slide-in-from-bottom-1 duration-200`
- 流式状态用 `block.status === 'streaming'` 判断
- 视觉常量从 `../chat-tokens.ts` 取
