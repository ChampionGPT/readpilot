import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');
const skillPack = path.join(root, '.next', 'readpilot-skill-pack');

function copy(from, to) {
  if (!fs.existsSync(from)) return;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimStart(), 'utf-8');
}

function copyPackagedSkill(sourceName, packageName) {
  const target = path.join(skillPack, 'skills', packageName);
  copy(path.join(root, 'skills', sourceName), target);

  const skillFile = path.join(target, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    const content = fs.readFileSync(skillFile, 'utf-8').replace(/^name:\s*.+$/m, `name: ${packageName}`);
    fs.writeFileSync(skillFile, content, 'utf-8');
  }
}

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Missing .next/standalone/server.js. Run next build first.');
}

// ponytail: Next tracing can over-copy the repo; keep only runtime files, then add our extras.
for (const entry of fs.readdirSync(standalone)) {
  if (!['.next', 'node_modules', 'package.json', 'server.js'].includes(entry)) {
    fs.rmSync(path.join(standalone, entry), { recursive: true, force: true });
  }
}

copy(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'));
copy(path.join(root, 'public'), path.join(standalone, 'public'));
copy(path.join(root, 'scripts', 'ebook-converter'), path.join(standalone, 'scripts', 'ebook-converter'));
copy(path.join(root, 'src'), path.join(standalone, 'src'));
copy(path.join(root, 'tsconfig.json'), path.join(standalone, 'tsconfig.json'));

for (const pkg of [
  ['node_modules', 'tsx'],
  ['node_modules', 'esbuild'],
  ['node_modules', '@esbuild'],
  ['node_modules', '@modelcontextprotocol'],
  ['node_modules', 'zod'],
]) {
  copy(path.join(root, ...pkg), path.join(standalone, ...pkg));
}

fs.rmSync(skillPack, { recursive: true, force: true });
copyPackagedSkill('books-to-course', 'books-to-course');
write(path.join(skillPack, 'README.zh-CN.md'), `
# ReadPilot Skill Pack

这里只有一个核心 skill：\`books-to-course\`。

把整个 \`skills/books-to-course\` 文件夹复制到 Claude Code 或 Codex 的用户 skills 目录。

Windows PowerShell:

\`\`\`powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\skills"
Copy-Item ".\\skills\\books-to-course" "$env:USERPROFILE\\.claude\\skills\\" -Recurse -Force

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\skills"
Copy-Item ".\\skills\\books-to-course" "$env:USERPROFILE\\.codex\\skills\\" -Recurse -Force
\`\`\`

\`books-to-course\` 已经自带 \`references/\`，不要只复制 \`SKILL.md\`。
`);

console.log('Prepared Electron standalone runtime.');
