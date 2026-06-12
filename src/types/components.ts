// 5 种 MVP 交互组件的 Props 类型定义
// 来源: PRP Section 4.2 + Ui/interactive-elements.md

/** 原文高亮标注类型 */
export type AnnotationType = 'keyword' | 'emphasis' | 'metaphor' | 'data' | 'debunked' | 'warning';

export interface TranslationQuote {
  original: string;
  plain: string;
  annotations?: { text: string; type: AnnotationType }[];
}

export interface TranslationBlockProps {
  originalLabel?: string;
  plainLabel?: string;
  quotes: TranslationQuote[];
}

/** 选择题 */
export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correctId: string;
  explanations: Record<string, string>;
}

export interface QuizResult {
  score: number;
  total: number;
  details: { questionId: string; selectedId: string; correctId: string; isCorrect: boolean }[];
  masteryPercent: number;
}

export interface QuizProps {
  title?: string;
  questions: QuizQuestion[];
  onComplete?: (result: QuizResult) => void;
}

/** 群聊动画角色 */
export interface ChatActor {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface ChatAnimationMessage {
  sender: string;
  text: string;
}

export interface ChatAnimationProps {
  title?: string;
  actors: ChatActor[];
  messages: ChatAnimationMessage[];
  autoPlayInterval?: number;
  typingDuration?: number;
}

/** 逻辑推演流 */
export interface FlowNode {
  id: string;
  label: string;
  color?: string;
}

export interface FlowStep {
  from: string;
  to: string;
  label: string;
  highlight: string;
}

export interface FlowAnimationProps {
  title?: string;
  nodes: FlowNode[];
  steps: FlowStep[];
  stepInterval?: number;
}

/** 术语提示 */
export interface GlossaryTooltipProps {
  terms: Record<string, string>;
}

/** 动态渲染用联合类型 */
export type ComponentType =
  | 'TranslationBlock'
  | 'Quiz'
  | 'ChatAnimation'
  | 'FlowAnimation'
  | 'GlossaryTooltip';

export type ComponentSection =
  | { type: 'TranslationBlock'; props: TranslationBlockProps }
  | { type: 'Quiz'; props: QuizProps }
  | { type: 'ChatAnimation'; props: ChatAnimationProps }
  | { type: 'FlowAnimation'; props: FlowAnimationProps }
  | { type: 'GlossaryTooltip'; props: GlossaryTooltipProps };
