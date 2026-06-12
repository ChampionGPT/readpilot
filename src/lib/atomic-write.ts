/**
 * input: 文件绝对路径 + 任意可序列化对象
 * output: 原子写入 + .bak 备份；失败不破坏原文件
 * pos: 所有 progress.json / 类似关键 JSON 文件的唯一写入入口
 */
import fs from 'node:fs';

export function writeJsonAtomic(absPath: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const tmp = absPath + '.tmp';

  if (fs.existsSync(absPath)) {
    try {
      fs.copyFileSync(absPath, absPath + '.bak');
    } catch (err) {
      console.warn('[atomic-write] failed to write .bak (best-effort):', err);
    }
  }

  fs.writeFileSync(tmp, json, 'utf-8');
  fs.renameSync(tmp, absPath);
}
