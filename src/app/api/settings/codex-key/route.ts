// input: GET current status, POST { value }, DELETE clear
// output: local Codex/OpenAI API key setting
// pos: settings API for non-CLI Codex setup
import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

function mask(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export async function GET() {
  const value = getSetting('openai_api_key') ?? '';
  return NextResponse.json({ hasKey: !!value, maskedKey: value ? mask(value) : null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { value?: string };
  const value = (body.value ?? '').trim();
  if (!value) return NextResponse.json({ error: '请填入 OpenAI API Key' }, { status: 400 });
  setSetting('openai_api_key', value);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  setSetting('openai_api_key', '');
  return NextResponse.json({ ok: true });
}
