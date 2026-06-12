// input: 无 — 全局单例 store
// output: useWereadStore — 各 BookCard 共享的 summary 缓存 + fetch/refresh action
// pos: 客户端状态层 — 避免每个 BookCard 各自重复 fetch /api/weread/book/[id]
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { create } from 'zustand';
import type { WereadBookSummary } from '@/types/weread';

interface State {
  byBookId: Record<string, WereadBookSummary>;
  byLocalDir: Record<string, string>;          // localBookDir → wereadBookId mapping (for quick lookup)
  inflight: Record<string, Promise<WereadBookSummary>>;
  /** 最近一次 syncAll 完成时间（毫秒）— LibraryView 头部按钮文案用 */
  lastSyncAllAt: number | null;
  /** syncAll 进行中状态：{ done, total } 或 null（空闲） */
  syncAllProgress: { done: number; total: number } | null;
}

interface Actions {
  setBinding(localBookDir: string, wereadBookId: string): void;
  forgetBinding(localBookDir: string): void;
  fetchSummary(wereadBookId: string, force?: boolean): Promise<WereadBookSummary>;
  /** 调用后端 /sync，再重拉 summary */
  syncAndRefresh(localBookDir: string, wereadBookId: string): Promise<WereadBookSummary>;
  /** 串行同步所有已绑定书；UI 通过 syncAllProgress 观察进度 */
  syncAll(): Promise<void>;
}

export const useWereadStore = create<State & Actions>((set, get) => ({
  byBookId: {},
  byLocalDir: {},
  inflight: {},
  lastSyncAllAt: null,
  syncAllProgress: null,

  setBinding(localBookDir, wereadBookId) {
    set((s) => ({ byLocalDir: { ...s.byLocalDir, [localBookDir]: wereadBookId } }));
  },

  forgetBinding(localBookDir) {
    set((s) => {
      const map = { ...s.byLocalDir };
      const bid = map[localBookDir];
      delete map[localBookDir];
      const byBookId = { ...s.byBookId };
      if (bid) delete byBookId[bid];
      return { byLocalDir: map, byBookId };
    });
  },

  async fetchSummary(wereadBookId, force = false) {
    const state = get();
    if (!force && state.byBookId[wereadBookId]) {
      return state.byBookId[wereadBookId];
    }
    if (wereadBookId in state.inflight) {
      return state.inflight[wereadBookId];
    }
    const p = (async () => {
      const r = await fetch(`/api/weread/book/${encodeURIComponent(wereadBookId)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const summary = await r.json() as WereadBookSummary;
      set((s) => ({
        byBookId: { ...s.byBookId, [wereadBookId]: summary },
        inflight: Object.fromEntries(Object.entries(s.inflight).filter(([k]) => k !== wereadBookId)),
      }));
      return summary;
    })();
    set((s) => ({ inflight: { ...s.inflight, [wereadBookId]: p } }));
    return p;
  },

  async syncAndRefresh(localBookDir, wereadBookId) {
    await fetch('/api/weread/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localBookDir, force: true }),
    });
    return get().fetchSummary(wereadBookId, true);
  },

  async syncAll() {
    // 1) 拉取所有 binding
    const r = await fetch('/api/weread/bindings');
    if (!r.ok) throw new Error(`bindings fetch failed: HTTP ${r.status}`);
    const j = await r.json() as { bindings: Array<{ localBookDir: string; wereadBookId: string }> };
    const list = j.bindings ?? [];
    if (list.length === 0) {
      set({ lastSyncAllAt: Date.now() });
      return;
    }

    // 2) 串行 sync — 微读 gateway 对单 API key 并发不友好；串行最稳
    set({ syncAllProgress: { done: 0, total: list.length } });
    let done = 0;
    for (const b of list) {
      try {
        await fetch('/api/weread/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localBookDir: b.localBookDir, force: true }),
        });
        await get().fetchSummary(b.wereadBookId, true);
      } catch (e) {
        console.warn('[useWereadStore.syncAll] one book failed, continue:', b.wereadBookId, e);
      } finally {
        done += 1;
        set({ syncAllProgress: { done, total: list.length } });
      }
    }
    set({ syncAllProgress: null, lastSyncAllAt: Date.now() });
  },
}));
