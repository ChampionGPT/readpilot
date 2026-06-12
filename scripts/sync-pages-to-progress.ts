/**
 * 同步脚本：将 pages 目录下的 HTML 文件同步到 progress.json 的 pages 数组
 * 用法：npx tsx scripts/sync-pages-to-progress.ts <bookDir>
 * 示例：npx tsx scripts/sync-pages-to-progress.ts oldbook_喧哗与骚动
 */
import fs from 'fs';
import path from 'path';

const BOOKS_DIR = path.join(process.cwd(), 'data', 'books');

function syncPages(bookDir: string) {
  const bookPath = path.join(BOOKS_DIR, bookDir);
  const pagesDir = path.join(bookPath, 'pages');
  const progressPath = path.join(bookPath, 'progress.json');

  if (!fs.existsSync(bookPath)) {
    console.error(`❌ 书籍目录不存在: ${bookPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(pagesDir)) {
    console.error(`❌ pages 目录不存在: ${pagesDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(progressPath)) {
    console.error(`❌ progress.json 不存在: ${progressPath}`);
    process.exit(1);
  }

  // 读取现有 HTML 文件
  const htmlFiles = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.html'))
    .sort();

  console.log(`📁 发现 HTML 文件: ${htmlFiles.join(', ')}`);

  // 读取 progress.json
  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  const existingPages = progress.pages || [];

  // 构建现有文件的映射
  const existingFiles = new Set(existingPages.map((p: any) => p.file.replace('pages/', '')));

  // 找出需要新增的页面
  const newPages = htmlFiles.filter(f => !existingFiles.has(f));

  if (newPages.length === 0) {
    console.log('✅ 所有页面已同步，无需更新');
    return;
  }

  console.log(`➕ 需要新增: ${newPages.join(', ')}`);

  // 为新文件生成页面记录
  for (const file of newPages) {
    const baseName = file.replace('.html', '').replace(/^\d+_/, '');
    const id = file.replace('.html', '');

    const newPage = {
      id,
      type: 'chapter' as const,
      title: baseName,
      description: `阅读 ${baseName}`,
      file: `pages/${file}`,
      status: 'new' as const,
      masteryScore: null,
      relatedChapters: [],
      createdAt: new Date().toISOString().split('T')[0],
      completedAt: null
    };

    existingPages.push(newPage);
  }

  // 按文件名排序
  existingPages.sort((a: any, b: any) => a.file.localeCompare(b.file, 'zh-CN'));

  // 更新 progress.json
  progress.pages = existingPages;
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');

  console.log(`✅ 已同步 ${newPages.length} 个页面到 progress.json`);
}

// 主入口
const bookDir = process.argv[2];
if (!bookDir) {
  console.error('用法: npx tsx scripts/sync-pages-to-progress.ts <bookDir>');
  console.error('示例: npx tsx scripts/sync-pages-to-progress.ts oldbook_喧哗与骚动');
  process.exit(1);
}

syncPages(bookDir);