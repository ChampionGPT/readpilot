// input: ComponentSection[] — AI 产出的 JSON 协议块数组
// output: 动态渲染对应的 React 交互组件
// pos: AI 输出协议与 React 组件桥梁 — 将 JSON 数据驱动的 section 映射到真实组件树
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

"use client";

import React from "react";
import type { ComponentSection } from "@/types/components";
import { TranslationBlock } from "./TranslationBlock";
import { Quiz } from "./Quiz";
import { ChatAnimation } from "./ChatAnimation";
import { FlowAnimation } from "./FlowAnimation";
import { GlossaryTooltip } from "./GlossaryTooltip";

/**
 * 根据 ComponentSection 的 type 字段分发到真实 React 组件。
 * 设计原则：只做映射，不做逻辑。如果遇到无法识别的 type，优雅跳过。
 */
const componentMap: Record<string, React.ComponentType<any>> = {
  TranslationBlock,
  Quiz,
  ChatAnimation,
  FlowAnimation,
  GlossaryTooltip,
};

interface ComponentRendererProps {
  sections: ComponentSection[];
}

export function ComponentRenderer({ sections }: ComponentRendererProps) {
  if (!sections || sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map((section, index) => {
        const Component = componentMap[section.type];
        if (!Component) {
          console.warn(`[ComponentRenderer] Unknown type: ${section.type}`);
          return null;
        }
        return <Component key={`${section.type}-${index}`} {...section.props} />;
      })}
    </div>
  );
}
