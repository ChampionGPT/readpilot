# progress.json Schema（进度追踪规范）

定义 ReadPilot 书籍目录中的 `progress.json` 状态文件格式、状态机和掌握度评估标准。运行时校验以 [src/lib/schemas/progress-schema.ts](../../src/lib/schemas/progress-schema.ts) 为准，本文件用于给人和 skill 阅读。

## 完整 Schema

```json
{
  "book": {
    "title": "书名（不含书名号）",
    "author": "作者名",
    "genre": "体裁分类（如：现代主义文学、商业管理、心理学等）",
    "totalChapters": 10,
    "startDate": "YYYY-MM-DD",
    "totalPages": 320,
    "currentPage": 72,
    "structure": [
      {
        "id": "part-1",
        "title": "第一部分标题",
        "chapters": ["第1章", "第2章"]
      }
    ]
  },
  "pages": [
    {
      "id": "00_全书透视",
      "type": "overview | chapter | deepdive | theme | synthesis",
      "title": "页面显示标题",
      "description": "一句话描述（用于 Hub 卡片显示）",
      "file": "pages/00_全书透视.html",
      "status": "completed | in-progress | new",
      "masteryScore": 85,
      "relatedChapters": ["part-1"],
      "createdAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
      "completedAt": "YYYY-MM-DDTHH:mm:ss.sssZ"
    }
  ],
  "themes": ["主题1", "主题2", "主题3"],
  "glossary": {
    "术语": "定义"
  },
  "currentFocus": "当前读者关注的章节或主题（可为 null）",
  "nextRecommendation": {
    "title": "推荐下一步标题",
    "description": "推荐理由",
    "hint": "告诉 AI 伴侣的对话提示"
  },
  "readingLog": [
    {
      "date": "YYYY-MM-DD",
      "action": "started | page_created | page_completed | mastery_updated | note",
      "pageId": "关联的页面 ID（可选）",
      "note": "描述"
    }
  ]
}
```

## 字段说明

### book（必填）

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 书名（不含书名号） |
| author | string | 作者名 |
| genre | string | 体裁分类 |
| totalChapters | number \| null | 总章节数（可选，用于进度估算） |
| startDate | string | 开始日期 YYYY-MM-DD |
| totalPages | number \| null | 书籍总页数（可选，用户输入） |
| currentPage | number \| null | 当前阅读页数（可选，用户输入） |
| structure | array | 全书结构目录（可为空，首次分析后填入） |

### pages（核心数组）

每当生成一个新页面时，在此数组中添加一条记录。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识，同时也是文件名（不含 .html） |
| type | enum | 是 | 页面类型 |
| title | string | 是 | 显示标题 |
| description | string | 是 | Hub 卡片上的描述文字 |
| file | string | 是 | 相对于课程根目录的文件路径 |
| status | enum | 是 | 当前状态 |
| masteryScore | number \| null | 是 | 掌握度评分 (0-100)，未评分时为 `null` |
| relatedChapters | array | 是 | 关联的书籍章节标题；全书概览/综合页可为空数组 |
| createdAt | string | 是 | 创建日期 |
| completedAt | string \| null | 是 | 完成日期；未完成时为 `null` |

### 页面类型 (type)

| 值 | 说明 | 命名前缀 |
|----|------|----------|
| overview | 全书透视页 | `00_` |
| chapter | 章节伴读页 | `{序号}_` |
| deepdive | 深入/补充页 | `{序号}b_深入_` |
| theme | 主题探索页 | `T{序号}_` |
| synthesis | 综合总结页 | `S{序号}_` |

### 页面状态 (status) 状态机

```
new ──→ in-progress ──→ completed
  ↑                        │
  └────────────────────────┘ (重新学习时可回退)
```

| 状态 | 含义 | 触发条件 |
|------|------|----------|
| new | 新生成，尚未阅读 | 页面刚创建时 |
| in-progress | 正在阅读/学习 | 用户表示在阅读此页面 |
| completed | 已完成 | 用户完成掌握检测 |

### themes

随着阅读推进动态发现和更新的主题列表。初始可为空，在分析书籍后填入核心主题。

### glossary

累积的词汇表。每次出现新术语时添加，确保跨页面一致。格式：`"术语": "大白话定义"`。

### nextRecommendation

根据当前阅读状态，AI 推荐的下一步行动。

| 字段 | 说明 |
|------|------|
| title | 推荐标题（如："深入班吉的时间碎片"） |
| description | 推荐理由（如："你对时间叙事的理解还需加强"） |
| hint | 用户可以复制的对话提示（如："帮我深入理解福克纳的时间碎片叙事"） |

### readingLog

按时间顺序记录的阅读事件。

| action 值 | 说明 |
|-----------|------|
| started | 阅读课程启动 |
| page_created | 新页面生成 |
| page_completed | 页面学习完成 |
| mastery_updated | 掌握度评分更新 |
| note | 读者自由备注 |

---

## 掌握度评估标准

### 评分规则 (masteryScore: 0-100)

| 分数范围 | 等级 | 判断依据 | 下一步行动 |
|----------|------|----------|-----------|
| 85-100 | 完全掌握 | 准确回答所有检测题，能举一反三 | 推荐前进到下一章节或探索新主题 |
| 60-84 | 基本掌握 | 大部分正确，有小偏差 | 简短纠正 + 可以前进 |
| 30-59 | 部分理解 | 概念混淆或明显误解 | 生成深入页（deepdive） |
| 0-29 | 尚未理解 | 回答错误或"不知道" | 从更基础概念重建，可能需要回顾前置页面 |

### 评分方法

掌握度由用户与 AI 的对话中评估，不是自动化的：

1. 用户阅读完 HTML 页面中的检测题
2. 用户回到对话中分享答案或反馈
3. AI 根据回答质量给出 masteryScore
4. 更新 progress.json

**如果用户没有分享检测结果：**
- 默认设为 `null`（不评分）
- 状态设为 `completed`（信任读者）
- 在 nextRecommendation 中温和提示可以随时回来讨论

---

## 初始化模板

首次启动时创建的 progress.json：

```json
{
  "book": {
    "title": "",
    "author": "",
    "genre": "",
    "totalChapters": null,
    "startDate": "YYYY-MM-DD",
    "totalPages": null,
    "currentPage": null,
    "structure": []
  },
  "pages": [],
  "themes": [],
  "glossary": {},
  "currentFocus": null,
  "nextRecommendation": null,
  "readingLog": [
    {
      "date": "YYYY-MM-DD",
      "action": "started",
      "note": "创建阅读课程"
    }
  ]
}
```

---

## 更新规则

### 每次生成新页面时

1. 在 `pages` 数组追加新记录
2. 在 `readingLog` 追加 `page_created` 事件
3. 更新 `nextRecommendation`
4. 如有新术语，更新 `glossary`
5. 如发现新主题，更新 `themes`

### 每次掌握检测后

1. 更新对应页面的 `masteryScore` 和 `status`
2. 在 `readingLog` 追加 `mastery_updated` 事件
3. 根据分数调整 `nextRecommendation`
4. 更新 `currentFocus`

### 更新 index.html

每次修改 progress.json 后，必须同步重新生成 index.html，将最新的 JSON 数据嵌入其中。
