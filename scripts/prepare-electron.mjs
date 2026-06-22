import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');
const runtimeModules = path.join(standalone, 'runtime_modules');
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

function patchStandaloneServer() {
  const serverFile = path.join(standalone, 'server.js');
  const marker = 'READPILOT_STANDALONE_RUNTIME_MODULES';
  let source = fs.readFileSync(serverFile, 'utf-8');
  if (source.includes(marker)) return;

  source = source.replace(
    "const path = require('path')\n",
    [
      "const path = require('path')",
      "const Module = require('module')",
      '',
      "const runtimeModules = path.join(__dirname, 'runtime_modules')",
      `process.env.${marker} = runtimeModules`,
      "process.env.NODE_PATH = [runtimeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter)",
      'Module._initPaths()',
      '',
    ].join('\n'),
  );
  write(serverFile, source);
}

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Missing .next/standalone/server.js. Run next build first.');
}

// ponytail: Next tracing can over-copy the repo; keep only runtime files, then add our extras.
for (const entry of fs.readdirSync(standalone)) {
  if (!['.next', 'package.json', 'server.js'].includes(entry)) {
    fs.rmSync(path.join(standalone, entry), { recursive: true, force: true });
  }
}
fs.rmSync(path.join(standalone, 'node_modules'), { recursive: true, force: true });
fs.rmSync(runtimeModules, { recursive: true, force: true });

copy(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'));
copy(path.join(root, 'public'), path.join(standalone, 'public'));
copy(path.join(root, 'scripts', 'ebook-converter'), path.join(standalone, 'scripts', 'ebook-converter'));
copy(path.join(root, 'src'), path.join(standalone, 'src'));
copy(path.join(root, 'tsconfig.json'), path.join(standalone, 'tsconfig.json'));
if (process.platform === 'win32') {
  copy(process.execPath, path.join(standalone, 'node.exe'));
}
for (const file of ['server-smoke.out.log', 'server-smoke.err.log']) {
  fs.rmSync(path.join(standalone, file), { force: true });
}

for (const pkg of [
  ['next'],
  ['react'],
  ['react-dom'],
  ['styled-jsx'],
  ['better-sqlite3'],
  ['bindings'],
  ['file-uri-to-path'],
  ['tsx'],
  ['esbuild'],
  ['@esbuild'],
  ['@modelcontextprotocol'],
  ['zod'],
]) {
  copy(path.join(root, 'node_modules', ...pkg), path.join(runtimeModules, ...pkg));
}

write(path.join(runtimeModules, 'better-sqlite3-90e2652d1716b047', 'package.json'), '{"main":"index.js"}\n');
write(path.join(runtimeModules, 'better-sqlite3-90e2652d1716b047', 'index.js'), "module.exports = require('better-sqlite3');\n");
patchStandaloneServer();

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

write(path.join(skillPack, 'README.zh-CN.md'), `
# ReadPilot Skill Pack

这里只有一个核心 skill：\`books-to-course\`。

ReadPilot EXE 会在生成伴读页前，把这个 skill 自动同步到当前书籍数据目录：

- Claude Code: \`.claude/skills/books-to-course\`
- Codex: \`.agents/skills/books-to-course\`

如果需要手动安装到某个书籍目录，可以把整个 \`skills/books-to-course\` 文件夹复制过去。
Windows PowerShell:

\`\`\`powershell
New-Item -ItemType Directory -Force -Path ".\\.claude\\skills"
Copy-Item ".\\skills\\books-to-course" ".\\.claude\\skills\\" -Recurse -Force

New-Item -ItemType Directory -Force -Path ".\\.agents\\skills"
Copy-Item ".\\skills\\books-to-course" ".\\.agents\\skills\\" -Recurse -Force
\`\`\`

\`books-to-course\` 已经自带 \`references/\`，不要只复制 \`SKILL.md\`。
`);

console.log('Prepared Electron standalone runtime.');
