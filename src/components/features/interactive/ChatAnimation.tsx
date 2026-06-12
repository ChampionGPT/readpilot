"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatAnimationProps } from "@/types/components";

type PlayState = "ready" | "playing" | "paused" | "finished";

export function ChatAnimation({
  title = "思想碰撞",
  actors,
  messages,
  autoPlayInterval = 1200,
  typingDuration = 800,
}: ChatAnimationProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [playState, setPlayState] = useState<PlayState>("ready");
  const messagesRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getActor = (senderId: string) => actors.find((a) => a.id === senderId) || actors[0];

  const playNext = useCallback(() => {
    if (visibleCount >= messages.length) {
      setPlayState("finished");
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setIsTyping(true);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      setVisibleCount((prev) => {
        const next = prev + 1;
        if (next >= messages.length) {
          setPlayState("finished");
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
      requestAnimationFrame(() => {
        messagesRef.current?.scrollTo({
          top: messagesRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }, typingDuration);
  }, [visibleCount, messages.length, typingDuration]);

  const togglePlay = useCallback(() => {
    if (playState === "playing") {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setIsTyping(false);
      setPlayState("paused");
    } else {
      setPlayState("playing");
      playNext();
      timerRef.current = setInterval(playNext, autoPlayInterval + typingDuration);
    }
  }, [playState, playNext, autoPlayInterval, typingDuration]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setVisibleCount(0);
    setIsTyping(false);
    setPlayState("ready");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  return (
    <div className="my-8 rounded-xl overflow-hidden shadow-md bg-white">
      <h3 className="text-lg font-bold px-6 pt-5 pb-3 text-[#2C2A28]">{title}</h3>

      {/* Actors bar */}
      <div className="flex gap-4 px-6 pb-3 border-b border-[#EEEBE5]">
        {actors.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: a.color }}
            >
              {a.avatar}
            </div>
            <span className="text-xs text-[#6B6560]">{a.name}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="h-72 overflow-y-auto p-4 space-y-3">
        {messages.slice(0, visibleCount).map((msg, i) => {
          const actor = getActor(msg.sender);
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 animate-[fadeSlideUp_0.3s_cubic-bezier(0.16,1,0.3,1)_both]"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: actor.color }}
              >
                {actor.avatar}
              </div>
              <div>
                <span className="text-xs font-medium block mb-1" style={{ color: actor.color }}>
                  {actor.name}
                </span>
                <div className="bg-[#F5F0E8] rounded-xl rounded-tl-none px-4 py-2.5 text-sm text-[#2C2A28] leading-relaxed max-w-sm">
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && visibleCount < messages.length && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: getActor(messages[visibleCount].sender).color }}
            >
              {getActor(messages[visibleCount].sender).avatar}
            </div>
            <div className="flex gap-1 bg-[#F5F0E8] rounded-xl px-4 py-3">
              <span className="w-2 h-2 bg-[#9E9790] rounded-full animate-[typingBounce_1.4s_infinite]" />
              <span className="w-2 h-2 bg-[#9E9790] rounded-full animate-[typingBounce_1.4s_infinite_0.2s]" />
              <span className="w-2 h-2 bg-[#9E9790] rounded-full animate-[typingBounce_1.4s_infinite_0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#EEEBE5] bg-[#FAF7F2]">
        <button
          onClick={togglePlay}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#D94F30] text-white hover:bg-[#C4432A] transition-colors cursor-pointer"
        >
          {playState === "playing" ? "暂停" : "播放"}
        </button>
        <button
          onClick={() => { if (playState !== "playing") playNext(); }}
          disabled={playState === "finished" || playState === "playing"}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5DFD6] text-[#6B6560] hover:bg-[#F5F0E8] transition-colors cursor-pointer disabled:opacity-40"
        >
          下一条
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5DFD6] text-[#6B6560] hover:bg-[#F5F0E8] transition-colors cursor-pointer"
        >
          重播
        </button>
        <span className="ml-auto text-xs text-[#9E9790] font-mono">
          {visibleCount}/{messages.length}
        </span>
      </div>
    </div>
  );
}
