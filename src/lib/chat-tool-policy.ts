// input: 用户 prompt、当前界面上下文、近期聊天消息
// output: 是否允许本轮执行会写入/修改文件的工具
// pos: ChatPanel 工具门禁策略 — 区分文字伴读、显式页面生成和多轮生成确认
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

export interface ChatToolPolicyContext {
  viewMode?: string;
  pageTitle?: string | null;
  pageType?: string | null;
}

export interface ChatToolPolicyMessage {
  role: string;
  content: string;
}

function compactText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

function hasDirectGenerationIntent(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  const compact = compactText(prompt);

  if (
    [
      '/books-to-course',
      '继续生成',
      '交互式解析',
      '直接写入',
      '授权你写入',
      '开始写入',
      '写入文件',
      '落地成文件',
    ].some((signal) => compact.includes(signal))
  ) {
    return true;
  }

  const hasChineseGenerationAction =
    /生成|创建|新建|制作|做成|做|更新|重建|产出|输出|变成|转换|转成|初始化|写入|落地|修复|重构/.test(compact);
  const hasEnglishGenerationAction = /\b(generate|create|build|make|update|render|write|save|fix|refactor)\b/.test(normalized);
  const hasGenerationAction = hasChineseGenerationAction || hasEnglishGenerationAction;

  const hasChinesePageObject =
    /伴读|导读|导览|阅读页|页面|网页|html|课程|下一页|全书透视|章节伴读|深入页|主题页|综合页|hub|大本营|首页|仪表盘|index\.html|progress\.json|pages\//.test(compact);
  const hasEnglishPageObject =
    /\b(companion page|reading page|guide page|intro page|html|course|interactive page|overview page|deep dive|topic page|hub|index\.html|progress\.json)\b/.test(normalized);
  const hasPageObject = hasChinesePageObject || hasEnglishPageObject;

  return hasGenerationAction && hasPageObject;
}

function hasRecentGenerationContext(recentMessages: ChatToolPolicyMessage[]): boolean {
  const recentAssistantText = recentMessages
    .filter((message) => message.role === 'assistant')
    .slice(-3)
    .map((message) => message.content)
    .join('\n')
    .toLowerCase();
  const compact = compactText(recentAssistantText);

  const hasPageContext =
    /伴读|导读|导览|阅读课程|页面|html|hub|大本营|index\.html|progress\.json|pages\/|全书透视|章节伴读|深入页|主题页|综合页/.test(compact);
  const hasActionContext =
    /生成|创建|更新|写入|修改|落地|开始|选项|选择|a[｜|]/.test(compact) ||
    /\b(generate|create|update|write|save|render|option|choose)\b/.test(recentAssistantText);

  return hasPageContext && hasActionContext;
}

function isContinuationOrApproval(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  const compact = compactText(prompt);

  if (/^[abc123一二三][,，、.\s]/i.test(prompt.trim())) return true;
  if (/^(a|b|c|1|2|3)$/i.test(normalized)) return true;

  return /请继续|继续|就这个|按这个|按你说的|选这个|选择|可以|确认|开始|执行|写入|授权|动手|没问题|好的|好呀|行|没错|同意|ok|goahead|doit|proceed/.test(compact);
}

export function shouldAllowFileMutationTools(
  prompt: string,
  context: ChatToolPolicyContext | undefined,
  recentMessages: ChatToolPolicyMessage[] = [],
): boolean {
  if (hasDirectGenerationIntent(prompt)) return true;

  const inGenerationSurface = context?.viewMode === 'hub' || context?.viewMode === 'page';
  if (hasRecentGenerationContext(recentMessages) && isContinuationOrApproval(prompt)) {
    return true;
  }

  return inGenerationSurface && /^(导读页|导览页|伴读页|hub|全书透视|阅读课程|页面|html)$/i.test(compactText(prompt));
}
