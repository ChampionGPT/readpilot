# ReadPilot

ReadPilot 是一个本地优先的 AI 伴读工作台：导入 EPUB，把书籍保存在本地书库中，在阅读页旁边直接与 Claude Code 对话，并按阅读进度生成可交互的伴读页面。

它不是“把一本书一次性总结完”的工具，而是面向认真阅读的人：读到哪里，理解、笔记、追问和伴读页就生长到哪里。

## 适合谁

- 想把长书读透，而不是只拿一份摘要的人
- 想在阅读过程中持续提问、做笔记、生成章节拆解页的人
- 想研究“AI + 阅读 + 本地知识工作台”产品形态的开发者
- 想把 Claude Code / Claude Agent SDK 接入真实桌面式工作流的人

## 核心能力

- 本地书库：导入 EPUB，按书籍维护 `progress.json`、原始章节、生成页和阅读状态
- 中央阅读工作台：保留 EPUB 排版、目录、章节时间线、Hub 和伴读页入口
- 右侧 Claude Chat：通过 `@anthropic-ai/claude-agent-sdk` 接入 Claude Code，支持流式输出、Markdown 渲染、工具读写提示和 token 使用反馈
- 伴读页生成：配套 `reading-companion` skill，把章节、主题或阶段总结生成独立 HTML 页面
- 笔记与进度：SQLite 保存对话和笔记，本地文件保存书籍内容与伴读产物
- 渐进式数据模型：普通问答留在 ChatPanel，只有明确要求“生成页面”时才进入伴读页工作流

## 技术栈

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS v4 + Base UI / shadcn 风格组件
- Zustand 状态管理
- better-sqlite3 本地数据库
- Claude Agent SDK / Claude Code
- Python EPUB 转换脚本：`ebooklib`、`beautifulsoup4`

## 快速开始

环境要求：

- Node.js 20 或更高版本
- npm
- Python 3.10 或更高版本
- Claude Code CLI，并确保 `claude` 命令可用

安装依赖：

```bash
npm install
pip install ebooklib beautifulsoup4
```

准备本地配置：

```bash
cp .env.example .env.local
```

启动开发服务器：

```bash
npm run dev
```

然后打开 `http://localhost:3000`。

## Claude Code 配置

ReadPilot 默认通过本机 Claude Code / Claude Agent SDK 工作。请先在终端中确认：

```bash
claude --version
```

官方资源：

- Claude Code 文档：https://docs.anthropic.com/en/docs/claude-code/overview
- 安装与设置：https://docs.anthropic.com/en/docs/claude-code/setup
- Claude Code SDK：https://docs.anthropic.com/en/docs/claude-code/sdk
- Claude Agent SDK npm 包：https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

常见安装方式：

```bash
npm install -g @anthropic-ai/claude-code
```

如果你的环境依赖 API Key，请按 Claude Code 或 Anthropic 官方方式配置，不要把密钥提交到仓库。Windows 环境下如果 Claude Code 需要 Git Bash，可在 `.env.local` 中设置 `CLAUDE_CODE_GIT_BASH_PATH`。

## 数据与隐私

ReadPilot 默认把运行数据放在 `data/`：

- `data/books/`：导入的书籍、EPUB 源文件、章节 JSONL、生成的 HTML 伴读页
- `data/readpilot.db`：本地聊天、笔记等 SQLite 数据
- `.env.local`：本地环境变量和可能的密钥

这些文件默认不应进入公开仓库。开源前请确认没有提交私人书籍、数据库、聊天记录、API Key 或带版权风险的生成页面。

## 常用脚本

```bash
npm run dev       # 本地开发
npm run build     # 生产构建
npm run start     # 启动生产构建
npm run lint      # ESLint
npm run test      # Vitest
```

## 配套 Skill

仓库中包含一个面向 Claude Code 的伴读思路：`reading-companion`。它的目标是把一本书变成“随阅读进度生长”的伴读系统，而不是一次性批量生成课程。

公开版 skill 模板见 [skills/reading-companion/SKILL.md](skills/reading-companion/SKILL.md)。如果你准备展示示例，建议只使用自有文本或公版文本，避免公开版权书籍原文。

## 文档

- [安装与运行](docs/SETUP.md)
- [依赖说明](docs/DEPENDENCIES.md)
- [贡献指南](CONTRIBUTING.md)
- [安全与隐私](SECURITY.md)

## 开源协议

ReadPilot 使用 [MIT License](LICENSE)。
