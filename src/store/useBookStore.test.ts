// input: useBookStore 的导航动作
// output: 阅读页返回来源（pageReturnView）状态机的单元测试
// pos: 测试层 — 返回逻辑符合「从哪进入回哪里」的使用习惯
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { beforeEach, describe, expect, it } from 'vitest';
import { useBookStore } from './useBookStore';
import type { ProgressPage } from '@/types/progress-data';

function page(id: string): ProgressPage {
  return {
    id, title: id, type: 'chapter', description: '', file: `pages/${id}.html`,
    status: 'new', masteryScore: null, relatedChapters: [], createdAt: '', completedAt: null,
  };
}

beforeEach(() => {
  useBookStore.setState({ viewMode: 'library', currentPage: null, pageReturnView: 'hub' });
});

describe('阅读页返回来源', () => {
  it('从 Hub 进入 → 关闭回 Hub', () => {
    useBookStore.getState().openPage(page('chap-1'), 'hub');
    expect(useBookStore.getState().viewMode).toBe('page');
    useBookStore.getState().closePage();
    expect(useBookStore.getState().viewMode).toBe('hub');
    expect(useBookStore.getState().currentPage).toBeNull();
  });

  it('从笔记工作台进入 → 关闭回笔记工作台，章节间跳转不改变来源', () => {
    useBookStore.getState().openPage(page('chap-1'), 'readingnotes-detail');
    // 阅读中切换章节（目录/上一下一章走 setCurrentPage）
    useBookStore.getState().setCurrentPage(page('chap-2'));
    useBookStore.getState().closePage();
    expect(useBookStore.getState().viewMode).toBe('readingnotes-detail');
  });

  it('不带来源的 openPage 沿用上一次来源；selectBook 重置为 hub', () => {
    useBookStore.getState().openPage(page('chap-1'), 'readingnotes-detail');
    useBookStore.getState().closePage();
    useBookStore.getState().openPage(page('chap-2'));
    expect(useBookStore.getState().pageReturnView).toBe('readingnotes-detail');

    useBookStore.getState().selectBook('some-dir');
    expect(useBookStore.getState().pageReturnView).toBe('hub');
    expect(useBookStore.getState().viewMode).toBe('hub');
  });
});
