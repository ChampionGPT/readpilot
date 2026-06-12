"use client";

import { useState, useCallback } from "react";
import type { QuizProps, QuizResult } from "@/types/components";

type OptionState = "idle" | "selected" | "correct" | "incorrect" | "missed" | "disabled";

export function Quiz({ title = "掌握检测", questions, onComplete }: QuizProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"answering" | "reviewed">("answering");

  const selectOption = useCallback((qId: string, optId: string) => {
    if (checked.has(qId)) return;
    setAnswers((prev) => ({ ...prev, [qId]: optId }));
  }, [checked]);

  const checkAnswer = useCallback((qId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.add(qId);
      if (next.size === questions.length) {
        setTimeout(() => setPhase("reviewed"), 300);
      }
      return next;
    });
  }, [questions.length]);

  const getState = (qId: string, optId: string): OptionState => {
    if (!checked.has(qId)) {
      return answers[qId] === optId ? "selected" : "idle";
    }
    const q = questions.find((q) => q.id === qId)!;
    const isCorrect = q.correctId === optId;
    const isSelected = answers[qId] === optId;
    if (isSelected && isCorrect) return "correct";
    if (isSelected && !isCorrect) return "incorrect";
    if (!isSelected && isCorrect) return "missed";
    return "disabled";
  };

  const getFeedback = (qId: string): { type: "success" | "error"; text: string } => {
    const q = questions.find((q) => q.id === qId)!;
    const isCorrect = answers[qId] === q.correctId;
    const text = q.explanations[isCorrect ? "correct" : answers[qId]] || q.explanations.correct;
    return { type: isCorrect ? "success" : "error", text };
  };

  const score = questions.filter((q) => answers[q.id] === q.correctId).length;

  const handleReset = () => {
    setAnswers({});
    setChecked(new Set());
    setPhase("answering");
  };

  const handleSendToChat = () => {
    const result: QuizResult = {
      score,
      total: questions.length,
      masteryPercent: Math.round((score / questions.length) * 100),
      details: questions.map((q) => ({
        questionId: q.id,
        selectedId: answers[q.id] || "",
        correctId: q.correctId,
        isCorrect: answers[q.id] === q.correctId,
      })),
    };
    onComplete?.(result);
  };

  const stateStyles: Record<OptionState, string> = {
    idle: "border-[#E5DFD6] bg-white hover:border-[#E8836C] hover:bg-[#FDEEE9]",
    selected: "border-[#D94F30] bg-[#FDEEE9]",
    correct: "border-[#2D8B55] bg-[#E8F5EE]",
    incorrect: "border-[#C93B3B] bg-[#FDE8E8]",
    missed: "border-[#2D8B55] border-dashed bg-[#E8F5EE]",
    disabled: "opacity-50 border-[#E5DFD6]",
  };

  return (
    <div className="my-8 p-6 bg-white rounded-xl shadow-md">
      <h3 className="text-xl font-bold mb-6 text-[#2C2A28]">{title}</h3>
      <div className="space-y-8">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="font-medium text-[#2C2A28] mb-3">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt) => {
                const state = getState(q.id, opt.id);
                return (
                  <button
                    key={opt.id}
                    disabled={checked.has(q.id)}
                    onClick={() => selectOption(q.id, opt.id)}
                    className={`flex items-center gap-3 w-full text-left p-3 rounded-lg border-2 transition-all duration-150 cursor-pointer ${stateStyles[state]}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 shrink-0 relative ${
                        state === "selected" || state === "correct"
                          ? "border-current"
                          : "border-[#E5DFD6]"
                      }`}
                    >
                      {(state === "selected" || state === "correct") && (
                        <div className="absolute inset-[3px] rounded-full bg-current" />
                      )}
                    </div>
                    <span className="text-sm">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Check button */}
            {!checked.has(q.id) && answers[q.id] && (
              <button
                onClick={() => checkAnswer(q.id)}
                className="mt-3 px-4 py-2 bg-[#D94F30] text-white text-sm rounded-lg hover:bg-[#C4432A] transition-colors cursor-pointer"
              >
                检查答案
              </button>
            )}

            {/* Feedback */}
            {checked.has(q.id) && (
              <div
                className={`mt-3 p-4 rounded-lg text-sm transition-all duration-300 ${
                  getFeedback(q.id).type === "success"
                    ? "bg-[#E8F5EE] border-l-[3px] border-[#2D8B55] text-[#2D8B55]"
                    : "bg-[#FDE8E8] border-l-[3px] border-[#C93B3B] text-[#C93B3B]"
                }`}
              >
                <strong>{getFeedback(q.id).type === "success" ? "正确!" : "再想想"}</strong>{" "}
                {getFeedback(q.id).text}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {phase === "reviewed" && (
        <div className="mt-8 p-6 bg-[#FAF7F2] rounded-xl text-center">
          <p className="text-2xl font-bold text-[#2C2A28]">
            {score}/{questions.length}{" "}
            <span className="text-base font-normal text-[#6B6560]">
              ({Math.round((score / questions.length) * 100)}%)
            </span>
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={handleSendToChat}
              className="px-4 py-2 bg-[#D94F30] text-white text-sm rounded-lg hover:bg-[#C4432A] transition-colors cursor-pointer"
            >
              分享结果到对话
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-[#E5DFD6] text-[#6B6560] text-sm rounded-lg hover:bg-[#F5F0E8] transition-colors cursor-pointer"
            >
              重新测试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
