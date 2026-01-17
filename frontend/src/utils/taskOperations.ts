import { Task } from '@/types';

export interface OptimisticUpdateCallbacks {
  onOptimisticUpdate?: (updates: Partial<Task>) => void;
  onRollback?: () => void;
  onError?: (message: string) => void;
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
  const optimisticUpdate = { endTime: newEndTime.toISOString() };
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
      const errorMsg = `Failed to extend task: ${errorData.error || 'Unknown error'}`;
      callbacks?.onError?.(errorMsg);
      return false;
    }

    return true;
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    console.error('Error extending task:', error);
    const errorMsg = `Failed to extend task: ${(error as Error).message}`;
    callbacks?.onError?.(errorMsg);
    return false;
  }
}

export interface FinishTaskCallbacks {
  onOptimisticDelete?: () => void;
  onOptimisticXP?: (xp: number) => void;
  onRollback?: () => void;
  onRollbackXP?: () => void;
  onError?: (message: string) => void;
  onNarrative?: (narrative: string, xpEarned: number) => void;
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
      const errorMsg = `Failed to finish task: ${errorData.error || 'Unknown error'}`;
      callbacks?.onError?.(errorMsg);
      return false;
    }

    const responseData = await response.json() as { success?: boolean; narrative?: string; xpEarned?: number };
    const narrative = responseData.narrative || `The quest "${task.name}" has been completed!`;
    const xpEarned = responseData.xpEarned || task.XP;
    
    // Show narrative if provided
    if (narrative) {
      callbacks?.onNarrative?.(narrative, xpEarned);
    }

    return true;
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    callbacks?.onRollbackXP?.();
    console.error('Error finishing task:', error);
    const errorMsg = `Failed to finish task: ${(error as Error).message}`;
    callbacks?.onError?.(errorMsg);
    return false;
  }
}

export interface AbandonTaskCallbacks {
  onOptimisticDelete?: () => void;
  onOptimisticXP?: (xpDelta: number) => void;
  onRollback?: () => void;
  onRollbackXP?: () => void;
  onError?: (message: string) => void;
}

export async function abandonTask(
  task: Task,
  userTimezone: string | null,
  callbacks?: AbandonTaskCallbacks
): Promise<boolean> {
  // Calculate penalty: 50% of task XP
  const penaltyXP = Math.floor(task.XP * 0.5);
  
  // Optimistic updates
  callbacks?.onOptimisticDelete?.();
  callbacks?.onOptimisticXP?.(-penaltyXP); // Subtract XP

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
      callbacks?.onRollbackXP?.();
      const errorData = await response.json() as { error?: string };
      console.error('Error deleting task:', errorData.error);
      const errorMsg = `Failed to delete task: ${errorData.error || 'Unknown error'}`;
      callbacks?.onError?.(errorMsg);
      return false;
    }

    return true;
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    callbacks?.onRollbackXP?.();
    console.error('Error deleting task:', error);
    const errorMsg = `Failed to delete task: ${(error as Error).message}`;
    callbacks?.onError?.(errorMsg);
    return false;
  }
}

export interface CreateTaskCallbacks {
  onOptimisticAdd?: (task: Task) => void;
  onRollback?: () => void;
  onError?: (message: string) => void;
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
    startTime: taskData.taskStartTime,
    endTime: taskData.taskEndTime,
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
        callbacks?.onError?.(`Failed to create task: ${errorMsg}`);
        return false;
      }
    } else {
      // Rollback on error
      callbacks?.onRollback?.();
      const error = await response.json() as { error?: string };
      const errorMsg = error.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Error creating task:', errorMsg);
      callbacks?.onError?.(`Failed to create task: ${errorMsg}`);
      return false;
    }
  } catch (error: unknown) {
    // Rollback on error
    callbacks?.onRollback?.();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating task:', error);
    callbacks?.onError?.(`Failed to create task: ${errorMsg}`);
    return false;
  }
}

