/**
 * input: 无 props — 自包含；初始化时读取 GET /api/settings/weread-key
 * output: 渲染微信读书 API Key 设置卡片 — 输入/保存/清除/测试连接
 * pos: /settings 页面的子卡片；与 /api/settings/weread-key + /api/weread/search 交互
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
'use client';

import React, { useEffect, useState } from 'react';

export function WereadSettingsCard() {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const [busy, setBusy] = useState<'idle' | 'saving' | 'testing' | 'clearing'>('idle');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/weread-key').then(r => r.json()).then(d => {
      setHasKey(d.hasKey);
      setMasked(d.maskedKey);
    });
  }, []);

  async function save() {
    if (!input.trim()) { setMsg({ kind: 'err', text: '请填入 API Key' }); return; }
    setBusy('saving'); setMsg(null);
    const r = await fetch('/api/settings/weread-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: input.trim() }),
    });
    if (r.ok) {
      setHasKey(true);
      setMasked(input.trim().slice(0, 4) + '••••' + input.trim().slice(-4));
      setInput('');
      setMsg({ kind: 'ok', text: '已保存' });
    } else {
      const j = await r.json().catch(() => ({}));
      setMsg({ kind: 'err', text: j.error ?? '保存失败' });
    }
    setBusy('idle');
  }

  async function testConn() {
    setBusy('testing'); setMsg(null);
    const r = await fetch('/api/weread/search?q=%E4%B8%89%E4%BD%93&count=1');
    if (r.ok) {
      const j = await r.json();
      const n = (j.results ?? []).length;
      setMsg({ kind: 'ok', text: `连接成功（试搜《三体》返回 ${n} 条）` });
    } else if (r.status === 401) {
      setMsg({ kind: 'err', text: 'API Key 无效或未保存' });
    } else {
      const j = await r.json().catch(() => ({}));
      setMsg({ kind: 'err', text: j.error ?? `连接失败 (HTTP ${r.status})` });
    }
    setBusy('idle');
  }

  async function clearKey() {
    setBusy('clearing'); setMsg(null);
    await fetch('/api/settings/weread-key', { method: 'DELETE' });
    setHasKey(false); setMasked(null); setInput('');
    setMsg({ kind: 'info', text: '已清除' });
    setBusy('idle');
  }

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
      <header className="mb-4">
        <h2 className="font-serif text-xl font-bold text-on-surface">微信读书集成</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          填入个人 API Key（格式 <code className="font-mono">wrk-xxxx</code>）后，ReadPilot 可以读取你的划线、想法、阅读进度等。
        </p>
      </header>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-on-surface-variant">当前状态：</span>
          {hasKey
            ? <span className="text-green-600">✓ 已设置 <code className="font-mono">{masked}</code></span>
            : <span className="text-on-surface-variant">未设置</span>}
        </div>

        <div className="flex gap-2">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasKey ? '换一个 key' : 'wrk-xxxxxxxxxxxx'}
            className="flex-1 px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy !== 'idle' || !input.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm hover:opacity-90 disabled:opacity-40"
          >
            {busy === 'saving' ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={testConn}
            disabled={busy !== 'idle' || !hasKey}
            className="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-sm hover:bg-surface-container disabled:opacity-40"
          >
            {busy === 'testing' ? '测试中…' : '测试连接'}
          </button>
          {hasKey && (
            <button
              type="button"
              onClick={clearKey}
              disabled={busy !== 'idle'}
              className="px-3 py-1.5 rounded-lg border border-red-300 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {busy === 'clearing' ? '清除中…' : '清除'}
            </button>
          )}
        </div>

        {msg && (
          <div className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : msg.kind === 'err' ? 'text-red-600' : 'text-on-surface-variant'}`}>
            {msg.text}
          </div>
        )}

        <p className="text-xs text-on-surface-variant/70 pt-2 border-t border-outline-variant/20">
          ❓ 如何获取 API Key：访问 <a href="https://i.weread.qq.com/skills/agent" target="_blank" rel="noreferrer" className="underline">微信读书 Skill 控制台</a>，登录后会显示个人 <code className="font-mono">wrk-</code> 开头的 key。
        </p>
      </div>
    </section>
  );
}
