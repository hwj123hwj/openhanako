import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PreferencesManager } from "../core/preferences-manager.js";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-prefs-")); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function makePrefs() {
  const userDir = path.join(dir, "user");
  const agentsDir = path.join(dir, "agents");
  fs.mkdirSync(userDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
  return new PreferencesManager({ userDir, agentsDir });
}

describe("workflow preferences", () => {
  it("默认 enabled=false（旧用户无字段时读时兜底）", () => {
    expect(makePrefs().getWorkflowSettings().enabled).toBe(false);
  });

  it("set 打开后能读回 true，并持久化到磁盘", () => {
    const prefs = makePrefs();
    prefs.setWorkflowSettings({ enabled: true });
    expect(prefs.getWorkflowSettings().enabled).toBe(true);
    // 新实例从磁盘读，仍为 true
    expect(makePrefs2(prefs).getWorkflowSettings().enabled).toBe(true);
  });

  it("set 关闭后清掉显式 false，回到默认", () => {
    const prefs = makePrefs();
    prefs.setWorkflowSettings({ enabled: true });
    prefs.setWorkflowSettings({ enabled: false });
    expect(prefs.getWorkflowSettings().enabled).toBe(false);
  });
});

// 复用同一磁盘目录开第二个实例
function makePrefs2(prev) {
  return new PreferencesManager({ userDir: prev._userDir, agentsDir: prev._agentsDir });
}
