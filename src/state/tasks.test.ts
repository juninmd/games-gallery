import { afterEach, describe, expect, it, vi } from "vitest";
import { useTasks } from "./tasks";

afterEach(() => {
  useTasks.getState().cancelAll();
  vi.useRealTimers();
});

describe("task cancellation", () => {
  it("cancels a keyed job immediately and allows restarting the same key", () => {
    vi.useFakeTimers();
    const stale = vi.fn();
    const fresh = vi.fn();
    useTasks.getState().run("same", "stale", 240, stale);
    vi.advanceTimersByTime(120);
    expect(useTasks.getState().tasks.same!.progress).toBe(50);
    useTasks.getState().cancel("same");
    expect(useTasks.getState().tasks.same).toBeUndefined();
    useTasks.getState().run("same", "fresh", 120, fresh);
    vi.advanceTimersByTime(120);
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledOnce();
    expect(useTasks.getState().tasks.same).toBeUndefined();
  });

  it("cancelAll clears all active timers and jobs", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    useTasks.getState().run("a", "A", 120, done);
    useTasks.getState().run("b", "B", 120, done);
    useTasks.getState().cancelAll();
    vi.runOnlyPendingTimers();
    expect(useTasks.getState().tasks).toEqual({});
    expect(done).not.toHaveBeenCalled();
  });

  it("resists same-key run and cancellation during task publication", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    let rerun = false;
    const unsubscribe = useTasks.subscribe((state, previous) => {
      if (!previous.tasks.same && state.tasks.same) {
        if (rerun) useTasks.getState().run("same", "nested", 120, done);
        else useTasks.getState().cancel("same");
      }
    });
    rerun = true;
    useTasks.getState().run("same", "outer", 120, done);
    unsubscribe();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(120);
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    const cancelOnPublish = useTasks.subscribe((state, previous) => {
      if (!previous.tasks.cancelled && state.tasks.cancelled) useTasks.getState().cancel("cancelled");
    });
    useTasks.getState().run("cancelled", "cancel me", 120, done);
    cancelOnPublish();
    expect(useTasks.getState().tasks.cancelled).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    vi.runOnlyPendingTimers();
    expect(done).toHaveBeenCalledOnce();
  });

  it("does not call onDone if a subscriber cancels during completion publication", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const unsubscribe = useTasks.subscribe((state, previous) => {
      if (previous.tasks.finish && !state.tasks.finish) useTasks.getState().cancel("finish");
    });
    useTasks.getState().run("finish", "finish", 120, done);
    vi.advanceTimersByTime(120);
    unsubscribe();
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
