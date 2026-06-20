# 使用流程

本文说明一个新用户从导入 EPUB 到完成第一次伴读的路径。

## 一句话理解

ReadPilot 把一本书拆成可持续阅读的本地工作区：

1. 导入 EPUB。
2. 在书籍 Hub 查看进度、章节和已生成内容。
3. 在阅读页按章节阅读。
4. 在 ChatPanel 中向 Claude 或 Codex 提问。
5. 用 Markdown 写笔记。
6. 明确需要持久化时，再生成伴读 HTML 页面。

## 导入 EPUB

在书库页点击导入入口，选择 EPUB。导入完成后，ReadPilot 会创建本地书籍目录：

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

这些文件属于你的本地阅读数据，默认不应提交到公开仓库。

## 阅读与提问

进入单本书 Hub 后，可以看到：

- 当前书籍信息
- 章节和阅读进度
- 已生成的伴读页面
- 主题、问题和下一步建议

进入章节阅读页后，右侧 ChatPanel 会带上当前书籍和页面上下文。适合直接问：

- “帮我解释这一段。”
- “这个概念是什么意思？”
- “给我三个检验理解的问题。”
- “把这一章的论证链条整理出来。”

普通问答默认只留在 ChatPanel，不会写入 `pages/`。

## 生成伴读页

当你希望把某个主题变成可复访页面时，再明确提出生成需求，例如：

- “为这一章生成一个伴读页。”
- “把这个概念做成 deep-dive 页面。”
- “生成一个对比 X 和 Y 的主题页。”
- “更新当前书的 Hub 和 progress.json。”

此时才进入伴读页工作流：生成 HTML，登记到 `progress.json`，并在 Hub 中出现。

## 笔记

笔记编辑器支持 Markdown：

- 编辑模式：直接写 Markdown。
- 预览模式：查看渲染后的结果。
- 复习模式：临时遮住笔记，用线索回忆内容。
- 页面上下文：关联伴读页时，会显示提取出的关键上下文。

建议把笔记写成“问题、理解、证据、待追问”的结构，而不是只复制摘要。

## 微信读书

微信读书集成是可选能力：

1. 访问微信读书 Skill 控制台获取 API Key：`https://i.weread.qq.com/skills/agent`
2. 打开 ReadPilot 的 `/settings` 页面。
3. 填入 `wrk-` 开头的 key 并测试连接。
4. 回到书库，在书籍卡片上绑定对应微信读书书目。

绑定后，ReadPilot 可以同步划线、想法、阅读进度和统计，并把这些读者侧记忆提供给 ChatPanel。

## Agent 上下文

ReadPilot 会根据当前书籍、当前页面、阅读进度、伴读索引、本地笔记和微信读书记忆，为 ChatPanel 提供必要的上下文。

用户只需要在应用中选择可用的 agent provider。上下文加载、工具调用和结果展示由 ChatPanel 统一处理。

## 常见误区

- 不要把 `data/books/` 或 `data/readpilot.db*` 提交到公开仓库。
- 不要公开上传版权书籍原文或包含大段原文的生成页。
- 普通解释、摘要和检验题不一定需要生成页面。
- 伴读页应该围绕一个明确阅读问题生成，而不是一次性批量生成整本书。
- `skills/books-to-course/` 是唯一核心 skill，里面已经包含配套 `references/`。
