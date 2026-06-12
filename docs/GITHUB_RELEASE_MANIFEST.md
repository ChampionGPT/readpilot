# GitHub 发布文件清单

这份清单说明哪些文件应该进入公开 GitHub 仓库，哪些只保留在本地。

## 应该上传

项目入口与协议：

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.gitignore`
- `.env.example`

依赖与构建配置：

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `vitest.config.ts`
- `components.json`

产品源码：

- `src/`
- `scripts/`
- `public/`

公开文档：

- `docs/SETUP.md`
- `docs/DEPENDENCIES.md`
- `docs/OPEN_SOURCE.md`
- `docs/GITHUB_RELEASE_MANIFEST.md`
- `docs/references/`

公开 skill 模板：

- `skills/reading-companion/SKILL.md`

数据目录占位：

- `data/.gitkeep`

## 不应该上传

本地运行数据：

- `data/books/`
- `data/readpilot.db`
- `data/readpilot.db-shm`
- `data/readpilot.db-wal`

本地密钥和配置：

- `.env.local`
- `.env.*` 中任何包含真实密钥的文件

本地 Claude / agent 产物：

- `.claude/`
- `.agent/`
- `.codex/`
- `.planning/`
- `.trae/`
- `.serena/`
- `.superpowers/`
- `PRPs/`
- `CLAUDE.md`
- 外部参考仓库目录
- `Ui/`

构建和依赖缓存：

- `node_modules/`
- `.next/`
- `out/`
- `coverage/`
- `tsconfig.tsbuildinfo`

运营草稿：

- `.marketing/`
- `docs/superpowers/`
- `docs/SKILL_PROMOTION.md`
- `docs/XIAOHONGSHU_NOTE.md`

## 已跟踪文件的处理

`.gitignore` 只会阻止新的未跟踪文件被加入仓库。若某些本地数据已经被 Git 跟踪，发布前需要从 Git 索引移除，但保留本地文件：

```bash
git rm --cached -r data/books
git rm --cached data/readpilot.db data/readpilot.db-shm data/readpilot.db-wal
git rm --cached -r .claude .agent .codex .planning .trae .serena .superpowers PRPs
git rm --cached -r docs/superpowers
git rm --cached CLAUDE.md
git rm --cached -r Ui
```

执行后检查：

```bash
git status --short
git ls-files data .claude .agent .codex .planning .trae .serena .superpowers PRPs docs/superpowers CLAUDE.md Ui
```

公开仓库里理想情况下只应保留 `data/.gitkeep`，不应出现私人书籍、数据库、Claude 本地配置或推广草稿。
