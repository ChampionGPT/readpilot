# ReadPilot

[简体中文](README.zh-CN.md)

ReadPilot is a local-first AI reading workspace for EPUBs, notes, and Claude-assisted companion pages.

It is not designed to summarize an entire book in one pass. ReadPilot is built for serious reading: import a book, read chapter by chapter, ask questions in context, keep notes locally, and generate focused interactive companion pages as your reading progresses.

## Who It Is For

- Readers who want to understand long books instead of only collecting summaries
- Developers exploring AI-assisted reading, local knowledge workspaces, and book-aware agents
- Claude Code users who want a concrete desktop-style workflow around the Claude Agent SDK
- Builders experimenting with EPUB import, local-first data, and generated HTML study material

## Core Features

- Local library: import EPUBs and keep book files, source chunks, generated pages, and `progress.json` under local data directories
- Reading workspace: central book Hub, chapter timeline, preserved EPUB-style reading pages, notes, and companion page entry points
- Claude ChatPanel: uses `@anthropic-ai/claude-agent-sdk` to talk to Claude Code with streaming output, Markdown rendering, tool activity hints, and token usage feedback
- Companion page generation: the bundled `reading-companion` skill turns explicit page-generation requests into focused HTML pages
- Optional WeRead integration: bind local books to WeChat Reading / WeRead, sync highlights, thoughts, progress, and reading stats, then pass that reader-side memory into the companion chat
- Local persistence: SQLite stores chats and notes; book content and generated artifacts stay on disk
- Progressive workflow: ordinary Q&A stays in ChatPanel; only explicit "generate a page" requests enter the companion page workflow

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS v4 + Base UI / shadcn-style components
- Zustand
- better-sqlite3
- Claude Agent SDK / Claude Code
- Python EPUB converter using `ebooklib` and `beautifulsoup4`

## Quick Start

Requirements:

- Node.js 20 or newer
- npm
- Python 3.10 or newer
- Claude Code CLI, with the `claude` command available in your terminal

Install dependencies:

```bash
npm install
pip install ebooklib beautifulsoup4
```

Prepare local configuration:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Claude Code Setup

ReadPilot works through your local Claude Code / Claude Agent SDK environment. First confirm that Claude Code is available:

```bash
claude --version
```

Official resources:

- Claude Code overview: https://docs.anthropic.com/en/docs/claude-code/overview
- Claude Code setup: https://docs.anthropic.com/en/docs/claude-code/setup
- Claude Code SDK: https://docs.anthropic.com/en/docs/claude-code/sdk
- Claude Agent SDK npm package: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

Common npm installation:

```bash
npm install -g @anthropic-ai/claude-code
```

If your environment uses an API key, configure it through the official Claude Code or Anthropic flow and do not commit secrets. On Windows, if Claude Code needs Git Bash, set `CLAUDE_CODE_GIT_BASH_PATH` in `.env.local`.

## Optional WeRead Skill Setup

The WeRead integration is optional and mainly useful for readers who use WeChat Reading / WeRead.

1. Open the WeRead Skill console and get a personal API key: https://i.weread.qq.com/skills/agent
2. Open ReadPilot's `/settings` page, enter the key that starts with `wrk-`, and test the connection.
3. Go back to the library, click the link icon on a book card, search for the matching WeRead book, and bind it.
4. After binding, chapter notes can show WeRead highlights, and ChatPanel can receive those reader-side context signals when the current book is bound.

WeRead data is cached in local SQLite. Do not commit `data/readpilot.db*` to a public repository.

## Data And Privacy

ReadPilot stores runtime data in `data/` by default:

- `data/books/`: imported books, EPUB sources, chapter JSONL, generated HTML companion pages, and `progress.json`
- `data/readpilot.db`: local chats, notes, bindings, and other SQLite state
- `.env.local`: local environment variables and possible secrets

These files should not be committed to a public repository. Before publishing, make sure you are not including private books, databases, chat logs, API keys, or generated pages that contain copyrighted source text.

## Scripts

```bash
npm run dev       # local development
npm run build     # production build
npm run start     # start production build
npm run lint      # ESLint
npm run test      # Vitest
```

## Companion Skills

This repository includes Claude Code skill templates for the companion reading workflow:

- English: [skills/reading-companion/SKILL.md](skills/reading-companion/SKILL.md)
- Chinese: [skills/reading-companion-zh/SKILL.md](skills/reading-companion-zh/SKILL.md)

The skill is intentionally narrow: it should generate or update companion pages only when the user explicitly asks for a page. Ordinary explanations, summaries, quiz questions, and lightweight Q&A should stay in chat.

If you publish demos, use your own text or public-domain text as examples. Avoid publishing copyrighted book excerpts.

## Documentation

- [Setup](docs/SETUP.md) currently in Chinese
- [Dependencies](docs/DEPENDENCIES.md) currently in Chinese
- [Contributing](CONTRIBUTING.md)
- [Security and privacy](SECURITY.md)

## License

ReadPilot is released under the [MIT License](LICENSE).
