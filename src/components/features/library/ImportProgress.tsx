// input: ImportState
// output: 6 步可视化进度（含百分比条 + 伴读档案编译状态）
// pos: ImportModal 内嵌的进度区块
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import React from 'react';
import type { ImportState } from '@/hooks/useImportStream';
import type { ImportStage } from '@/lib/import-events';

interface Step {
  label: string;
  stages: ImportStage[];
}

const STEPS: Step[] = [
  { label: '文件已接收', stages: ['upload_received'] },
  { label: 'Python 解析中', stages: ['python_spawning', 'python_running'] },
  { label: '渲染章节', stages: ['parsing_jsonl', 'rendering_pages'] },
  { label: '写入阅读进度', stages: ['writing_progress'] },
  { label: '建立伴读档案', stages: ['building_companion', 'committing'] },
  { label: '完成', stages: ['done'] },
];

const ORDER: ImportStage[] = [
  'upload_received',
  'python_spawning',
  'python_running',
  'parsing_jsonl',
  'rendering_pages',
  'writing_progress',
  'building_companion',
  'committing',
  'done',
];

function stageRank(s: ImportStage | undefined): number {
  return s ? ORDER.indexOf(s) : -1;
}

export function ImportProgress({ state }: { state: ImportState }) {
  const currentStage = state.progress?.stage;
  const currentRank = stageRank(currentStage);

  return (
    <div className="min-h-[150px] space-y-2 py-2">
      {STEPS.map((step, idx) => {
        const stepMaxRank = Math.max(...step.stages.map((s) => ORDER.indexOf(s)));
        const stepMinRank = Math.min(...step.stages.map((s) => ORDER.indexOf(s)));
        const isDone = currentRank > stepMaxRank;
        const isActive = currentRank >= stepMinRank && currentRank <= stepMaxRank;
        const showBar =
          isActive && step.stages.includes('rendering_pages') && !!state.progress?.total;

        return (
          <div key={step.label} className="flex min-h-6 items-center gap-3 text-sm">
            <span className="w-5 text-on-surface-variant">{idx + 1}.</span>
            <span
              className={`flex-1 ${
                isDone
                  ? 'text-on-surface'
                  : isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant/60'
              }`}
            >
              {step.label}
              {showBar && state.progress?.current !== undefined && (
                <span className="ml-2 text-xs text-on-surface-variant">
                  ({state.progress.current}/{state.progress.total})
                </span>
              )}
            </span>
            <div className="flex w-32 shrink-0 items-center justify-end gap-2">
              {isDone && <span className="text-primary">✓</span>}
              {isActive && !isDone && (
                <span className="text-primary animate-pulse">⠋</span>
              )}
              <div className="h-1.5 w-24 overflow-hidden rounded bg-surface-container">
                {showBar &&
                  state.progress?.total &&
                  state.progress.current !== undefined && (
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.round(
                          (state.progress.current / state.progress.total) * 100,
                        )}%`,
                      }}
                    />
                  )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
