# ebook-converter（vendor）

EPUB → JSONL 转换器。本目录的 Python 脚本从外部仓库 vendor 进来。

## 来源

- 仓库：https://github.com/Jia-Hong-Peng/rag-to-skill
- License：MIT（以上游 README 中的授权说明为准）
- 固定 commit：`8ab576153209322bcf7fe845e8ecc7f89c647fbb`
- 作者：Jia-Hong-Peng

仓库根目录的 [NOTICE.md](../../NOTICE.md) 也记录了该 vendored 脚本的来源。

## 安装依赖

```bash
pip install -r scripts/ebook-converter/requirements.txt
```

## 直接调用

```bash
python3 scripts/ebook-converter/epub_to_jsonl.py <input.epub> <output.jsonl> [--chunk-size 500]
```

ReadPilot 内部通过 `src/lib/ebook-converter.ts` 包装调用，不需要手动跑。

## 输出格式

每行一个 JSON 对象：
`{"loc":{"item_index":0,"chunk_index":0},"chapter":"第一章","text":"..."}`

## 升级

替换 `epub_to_jsonl.py`，更新本 README 的 commit hash，运行 `npm test` 确保 wrapper 测试仍然通过。
