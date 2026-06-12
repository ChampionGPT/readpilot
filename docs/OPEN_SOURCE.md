# 开源发布清单

这份清单用于把 ReadPilot 发布到 GitHub 前做最后检查。

## 推荐定位

一句话：

> ReadPilot 是一个本地优先的 AI 伴读工作台，把 EPUB 阅读、笔记、Claude Code 对话和可交互伴读页放在同一个界面里。

短介绍：

> 它不是一次性总结工具，而是跟随阅读进度工作的伴读系统。你可以导入一本书，在阅读过程中追问、记录、生成章节或主题页面，并把所有数据保存在本地。

GitHub About 建议：

```text
Local-first AI reading workspace for EPUBs, notes, Claude Code chat, and interactive companion pages.
```

推荐 Topics：

```text
ai-reading, epub, claude-code, claude-agent-sdk, nextjs, typescript, local-first, knowledge-workspace
```

## 协议选择

建议使用 MIT License，原因：

- 对个人开发者和产品团队都足够友好
- 允许二次开发、商用、分发和修改
- 降低社区尝试和贡献门槛

注意：MIT 只覆盖仓库代码和文档，不覆盖用户导入的书籍、笔记、聊天记录或生成页面中可能包含的版权内容。

## 发布前必须清理

确认不要公开：

- `.env.local` 和任何 API Key
- `data/books/` 中的私人 EPUB、JSONL、HTML 生成页和 `progress.json`
- `data/readpilot.db*` 本地数据库
- Claude Code 本地日志、工作树、临时配置
- `.agent/`、`.planning/`、`CLAUDE.md`、`Ui/`、外部参考仓库等内部开发参考
- `.marketing/` 中的推广方案、小红书草稿等运营材料
- `docs/superpowers/` 中的内部计划、规格草稿或阶段记录
- 带版权风险的截图或演示数据

完整文件清单见 [GitHub 发布文件清单](GITHUB_RELEASE_MANIFEST.md)。

如果这些文件已经被 Git 跟踪，请在发布前从索引中移除，但保留本地文件：

```bash
git rm --cached -r data/books
git rm --cached data/readpilot.db data/readpilot.db-shm data/readpilot.db-wal
git rm --cached -r .claude .agent .codex .planning .trae .serena .superpowers PRPs
git rm --cached -r docs/superpowers
git rm --cached CLAUDE.md
git rm --cached -r Ui
```

然后确认：

```bash
git status --short
```

保留 `data/.gitkeep` 即可。

## README 首屏建议

GitHub 首屏要让读者快速知道三件事：

- ReadPilot 解决什么问题：把阅读、提问、笔记和伴读页放在一个本地工作台
- 为什么不只是总结器：它按阅读进度工作，普通问答不强行生成页面
- 如何跑起来：Node、Python、Claude Code、`npm run dev`

## 演示素材

建议准备：

- 书库页截图
- 中央阅读页截图
- 右侧 Claude Chat 流式输出截图
- 一个用公版文本生成的伴读页截图
- 30 到 60 秒屏录：导入 EPUB、阅读、追问、生成一个章节页

公开演示请使用自有文本、公版文本或明确可授权文本，不要把版权书籍正文作为宣传素材。

## 首个 Release 文案

```markdown
ReadPilot v0.1.0

本次开源的是 ReadPilot 的本地优先版本：

- EPUB 导入与本地书库
- 中央阅读工作台
- Claude Code ChatPanel
- Markdown 渲染、工具读写提示和 token 使用反馈
- 伴读页生成工作流
- 本地 SQLite 聊天与笔记存储

这是一个早期项目，欢迎围绕导入稳定性、阅读体验、Claude Code 集成和 skill 工作流提出 issue。
```

## 后续路线建议

- 补一套基于公版文本的 demo 数据
- 给 `reading-companion` skill 做独立安装说明或单独仓库
- 加截图和短视频到 README
- 做一次依赖许可证扫描
- 增加英文 README 摘要，方便海外开发者理解
