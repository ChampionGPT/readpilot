# ReadPilot 文档总览

这里汇总 ReadPilot 的公开说明文档。第一次使用建议先看安装和使用流程；想了解伴读页如何生成，再阅读参考资料。

## 入门

- [Windows 安装版说明](DESKTOP_INSTALL.zh-CN.md)：EXE 安装、Python/Claude/Codex 依赖、skill pack 安装路径。
- [安装与运行](SETUP.md)：环境要求、依赖安装、本地配置和启动方式。
- [使用流程](USAGE.md)：从导入 EPUB 到阅读、提问、做笔记、生成伴读页的完整路径。
- [项目结构](PROJECT_STRUCTURE.md)：仓库目录、运行数据目录、skill 与参考资料的边界。
- [依赖说明](DEPENDENCIES.md)：前端、EPUB 转换、SQLite、Claude/Codex 等依赖的用途。

## 伴读页参考

这些文档用于约束伴读页的内容、结构和交互风格：

- [生成方法论](../skills/books-to-course/references/companion-methodology.md)
- [设计原则](../skills/books-to-course/references/design.md)
- [设计系统](../skills/books-to-course/references/design-system.md)
- [Hub 模板](../skills/books-to-course/references/hub-template.md)
- [交互元素](../skills/books-to-course/references/interactive-elements.md)
- [progress.json schema](../skills/books-to-course/references/progress-schema.md)
- [参考资料索引](../skills/books-to-course/references/README.md)

## 建议阅读顺序

1. 新用户：`README.md` -> `docs/SETUP.md` -> `docs/USAGE.md`
2. 想配置 agent：`docs/SETUP.md` -> `README.md` 的 Agent 支持部分
3. 想维护伴读页：`docs/PROJECT_STRUCTURE.md` -> `skills/books-to-course/SKILL.md` -> `skills/books-to-course/references/`
