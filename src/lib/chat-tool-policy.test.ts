import { describe, expect, it } from 'vitest';
import { shouldAllowFileMutationTools } from './chat-tool-policy';

describe('chat-tool-policy', () => {
  it('allows explicit guide page generation', () => {
    expect(shouldAllowFileMutationTools('帮我生成导读页', { viewMode: 'hub' })).toBe(true);
  });

  it('keeps lightweight quiz generation in text mode', () => {
    expect(shouldAllowFileMutationTools('针对当前章节生成3道检测题', { viewMode: 'page' })).toBe(false);
  });

  it('allows option replies inside a generation flow', () => {
    expect(
      shouldAllowFileMutationTools(
        'A，日常表达更清醒，建一套语义思维框架',
        { viewMode: 'hub' },
        [
          {
            role: 'assistant',
            content: '在动手生成导读页之前，我想先确认：A｜全书透视 X 光片，生成 Hub 大本营；B｜章节路线图。',
          },
        ],
      ),
    ).toBe(true);
  });

  it('allows explicit write authorization inside a generation flow', () => {
    expect(
      shouldAllowFileMutationTools(
        '1，你直接写入啊，我授权你写入',
        { viewMode: 'hub' },
        [
          {
            role: 'assistant',
            content: '我先核对目录，然后生成全书透视页和 Hub。如果页面生成通道可用，可以写入 HTML。',
          },
        ],
      ),
    ).toBe(true);
  });

  it('does not treat generic continuation as generation without recent generation context', () => {
    expect(shouldAllowFileMutationTools('请继续', { viewMode: 'page' })).toBe(false);
  });
});
