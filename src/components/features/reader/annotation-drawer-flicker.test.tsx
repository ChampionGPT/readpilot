/**
 * input: deferred annotation API responses, page changes, retries, and component unmounts
 * output: Regression coverage for latest-request-wins annotation drawer loading
 * pos: AnnotationDrawer async flicker and cancellation tests
 */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnotationDrawer } from "./AnnotationDrawer";

function response(annotations: unknown[] = [], ok = true): Response {
  return { ok, json: async () => ({ annotations }) } as Response;
}

describe("AnnotationDrawer request isolation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aborts the previous page request and ignores its late response", async () => {
    const requests: Array<{ signal: AbortSignal; resolve(value: Response): void }> = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((resolve) => {
      requests.push({ signal: init?.signal as AbortSignal, resolve });
    })));
    const props = { bookDir: "book", getActiveFrame: () => null, onClose: vi.fn() };
    const { rerender } = render(<AnnotationDrawer {...props} pageId="chap-1" />);
    rerender(<AnnotationDrawer {...props} pageId="chap-2" />);

    expect(requests[0].signal.aborted).toBe(true);
    requests[1].resolve(response([{ id: "new", pageId: "chap-2", quote: "newest", body: "", origin: "local", semanticType: null, createdAt: "2026-01-01" }]));
    await waitFor(() => expect(screen.getByText("newest")).toBeInTheDocument());
    requests[0].resolve(response([{ id: "old", pageId: "chap-1", quote: "stale", body: "", origin: "local", semanticType: null, createdAt: "2026-01-01" }]));
    await Promise.resolve();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });

  it("shows a load error without empty state and retries successfully", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([], false))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<AnnotationDrawer bookDir="book" pageId="chap-1" getActiveFrame={() => null} onClose={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("标注加载失败");
    expect(screen.queryByText(/选中正文任意文字/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText(/选中正文任意文字/)).toBeInTheDocument();
  });

  it("aborts the active request on unmount", () => {
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    }));
    const { unmount } = render(<AnnotationDrawer bookDir="book" pageId="chap-1" getActiveFrame={() => null} onClose={vi.fn()} />);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("aborts the previous refresh during an annotator message storm", async () => {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const requests: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      requests.push(init?.signal as AbortSignal);
      return new Promise<Response>(() => undefined);
    }));
    render(<AnnotationDrawer bookDir="book" pageId="chap-1" getActiveFrame={() => frame} onClose={vi.fn()} />);
    await waitFor(() => expect(requests).toHaveLength(1));
    const message = () => window.dispatchEvent(new MessageEvent("message", {
      origin: location.origin,
      source: frame.contentWindow,
      data: { source: "rp-annotator", type: "rp-annotations-changed", payload: { pageId: "chap-1" } },
    }));
    message();
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].aborted).toBe(true);
    message();
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[1].aborted).toBe(true);
    frame.remove();
  });
});
