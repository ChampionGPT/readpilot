// input: GET current status, POST { value }, DELETE clear
// output: local Codex CLI executable path setting
// pos: settings API for desktop Codex CLI path override
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSetting, setSetting } from '@/lib/db';

export async function GET() {
  const value = getSetting('codex_cli_path') ?? '';
  return NextResponse.json({ value, exists: value ? fs.existsSync(value) : false });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { value?: string };
  const value = (body.value ?? '').trim();
  if (!value) return NextResponse.json({ error: '请输入 Codex CLI 路径' }, { status: 400 });
  if (!fs.existsSync(value)) return NextResponse.json({ error: '路径不存在' }, { status: 400 });
  setSetting('codex_cli_path', value);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  setSetting('codex_cli_path', '');
  return NextResponse.json({ ok: true });
}
