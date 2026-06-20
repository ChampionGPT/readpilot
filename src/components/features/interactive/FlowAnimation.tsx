"use client";

import { useState, useCallback, useRef } from "react";
import type { FlowAnimationProps } from "@/types/components";

const defaultColors = ["#D94F30", "#2A7B9B", "#7B6DAA", "#D4A843", "#2D8B55"];

export function FlowAnimation({
  title = "逻辑推演",
  nodes,
  steps,
  stepInterval = 1000,
}: FlowAnimationProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeNode = currentStep >= 0 ? steps[currentStep]?.highlight : null;

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) return prev;
      return prev + 1;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(-1, prev - 1));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(-1);
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const autoPlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setIsPlaying(true);
    setCurrentStep(-1);
    let step = -1;
    timerRef.current = setInterval(() => {
      step++;
      if (step >= steps.length) {
        setIsPlaying(false);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      setCurrentStep(step);
    }, stepInterval);
  }, [isPlaying, steps.length, stepInterval]);

  return (
    <div className="my-8 rounded-xl overflow-hidden shadow-md bg-white p-6">
      <h3 className="text-lg font-bold text-[#2C2A28] mb-6">{title}</h3>

      {/* Nodes row */}
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {nodes.map((node, i) => {
          const color = node.color || defaultColors[i % defaultColors.length];
          const isActive = node.id === activeNode;
          return (
            <div key={node.id} className="flex items-center gap-2">
              <div
                className="px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all duration-300"
                style={{
                  borderColor: isActive ? color : "#E5DFD6",
                  backgroundColor: isActive ? `${color}15` : "#FFFFFF",
                  color: isActive ? color : "#2C2A28",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                  boxShadow: isActive ? `0 4px 12px ${color}25` : "none",
                }}
              >
                {node.label}
              </div>
              {i < nodes.length - 1 && (
                <svg width="28" height="16" viewBox="0 0 28 16" className="text-[#E5DFD6] shrink-0">
                  <path d="M0 8h22m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Step label */}
      <div className="min-h-[60px] flex items-center justify-center mb-6">
        {currentStep >= 0 && (
          <div className="text-center animate-[fadeSlideUp_0.3s_cubic-bezier(0.16,1,0.3,1)_both]">
            <p className="text-sm text-[#2C2A28] leading-relaxed max-w-lg">
              {steps[currentStep].label}
            </p>
          </div>
        )}
        {currentStep === -1 && (
          <p className="text-sm text-[#9E9790]">点击「下一步」开始推演</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={prevStep}
          disabled={currentStep <= -1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5DFD6] text-[#6B6560] hover:bg-[#F5F0E8] transition-colors cursor-pointer disabled:opacity-40"
        >
          上一步
        </button>
        <button
          onClick={nextStep}
          disabled={currentStep >= steps.length - 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#D94F30] text-white hover:bg-[#C4432A] transition-colors cursor-pointer disabled:opacity-40"
        >
          下一步
        </button>
        <button
          onClick={autoPlay}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5DFD6] text-[#6B6560] hover:bg-[#F5F0E8] transition-colors cursor-pointer"
        >
          {isPlaying ? "暂停" : "自动播放"}
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5DFD6] text-[#6B6560] hover:bg-[#F5F0E8] transition-colors cursor-pointer"
        >
          重置
        </button>
        <span className="ml-2 text-xs text-[#9E9790] font-mono">
          {currentStep + 1}/{steps.length}
        </span>
      </div>
    </div>
  );
}
