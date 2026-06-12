#!/usr/bin/env node
/**
 * input: argv [bookDir, --json '<page-json>'] or stdin JSON
 * output: 调 POST /api/books/:bookDir/pages，打印结果
 * pos: books-to-course skill 唯一允许的 progress.json 写入工具
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: tsx scripts/append-page.ts <bookDir> [--json '<JSON>']");
    process.exit(2);
  }
  const bookDir = args[0];
  let pageJson: string | null = null;
  const jsonIdx = args.indexOf('--json');
  if (jsonIdx >= 0 && args[jsonIdx + 1]) pageJson = args[jsonIdx + 1];

  if (!pageJson) {
    pageJson = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    });
  }

  let page: unknown;
  try { page = JSON.parse(pageJson); }
  catch (e) { console.error('Invalid JSON:', (e as Error).message); process.exit(3); }

  const baseUrl = process.env.READPILOT_BASE_URL ?? 'http://localhost:3000';

  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const res = await fetch(`${baseUrl}/api/books/${encodeURIComponent(bookDir)}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    });
    const body = await res.text();

    if (res.status === 201) {
      console.log(body);
      return;
    }

    lastStatus = res.status;
    lastBody = body;

    if (res.status !== 409 || !body.includes('page_not_ready')) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.error(`HTTP ${lastStatus}:`, lastBody);
  process.exit(4);
}
main().catch((e) => { console.error(e); process.exit(1); });
