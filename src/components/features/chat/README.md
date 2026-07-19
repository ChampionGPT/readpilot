# chat 组件声明

**一旦我所属的文件夹有所变化，请更新我。**

AI 对话面板的所有组件与状态管理代码。右栏沉浸式终端，承载 SSE 流式对话、思考过程、工具调用、交互式问答与历史 hydration。

## 顶层组件
- `ChatPanel.tsx` — 主组件。消费 `useSSEStream` 的 block-based 状态，按 `block.kind` 路由到 `blocks/` 下对应组件；处理会话切换、历史 hydration（从 `messages.blocks_json` 解码）、SSE 流接入、顶部/气泡内运行状态指示、token 用量摘要、清空会话、编辑+重发流程。
- 「问 AI」桥接：ChatPanel 监听 window `message`（`source: 'rp-annotator'`, `type: 'rp-ask-ai'`），把阅读页选区/标注上下文预填到输入框。
  - 会话 hydration 使用 `bookId:sessionId` 去重，切书时先解析当前书的真实 session，避免右栏消息区因旧 session 或重复 `replaceMessages` 闪烁。
  - 上下文通过 `contextMeta` 隐藏传给 `/api/chat`，用户可见消息保持原文，不再把“当前页面/章节”拼接到输入文本里。
- `chat-tokens.ts` — 视觉规范单一来源：tool palette + mono 字体栈。所有 block 组件共享。

## blocks/
按 `block.kind` 拆分的 8 个 React 组件及文本辅助渲染器 — 见 `blocks/README.md`。

## 数据流
```
[Claude Agent SDK] → claude-client.ts → SSE events
        ↓
useSSEStream 解码 SSE → chat-reducer 派发 → ChatState.messages: ChatMessage[]
        ↓
ChatPanel.MessageBubble → BlockRouter → blocks/{kind}Block
        ↓ (user 提交交互答案)
POST /api/chat/permission → resolvePending(in-memory Map) → SDK 继续
        ↓ (user 编辑历史气泡)
POST /api/chat/rewind → 硬删 + 清空 sdk_session_id → 新一轮 sendMessage
```

## 隐藏式上下文
- `ChatPanel` 顶部显示当前书/章节的轻量上下文条。
- 用户发送的 `prompt` 保持原样进入本地消息历史。
- `contextMeta` 作为独立字段提交到 `/api/chat`，后端转换为 system prompt append，供模型理解当前书籍、章节、笔记或文章。
- 不允许把上下文说明拼进用户消息正文。

## 历史持久化
- assistant 消息保存 `content`（纯文本兜底）+ `blocks_json`（完整 ChatBlock[] 快照）至 `messages` 表
- 加载时优先解析 `blocks_json`；缺失/损坏 → 回退到单个 TextBlock from `content`
