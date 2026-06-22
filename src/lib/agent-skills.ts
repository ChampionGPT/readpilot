import fs from 'fs';
import path from 'path';

const READPILOT_SKILL_NAME = 'books-to-course';

function hasSkillFile(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'SKILL.md')) || fs.existsSync(path.join(dir, 'skill.md'));
}

function packagedSkillDir(): string | null {
  const candidates = [
    process.env.READPILOT_SKILL_PACK_DIR
      ? path.join(process.env.READPILOT_SKILL_PACK_DIR, 'skills', READPILOT_SKILL_NAME)
      : '',
    path.join(process.cwd(), 'skills', READPILOT_SKILL_NAME),
    path.join(process.cwd(), '..', 'skills', READPILOT_SKILL_NAME),
  ].filter(Boolean);

  return candidates.find((candidate) => hasSkillFile(candidate)) ?? null;
}

export function ensureReadPilotAgentSkills(targetCwd: string): void {
  const source = packagedSkillDir();
  if (!source) return;

  for (const skillsRoot of [
    path.join(targetCwd, '.claude', 'skills'),
    path.join(targetCwd, '.agents', 'skills'),
  ]) {
    const target = path.join(skillsRoot, READPILOT_SKILL_NAME);
    if (path.resolve(source) === path.resolve(target)) continue;

    try {
      fs.mkdirSync(skillsRoot, { recursive: true });
      fs.cpSync(source, target, { recursive: true, force: true });
    } catch (error) {
      console.warn(`[agent-skills] Failed to sync ${READPILOT_SKILL_NAME} to ${target}:`, error);
    }
  }
}
