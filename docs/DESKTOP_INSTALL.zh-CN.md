# ReadPilot Windows 安装版说明

本文面向安装 `ReadPilot Setup 0.1.0.exe` 的普通用户。

## 安装包包含什么

- ReadPilot 桌面应用
- 本地 Next.js 运行时
- ReadPilot Context MCP server
- Codex/Claude 对接所需的项目端代码
- EPUB 转换脚本
- `readpilot-skill-pack`：核心 skill `books-to-course` 和配套 `references/`

安装包不会自动下载或安装：

- Python
- `ebooklib`、`beautifulsoup4`
- Claude Code CLI
- Codex CLI
- Claude/Codex 账号登录或 API Key

## 安装 ReadPilot

1. 运行 `ReadPilot Setup 0.1.0.exe`。
2. 首次启动时选择数据目录。
3. 进入设置页，确认数据目录、Claude/Codex、Python 状态。

默认安装目录通常是：

```text
%LOCALAPPDATA%\Programs\ReadPilot
```

Skill Pack 位于：

```text
%LOCALAPPDATA%\Programs\ReadPilot\resources\readpilot-skill-pack
```

## EPUB 导入依赖

如果只阅读已有数据，可以不装 Python。

如果要导入 EPUB，需要安装 Python 3.10+，然后在 PowerShell 运行：

```powershell
py -m pip install ebooklib beautifulsoup4
```

验证：

```powershell
python --version
py -m pip show ebooklib beautifulsoup4
```

## Claude Code 模式

ReadPilot 不内置 Claude Code CLI。需要用户自行安装并登录。

常见 npm 安装方式：

```powershell
npm install -g @anthropic-ai/claude-code
claude --version
claude
```

确认 PowerShell 能找到：

```powershell
where claude
```

Claude Code 的 skill 目录：

```text
%USERPROFILE%\.claude\skills
```

安装 ReadPilot 核心 skill：

```powershell
$pack = "$env:LOCALAPPDATA\Programs\ReadPilot\resources\readpilot-skill-pack\skills"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\skills"
Copy-Item "$pack\books-to-course" "$env:USERPROFILE\.claude\skills\" -Recurse -Force
```

## Codex 模式

ReadPilot 桌面应用内的 Codex 模式可以在设置页保存 Codex/OpenAI API Key，不要求用户会用 CLI。

如果用户也要在终端使用 Codex CLI，请按官方文档安装。常见 npm 安装方式：

```powershell
npm install -g @openai/codex
codex --version
```

Windows PowerShell 如遇执行策略问题，优先使用：

```powershell
codex.cmd
```

Codex 的用户 skill 目录：

```text
%USERPROFILE%\.codex\skills
```

安装 ReadPilot 核心 skill：

```powershell
$pack = "$env:LOCALAPPDATA\Programs\ReadPilot\resources\readpilot-skill-pack\skills"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.codex\skills"
Copy-Item "$pack\books-to-course" "$env:USERPROFILE\.codex\skills\" -Recurse -Force
```

不要只复制 `SKILL.md`。每个 skill 文件夹里的 `references/` 也必须一起保留。

## MCP 说明

ReadPilot Context MCP 已随桌面应用内置。应用内 Claude/Codex 对话会自动配置这个 MCP，不需要用户单独安装 MCP server。

如果用户在外部 Claude Code/Codex CLI 里使用 ReadPilot skill，skill 本身可以工作；但直接访问 ReadPilot 桌面应用的本地数据和 MCP，需要在对应 CLI 环境里额外配置项目路径和数据目录。

## 微信读书

微信读书是可选功能：

1. 访问 `https://i.weread.qq.com/skills/agent`。
2. 获取 `wrk-` 开头的 API Key。
3. 在 ReadPilot 设置页填入并测试。

## 最小可用组合

- 只阅读已有数据：安装 ReadPilot。
- 导入 EPUB：ReadPilot + Python + `ebooklib` + `beautifulsoup4`。
- Claude 对话：ReadPilot + Claude Code CLI 登录。
- Codex 对话：ReadPilot + 设置页保存 Codex/OpenAI API Key。
- 生成伴读页：再安装 `books-to-course` skill。
