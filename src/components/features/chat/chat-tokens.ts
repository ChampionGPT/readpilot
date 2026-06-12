import type React from 'react';

// input: 无
// output: 工具区与各 block 共享的颜色与字体常量
// pos: 对话面板视觉规范单一来源
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

export const toolPalette = {
  bg: '#F5F1EA',
  bgHover: '#EDE7DC',
  border: '#D9D2C5',
  borderRun: '#D94F30',
  ink: '#3A342E',
  inkMute: '#8A8378',
  ok: '#6B8E5A',
  err: '#B5503C',
  warn: '#C49850',
  info: '#5A7A9E',
} as const;

export const fontMonoStack =
  'ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, "Source Han Mono SC", monospace';

export const fontMonoStyle: React.CSSProperties = { fontFamily: fontMonoStack };
