# 使用旅程

本文档说明一个新用户从克隆仓库到完成第一次伴读的完整路径。

## 一句话理解

ReadPilot 是一个本地优先的阅读工作台：

1. 把 EPUB 导入本地书库。
2. 在中间阅读区按章节阅读。
3. 在右侧 ChatPanel 和 Claude Code 对话。
4. 只有当你明确要求“生成页面”时，才把问题变成可复访的 HTML 伴读页。
5. 笔记、聊天、进度、生成页都留在本机。

## 安装路径

### 1. 准备环境

需要：

- Node.js 20+
- npm
- Python 3.10+
- Claude Code CLI，终端里能执行 `claude`

Claude Code 官方文档：

- 安装与设置：https://docs.anthropic.com/en/docs/claude-code/setup
- SDK 文档：https://docs.anthropic.com/en/docs/claude-code/sdk

### 2. 安装项目依赖

```bash
npm install
pip install ebooklib beautifulsoup4
```

也可以使用转换器自己的依赖文件：

```bash
pip install -r scripts/ebook-converter/requirements.txt
```

### 3. 创建本地配置

```bash
cp .env.example .env.local
```

默认数据目录是 `./data`。你可以在 `.env.local` 中改到别的位置：

```bash
READPILOT_DATA_DIR=./data
READPILOT_BOOKS_DIR=./data/books
```

不要提交 `.env.local`。

### 4. 启动

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 第一次使用

### 1. 导入 EPUB

在书库页点击“导入书籍”，选择 EPUB。导入完成后，ReadPilot 会在本地创建一份书籍数据目录：

```text
data/books/<book-slug>/
  source.epub
  source.jsonl
  source-manifest.json
  progress.json
  companion/
    book-profile.md
    chapter-index.md
    topic-index.md
  pages/
    *.html
```

这些文件都属于你的本地阅读数据，不应提交到公开仓库。

### 2. 阅读章节

导入后回到书库，点击书籍卡片进入单本书 Hub。Hub 会显示：

- 当前书籍信息
- 章节进度
- 已生成的伴读材料
- 主题和术语
- 下一步建议

点击“继续阅读”进入章节阅读页。

### 3. 和 Claude Code 对话

右侧 ChatPanel 会带上当前书籍、页面和上下文。适合直接问：

- “帮我理解这一章”
- “这个概念是什么意思？”
- “给我 3 个检测题”
- “帮我总结当前章节”

这些普通问答默认只留在 ChatPanel，不会写入 `pages/`。

### 4. 生成伴读页

当你明确希望留下一个可复访页面时，再说：

- “为这一章生成一个伴读页”
- “把这个概念做成一个 deep-dive 页面”
- “生成一个主题页，对比 X 和 Y”
- “更新当前书的 Hub/progress.json”

这时才进入 companion page 工作流：生成 HTML，登记到 `progress.json`，并在 Hub 中出现。

## 微信读书可选能力

微信读书集成不是必需项。需要时：

1. 到 https://i.weread.qq.com/skills/agent 获取 `wrk-` 开头的 API Key。
2. 打开 ReadPilot 的 `/settings` 页面。
3. 填入 key 并测试连接。
4. 回到书库，在书籍卡片上点击链接图标，绑定对应微信读书书目。

绑定后，ReadPilot 可以同步划线、想法、阅读进度和统计，并把这些读者侧记忆提供给 ChatPanel。

## Skill 怎么用

仓库里有两个可发布/可复制的 skill：

```text
skills/
  reading-companion/
    SKILL.md
  reading-companion-zh/
    SKILL.md
```

它们是轻量入口，负责约束什么时候应该生成页面。更丰富的生成方法、页面类型、掌握检测和设计原则放在：

```text
docs/references/companion-methodology.md
docs/references/design-system.md
docs/references/interactive-elements.md
docs/references/progress-schema.md
```

简单说：

- `skills/`：给 Claude Code 使用的 skill 入口。
- `docs/references/`：给人和 skill 参考的页面生成规范。

## 常见误区

- 不要把 `data/books/`、`data/readpilot.db*` 提交到 GitHub。
- 不要公开上传版权书籍原文或包含大段原文的生成页。
- 普通问答不需要生成页面。
- 伴读页应一次生成一个，围绕一个明确阅读问题。
- 如果要单独发布 skill，示例最好使用自有文本或公版文本。
