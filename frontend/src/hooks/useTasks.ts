import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, Session } from '@/types';
import { AUTO_DELETE_THRESHOLD_MS } from '@/constants';
import { debounce } from '@/utils/debounce';

export function useTasks(session: Session | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalXP, setTotalXP] = useState<number | undefined>(undefined);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [expiredTaskAlert, setExpiredTaskAlert] = useState<Task | null>(null);
  const [processedExpiredTasks, setProcessedExpiredTasks] = useState<Set<string>>(new Set());
  const userTimezoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        userTimezoneRef.current = timezone;
      } catch (error) {
        console.error('Error detecting timezone:', error);
      }
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const headers: Record<string, string> = {};
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
      }

      const response = await fetch('/api/tasks', {
        headers,
      });
      
      if (response.ok) {
        const data = await response.json() as { tasks?: Task[]; totalXP?: number; currentStreak?: number; longestStreak?: number; lastCompletionDate?: string | null };
        if (data.tasks) {
          setTasks(data.tasks);
        } else {
          setTasks([]);
        }
        // Always set totalXP, even if it's 0 (user has no XP yet)
        setTotalXP(data.totalXP ?? 0);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []); // Empty deps: setters are stable, userTimezoneRef is stable

  useEffect(() => {
    if (!session) return;
    
    // Fetch immediately on mount, then every 30 seconds
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
    // fetchTasks is stable from useCallback, so we omit it from deps to keep array size constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session || tasks.length === 0) return;

    const checkExpiredTasks = () => {
      const now = new Date();
      const newlyExpired = tasks.filter(task => {
        const end = new Date(task.endTime);
        const isExpired = end < now;
        const notProcessed = !processedExpiredTasks.has(task.id);
        return isExpired && notProcessed;
      });

      if (newlyExpired.length > 0 && !expiredTaskAlert) {
        setExpiredTaskAlert(newlyExpired[0]);
      }
    };

    checkExpiredTasks();
    // Check every 5 seconds instead of every 1 second to reduce CPU usage
    const interval = setInterval(checkExpiredTasks, 5000);

    return () => clearInterval(interval);
  }, [tasks, processedExpiredTasks, expiredTaskAlert, session]);

  useEffect(() => {
    if (!session || tasks.length === 0) return;

    const autoDeleteExpiredTasks = async () => {
      const now = new Date();
      const expiredThreshold = AUTO_DELETE_THRESHOLD_MS;
      
      const tasksToDelete = tasks.filter(task => {
        const end = new Date(task.endTime);
        const expiredFor = now.getTime() - end.getTime();
        return expiredFor > expiredThreshold;
      });

      if (tasksToDelete.length > 0) {
        for (const task of tasksToDelete) {
          try {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };
            if (userTimezoneRef.current) {
              headers['x-timezone'] = userTimezoneRef.current;
            }

            await fetch('/api/tasks', {
              method: 'DELETE',
              headers,
              body: JSON.stringify({
                tool: 'deleteTask',
                params: {
                  taskId: task.id,
                },
              }),
            });
            
            setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
          } catch (error) {
            console.error('Error auto-deleting expired task:', error);
          }
        }
        
        await fetchTasks();
      }
    };

    // Debounce auto-delete to avoid multiple rapid calls when tasks change frequently
    const debouncedAutoDelete = debounce(autoDeleteExpiredTasks, 1000);
    
    // Run once immediately, then debounced on interval to prevent rapid-fire calls
    autoDeleteExpiredTasks();
    const interval = setInterval(() => {
      debouncedAutoDelete();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
    // fetchTasks is stable from useCallback, so we omit it from deps to keep array size constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, session]);

  // Optimistic update functions
  const optimisticallyAddTask = useCallback((task: Task) => {
    setTasks(prev => {
      // Check if task already exists to avoid duplicates
      if (prev.some(t => t.id === task.id)) {
        return prev;
      }
      return [...prev, task];
    });
  }, []);

  const optimisticallyUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  }, []);

  const optimisticallyDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const optimisticallyUpdateXP = useCallback((xpDelta: number) => {
    setTotalXP(prev => {
      if (prev === undefined) return xpDelta;
      return prev + xpDelta;
    });
  }, []);

  // Rollback function - restore previous state
  const rollbackTasks = useCallback((previousTasks: Task[]) => {
    setTasks(previousTasks);
  }, []);

  const rollbackXP = useCallback((previousXP: number | undefined) => {
    setTotalXP(previousXP);
  }, []);

  return {
    tasks,
    totalXP,
    isLoadingTasks,
    expiredTaskAlert,
    processedExpiredTasks,
    setExpiredTaskAlert,
    setProcessedExpiredTasks,
    fetchTasks,
    userTimezoneRef,
    // Optimistic update functions
    optimisticallyAddTask,
    optimisticallyUpdateTask,
    optimisticallyDeleteTask,
    optimisticallyUpdateXP,
    rollbackTasks,
    rollbackXP,
  };
}

