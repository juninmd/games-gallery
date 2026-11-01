import { afterEach, describe, expect, it } from "vitest";
import { useTasks } from "./tasks";

afterEach(() => useTasks.getState().cancelAll());

describe("task registry", () => {
  it("starts a key once and ignores updates for keys that do not exist", () => {
    const tasks = useTasks.getState();
    tasks.start("a", "Instalando DuckStation");
    tasks.start("a", "Outro rótulo");
    expect(useTasks.getState().tasks.a!.label).toBe("Instalando DuckStation");
    tasks.update("missing", { progress: 10 });
    expect(Object.keys(useTasks.getState().tasks)).toEqual(["a"]);
  });

  it("clamps progress and keeps the label when only the detail changes", () => {
    const tasks = useTasks.getState();
    tasks.start("a", "Instalando");
    tasks.update("a", { progress: 250, detail: "line 1" });
    expect(useTasks.getState().tasks.a).toMatchObject({ progress: 100, detail: "line 1", label: "Instalando" });
    tasks.update("a", { progress: -5 });
    expect(useTasks.getState().tasks.a!.progress).toBe(0);
  });

  it("done removes a single key and cancel removes an existing one", () => {
    const tasks = useTasks.getState();
    tasks.start("a", "A");
    tasks.start("b", "B");
    tasks.done("a");
    expect(useTasks.getState().tasks.a).toBeUndefined();
    expect(useTasks.getState().tasks.b).toBeDefined();
    tasks.cancel("b");
    expect(useTasks.getState().tasks).toEqual({});
  });

  it("cancel of an unknown key is a no-op and cancelAll clears everything", () => {
    const tasks = useTasks.getState();
    tasks.cancel("ghost");
    expect(useTasks.getState().tasks).toEqual({});
    tasks.start("a", "A");
    tasks.start("b", "B");
    tasks.cancelAll();
    expect(useTasks.getState().tasks).toEqual({});
  });
});
