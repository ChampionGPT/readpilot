// input: ReaderApp 组件
// output: 应用主页面
// pos: Next.js 入口页 — 将 ReaderApp 渲染为整个中间区域的内容
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { ReaderApp } from "@/components/features/reader/ReaderApp";

export default function Home() {
  return <ReaderApp />;
}
