# 安全与隐私

ReadPilot 是本地优先应用，但它会把你的阅读内容、提问和生成请求交给本机配置的 Claude Code / Claude Agent SDK 处理。实际数据是否发送到模型服务，取决于你的 Claude Code 配置。

## 不要公开的数据

- `.env.local`
- API Key、访问令牌、Claude Code 本地认证信息
- `data/books/` 下的私人书籍、章节 JSONL、生成页面和 `progress.json`
- `data/readpilot.db*` 本地数据库
- 聊天记录、笔记、带版权内容的截图

## 开源发布前检查

```bash
git status --short
git ls-files data
```

如果 `data/` 下仍有文件被 Git 跟踪，请参考 [docs/OPEN_SOURCE.md](docs/OPEN_SOURCE.md) 的清理步骤。

## 报告安全问题

如果你发现可能导致密钥泄露、本地文件越权读取、路径穿越、未授权写入或隐私数据公开的问题，请先通过私下渠道联系维护者。公开 issue 中不要包含真实密钥、私人书籍或数据库内容。

## 版权提醒

MIT License 覆盖 ReadPilot 的代码和文档，不代表用户导入的书籍内容、生成页面中的引用内容或截图素材可以被再分发。公开 demo 请使用自有文本、公版文本或明确授权文本。

