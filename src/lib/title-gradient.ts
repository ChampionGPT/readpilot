// input: 书籍标题字符串
// output: Tailwind 渐变色 class（两种调色板：cover 浅色 / thumbnail 深色）
// pos: UI 工具层 — 统一"标题 → 确定性渐变色"的哈希算法，避免 BookCard 与 BookshelfPanel 各写一套
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

/** 共享 djb2-like 哈希：保证同一标题在两个视图里映射到同一索引 */
function titleHash(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/** Library 大封面用 — 柔和浅色（搭配首字母叠加） */
const COVER_GRADIENTS = [
  "from-rose-100 to-teal-100",
  "from-orange-100 to-amber-100",
  "from-emerald-100 to-cyan-100",
  "from-indigo-100 to-purple-100",
  "from-fuchsia-100 to-pink-100",
  "from-[#FDEEE9] to-[#F5F0E8]",
];

/** 侧边栏小缩略图用 — 深色（白色文字直接铺底） */
const THUMBNAIL_GRADIENTS = [
  "from-stone-500 to-stone-700",
  "from-amber-700 to-stone-800",
  "from-emerald-700 to-stone-800",
  "from-sky-700 to-stone-800",
  "from-violet-700 to-stone-800",
  "from-rose-700 to-stone-800",
];

export function getCoverGradient(title: string): string {
  return COVER_GRADIENTS[titleHash(title) % COVER_GRADIENTS.length];
}

export function getThumbnailGradient(title: string): string {
  return THUMBNAIL_GRADIENTS[titleHash(title) % THUMBNAIL_GRADIENTS.length];
}
