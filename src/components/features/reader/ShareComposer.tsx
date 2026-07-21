// input: rp-share 内容、书籍元数据与浏览器本地分享能力
// output: 可访问的分享卡片 dialog、PNG/剪贴板/系统分享动作
// pos: 阅读器父层 — 本地分享卡片编排器

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Image as ImageIcon, Share2, X } from 'lucide-react';
import { buildShareSvg, shareFileName, svgToPngBlob, type ShareContent, type ShareRatio, type ShareTemplate } from './share-card';

interface Capabilities {
  rasterize?: (svg: string) => Promise<Blob>;
  shareFile?: (file: File) => Promise<void>;
  copyImage?: (blob: Blob) => Promise<void>;
  download?: (blob: Blob, filename: string) => void;
  copyText?: (text: string) => Promise<void>;
}

interface ShareComposerProps {
  open: boolean;
  content: ShareContent;
  onClose: () => void;
  capabilities?: Capabilities;
}

function browserCapabilities(): Capabilities {
  const rasterize = typeof document !== 'undefined' ? svgToPngBlob : undefined;
  return {
    rasterize,
    shareFile: typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' ? async (file) => {
      if (!navigator.canShare?.({ files: [file] })) throw new Error('系统不支持文件分享');
      await navigator.share({ files: [file], title: 'ReadPilot 阅读摘录' });
    } : undefined,
    copyImage: typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined' ? async (blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]) : undefined,
    download: typeof document !== 'undefined' ? (blob, filename) => { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); } : undefined,
    copyText: typeof navigator !== 'undefined' && navigator.clipboard ? (text) => navigator.clipboard.writeText(text) : undefined,
  };
}

