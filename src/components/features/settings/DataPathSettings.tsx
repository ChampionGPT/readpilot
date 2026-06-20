/**
 * input: Electron preload API or /api/settings/runtime
 * output: data directory status and desktop path picker
 * pos: /settings data storage card
 */
'use client';

import { useEffect, useState } from 'react';

type ElectronAPI = {
  isElectron: true;
  selectDirectory: () => Promise<string | null>;
  getDataPath: () => Promise<string>;
  getDefaultDataPath: () => Promise<string>;
  setDataPath: (path: string) => Promise<void>;
};

type RuntimeStatus = {
  desktop: boolean;
  dataDir: string;
  booksDir: string;
};

function electronAPI(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

export function DataPathSettings() {
  const [desktopApi, setDesktopApi] = useState<ElectronAPI | null>(null);
  const [path, setPath] = useState('');
  const [booksDir, setBooksDir] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const api = electronAPI();
    setDesktopApi(api);
    if (api) {
      api.getDataPath().then(setPath);
      return;
    }
    fetch('/api/settings/runtime')
      .then((r) => r.json())
      .then((status: RuntimeStatus) => {
        setPath(status.dataDir);
        setBooksDir(status.booksDir);
      });
  }, []);

  async function browse() {
    if (!desktopApi) return;
    const selected = await desktopApi.selectDirectory();
    if (selected) setPath(selected);
  }

  async function resetDefault() {
    if (!desktopApi) return;
    setPath(await desktopApi.getDefaultDataPath());
  }

  async function save() {
    if (!desktopApi || !path.trim()) return;
    await desktopApi.setDataPath(path.trim());
    setMessage('已保存。重启 ReadPilot 后生效。');
  }

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
      <header className="mb-4">
        <h2 className="font-serif text-xl font-bold text-on-surface">数据目录</h2>
        <p className="mt-1 text-sm text-on-surface-variant">书籍、笔记、数据库和聊天记录会保存在这里。</p>
      </header>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            readOnly={!desktopApi}
            className="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-mono text-xs text-on-surface"
          />
          {desktopApi && (
            <button type="button" onClick={browse} className="whitespace-nowrap rounded-lg border border-outline-variant/40 px-3 py-2 text-sm hover:bg-surface-container">
              浏览
            </button>
          )}
        </div>

        {!desktopApi && booksDir && (
          <p className="text-xs text-on-surface-variant">当前书籍目录：<code className="font-mono">{booksDir}</code></p>
        )}

        {desktopApi ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40" disabled={!path.trim()}>
              保存
            </button>
            <button type="button" onClick={resetDefault} className="rounded-lg border border-outline-variant/40 px-3 py-2 text-sm hover:bg-surface-container">
              重置默认
            </button>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant">Web/开发模式请通过 <code className="font-mono">READPILOT_DATA_DIR</code> 环境变量修改。</p>
        )}

        {message && <p className="text-sm text-green-600">{message}</p>}
      </div>
    </section>
  );
}
