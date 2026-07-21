/**
 * input: ReaderApp page-mode state, delayed iframe loads, annotator messages, and utility controls
 * output: Regression coverage for stable iframe crossfades, persistent panel shell, and isolated annotation loading
 * pos: Reader layout flicker-remediation and utility rail component tests
 */
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderApp, isTrustedShareMessage } from "./ReaderApp";
import { useBookStore } from "@/store/useBookStore";
import type { ProgressData, ProgressPage } from "@/types/progress-data";

const chapterOne: ProgressPage = {
  id: "chap-1",
  type: "chapter",
  title: "第一章",
  description: "",
  file: "chap-1.html",
  status: "in-progress",
  masteryScore: null,
  relatedChapters: [],
  createdAt: "2026-07-19",
  completedAt: null,
};

const chapterTwo: ProgressPage = {
  ...chapterOne,
  id: "chap-2",
  title: "第二章",
  file: "chap-2.html",
  status: "new",
};

const progress: ProgressData = {
  book: {
    title: "测试书",
    author: "测试作者",
    genre: "",
    totalChapters: 2,
    startDate: "2026-07-19",
    structure: [],
    totalPages: null,
    currentPage: null,
  },
  pages: [chapterOne, chapterTwo],
  themes: [],
  glossary: {},
  currentFocus: null,
  nextRecommendation: null,
  readingLog: [],
};

function transitionEnd(element: Element, propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}

