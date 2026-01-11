import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { AgentNamespace } from "agents";
import type { TaskMasterAgent } from "../src/agent";

interface ProvidedEnv {
  TaskMasterAgent: AgentNamespace<TaskMasterAgent>;
  AI: Ai;
}

const LOCAL_DEV_URL = "http://localhost:8787";

describe("TaskMasterAgent", () => {
  it("responds to agent requests", async () => {
    // Using routeAgentRequest, the URL pattern is /agents/:agent/:name
    const request = new Request(
      `${LOCAL_DEV_URL}/agents/TaskMasterAgent/test-session-123`
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env as ProvidedEnv, ctx);
    console.log(await response.text());
    await waitOnExecutionContext(ctx);
    
    // Should get a response (not 404)
    expect(response.status).not.toBe(404);
  });

  it("handles requests using SELF", async () => {
    const request = new Request(
      `${LOCAL_DEV_URL}/agents/TaskMasterAgent/test-session-456`
    );
    const response = await SELF.fetch(request);
    
    // Should get a response (not 404)
    expect(response.status).not.toBe(404);
  });

  it("returns 404 for non-agent routes", async () => {
    const request = new Request(`${LOCAL_DEV_URL}/some-other-path`);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env as ProvidedEnv, ctx);
    await waitOnExecutionContext(ctx);
    
    // Should return 404 for non-agent routes
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toHaveProperty("msg", "no agent here");
  });
});

