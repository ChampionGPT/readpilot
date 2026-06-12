// input: GET 读取当前是否已设置；POST { value: string } 写入；DELETE 清空
// output: GET → { hasKey: boolean, maskedKey: string | null }; POST/DELETE → { ok: true }
// pos: settings 表的 weread_api_key 行的 HTTP 出口（避免前端直接调用 db 模块）
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

function mask(key: string): string {
  if (key.length <= 8) return '••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

export async function GET() {
  const v = getSetting('weread_api_key') ?? '';
  return NextResponse.json({ hasKey: v.length > 0, maskedKey: v.length > 0 ? mask(v) : null });
}

export async function POST(req: NextRequest) {
  let body: { value?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  const value = (body.value ?? '').trim();
  if (!value) return NextResponse.json({ error: '请填入 API Key' }, { status: 400 });
  setSetting('weread_api_key', value);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  setSetting('weread_api_key', '');
  return NextResponse.json({ ok: true });
}
