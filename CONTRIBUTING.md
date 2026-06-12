# 贡献指南

感谢你考虑参与 ReadPilot。这个项目还处于早期阶段，最有价值的贡献通常是：可复现 bug、导入兼容性改进、阅读体验优化、Claude Code 集成稳定性、文档和 demo。

## 本地开发

```bash
npm install
pip install ebooklib beautifulsoup4
cp .env.example .env.local
npm run dev
```

## 提交前检查

```bash
npm run lint
npm run test
npm run build
```

如果改动只涉及文档，可以说明未运行构建的原因。

## 数据与版权

请不要在 PR 中提交：

- 私人 EPUB、PDF、TXT 或其他书籍文件
- `data/books/` 下生成的页面和 `progress.json`
- `data/readpilot.db*`
- `.env.local` 或任何密钥
- 未授权书籍正文截图

Demo 和测试材料请优先使用自有文本、公版文本或明确授权文本。

## 代码风格

- 优先沿用现有组件和目录结构
- 变更范围尽量小，避免顺手重构无关代码
- UI 改动需要考虑阅读密度、移动端布局和文本不重叠
- 涉及共享逻辑时补测试
- 修改重要模块时同步更新附近 README 或 docs

## Issue 建议

提交 bug 时请包含：

- 操作系统和 Node/Python 版本
- 复现步骤
- 预期行为和实际行为
- 控制台错误或服务端日志
- 是否与特定 EPUB 文件相关

如果问题涉及版权书籍，请不要上传原文件，可以提供脱敏后的结构信息或最小复现样本。

