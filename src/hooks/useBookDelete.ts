// input: useBookStore (setBooks, removeBookOptimistic)
// output: { pendingDelete, deleteError, requestDelete, cancelDelete, confirmDelete, dismissError } — 统一书籍删除的乐观 UI 流程
// pos: 书籍删除的唯一业务 hook — 任何展示书籍的视图都应通过它发起删除，禁止再各自维护 pendingDelete / performDelete 副本
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

"use client";

import { useState, useCallback } from "react";
import { useBookStore } from "@/store/useBookStore";

export interface PendingDelete {
  dir: string;
  title: string;
}

export function useBookDelete() {
  const setBooks = useBookStore((s) => s.setBooks);
  const removeBookOptimistic = useBookStore((s) => s.removeBookOptimistic);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestDelete = useCallback((book: PendingDelete) => {
    setPendingDelete(book);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const dismissError = useCallback(() => {
    setDeleteError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const book = pendingDelete;
    setPendingDelete(null);

    // 显式浅拷贝：避免依赖 store filter 返回新数组的"恰好正确"行为
    const snapshot = [...useBookStore.getState().books];
    removeBookOptimistic(book.dir);

    try {
      const res = await fetch(`/api/books/${encodeURIComponent(book.dir)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Delete failed, rolling back:", err);
      setBooks(snapshot);
      setDeleteError(`《${book.title}》删除失败：${(err as Error).message}`);
    }
  }, [pendingDelete, removeBookOptimistic, setBooks]);

  return {
    pendingDelete,
    deleteError,
    requestDelete,
    cancelDelete,
    confirmDelete,
    dismissError,
  };
}
