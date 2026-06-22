import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BOOKS_DIR } from '@/lib/constants';

type AgentCommand = {
  name: string;
  value: string;
  description: string;
  kind: 'slash_command' | 'skill' | 'sdk_command';
};

const CLAUDE_SDK_COMMANDS: AgentCommand[] = [
  { name: 'compact', value: '/compact', description: 'Compress Claude Code conversation context', kind: 'sdk_command' },
  { name: 'init', value: '/init', description: 'Initialize project instructions for Claude Code', kind: 'sdk_command' },
  { name: 'review', value: '/review', description: 'Ask Claude Code to review the current work', kind: 'sdk_command' },
];

function frontMatter(content: string, key: string): string {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
}

function scanCommands(dir: string): AgentCommand[] {
  if (!fs.existsSync(dir)) return [];
  const out: AgentCommand[] = [];
  const stack = [{ dir, prefix: '' }];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current.dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(current.dir, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dir: full, prefix: current.prefix ? `${current.prefix}:${entry.name}` : entry.name });
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = `${current.prefix ? `${current.prefix}:` : ''}${entry.name.replace(/\.md$/, '')}`;
        const content = fs.readFileSync(full, 'utf-8');
        const first = content.split(/\r?\n/).find((line) => line.trim())?.replace(/^#+\s*/, '').trim();
        out.push({ name, value: `/${name}`, description: first || `/${name}`, kind: 'slash_command' });
      }
    }
  }
  return out;
}

function scanSkills(dir: string): AgentCommand[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const skillFile = path.join(dir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) return [];
      const content = fs.readFileSync(skillFile, 'utf-8');
      const name = frontMatter(content, 'name') || entry.name;
      return [{ name, value: `/${name}`, description: frontMatter(content, 'description') || `Skill: ${name}`, kind: 'skill' as const }];
    });
}

function bookCwd(bookDir: string | null): string | null {
  if (!bookDir) return null;
  const cwd = path.resolve(BOOKS_DIR, bookDir);
  const rel = path.relative(path.resolve(BOOKS_DIR), cwd);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : cwd;
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider');
  if (provider !== 'claude') return NextResponse.json({ commands: [] });

  const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const cwd = bookCwd(req.nextUrl.searchParams.get('bookDir'));
  const commands = [
    ...CLAUDE_SDK_COMMANDS,
    ...scanCommands(path.join(home, 'commands')),
    ...scanSkills(path.join(home, 'skills')),
    ...(cwd ? scanCommands(path.join(cwd, '.claude', 'commands')) : []),
    ...(cwd ? scanSkills(path.join(cwd, '.claude', 'skills')) : []),
  ];

  const byValue = new Map<string, AgentCommand>();
  for (const command of commands) byValue.set(command.value, command);
  return NextResponse.json({ commands: Array.from(byValue.values()).slice(0, 50) });
}
