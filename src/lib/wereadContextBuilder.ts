// input: localBookDir (来自 ChatPanel/claude-client)
// output: 一段 markdown，注入到伴读 AI system prompt；包含读者真实划线 + 想法 + 进度
// pos: 上下文增强层 — 让 AI 能基于读者侧记忆对话；唯一调用方 claude-client.ts
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { getBindingByDir } from './db';
import { getChapterMarks, getCachedProgress, getCachedBookInfo } from './wereadCache';

const MAX_BOOKMARKS = 50;     // 总条数硬上限（避免 prompt 爆炸）
const RECENT_KEEP = 30;       // 优先保留：按 createTime 最新 30 条

function fmtDate(unixSec: number): string {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtHours(sec: number | undefined): string {
  if (!sec) return '0h';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}分钟`;
  return m === 0 ? `${h}小时` : `${h}小时${m}分钟`;
}

/** 返回追加到 system prompt 的 markdown 段；若该书没绑定/无划线返回空串 */
export function buildWereadContextSection(localBookDir: string): string {
  if (!localBookDir) return '';

  const binding = getBindingByDir(localBookDir);
  if (!binding) return '';

  const chapters = getChapterMarks(binding.wereadBookId);
  if (chapters.length === 0) return '';

  const info = getCachedBookInfo(binding.wereadBookId);
  const progress = getCachedProgress(binding.wereadBookId);

  // 平铺所有 bookmarks → 取最新 30 条 + 每章首条（去重保留 ≤MAX_BOOKMARKS）
  const allMarks = chapters.flatMap((c) =>
    c.bookmarks.map((b) => ({ ...b, chapterUid: c.chapterUid, chapterTitle: c.chapterTitle }))
  );
  const totalMarks = allMarks.length;

  const sortedRecent = [...allMarks].sort((a, b) => b.createTime - a.createTime);
  const keepIds = new Set(sortedRecent.slice(0, RECENT_KEEP).map((b) => b.bookmarkId));
  // 补充：每章首条（如果还没在 keepIds 里）
  for (const c of chapters) {
    if (c.bookmarks[0] && !keepIds.has(c.bookmarks[0].bookmarkId)) keepIds.add(c.bookmarks[0].bookmarkId);
    if (keepIds.size >= MAX_BOOKMARKS) break;
  }
  const kept = allMarks.filter((b) => keepIds.has(b.bookmarkId));
  // 按章节升序、章节内按 range 升序
  kept.sort((a, b) => a.chapterUid - b.chapterUid || a.range.localeCompare(b.range, 'en-u-kn-true'));

  // 想法保留全部（一般数量远少于划线）
  const allReviews = chapters.flatMap((c) => c.reviews.map((r) => ({ ...r, chapterUid: c.chapterUid, chapterTitle: c.chapterTitle })));

  const parts: string[] = [];
  parts.push('## 读者在微信读书中对本书的私人笔记');
  parts.push('');
  const overview: string[] = [];
  if (info?.title) overview.push(`《${info.title}》${info.author ? ` — ${info.author}` : ''}`);
  if (progress) overview.push(`读到 ${progress.progressPercent ?? 0}%${progress.readingTimeSec ? `，累计 ${fmtHours(progress.readingTimeSec)}` : ''}`);
  overview.push(`共 ${totalMarks} 条划线，${allReviews.length} 条想法`);
  if (kept.length < totalMarks) overview.push(`（下方展示 ${kept.length} 条最具代表性的划线，覆盖最近活动 + 每章首条）`);
  parts.push(overview.join(' · '));
  parts.push('');

  // 按章节分组渲染 kept marks
  parts.push('### 划线（按章节）');
  let lastChapterUid: number | null = null;
  for (const m of kept) {
    if (m.chapterUid !== lastChapterUid) {
      parts.push('');
      parts.push(`**${m.chapterTitle || `第 ${m.chapterUid} 节`}**`);
      lastChapterUid = m.chapterUid;
    }
    parts.push(`> ${m.markText}  (${fmtDate(m.createTime)} 划)`);
    // 同 range 想法挂在划线下
    const inline = allReviews.filter((r) => r.range === m.range && r.chapterUid === m.chapterUid);
    for (const r of inline) {
      parts.push(`>> 💭 读者想法：${r.content.replace(/\n/g, ' ')}`);
    }
  }

  // 章节级 / 整本书评（没有 range 关联的）
  const standaloneReviews = allReviews.filter((r) => !r.range || !kept.some((m) => m.range === r.range && m.chapterUid === r.chapterUid));
  if (standaloneReviews.length > 0) {
    parts.push('');
    parts.push('### 章节点评 / 整本书评');
    for (const r of standaloneReviews) {
      const tag = r.chapterUid === 0 ? '整本书评' : (r.chapterTitle || `第 ${r.chapterUid} 节`);
      const stars = r.star != null && r.star > 0 ? ` · ${'★'.repeat(Math.max(1, Math.round(r.star)))}` : '';
      parts.push(`- **${tag}**${stars}（${fmtDate(r.createTime)}）：${r.content.replace(/\n/g, ' ')}`);
    }
  }

  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push('请在对话中主动引用这些划线/想法（读者亲自划过的句子是最强信号）。回答时优先关注读者已经标记过的段落与产生过的想法。');
  return parts.join('\n');
}