describe("ReaderApp reading utility rail", () => {
  beforeEach(() => {
    window.happyDOM.settings.disableIframePageLoading = true;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => clearTimeout(id)));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ annotations: [] }),
    }));
    useBookStore.setState({
      progress,
      viewMode: "page",
      currentPage: chapterOne,
      selectedBookDir: "test-book",
      theme: "classic",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the reading utility rail with directory, annotations, and typography controls", () => {
    render(<ReaderApp />);

    expect(screen.getByRole("toolbar", { name: "阅读工具" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "目录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标注" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "排版" })).toBeInTheDocument();
  });

  it("uses one parent-controlled slot so directory and annotations are mutually exclusive", async () => {
    render(<ReaderApp />);

    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    expect(screen.getByRole("complementary", { name: "目录面板" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "标注面板" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "标注" }));
    await waitFor(() => {
      expect(screen.getByRole("complementary", { name: "标注面板" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("complementary", { name: "目录面板" })).not.toBeInTheDocument();
  });

  it("filters directory chapters and marks the current chapter active", () => {
    render(<ReaderApp />);
    fireEvent.click(screen.getByRole("button", { name: "目录" }));

    expect(screen.getByRole("button", { name: /第一章/ })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索章节" }), { target: { value: "第二" } });

    expect(screen.queryByRole("button", { name: /第一章/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /第二章/ })).toBeInTheDocument();
  });

  it("keeps related links inside the TOC and closes typography from the same rail button", () => {
    useBookStore.setState({ progress: { ...progress, pages: [{ ...chapterOne, relatedChapters: [] }, chapterTwo, { ...chapterOne, id: "deep-1", type: "deepdive", title: "相关解读", file: "deep.html", relatedChapters: ["第一章"] }] } });
    render(<ReaderApp />);
    expect(screen.queryByRole("button", { name: "相关解读" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    expect(screen.getByRole("button", { name: /相关解读/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "排版" }));
    expect(screen.queryByRole("complementary", { name: "目录面板" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "排版面板" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "排版" }));
    expect(screen.queryByRole("complementary", { name: "排版面板" })).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "阅读工具" })).toBeInTheDocument();
  });

  it("uses reader container width, preserves a 464px panel, and applies two-stage Escape", () => {
    render(<ReaderApp />);
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    const panel = screen.getByRole("complementary", { name: "目录面板" }).parentElement;
    expect(panel).toHaveClass("w-[min(33.5rem,calc(100cqw-1rem))]", "@min-[900px]:w-[33.5rem]");
    // 面板内容占满壳宽，不再保留 rail 死区；按钮列停靠到面板左外缘
    expect(screen.getByRole("complementary", { name: "目录面板" })).toHaveClass("w-full");
    expect(screen.getByRole("toolbar", { name: "阅读工具" }).className).toContain("right-[calc(min(33.5rem,100cqw-1rem)+0.75rem)]");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "目录面板" })).not.toBeInTheDocument();
    expect(useBookStore.getState().viewMode).toBe("page");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useBookStore.getState().viewMode).toBe("hub");
  });

  it("closes the controlled annotation drawer and ignores chapter shortcuts while typing", () => {
    render(<ReaderApp />);
    fireEvent.click(screen.getByRole("button", { name: "标注" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭标注面板" }));
    expect(screen.queryByRole("complementary", { name: "标注面板" })).not.toBeInTheDocument();

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useBookStore.getState().currentPage?.id).toBe("chap-1");
    input.remove();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useBookStore.getState().currentPage?.id).toBe("chap-2");
  });

  it("resets the active panel when the chapter changes", () => {
    render(<ReaderApp />);
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    expect(screen.getByRole("complementary", { name: "目录面板" })).toBeInTheDocument();
    act(() => useBookStore.setState({ currentPage: chapterTwo }));
    expect(screen.queryByRole("complementary", { name: "目录面板" })).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "阅读工具" })).toBeInTheDocument();
  });

  it("keeps the panel shell mounted and hides closed content from accessibility", () => {
    vi.useFakeTimers();
    render(<ReaderApp />);
    const shell = screen.getByTestId("reading-panel-shell");
    expect(shell).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    expect(screen.getByTestId("reading-panel-shell")).toBe(shell);
    expect(shell).toHaveAttribute("aria-hidden", "false");

    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    expect(screen.getByTestId("reading-panel-shell")).toBe(shell);
    expect(shell).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("测试书")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("测试书")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps the old frame visible while the next chapter is loading", () => {
    render(<ReaderApp />);
    const oldFrame = screen.getAllByTitle("ReadPilot reading page")[0];
    fireEvent.load(oldFrame);

    act(() => useBookStore.getState().setCurrentPage(chapterTwo));

    const frames = screen.getAllByTitle("ReadPilot reading page");
    expect(frames).toHaveLength(2);
    expect(oldFrame).toHaveAttribute("data-frame-state", "front");
    expect(screen.queryByTestId("frame-loading-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("frame-loading-indicator")).toBeInTheDocument();
  });

  it("briefly crossfades both frames after load, then removes the old frame", () => {
    vi.useFakeTimers();
    render(<ReaderApp />);
    const oldFrame = screen.getAllByTitle("ReadPilot reading page")[0];
    fireEvent.load(oldFrame);
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    const newFrame = screen.getAllByTitle("ReadPilot reading page")[1];

    fireEvent.load(newFrame);
    expect(screen.getAllByTitle("ReadPilot reading page")).toHaveLength(2);
    expect(oldFrame).toHaveClass("opacity-100");
    expect(newFrame).toHaveClass("opacity-0");

    act(() => vi.advanceTimersByTime(16));
    expect(oldFrame).toHaveClass("opacity-0");
    expect(newFrame).toHaveClass("opacity-100");

    transitionEnd(oldFrame, "opacity");
    expect(screen.getAllByTitle("ReadPilot reading page")).toHaveLength(1);
    expect(screen.getByTitle("ReadPilot reading page")).toBe(newFrame);
    vi.useRealTimers();
  });

  it("uses the 170ms fallback when opacity transitionend never arrives", () => {
    vi.useFakeTimers();
    render(<ReaderApp />);
    const oldFrame = screen.getByTitle("ReadPilot reading page");
    fireEvent.load(oldFrame);
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    fireEvent.load(screen.getAllByTitle("ReadPilot reading page")[1]);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getAllByTitle("ReadPilot reading page")).toHaveLength(2);
    act(() => vi.advanceTimersByTime(170));
    expect(screen.getAllByTitle("ReadPilot reading page")).toHaveLength(1);
  });

  it("ignores non-opacity transitionend events", () => {
    vi.useFakeTimers();
    render(<ReaderApp />);
    const oldFrame = screen.getByTitle("ReadPilot reading page");
    fireEvent.load(oldFrame);
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    fireEvent.load(screen.getAllByTitle("ReadPilot reading page")[1]);
    act(() => vi.advanceTimersByTime(16));
    transitionEnd(oldFrame, "transform");
    expect(screen.getAllByTitle("ReadPilot reading page")).toHaveLength(2);
    transitionEnd(oldFrame, "opacity");
    expect(screen.getAllByTitle("ReadPilot reading page")).toHaveLength(1);
  });

  it("ignores a stale middle-frame load during rapid A-B-C navigation", () => {
    vi.useFakeTimers();
    const chapterThree = { ...chapterTwo, id: "chap-3", title: "第三章", file: "chap-3.html" };
    useBookStore.setState({ progress: { ...progress, pages: [...progress.pages, chapterThree] } });
    render(<ReaderApp />);
    const first = screen.getByTitle("ReadPilot reading page");
    fireEvent.load(first);
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    const middle = screen.getAllByTitle("ReadPilot reading page").find((frame) => frame.getAttribute("src")?.includes("chap-2.html"))!;
    act(() => useBookStore.getState().setCurrentPage(chapterThree));
    fireEvent.load(middle);
    act(() => vi.advanceTimersByTime(16));
    expect(first).toHaveClass("opacity-100");
    expect(middle).not.toHaveClass("opacity-100");
    vi.useRealTimers();
  });

  it("finishes rapid A-B-C with only C active after B loads late", () => {
    vi.useFakeTimers();
    const chapterThree = { ...chapterTwo, id: "chap-3", title: "第三章", file: "chap-3.html" };
    useBookStore.setState({ progress: { ...progress, pages: [...progress.pages, chapterThree] } });
    render(<ReaderApp />);
    fireEvent.load(screen.getByTitle("ReadPilot reading page"));
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    const middle = screen.getAllByTitle("ReadPilot reading page").find((frame) => frame.getAttribute("src")?.includes("chap-2.html"))!;
    act(() => useBookStore.getState().setCurrentPage(chapterThree));
    const finalFrame = screen.getAllByTitle("ReadPilot reading page").find((frame) => frame.getAttribute("src")?.includes("chap-3.html"))!;
    fireEvent.load(middle);
    fireEvent.load(finalFrame);
    act(() => vi.advanceTimersByTime(16));
    transitionEnd(screen.getAllByTitle("ReadPilot reading page").find((frame) => frame !== finalFrame)!, "opacity");
    expect(screen.getAllByTitle("ReadPilot reading page")).toEqual([finalFrame]);
    expect(finalFrame).toHaveClass("opacity-100");
  });

  it("generates a fresh frame for rapid same-page theme changes", () => {
    vi.useFakeTimers();
    render(<ReaderApp />);
    const classic = screen.getByTitle("ReadPilot reading page");
    fireEvent.load(classic);
    act(() => useBookStore.getState().setTheme("modern"));
    const modern = screen.getAllByTitle("ReadPilot reading page").find((frame) => frame.getAttribute("src")?.includes("theme=modern"))!;
    act(() => useBookStore.getState().setTheme("magazine"));
    const magazine = screen.getAllByTitle("ReadPilot reading page").find((frame) => frame.getAttribute("src")?.includes("theme=magazine"))!;
    fireEvent.load(modern);
    fireEvent.load(magazine);
    act(() => vi.advanceTimersByTime(16));
    expect(magazine).toHaveClass("opacity-100");
    expect(modern).not.toHaveClass("opacity-100");
  });

  it("cancels a scheduled frame entry when unmounted", () => {
    vi.useFakeTimers();
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(<ReaderApp />);
    fireEvent.load(screen.getByTitle("ReadPilot reading page"));
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    fireEvent.load(screen.getAllByTitle("ReadPilot reading page")[1]);
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears the fallback timer when unmounted after the RAF phase", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(<ReaderApp />);
    fireEvent.load(screen.getByTitle("ReadPilot reading page"));
    act(() => useBookStore.getState().setCurrentPage(chapterTwo));
    fireEvent.load(screen.getAllByTitle("ReadPilot reading page")[1]);
    act(() => vi.advanceTimersByTime(16));
    const callsBeforeUnmount = clearSpy.mock.calls.length;
    unmount();
    expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    act(() => vi.advanceTimersByTime(200));
  });

  it("closes an open panel synchronously when navigation is requested", () => {
    render(<ReaderApp />);
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    fireEvent.click(screen.getByRole("button", { name: /第二章/ }));
    expect(useBookStore.getState().currentPage?.id).toBe("chap-2");
    expect(screen.getByTestId("reading-panel-shell")).toHaveAttribute("aria-hidden", "true");
  });

  it("does not refresh annotations for stale iframe or mismatched page messages", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<ReaderApp />);
    const activeFrame = screen.getByTitle("ReadPilot reading page") as HTMLIFrameElement;
    fireEvent.load(activeFrame);
    fireEvent.click(screen.getByRole("button", { name: "标注" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new MessageEvent("message", {
      origin: location.origin,
      source: {} as Window,
      data: { source: "rp-annotator", type: "rp-annotations-changed", payload: { pageId: "chap-1" } },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      origin: location.origin,
      source: activeFrame.contentWindow,
      data: { source: "rp-annotator", type: "rp-annotations-changed", payload: { pageId: "chap-2" } },
    }));
    await act(async () => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows annotation loading state instead of an empty state before fetch resolves", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    render(<ReaderApp />);
    fireEvent.click(screen.getByRole("button", { name: "标注" }));
    expect(screen.getByRole("status", { name: "正在加载标注" })).toBeInTheDocument();
    expect(screen.queryByText(/选中正文任意文字/)).not.toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => ({ annotations: [] }) } as Response);
    await waitFor(() => expect(screen.queryByRole("status", { name: "正在加载标注" })).not.toBeInTheDocument());
    expect(screen.getByText(/选中正文任意文字/)).toBeInTheDocument();
  });

  it("rejects forged origins, stale pages, and old iframe sources", () => {
    const active = window;
    const payload = { source: "rp-annotator", type: "rp-share", payload: { quote: "原文", body: "", semanticType: null, pageId: "chap-1" } };
    expect(isTrustedShareMessage({ origin: location.origin, source: active, data: payload } as MessageEvent, active, "chap-1")).toBe(true);
    expect(isTrustedShareMessage({ origin: "https://evil.example", source: active, data: payload } as MessageEvent, active, "chap-1")).toBe(false);
    expect(isTrustedShareMessage({ origin: location.origin, source: active, data: payload } as MessageEvent, active, "chap-2")).toBe(false);
    expect(isTrustedShareMessage({ origin: location.origin, source: {} as Window, data: payload } as MessageEvent, active, "chap-1")).toBe(false);
  });
});
