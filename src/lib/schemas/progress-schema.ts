/**
 * input: ProgressData / ProgressPage 等 TS interface
 * output: 对应的 zod schema，运行时校验所有 progress.json 写入
 * pos: API 写入入口的硬关卡
 */
import { z } from 'zod';

export const PageTypeSchema = z.enum(['overview', 'chapter', 'deepdive', 'theme', 'synthesis']);
export const PageStatusSchema = z.enum(['new', 'in-progress', 'completed']);
export const ReadingActionSchema = z.enum(['started', 'page_created', 'page_completed', 'mastery_updated', 'note']);

export const BookStructurePartSchema = z.object({
  id: z.string(),
  title: z.string(),
  chapters: z.array(z.string()),
  narrator: z.string().optional(),
  note: z.string().optional(),
});

export const ProgressPageSchema = z.object({
  id: z.string().min(1),
  type: PageTypeSchema,
  title: z.string(),
  description: z.string(),
  file: z.string().min(1),
  status: PageStatusSchema,
  masteryScore: z.number().nullable(),
  relatedChapters: z.array(z.string()),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const ReadingLogEntrySchema = z.object({
  date: z.string(),
  action: ReadingActionSchema,
  pageId: z.string().optional(),
  note: z.string(),
});

export const NextRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  hint: z.string(),
});

export const ProgressDataSchema = z.object({
  book: z.object({
    title: z.string(),
    author: z.string(),
    genre: z.string(),
    totalChapters: z.number().nullable(),
    startDate: z.string(),
    structure: z.array(BookStructurePartSchema),
    totalPages: z.number().nullable().optional(),
    currentPage: z.number().nullable().optional(),
  }),
  pages: z.array(ProgressPageSchema),
  themes: z.array(z.string()),
  glossary: z.record(z.string(), z.string()),
  currentFocus: z.string().nullable(),
  nextRecommendation: NextRecommendationSchema.nullable(),
  readingLog: z.array(ReadingLogEntrySchema),
});

export type ProgressPage = z.infer<typeof ProgressPageSchema>;
export type ProgressData = z.infer<typeof ProgressDataSchema>;
