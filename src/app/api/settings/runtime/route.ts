// input: none
// output: desktop/runtime paths and tool availability
// pos: settings page status endpoint
import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { BOOKS_DIR, DATA_DIR } from '@/lib/constants';
import { getSetting } from '@/lib/db';

function mask(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function commandWorks(command: string): boolean {
  try {
    execFileSync(command, ['--version'], {
      shell: process.platform === 'win32',
      stdio: 'ignore',
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const savedOpenAiKey = getSetting('openai_api_key') ?? '';
  const envOpenAiKey = process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || '';
  const pythonAvailable = commandWorks('python') || commandWorks('python3');
  return NextResponse.json({
    desktop: process.env.READPILOT_DESKTOP === '1',
    dataDir: DATA_DIR,
    booksDir: BOOKS_DIR,
    mcpBundled: true,
    mcpEnabled: process.env.READPILOT_CONTEXT_MCP_ENABLED !== '0',
    pythonAvailable,
    claudeAvailable: commandWorks('claude'),
    codexKeyConfigured: !!(savedOpenAiKey || envOpenAiKey),
    codexKeySource: savedOpenAiKey ? 'settings' : envOpenAiKey ? 'env' : null,
    maskedCodexKey: savedOpenAiKey ? mask(savedOpenAiKey) : envOpenAiKey ? mask(envOpenAiKey) : null,
    agentProvider: process.env.READPILOT_AGENT_PROVIDER || 'claude',
  });
}
