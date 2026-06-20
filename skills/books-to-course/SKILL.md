---
name: books-to-course
description: 仅当用户明确要求创建、生成、更新，或把内容做成交互式 HTML 伴读页、主题页、深挖页、综合页、全书入口页，或更新 Hub/progress.json 时使用。普通章节解释、摘要、检测题、笔记和轻量问答不要使用本 skill，直接在聊天里回答。
---

# Books To Course

把用户明确提出的“页面生成”请求，转化为一个聚焦的 ReadPilot 伴读页面。

## 触发边界

默认只在聊天中回答，除非用户清晰要求生成或更新页面。

不要为以下请求生成页面：

- “帮我理解这一章”
- “总结这一节”
- “这个概念是什么意思？”
- “给我几道题”
- “我读完第 X 章了”

只有类似以下请求才生成或更新页面：

- “为第 X 章生成一个伴读页”
- “把这个概念做成一个深挖页”
- “创建一个比较 X 和 Y 的主题页”
- “更新 Hub / progress.json”
- “把这一节做成交互式 HTML 页面”

## 数据契约

在单本书目录内工作：

```text
data/books/<book-slug>/
  progress.json
  source.jsonl
  companion/
    book-profile.md
    chapter-index.md
    topic-index.md
  pages/
```

写入之前，先读取 `progress.json` 和相关的 `companion/*.md` 文件。只读取目标章节或相关的 `source.jsonl` 片段；除非用户明确要求重建整本书画像，否则不要重新处理全书。

## 配套 references

本 skill 和 references 必须一起安装。安装包内路径为：

```text
books-to-course/
  SKILL.md
  references/
```

使用这些文件：

- `references/companion-methodology.md`：页面类型、生成方法和边界。
- `references/design.md`：视觉方向。
- `references/design-system.md`：CSS token、排版和基础组件。
- `references/hub-template.md`：Hub 页面模板。
- `references/interactive-elements.md`：可复用交互组件。
- `references/progress-schema.md`：`progress.json` 字段约束。

在源码仓库和安装包中，同一批 reference 文件都放在本 skill 的 `references/` 目录内。

## 工作流

1. 判断请求类型：`overview`、`deepdive`、`theme`、`synthesis` 或 `hub-update`。
2. 读取当前书籍的 `progress.json`。
3. 读取相关 companion 索引。
4. 只读取生成该页面所需的原文材料。
5. 在 `pages/` 下生成一个自包含 HTML 页面。
6. 在 `progress.json` 中新增或更新对应页面记录。
7. 如需 Hub 入口，同步更新 `index.html`。
8. 向用户报告变更文件和下一步建议阅读动作。

## 页面规则

- 每次请求只创建一个页面。
- 原文引用要短，并保持精确。
- 优先使用结构化拆解、图表、对照、检查点和交互，不写长篇说明。
- 如果页面在讲解概念，加入一个小型掌握度检测。
- 生成的伴读页不要使用 `type: "chapter"`。
- 章节聚焦型伴读页使用 `type: "deepdive"`，并明确填写 `relatedChapters`。
- 跨章节主题页使用 `type: "theme"`，并明确填写 `relatedChapters`。
- 全书入口页使用 `type: "overview"` 或 `type: "synthesis"`，并使用 `relatedChapters: []`。
- 不要复制大段受版权保护的书籍原文。

## Progress 页面记录格式

```json
{
  "id": "stable-page-id",
  "type": "deepdive",
  "title": "页面标题",
  "description": "一句话说明这个页面帮助读者完成什么",
  "file": "pages/page-file.html",
  "status": "new",
  "masteryScore": null,
  "createdAt": "2026-06-12T00:00:00.000Z",
  "completedAt": null,
  "relatedChapters": ["章节标题"]
}
```

`chapter` 是导入器生成的原文阅读页类型，不是伴读页类型。只有全书概览或综合页可以使用 `relatedChapters: []`。

## 最终回复

保持简短：

- 说明生成或更新了哪个页面。
- 列出变更文件。
- 建议一个下一步有价值的阅读动作。
