# 参考资料目录

本目录只放 ReadPilot 伴读页生成时使用的设计、模板和数据结构参考，不再存放 skill 本体。

## 当前文件

- [design.md](design.md)：伴读页视觉方向的简短中文概览。
- [design-system.md](design-system.md)：更完整的 CSS 设计令牌与页面样式规范。
- [hub-template.md](hub-template.md)：单本书 Hub 页面的 HTML/CSS/JS 模板参考。
- [interactive-elements.md](interactive-elements.md)：伴读页可使用的交互组件模式。
- [progress-schema.md](progress-schema.md)：`progress.json` 的结构和状态说明。

## Skill 统一位置

可发布、可复制给 Claude Code 使用的 skill 统一放在仓库根目录的 `skills/` 下：

- 英文版：[../../skills/reading-companion/SKILL.md](../../skills/reading-companion/SKILL.md)
- 中文版：[../../skills/reading-companion-zh/SKILL.md](../../skills/reading-companion-zh/SKILL.md)

之前的 `docs/references/skill.md` 是旧版伴读页生成说明，触发边界过宽，且与根目录 `skills/` 下的公开版 skill 重复。为避免维护两个事实来源，该文件已移除。