export function ShareComposer({ open, content, onClose, capabilities }: ShareComposerProps) {
  const [template, setTemplate] = useState<ShareTemplate>('paper');
  const [ratio, setRatio] = useState<ShareRatio>('landscape');
  const [includeThought, setIncludeThought] = useState(Boolean(content.thought));
  const [watermark, setWatermark] = useState(true);
  const [thought, setThought] = useState(content.thought);
  const [readyAsset, setReadyAsset] = useState<{ version: string; blob: Blob } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'status' | 'alert'; text: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const generationRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const caps = useMemo(() => capabilities ?? browserCapabilities(), [capabilities]);
  const svg = buildShareSvg({ ...content, thought }, { template, ratio, includeThought, watermark });

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    setThought(content.thought);
    setIncludeThought(Boolean(content.thought));
  }, [content]);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!open || !caps.rasterize) { setPreparing(false); return; }
    setPreparing(true);
    const timer = window.setTimeout(() => {
      caps.rasterize!(svg).then((blob) => { if (generation === generationRef.current) setReadyAsset({ version: svg, blob }); }).catch((error) => {
        if (generation === generationRef.current) setMessage({ kind: 'alert', text: error instanceof Error ? error.message : '图片生成失败' });
      }).finally(() => { if (generation === generationRef.current) setPreparing(false); });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [caps, open, svg]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previousFocus.current?.focus(); };
  }, [open]);

  if (!open) return null;
  const currentBlob = readyAsset?.version === svg ? readyAsset.blob : null;
  const text = `“${content.quote}”${includeThought && thought ? `\n\n${thought}` : ''}\n\n—— ${content.bookTitle}${content.author ? ` · ${content.author}` : ''}`;
  const withPng = async (action: (blob: Blob, filename: string) => Promise<void> | void, success: string) => {
    try {
      if (!currentBlob) throw new Error('图片尚未准备好');
      await action(currentBlob, shareFileName(content.bookTitle));
      setMessage({ kind: 'status', text: success });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage({ kind: 'alert', text: error instanceof Error ? error.message : '操作失败，请重试' });
    }
  };

  const shareCurrent = async () => {
    if (!currentBlob || !caps.shareFile) return;
    const filename = shareFileName(content.bookTitle);
    try {
      await caps.shareFile(new File([currentBlob], filename, { type: 'image/png' }));
      setMessage({ kind: 'status', text: '已打开系统分享' }); return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage({ kind: 'alert', text: '系统分享失败，请改用复制图片或保存 PNG' });
    }
  };

  const previewSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const templateOptions = [['paper', '暖纸', '#D94F30'], ['editorial', '杂志', '#171717'], ['ink', '墨迹', '#211E1B']] as const;
  const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D94F30]/40 disabled:cursor-wait disabled:opacity-45';
  return <div data-testid="share-overlay" className="fixed inset-0 z-50 flex min-w-0 items-center justify-center overflow-hidden bg-stone-950/45 p-0 backdrop-blur-[5px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="share-composer-title" className="flex h-full min-w-0 w-full flex-col overflow-hidden bg-[#FBF8F3] shadow-[0_28px_90px_rgba(41,37,33,.28)] sm:h-auto sm:max-h-[92vh] sm:max-w-[1120px] sm:rounded-[22px]">
      <header className="flex min-w-0 items-start justify-between border-b border-stone-200/80 px-6 py-5">
        <div className="min-w-0"><p className="mb-1 text-[11px] font-bold uppercase tracking-[.2em] text-[#D94F30]">ReadPilot Share Studio</p><h2 id="share-composer-title" className="font-serif text-[22px] font-semibold text-stone-950">分享阅读摘录</h2><p className="mt-1 text-sm text-stone-500">内容仅在本地生成，不会上传。</p></div>
        <button ref={closeRef} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D94F30]/35" onClick={onClose} aria-label="关闭"><X size={20}/></button>
      </header>
      <div data-testid="composer-grid" className="grid min-h-0 min-w-0 flex-1 overflow-y-auto lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_332px]">
        <div data-testid="preview-stage" className="flex min-h-[300px] min-w-0 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#eee7dc,#ddd4c8)] p-5 sm:p-8">
          <div className={`flex min-h-0 min-w-0 items-center justify-center ${ratio === 'portrait' ? 'h-full max-h-[620px] aspect-[3/4]' : 'w-full max-w-[720px] aspect-video'}`}>
            {/* SVG is generated locally and must remain a data URL; Next Image does not optimize it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-testid="share-preview" src={previewSrc} alt="分享卡片预览" className="block h-full max-h-full w-full max-w-full object-contain shadow-[0_20px_54px_rgba(54,45,36,.24)]" />
          </div>
        </div>
        <div data-testid="settings-panel" className="min-h-0 min-w-0 overflow-y-auto border-l border-stone-200/80 bg-[#FBF8F3] p-6 text-sm">
          <div className="space-y-6">
            <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-stone-500">模板</legend><div className="grid grid-cols-3 gap-2">{templateOptions.map(([value, label, color]) => <label key={value} className={`relative min-w-0 cursor-pointer rounded-xl border p-2.5 transition ${template === value ? 'border-[#D94F30] bg-[#FFF4EF] shadow-sm' : 'border-stone-200 bg-white hover:border-stone-300'}`}><input className="sr-only" type="radio" name="template" checked={template === value} onChange={() => setTemplate(value)} /><span className="mb-2 block h-2 rounded-full" style={{ background: color }}/><span className="block truncate text-xs font-semibold text-stone-800">{label}</span>{template === value && <Check className="absolute right-2 top-2 text-[#D94F30]" size={14}/>}</label>)}</div></fieldset>
            <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-stone-500">画幅</legend><div className="grid grid-cols-2 rounded-xl bg-stone-200/70 p-1">{([['landscape', '横版 16:9'], ['portrait', '竖版 3:4']] as const).map(([value, label]) => <label key={value} className={`cursor-pointer rounded-[9px] px-3 py-2.5 text-center text-xs font-semibold transition ${ratio === value ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'}`}><input className="sr-only" type="radio" name="ratio" checked={ratio === value} onChange={() => setRatio(value)} />{label}</label>)}</div></fieldset>
            <div className="space-y-3"><Switch label="附上想法" checked={includeThought} onChange={setIncludeThought}/><label className="block"><span className="mb-2 flex justify-between text-xs font-semibold text-stone-700"><span>想法内容</span><span className="font-normal text-stone-400">{Array.from(thought).length}</span></span><textarea aria-label="想法内容" value={thought} onChange={(event) => setThought(event.target.value)} className="min-h-28 w-full resize-none rounded-xl border border-stone-200 bg-white p-3.5 leading-6 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#D94F30]/60 focus:ring-4 focus:ring-[#D94F30]/10" /></label><Switch label="显示 ReadPilot 水印" checked={watermark} onChange={setWatermark}/></div>
            <p className="rounded-xl bg-[#F1EBE2] px-3 py-2.5 text-xs leading-5 text-stone-500">文字会按当前模板列宽自动换行，超过卡片容量时以省略号结束。</p>
          </div>
        </div>
      </div>
      <footer data-testid="composer-actions" className="sticky bottom-0 flex min-w-0 flex-wrap items-center gap-2 border-t border-stone-200/80 bg-[#FBF8F3]/95 px-5 py-4 backdrop-blur">
        {caps.shareFile && caps.rasterize && <button disabled={!currentBlob} className={`${actionClass} bg-[#D94F30] text-white hover:bg-[#C84529]`} onClick={shareCurrent}><Share2 size={17}/>系统分享</button>}
        {caps.download && caps.rasterize && <button disabled={!currentBlob} className={`${actionClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-100`} onClick={() => withPng((blob, filename) => caps.download!(blob, filename), '已保存 PNG')}><Download size={17}/>保存 PNG</button>}
        {caps.copyImage && caps.rasterize && <button disabled={!currentBlob} className={`${actionClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-100`} onClick={() => withPng((blob) => caps.copyImage!(blob), '已复制图片')}><ImageIcon size={17}/>复制图片</button>}
        {caps.copyText && <button className={`${actionClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-100`} onClick={async () => { try { await caps.copyText!(text); setMessage({ kind: 'status', text: '已复制原文' }); } catch { setMessage({ kind: 'alert', text: '复制失败，请重试' }); } }}><Copy size={17}/>复制原文</button>}
        <div className="ml-auto min-w-0 text-xs">{preparing && <p role="status" className="text-stone-500">正在更新图片…</p>}{!caps.rasterize && <p role="status" className="text-stone-500">当前环境仅支持复制文本</p>}{message && <p role={message.kind} className={message.kind === 'alert' ? 'text-red-700' : 'text-stone-600'}>{message.text}</p>}</div>
      </footer>
    </section>
  </div>;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-1 text-sm font-medium text-stone-700"><span>{label}</span><input className="peer sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="relative h-6 w-11 rounded-full bg-stone-300 transition peer-checked:bg-[#D94F30] peer-focus-visible:ring-4 peer-focus-visible:ring-[#D94F30]/15 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" /></label>;
}
