// Progress data types matching the actual progress.json schema used by books-to-course
// This is the format used in book directories (e.g. 《喧哗与骚动》/progress.json)

export type PageType = 'overview' | 'chapter' | 'deepdive' | 'theme' | 'synthesis';
export type PageStatus = 'new' | 'in-progress' | 'completed';

export interface BookStructurePart {
  id: string;
  title: string;
  chapters: string[];
  narrator?: string;
  note?: string;
}

export interface ProgressPage {
  id: string;
  type: PageType;
  title: string;
  description: string;
  file: string;
  status: PageStatus;
  masteryScore: number | null;
  relatedChapters: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface ReadingLogEntry {
  date: string;
  action: 'started' | 'page_created' | 'page_completed' | 'mastery_updated' | 'note';
  pageId?: string;
  note: string;
}

export interface NextRecommendation {
  title: string;
  description: string;
  hint: string;
}

export interface ProgressData {
  book: {
    title: string;
    author: string;
    genre: string;
    totalChapters: number | null;
    startDate: string;
    structure: BookStructurePart[];
    totalPages: number | null;      // 用户输入的书籍总页数
    currentPage: number | null;     // 用户输入的当前阅读页数
  };
  pages: ProgressPage[];
  themes: string[];
  glossary: Record<string, string>;
  currentFocus: string | null;
  nextRecommendation: NextRecommendation | null;
  readingLog: ReadingLogEntry[];
}
