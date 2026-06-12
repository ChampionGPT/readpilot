// input: NextRequest 查询参数 q (必填), scope (可选, 默认 10), count (可选)
// output: GET 返回搜索结果列表 { results: WereadSearchResult[] }
// pos: 微读搜索代理 — 给 WereadBindDialog 提供候选书目
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { search, WereadAuthError, WereadApiError } from '@/lib/wereadClient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  if (!q || q.trim() === '') {
    return NextResponse.json({ error: '缺少查询参数 q' }, { status: 400 });
  }
  const scopeStr = url.searchParams.get('scope');
  const countStr = url.searchParams.get('count');
  const scope = scopeStr ? parseInt(scopeStr, 10) : 10;
  const count = countStr ? parseInt(countStr, 10) : undefined;

  try {
    const results = await search(q, { scope, count });
    return NextResponse.json({ results });
  } catch (e: any) {
    if (e instanceof WereadAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof WereadApiError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 502 });
    }
    console.error('[/api/weread/search] error:', e);
    return NextResponse.json({ error: e?.message ?? '搜索失败' }, { status: 500 });
  }
}
