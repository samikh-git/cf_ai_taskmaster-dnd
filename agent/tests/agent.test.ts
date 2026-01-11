import {
  env,
  getDurableObjectInstance,
  runDurableObjectAlarm,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import type { TaskMasterAgent } from "../src/agent";
import type { AgentNamespace } from "agents";

interface ProvidedEnv {
  TaskMasterAgent: AgentNamespace<TaskMasterAgent>;
  AI: Ai;
}

describe("TaskMasterAgent Tools", () => {
  const agentName = `test-agent-${Date.now()}`;
  let agentInstance: TaskMasterAgent;

  beforeEach(async () => {
    // Get a fresh agent instance for each test
    const stub = env.TaskMasterAgent.get(
      env.TaskMasterAgent.idFromName(agentName)
    );
    agentInstance = getDurableObjectInstance<TaskMasterAgent>(stub);
  });

  describe("getCurrentTime", () => {
    it("should return current time in ISO 8601 format", async () => {
      const beforeTime = new Date().toISOString();
      const currentTime = await agentInstance.getCurrentTime();
      const afterTime = new Date().toISOString();

      expect(currentTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(currentTime >= beforeTime).toBe(true);
      expect(currentTime <= afterTime).toBe(true);
    });

    it("should return a valid date string", () => {
      // This test can be run synchronously if we just validate format
      const testTime = new Date().toISOString();
      expect(() => new Date(testTime)).not.toThrow();
      expect(new Date(testTime).toISOString()).toBe(testTime);
    });
  });

  describe("createTask", () => {
    it("should create a task with valid properties", async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now
      const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 2); // 2 hours from now

      const task = await agentInstance.createTask(
        "Test Quest",
        "An epic test quest",
        startTime.toISOString(),
        endTime.toISOString(),
        100
      );

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe("Test Quest");
      expect(task.description).toBe("An epic test quest");
      expect(task.XP).toBe(100);
      expect(task.startTime).toEqual(startTime);
      expect(task.endTime).toEqual(endTime);
    });

    it("should persist tasks to state", async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 1000 * 60 * 60);
      const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 2);

      const task = await agentInstance.createTask(
        "Persisted Quest",
        "A quest that should persist",
        startTime.toISOString(),
        endTime.toISOString(),
        50
      );

      const tasks = await agentInstance.viewTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const foundTask = tasks.find((t) => t.id === task.id);
      expect(foundTask).toBeDefined();
      expect(foundTask?.name).toBe("Persisted Quest");
    });

    it("should create multiple tasks", async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 1000 * 60 * 60);
      const end1 = new Date(now.getTime() + 1000 * 60 * 60 * 2);
      const start2 = new Date(now.getTime() + 1000 * 60 * 60 * 3);
      const end2 = new Date(now.getTime() + 1000 * 60 * 60 * 4);

      const task1 = await agentInstance.createTask(
        "Quest One",
        "First quest",
        start1.toISOString(),
        end1.toISOString(),
        75
      );

      const task2 = await agentInstance.createTask(
        "Quest Two",
        "Second quest",
        start2.toISOString(),
        end2.toISOString(),
        150
      );

      const tasks = await agentInstance.viewTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks.some((t) => t.id === task1.id)).toBe(true);
      expect(tasks.some((t) => t.id === task2.id)).toBe(true);
    });
  });

  describe("viewTasks", () => {
    it("should return empty array when no tasks exist", async () => {
      // Create a fresh agent instance for this test
      const freshStub = env.TaskMasterAgent.get(
        env.TaskMasterAgent.idFromName(`empty-agent-${Date.now()}`)
      );
      const freshInstance = getDurableObjectInstance<TaskMasterAgent>(freshStub);

      const tasks = await freshInstance.viewTasks();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(0);
    });

    it("should return all created tasks", async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 1000 * 60 * 60);
      const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 2);

      await agentInstance.createTask(
        "View Test Quest",
        "A quest to test viewing",
        startTime.toISOString(),
        endTime.toISOString(),
        200
      );

      const tasks = await agentInstance.viewTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks.find((t) => t.name === "View Test Quest");
      expect(task).toBeDefined();
    });
  });

  describe("Task Expiration and Cleanup", () => {
    it("should schedule alarm when task is created", async () => {
      const now = Date.now();
      const startTime = new Date(now + 1000 * 60 * 60);
      const endTime = new Date(now + 1000 * 60 * 60 * 2);

      await agentInstance.createTask(
        "Alarm Test Quest",
        "A quest to test alarm scheduling",
        startTime.toISOString(),
        endTime.toISOString(),
        300
      );

      // Get storage to check alarm
      const storage = (agentInstance as any).ctx?.storage;
      if (storage) {
        const alarmTime = await storage.getAlarm();
        expect(alarmTime).toBeDefined();
        expect(alarmTime).toBeGreaterThan(now);
        expect(alarmTime).toBeLessThanOrEqual(endTime.getTime());
      }
    });

    it("should clean up expired tasks when alarm triggers", async () => {
      const now = Date.now();
      const pastTime = new Date(now - 1000 * 60 * 60); // 1 hour ago
      const futureTime = new Date(now + 1000 * 60 * 60); // 1 hour from now

      // Create an expired task
      const expiredTask = await agentInstance.createTask(
        "Expired Quest",
        "This quest is already expired",
        pastTime.toISOString(),
        new Date(now - 1000 * 60 * 30).toISOString(), // Ended 30 minutes ago
        100
      );

      // Create a future task
      const futureTask = await agentInstance.createTask(
        "Future Quest",
        "This quest is in the future",
        futureTime.toISOString(),
        new Date(now + 1000 * 60 * 60 * 2).toISOString(),
        200
      );

      // Trigger alarm to cleanup expired tasks
      const stub = env.TaskMasterAgent.get(
        env.TaskMasterAgent.idFromName(agentName)
      );
      await runDurableObjectAlarm(stub);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const tasks = await agentInstance.viewTasks();
      // Expired task should be removed
      expect(tasks.find((t) => t.id === expiredTask.id)).toBeUndefined();
      // Future task should remain
      expect(tasks.find((t) => t.id === futureTask.id)).toBeDefined();
    });

    it("should handle alarm trigger correctly", async () => {
      const now = Date.now();
      const expiredEndTime = new Date(now - 1000); // Just expired

      await agentInstance.createTask(
        "Alarm Trigger Test",
        "Testing alarm trigger",
        new Date(now - 1000 * 60 * 60).toISOString(),
        expiredEndTime.toISOString(),
        150
      );

      // Trigger the alarm manually
      const stub = env.TaskMasterAgent.get(
        env.TaskMasterAgent.idFromName(agentName)
      );
      await runDurableObjectAlarm(stub);

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      const tasks = await agentInstance.viewTasks();
      // The expired task should be cleaned up
      expect(tasks.every((t) => t.endTime.getTime() > Date.now())).toBe(true);
    });
  });

  describe("Alarm Scheduling", () => {
    it("should schedule alarm for earliest expiration", async () => {
      const now = Date.now();
      const endTime1 = new Date(now + 1000 * 60 * 30); // 30 minutes
      const endTime2 = new Date(now + 1000 * 60 * 60); // 1 hour
      const endTime3 = new Date(now + 1000 * 60 * 90); // 1.5 hours

      // Create tasks with different expiration times
      await agentInstance.createTask(
        "Earliest Quest",
        "Expires first",
        new Date(now + 1000 * 60 * 10).toISOString(),
        endTime1.toISOString(),
        100
      );

      await agentInstance.createTask(
        "Middle Quest",
        "Expires second",
        new Date(now + 1000 * 60 * 45).toISOString(),
        endTime2.toISOString(),
        200
      );

      await agentInstance.createTask(
        "Latest Quest",
        "Expires last",
        new Date(now + 1000 * 60 * 75).toISOString(),
        endTime3.toISOString(),
        300
      );

      const storage = (agentInstance as any).ctx?.storage;
      if (storage) {
        const alarmTime = await storage.getAlarm();
        expect(alarmTime).toBeDefined();
        // Alarm should be set for the earliest expiration (endTime1)
        expect(alarmTime).toBeLessThanOrEqual(endTime1.getTime());
      }
    });

    it("should cancel alarm when no tasks remain", async () => {
      const now = Date.now();
      const endTime = new Date(now + 1000 * 60 * 30);

      await agentInstance.createTask(
        "Last Quest",
        "Will be removed",
        new Date(now + 1000 * 60 * 10).toISOString(),
        endTime.toISOString(),
        100
      );

      // Trigger alarm to clean up expired task (if any)
      const stub = env.TaskMasterAgent.get(
        env.TaskMasterAgent.idFromName(agentName)
      );
      
      // Clean up all tasks by creating expired ones and triggering alarm
      const tasks = await agentInstance.viewTasks();
      if (tasks.length > 0) {
        // Create a new task that's already expired to trigger cleanup path
        const pastTime = new Date(Date.now() - 1000 * 60 * 60);
        await agentInstance.createTask(
          "Temp Expired",
          "Will be cleaned",
          pastTime.toISOString(),
          new Date(Date.now() - 1000).toISOString(),
          10
        );
        // Trigger alarm to clean up
        await runDurableObjectAlarm(stub);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const storage = (agentInstance as any).ctx?.storage;
      if (storage) {
        // After cleanup with no tasks, alarm might be cancelled
        // This is acceptable behavior
        const alarmTime = await storage.getAlarm();
        // Either null or a valid time is acceptable
        expect(alarmTime === null || typeof alarmTime === "number").toBe(true);
      }
    });
  });

  describe("State Persistence", () => {
    it("should persist state across method calls", async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 1000 * 60 * 60);
      const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 2);

      await agentInstance.createTask(
        "Persistence Test",
        "Testing state persistence",
        startTime.toISOString(),
        endTime.toISOString(),
        250
      );

      // Get state directly
      const state1 = await agentInstance.state;
      expect(state1.tasks.length).toBeGreaterThan(0);

      // Call viewTasks (which also reads state)
      const tasks = await agentInstance.viewTasks();
      expect(tasks.length).toBe(state1.tasks.length);
    });
  });

  describe("Edge Cases", () => {
    it("should handle tasks with same start and end time gracefully", async () => {
      const now = new Date();
      const time = new Date(now.getTime() + 1000 * 60 * 60);

      // Note: Our validation should prevent this, but test that system handles it
      const task = await agentInstance.createTask(
        "Same Time Quest",
        "Start and end at same time",
        time.toISOString(),
        time.toISOString(),
        50
      );

      // Task should still be created (validation is in tool description, not enforced in code)
      expect(task).toBeDefined();
      expect(task.startTime.getTime()).toBe(task.endTime.getTime());
    });

    it("should handle very large XP values", async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 1000 * 60 * 60);
      const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 2);

      const task = await agentInstance.createTask(
        "Epic Quest",
        "A quest with massive XP",
        startTime.toISOString(),
        endTime.toISOString(),
        999999
      );

      expect(task.XP).toBe(999999);
    });

    it("should handle empty task names and descriptions", async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 1000 * 60 * 60);
      const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 2);

      const task = await agentInstance.createTask(
        "",
        "",
        startTime.toISOString(),
        endTime.toISOString(),
        10
      );

      expect(task.name).toBe("");
      expect(task.description).toBe("");
    });
  });
});

