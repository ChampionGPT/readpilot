/**
 * input: /api/settings/runtime plus Codex key/path settings APIs
 * output: local agent/MCP status and Codex setup
 * pos: /settings AI agent configuration card
 */
'use client';

import { useEffect, useState } from 'react';

type RuntimeStatus = {
  agentProvider: string;
  claudeAvailable: boolean;
  codexCliAvailable: boolean;
  codexCliPath: string;
  codexCliPathSource: 'settings' | 'env' | null;
  codexKeyConfigured: boolean;
  codexKeySource: 'settings' | 'env' | null;
  maskedCodexKey: string | null;
  mcpBundled: boolean;
  mcpEnabled: boolean;
  pythonAvailable: boolean;
};

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-stone-300'}`} />;
}

export function AgentSettingsCard() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [cliPathInput, setCliPathInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const next = await fetch('/api/settings/runtime').then((r) => r.json());
    setStatus(next);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSetting(url: string, value: string, okMessage: string, clearInput: () => void) {
    if (!value.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: value.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      clearInput();
      setMessage(okMessage);
      await load();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setMessage(body.error ?? '保存失败');
  }

  async function clearSetting(url: string, okMessage: string) {
    setBusy(true);
    await fetch(url, { method: 'DELETE' });
    setBusy(false);
    setMessage(okMessage);
    await load();
  }

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
      <header className="mb-4">
        <h2 className="font-serif text-xl font-bold text-on-surface">AI Agent 与本地工具</h2>
        <p className="mt-1 text-sm text-on-surface-variant">ReadPilot MCP 已随应用内置；外部模型凭据按需配置。</p>
      </header>

      {status && (
        <div className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2"><StatusDot ok={status.mcpBundled && status.mcpEnabled} /> ReadPilot MCP：内置</div>
            <div className="flex items-center gap-2"><StatusDot ok={status.pythonAvailable} /> Python EPUB 导入：{status.pythonAvailable ? '可用' : '未检测到'}</div>
            <div className="flex items-center gap-2"><StatusDot ok={status.claudeAvailable} /> Claude CLI：{status.claudeAvailable ? '可用' : '未检测到'}</div>
            <div className="flex items-center gap-2"><StatusDot ok={status.codexKeyConfigured} /> Codex Key：{status.maskedCodexKey ?? '未设置'}</div>
            <div className="flex items-center gap-2"><StatusDot ok={status.codexCliAvailable} /> Codex CLI：{status.codexCliAvailable ? '可用' : '未检测到'}</div>
          </div>

          <div className="border-t border-outline-variant/20 pt-3">
            <label className="mb-2 block text-xs font-semibold text-on-surface-variant">Codex / OpenAI API Key</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={status.codexKeyConfigured ? '替换当前 Key' : 'sk-...'}
                className="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => saveSetting('/api/settings/codex-key', keyInput, 'Codex Key 已保存。新对话会使用它。', () => setKeyInput(''))} disabled={busy || !keyInput.trim()} className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40">
                保存
              </button>
              {status.codexKeySource === 'settings' && (
                <button type="button" onClick={() => clearSetting('/api/settings/codex-key', 'Codex Key 已清除。')} disabled={busy} className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
                  清除
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-outline-variant/20 pt-3">
            <label className="mb-2 block text-xs font-semibold text-on-surface-variant">Codex CLI 路径</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={cliPathInput}
                onChange={(e) => setCliPathInput(e.target.value)}
                placeholder={status.codexCliPath || 'C:\\Users\\你的用户名\\AppData\\Roaming\\npm\\codex.cmd'}
                className="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => saveSetting('/api/settings/codex-cli-path', cliPathInput, 'Codex CLI 路径已保存。新对话会使用它。', () => setCliPathInput(''))} disabled={busy || !cliPathInput.trim()} className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40">
                保存
              </button>
              {status.codexCliPathSource === 'settings' && (
                <button type="button" onClick={() => clearSetting('/api/settings/codex-cli-path', 'Codex CLI 路径已清除。')} disabled={busy} className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
                  清除
                </button>
              )}
            </div>
            {status.codexCliPath && <p className="mt-2 truncate text-xs text-on-surface-variant">当前：{status.codexCliPath}</p>}
          </div>

          {!status.pythonAvailable && (
            <p className="text-xs text-amber-700">导入 EPUB 需要系统 Python 和 ebooklib/beautifulsoup4。桌面首版先检测提示，不内置 Python。</p>
          )}
          {!status.claudeAvailable && (
            <p className="text-xs text-on-surface-variant">Claude 模式需要先安装并登录 Claude Code CLI；Codex 模式可保存 API Key，也可指定已登录的 Codex CLI 路径。</p>
          )}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-on-surface-variant">{message}</p>}
    </section>
  );
}
