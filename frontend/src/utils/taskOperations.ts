import { Task } from '@/types';

export interface OptimisticUpdateCallbacks {
  onOptimisticUpdate?: (updates: Partial<Task>) => void;
  onRollback?: () => void;
}

export async function extendTask(
  task: Task,
  userTimezone: string | null,
  callbacks?: OptimisticUpdateCallbacks
): Promise<boolean> {
  const start = new Date(task.startTime);
  const end = new Date(task.endTime);
  const originalDuration = end.getTime() - start.getTime();
  const extension = originalDuration * 0.1;
  const newEndTime = new Date(end.getTime() + extension);

  // Optimistic update
  const optimisticUpdate = { endTime: newEndTime };
  callbacks?.onOptimisticUpdate?.(optimisticUpdate);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userTimezone) {
      headers['x-timezone'] = userTimezone;
    }

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        tool: 'updateTask',
        params: {
          taskId: task.id,
          endTime: newEndTime.toISOString(),
        },
      }),
    });

    if (!response.ok) {
      // Rollback on error
      callbacks?.onRollback?.();
      const errorData = await response.json() as { error?: string };
      console.error('Error extending task:', errorData.error);
      alert(`Failed to extend task: ${errorData.error || 'Unknown error'}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    console.error('Error extending task:', error);
    alert(`Failed to extend task: ${(error as Error).message}`);
    return false;
  }
}

export interface FinishTaskCallbacks {
  onOptimisticDelete?: () => void;
  onOptimisticXP?: (xp: number) => void;
  onRollback?: () => void;
  onRollbackXP?: () => void;
}

export async function finishTask(
  task: Task,
  userTimezone: string | null,
  callbacks?: FinishTaskCallbacks
): Promise<boolean> {
  // Optimistic updates
  callbacks?.onOptimisticDelete?.();
  callbacks?.onOptimisticXP?.(task.XP);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userTimezone) {
      headers['x-timezone'] = userTimezone;
    }

    const response = await fetch('/api/tasks', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        tool: 'deleteTask',
        params: {
          taskId: task.id,
          addXP: true,
        },
      }),
    });

    if (!response.ok) {
      // Rollback on error
      callbacks?.onRollback?.();
      callbacks?.onRollbackXP?.();
      const errorData = await response.json() as { error?: string };
      console.error('Error finishing task:', errorData.error);
      alert(`Failed to finish task: ${errorData.error || 'Unknown error'}`);
      return false;
    }

    alert(`Quest "${task.name}" completed! You earned ${task.XP} XP.`);
    return true;
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    callbacks?.onRollbackXP?.();
    console.error('Error finishing task:', error);
    alert(`Failed to finish task: ${(error as Error).message}`);
    return false;
  }
}

export interface AbandonTaskCallbacks {
  onOptimisticDelete?: () => void;
  onRollback?: () => void;
}

export async function abandonTask(
  task: Task,
  userTimezone: string | null,
  callbacks?: AbandonTaskCallbacks
): Promise<boolean> {
  // Optimistic update
  callbacks?.onOptimisticDelete?.();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userTimezone) {
      headers['x-timezone'] = userTimezone;
    }

    const response = await fetch('/api/tasks', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        tool: 'deleteTask',
        params: {
          taskId: task.id,
        },
      }),
    });

    if (!response.ok) {
      // Rollback on error
      callbacks?.onRollback?.();
      const errorData = await response.json() as { error?: string };
      console.error('Error deleting task:', errorData.error);
      alert(`Failed to delete task: ${errorData.error || 'Unknown error'}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    console.error('Error deleting task:', error);
    alert(`Failed to delete task: ${(error as Error).message}`);
    return false;
  }
}

export interface CreateTaskCallbacks {
  onOptimisticAdd?: (task: Task) => void;
  onRollback?: () => void;
}

export async function createTask(
  taskData: {
    taskName: string;
    taskDescription: string;
    taskStartTime: string;
    taskEndTime: string;
    XP: number;
  },
  userTimezone: string | null,
  callbacks?: CreateTaskCallbacks
): Promise<boolean> {
  // Create optimistic task with temporary ID
  const optimisticTask: Task = {
    id: `temp-${Date.now()}-${Math.random()}`,
    name: taskData.taskName,
    description: taskData.taskDescription,
    startTime: new Date(taskData.taskStartTime),
    endTime: new Date(taskData.taskEndTime),
    XP: taskData.XP,
  };

  // Optimistic update
  callbacks?.onOptimisticAdd?.(optimisticTask);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userTimezone) {
      headers['x-timezone'] = userTimezone;
    }

    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: 'createTask',
        params: taskData,
      }),
    });

    if (response.ok) {
      const result = await response.json() as { success?: boolean; error?: string; task?: Task };
      if (result.success || result.task) {
        // Remove optimistic task (it will be replaced by real task from fetchTasks)
        callbacks?.onRollback?.();
        return true;
      } else {
        // Rollback on error
        callbacks?.onRollback?.();
        const errorMsg = result.error || 'Task creation failed';
        console.error('Task creation failed:', errorMsg);
        alert(`Failed to create task: ${errorMsg}`);
        return false;
      }
    } else {
      // Rollback on error
      callbacks?.onRollback?.();
      const error = await response.json() as { error?: string };
      const errorMsg = error.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Error creating task:', errorMsg);
      alert(`Failed to create task: ${errorMsg}`);
      return false;
    }
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating task:', error);
    alert(`Failed to create task: ${errorMsg}`);
    return false;
  }
}

