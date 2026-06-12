/**
 * input: useBookStore (books, progress fetching)
 * output: 按书籍体裁分类的浏览视图
 * pos: 中央面板的 Collections 视图 — 展示按 genre 分组的所有书籍
 *
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useEffect, useState } from "react";
import { useBookStore, type BookInfo } from "@/store/useBookStore";

/** 从书籍标题生成确定性的渐变色（复用 BookshelfPanel 相同逻辑） */
function titleToGradient(title: string): string {
  const gradients = [
    "from-stone-500 to-stone-700",
    "from-amber-700 to-stone-800",
    "from-emerald-700 to-stone-800",
    "from-sky-700 to-stone-800",
    "from-violet-700 to-stone-800",
    "from-rose-700 to-stone-800",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

interface BookWithGenre extends BookInfo {
  genre: string;
  author: string;
}

export function CollectionsView() {
  const { books, selectBook } = useBookStore();
  const [booksWithGenre, setBooksWithGenre] = useState<BookWithGenre[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch genre info for all books from their progress.json
  useEffect(() => {
    if (books.length === 0) {
      setLoading(false);
      return;
    }
    
    Promise.all(
      books.map(async (book) => {
        try {
          const res = await fetch(`/api/books/${encodeURIComponent(book.dir)}/progress`);
          if (!res.ok) return { ...book, genre: "未分类", author: "" };
          const progress = await res.json();
          return {
            ...book,
            genre: progress?.book?.genre || "未分类",
            author: progress?.book?.author || "",
          };
        } catch {
          return { ...book, genre: "未分类", author: "" };
        }
      })
    ).then((results) => {
      setBooksWithGenre(results);
      setLoading(false);
    });
  }, [books]);

  // Group books by genre
  const grouped = booksWithGenre.reduce<Record<string, BookWithGenre[]>>((acc, book) => {
    const genre = book.genre || "未分类";
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(book);
    return acc;
  }, {});

  const handleSelectBook = (dir: string) => {
    selectBook(dir);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-10 hide-scrollbar bg-[#FAF7F2]">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-stone-200 rounded w-48" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[3/4] bg-stone-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10 hide-scrollbar bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <nav className="text-xs uppercase tracking-widest text-[#D94F30] font-bold mb-3">
            READPILOT COLLECTIONS
          </nav>
          <h1 className="text-4xl font-serif font-bold text-stone-700 mb-2">书籍分类</h1>
          <p className="text-stone-500">按阅读类型与体裁浏览你的书库</p>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <svg className="w-12 h-12 mx-auto text-stone-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            <p className="text-stone-500 font-medium">还没有书籍，导入第一本书开始分类浏览</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(grouped).map(([genre, genreBooks]) => (
              <section key={genre}>
                {/* Genre Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-6 bg-[#D94F30] rounded-full" />
                  <h2 className="text-xl font-serif font-bold text-stone-700">{genre}</h2>
                  <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-bold">
                    {genreBooks.length}
                  </span>
                </div>

                {/* Books Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {genreBooks.map((book) => {
                    const gradient = titleToGradient(book.title);
                    return (
                      <div
                        key={book.id}
                        onClick={() => handleSelectBook(book.dir)}
                        className="group cursor-pointer"
                      >
                        {/* Cover */}
                        <div className="aspect-[3/4] w-full mb-3 rounded-lg overflow-hidden shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center p-4 text-center`}>
                            <span className="text-white/20 text-5xl font-serif font-black leading-none mb-2">
                              {book.title.charAt(0)}
                            </span>
                            <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest line-clamp-2">
                              {book.title}
                            </span>
                          </div>
                        </div>
                        {/* Info */}
                        <p className="text-sm font-serif font-bold text-stone-700 line-clamp-1 group-hover:text-[#D94F30] transition-colors">
                          {book.title}
                        </p>
                        {book.author && (
                          <p className="text-xs text-stone-500 italic mt-0.5 line-clamp-1">{book.author}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
