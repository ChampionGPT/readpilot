# 安装与运行

本文面向第一次拉取 ReadPilot 的开发者。ReadPilot 是本地优先的 Next.js 应用，不是云端托管服务。

## 环境要求

- Node.js 20 或更高版本
- npm
- Python 3.10 或更高版本
- Claude Code CLI 或 Codex CLI，取决于你要使用的 agent provider

确认 Node 与 Python：

```bash
node --version
npm --version
python --version
```

## 安装依赖

Node 依赖：

```bash
npm install
```

EPUB 转换脚本需要 Python 依赖：

```bash
pip install ebooklib beautifulsoup4
```

也可以使用转换器目录中的 requirements：

```bash
pip install -r scripts/ebook-converter/requirements.txt
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
| `READPILOT_BOOKS_DIR` | 本地书籍目录 | `./data/books` |
| `READPILOT_BASE_URL` | helper 脚本访问本地应用时使用 | `http://localhost:3000` |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows 下 Claude Code 需要 Git Bash 时使用 | 空 |

不要提交 `.env.local`。

## 启动应用

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

## Agent 配置

### Claude Code

确认本机可执行：

```bash
claude --version
```

如果未安装，请按 Claude Code 官方文档配置。常见 npm 安装方式：

```bash
npm install -g @anthropic-ai/claude-code
```

### Codex

如果你已配置 Codex CLI，建议从 ReadPilot 项目根目录启动，以便加载项目内 `.codex/config.toml`：

```bash
codex.cmd
```

在 Windows PowerShell 中优先使用 `codex.cmd`，避免 `codex.ps1` 被执行策略拦截。

## Codex 项目配置

项目根目录包含 `.codex/config.toml`，用于在 Codex 信任该仓库后加载 ReadPilot 的本地上下文能力。

## 本地数据目录

运行后会使用 `data/` 保存本地状态：

```text
data/
  readpilot.db
  readpilot.db-shm
  readpilot.db-wal
  books/
    <book-slug>/
      source.epub
      source.jsonl
      source-manifest.json
      progress.json
      companion/
      pages/
```

这些文件可能包含私有书籍、笔记和聊天记录，不应提交到公开仓库。

## 验证命令

```bash
npm run lint
npm run test
npm run build
```

如果本机 TypeScript 或测试进程内存不足，可以临时设置：

```bash
set NODE_OPTIONS=--max-old-space-size=4096
```
