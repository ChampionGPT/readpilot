# 安装与运行

这份文档面向第一次拉取 ReadPilot 的开发者。项目目前是本地优先的 Next.js 应用，不是 npm 包服务。

## 环境要求

- Node.js 20 或更高版本
- npm
- Python 3.10 或更高版本
- Claude Code CLI，并确保终端中可以执行 `claude`

Claude Code 官方资源：

- Claude Code 文档：https://docs.anthropic.com/en/docs/claude-code/overview
- Claude Code 安装与设置：https://docs.anthropic.com/en/docs/claude-code/setup
- Claude Code SDK 文档：https://docs.anthropic.com/en/docs/claude-code/sdk
- Claude Agent SDK npm 包：https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

Python 依赖：

```bash
pip install ebooklib beautifulsoup4
```

Node 依赖：

```bash
npm install
```

## 本地配置

复制环境变量示例：

```bash
cp .env.example .env.local
```

常用变量：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `READPILOT_DATA_DIR` | 本地数据根目录 | `./data` |
| `READPILOT_BOOKS_DIR` | 书籍目录 | `./data/books` |
| `READPILOT_BASE_URL` | helper 脚本访问本地应用时使用 | `http://localhost:3000` |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows 下 Claude Code 需要 Git Bash 时使用 | 空 |
| `ANTHROPIC_API_KEY` | 如果你的 Claude Code 环境使用 API Key，可在本地配置 | 空 |

不要提交 `.env.local`。

## 启动

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 数据目录

运行后会使用 `data/` 保存本地状态：

```text
data/
  books/              # EPUB、章节 JSONL、生成的 HTML 页面、progress.json
  readpilot.db        # 本地聊天和笔记
  readpilot.db-shm
  readpilot.db-wal
```

这些文件可能包含私人书籍、笔记和聊天记录，不应进入公开仓库。

## 常见问题

### 如何安装 Claude Code

请优先参考官方安装文档：https://docs.anthropic.com/en/docs/claude-code/setup

常见 npm 安装方式：

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude
```

首次运行 `claude` 时按官方流程登录或配置认证。ReadPilot 的 `@anthropic-ai/claude-agent-sdk` 已在 `package.json` 中声明，执行 `npm install` 后会作为项目依赖安装；你仍然需要本机 Claude Code CLI 可用。

### 找不到 Python

确认命令行中可以执行：

```bash
python --version
```

或：

```bash
python3 --version
```

### 导入 EPUB 时报缺少依赖

执行：

```bash
pip install ebooklib beautifulsoup4
```

### 找不到 Claude Code

确认：

```bash
claude --version
```

如果命令不可用，请先安装并登录 Claude Code。Windows 环境下，如果 SDK 无法自动找到 Git Bash，在 `.env.local` 中设置 `CLAUDE_CODE_GIT_BASH_PATH`。

### better-sqlite3 安装失败

优先确认 Node.js 版本为 20 或更高。Windows 环境如果遇到原生模块编译问题，通常需要安装 Visual Studio Build Tools，或切换到有预编译包支持的 Node 版本。

## 验证命令

```bash
npm run lint
npm run test
npm run build
```
