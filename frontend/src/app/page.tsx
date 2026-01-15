'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { ScrollText, User } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  tasks?: Task[];
}

interface Task {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  XP: number;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalXP, setTotalXP] = useState<number>(0);
  const [showDashboard, setShowDashboard] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [expiredTaskAlert, setExpiredTaskAlert] = useState<Task | null>(null);
  const [processedExpiredTasks, setProcessedExpiredTasks] = useState<Set<string>>(new Set());
  const [levelUpAlert, setLevelUpAlert] = useState<number | null>(null);
  const previousLevelRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userTimezoneRef = useRef<string | null>(null);

  // Detect user's timezone on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Get timezone using Intl API
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        userTimezoneRef.current = timezone;
      } catch (error) {
        console.error('Error detecting timezone:', error);
        // Fallback: try to get from Date
        const offset = -new Date().getTimezoneOffset() / 60;
        userTimezoneRef.current = `UTC${offset >= 0 ? '+' : ''}${offset}`;
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      // Session ID is now generated server-side from authenticated user
      // Send timezone header so agent can use it
      const headers: Record<string, string> = {};
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
      }
      
      const response = await fetch('/api/tasks', {
        headers,
      });
      
      if (response.ok) {
        const data = await response.json() as { tasks?: Task[]; totalXP?: number };
        if (data.tasks) {
          setTasks(data.tasks);
        } else {
          setTasks([]);
        }
        if (data.totalXP !== undefined) {
          const newXP = data.totalXP;
          const oldLevel = previousLevelRef.current;
          const newLevel = Math.floor(newXP / 100) + 1;
          
          setTotalXP(newXP);
          
          // Check for level up (only if we had a previous level to compare)
          if (oldLevel !== null && newLevel > oldLevel) {
            setLevelUpAlert(newLevel);
          }
          
          // Update previous level for next comparison
          previousLevelRef.current = newLevel;
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (session) {
      // Delay initial fetch slightly to not block page render
      const timeout = setTimeout(() => {
        fetchTasks();
      }, 100);
      
      // Refresh tasks every 30 seconds
      const interval = setInterval(fetchTasks, 30000);
      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }
  }, [session]);

  const extendTask = async (task: Task): Promise<boolean> => {
    try {
      // Calculate 10% of original duration
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);
      const originalDuration = end.getTime() - start.getTime();
      const extension = originalDuration * 0.1;
      const newEndTime = new Date(end.getTime() + extension);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
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
        const errorData = await response.json() as { error?: string };
        console.error('Error extending task:', errorData.error);
        alert(`Failed to extend task: ${errorData.error || 'Unknown error'}`);
        return false;
      }

      // Mark as processed and refresh tasks
      setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
      setExpiredTaskAlert(null);
      await fetchTasks();
      return true;
    } catch (error: unknown) {
      console.error('Error extending task:', error);
      alert(`Failed to extend task: ${(error as Error).message}`);
      return false;
    }
  };

  const finishTask = async (task: Task): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
      }

      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          tool: 'deleteTask',
          params: {
            taskId: task.id,
            addXP: true, // Add XP when finishing a task
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        console.error('Error finishing task:', errorData.error);
        alert(`Failed to finish task: ${errorData.error || 'Unknown error'}`);
        return false;
      }

      // Mark as processed and refresh tasks
      setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
      setExpiredTaskAlert(null);
      await fetchTasks();
      return true;
    } catch (error: unknown) {
      console.error('Error finishing task:', error);
      alert(`Failed to finish task: ${(error as Error).message}`);
      return false;
    }
  };

  const abandonTask = async (task: Task): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
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
        const errorData = await response.json() as { error?: string };
        console.error('Error deleting task:', errorData.error);
        alert(`Failed to delete task: ${errorData.error || 'Unknown error'}`);
        return false;
      }

      // Mark as processed and refresh tasks
      setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
      setExpiredTaskAlert(null);
      await fetchTasks();
      return true;
    } catch (error: unknown) {
      console.error('Error deleting task:', error);
      alert(`Failed to delete task: ${(error as Error).message}`);
      return false;
    }
  };

  const createTask = async (taskData: {
    taskName: string;
    taskDescription: string;
    taskStartTime: string;
    taskEndTime: string;
    XP: number;
  }) => {
    setIsCreatingTask(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
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
        const result = await response.json() as { success?: boolean; error?: string; task?: any };
        if (result.success || result.task) {
          // Refresh tasks to show the new one
          await fetchTasks();
          setShowCreateTaskModal(false);
          return true;
        } else {
          const errorMsg = result.error || 'Task creation failed';
          console.error('Task creation failed:', errorMsg);
          alert(`Failed to create task: ${errorMsg}`);
          return false;
        }
      } else {
        const error = await response.json() as { error?: string };
        const errorMsg = error.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('Error creating task:', errorMsg);
        alert(`Failed to create task: ${errorMsg}`);
        return false;
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating task:', error);
      alert(`Failed to create task: ${errorMsg}`);
      return false;
    } finally {
      setIsCreatingTask(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    
    // Create placeholder assistant message for streaming
    const assistantMessageId = `msg-${Date.now()}-${Math.random()}`;
    setStreamingMessageId(assistantMessageId);
    setMessages((prev) => [...prev, {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
    }]);

    setIsLoading(true);
    setHasError(false);
    const userInput = input;
    setInput('');

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Use Next.js API route to proxy the request (avoids CORS issues)
      // Session ID is now generated server-side from authenticated user
      // Send timezone header so agent can use it for time calculations
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
      };
      if (userTimezoneRef.current) {
        headers['x-timezone'] = userTimezoneRef.current;
      }

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers,
        body: userInput,
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE format: lines starting with "data: " contain the actual content
        // Split by newlines and process each line
        const lines = buffer.split('\n');
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip empty lines
          if (!trimmedLine) continue;
          
          // Handle SSE data lines
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.substring(6); // Remove "data: " prefix
            
            // Check for [DONE] marker
            if (data.trim() === '[DONE]') {
              continue;
            }
            
            // Try to parse as JSON (for metadata or structured data)
            if (data.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(data);
                
                // Skip pure metadata JSON
                if (parsed.mcp || (parsed.usage && !parsed.response && !parsed.content)) {
                  continue;
                }
                
                // Extract text from JSON if it has response/content fields
                if (parsed.response) {
                  setMessages((prev) => {
                    return prev.map((msg) => 
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + parsed.response }
                        : msg
                    );
                  });
                } else if (parsed.content) {
                  setMessages((prev) => {
                    return prev.map((msg) => 
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + parsed.content }
                        : msg
                    );
                  });
                } else if (parsed.type === 'metadata' && parsed.tasks) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === assistantMessageId) {
                      lastMessage.tasks = parsed.tasks;
                    }
                    return updated;
                  });
                  if (parsed.tasks && parsed.tasks.length > 0) {
                    setTasks((prev) => {
                      const taskMap = new Map<string, Task>();
                      prev.forEach(task => taskMap.set(task.id, task));
                      parsed.tasks.forEach((newTask: Task) => {
                        if (newTask.id && newTask.name) {
                          taskMap.set(newTask.id, newTask);
                        }
                      });
                      return Array.from(taskMap.values());
                    });
                    setTimeout(() => {
                      fetchTasks();
                    }, 1000);
                  }
                }
                continue;
              } catch {
                // Not valid JSON, treat as text
              }
            }
            
            // It's plain text data, append it
            if (data) {
              setMessages((prev) => {
                return prev.map((msg) => 
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + data }
                    : msg
                );
              });
            }
          } else if (trimmedLine !== '[DONE]') {
            // Handle lines that don't start with "data: " (might be continuation or malformed)
            // Only process if it's not the [DONE] marker
            setMessages((prev) => {
              return prev.map((msg) => 
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + trimmedLine }
                  : msg
              );
            });
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const trimmedBuffer = buffer.trim();
        
        if (trimmedBuffer === '[DONE]') {
          // Stream is complete
        } else if (trimmedBuffer.startsWith('data: ')) {
          const data = trimmedBuffer.substring(6);
          if (data && data !== '[DONE]') {
            // Try to parse as JSON for metadata
            if (data.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'metadata' && parsed.tasks) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === assistantMessageId) {
                      lastMessage.tasks = parsed.tasks;
                    }
                    return updated;
                  });
                  if (parsed.tasks && parsed.tasks.length > 0) {
                    setTasks((prev) => {
                      const taskMap = new Map<string, Task>();
                      prev.forEach(task => taskMap.set(task.id, task));
                      parsed.tasks.forEach((newTask: Task) => {
                        if (newTask.id && newTask.name) {
                          taskMap.set(newTask.id, newTask);
                        }
                      });
                      return Array.from(taskMap.values());
                    });
                    setTimeout(() => {
                      fetchTasks();
                    }, 1000);
                  }
                  setStreamingMessageId(null);
                  return;
                }
              } catch {
                // Not valid JSON, treat as text
              }
            }
            // Treat as text content
            setMessages((prev) => {
              return prev.map((msg) => 
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + data }
                  : msg
              );
            });
          }
        } else if (trimmedBuffer !== '[DONE]') {
          // Treat as plain text if not [DONE]
          setMessages((prev) => {
            return prev.map((msg) => 
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + trimmedBuffer }
                : msg
            );
          });
        }
      }

      setStreamingMessageId(null);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      console.error('Error sending message:', error);
      setHasError(true);
      
      // Update assistant message with error
      setMessages((prev) => {
        return prev.map((msg) => 
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + '\n\n[Error: Failed to get response from agent]' }
            : msg
        );
      });
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTaskStatus = (task: Task) => {
    const now = new Date();
    const start = new Date(task.startTime);
    const end = new Date(task.endTime);
    
    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'active';
    return 'expired';
  };

  const activeTasks = tasks.filter(t => getTaskStatus(t) === 'active');
  const upcomingTasks = tasks.filter(t => getTaskStatus(t) === 'upcoming');
  // Don't show expired tasks - they will be auto-deleted
  // const expiredTasks = tasks.filter(t => getTaskStatus(t) === 'expired');


  // Detect when tasks expire and show alert - check frequently for immediate response
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
        // Show alert for the first newly expired task
        setExpiredTaskAlert(newlyExpired[0]);
      }
    };

    // Check immediately
    checkExpiredTasks();

    // Then check every second for immediate expiration detection
    const interval = setInterval(checkExpiredTasks, 1000);

    return () => clearInterval(interval);
  }, [tasks, processedExpiredTasks, expiredTaskAlert, session]);

  // Auto-delete expired tasks that have been expired for more than 5 minutes
  useEffect(() => {
    if (!session || tasks.length === 0) return;

    const autoDeleteExpiredTasks = async () => {
      const now = new Date();
      const expiredThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      const tasksToDelete = tasks.filter(task => {
        const end = new Date(task.endTime);
        const expiredFor = now.getTime() - end.getTime();
        return expiredFor > expiredThreshold;
      });

      if (tasksToDelete.length > 0) {
        // Delete all old expired tasks
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
            
            // Mark as processed so we don't show alerts for them
            setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
          } catch (error) {
            console.error('Error auto-deleting expired task:', error);
          }
        }
        
        // Refresh tasks after deletion
        await fetchTasks();
      }
    };

    // Run immediately, then every minute
    autoDeleteExpiredTasks();
    const interval = setInterval(autoDeleteExpiredTasks, 60000); // Every minute

    return () => clearInterval(interval);
  }, [tasks, session]);

  // Show login screen if not authenticated
  if (status === 'loading') {
    return (
      <div className="flex h-screen bg-black items-center justify-center p-4">
        <div className="text-orange-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen bg-black items-center justify-center p-4">
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-orange-600 mb-2">
              QuestMaster
            </h1>
            <p className="text-orange-400">
              Enter the realm of productivity
            </p>
          </div>
          
          <button
            onClick={() => signIn('github')}
            className="w-full bg-orange-900 hover:bg-orange-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors border border-orange-800 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>
        </div>
      </div>
    );
  }

	return (
    <div className="flex h-screen bg-black">
      {/* Task Dashboard Sidebar */}
      {showDashboard && (
        <div className="w-80 bg-gray-950 border-r border-orange-900 flex flex-col h-full">
          <header className="bg-black border-b border-orange-900 px-4 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-orange-600">
                Quest Log
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTasks}
                  disabled={isLoadingTasks}
                  className="text-orange-500 hover:text-orange-400 disabled:opacity-50 p-2 rounded hover:bg-gray-900 transition-colors"
                  title={isLoadingTasks ? 'Refreshing...' : 'Refresh tasks'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowDashboard(false)}
                  className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-900 transition-colors"
                  title="Close Quest Log"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center text-orange-500 mt-8">
                <p className="text-sm">No quests yet.</p>
                <p className="text-xs mt-1">Ask the agent to create a task!</p>
              </div>
            ) : (
              <>
                {activeTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-orange-500 mb-2 uppercase tracking-wide">
                      Active Quests ({activeTasks.length})
                    </h3>
                    {activeTasks.map((task) => (
                      <TaskCard key={task.id} task={task} status="active" formatDate={formatDate} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                )}
                
                {upcomingTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-orange-400 mb-2 uppercase tracking-wide">
                      Upcoming ({upcomingTasks.length})
                    </h3>
                    {upcomingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} status="upcoming" formatDate={formatDate} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* New Quest Button - Fixed at bottom right */}
          <div className="bg-black border-t border-orange-900 px-4 py-3 flex justify-end items-center min-h-[76px]">
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="bg-orange-900 hover:bg-orange-800 text-orange-100 p-2 rounded-full border border-orange-800 transition-colors shadow-lg hover:shadow-xl hover:scale-105"
              title="Create New Quest"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950 h-full">
        {/* Header */}
        <header className="bg-black border-b border-orange-900 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!showDashboard && (
                <button
                  onClick={() => setShowDashboard(true)}
                  className="p-2 text-orange-500 hover:text-orange-400 hover:bg-gray-950 rounded"
                  title="Show Quest Log"
                >
                  <ScrollText className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-xl font-bold text-orange-600">
                QuestMaster
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/about"
                className="text-sm text-orange-500 hover:text-orange-400 px-3 py-1 rounded hover:bg-gray-950 transition-colors"
              >
                About
              </Link>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  hasError ? 'bg-red-500' : 
                  isLoading ? 'bg-yellow-500' : 
                  'bg-green-500'
                }`} />
                <span className="text-sm text-orange-400">
                  {hasError ? 'Error' : isLoading ? 'Processing...' : 'Ready'}
                </span>
              </div>
              <Link
                href="/account"
                className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-950 transition-colors"
                title="Account"
              >
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={() => signOut()}
                className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-950 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-orange-500 mt-12">
            <p className="text-lg mb-2">Welcome to QuestMaster!</p>
            <p className="text-sm">Start a conversation to begin managing your quests.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-orange-900 text-orange-50 border border-orange-800'
                  : 'bg-gray-950 text-orange-100 border border-orange-900'
              }`}
            >
              <div className="wrap-break-word text-sm leading-relaxed">
                {message.content ? (
                  <>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {streamingMessageId === message.id && (
                      <span className="inline-block w-2 h-4 ml-1 bg-orange-500 animate-pulse" />
                    )}
                  </>
                ) : (
                  <span className="text-orange-500 italic">Thinking...</span>
                )}
              </div>
              <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-orange-200' : 'text-orange-500'}`}>
                {formatTime(message.timestamp)}
              </div>
              
              {/* Task Metadata */}
              {message.tasks && message.tasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-orange-900">
                  <div className="text-xs font-semibold mb-2 text-orange-400">
                    Quests Created:
                  </div>
                  {message.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="mb-2 p-2 bg-black border border-orange-900 rounded text-sm"
                    >
                      <div className="font-semibold text-orange-300">{task.name}</div>
                      <div className="text-orange-400 mt-1">{task.description}</div>
                      <div className="flex gap-4 mt-2 text-xs text-orange-500">
                        <span>Start: {formatDate(task.startTime)}</span>
                        <span>End: {formatDate(task.endTime)}</span>
                        <span className="font-semibold">XP: {task.XP}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-black border-t border-orange-900 px-4 py-3 min-h-[76px] flex items-center">
        <div className="flex gap-2 w-full">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "Processing..." : "Type your message..."}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-orange-900 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-700 bg-gray-950 text-orange-200 placeholder-orange-800 disabled:opacity-50"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '120px' }}
            maxLength={10000}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-orange-900 text-white rounded-lg hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed border border-orange-800 self-center transition-colors"
            title={isLoading ? "Sending..." : "Send message"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: 'rotate(90deg)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      </div>
      
      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} formatDate={formatDate} />
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <CreateTaskModal
          onClose={() => setShowCreateTaskModal(false)}
          onCreate={createTask}
          isCreating={isCreatingTask}
        />
      )}

      {/* Expiration Alert Modal */}
      {expiredTaskAlert && (
        <ExpirationAlertModal
          task={expiredTaskAlert}
          onExtend={() => extendTask(expiredTaskAlert)}
          onFinish={() => finishTask(expiredTaskAlert)}
          onAbandon={() => abandonTask(expiredTaskAlert)}
          onClose={async () => {
            // When dismissed without action, delete the task immediately
            const taskId = expiredTaskAlert.id;
            setProcessedExpiredTasks(prev => new Set(prev).add(taskId));
            setExpiredTaskAlert(null);
            
            // Delete the task immediately
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
                    taskId,
                  },
                }),
              });
              
              await fetchTasks();
            } catch (error) {
              console.error('Error deleting dismissed task:', error);
            }
          }}
        />
      )}

      {/* Level Up Alert Modal */}
      {levelUpAlert && (
        <LevelUpModal
          newLevel={levelUpAlert}
          onClose={() => setLevelUpAlert(null)}
        />
      )}
    </div>
  );
}

// Level Up Modal Component
function LevelUpModal({ newLevel, onClose }: { newLevel: number; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gradient-to-br from-orange-900 via-orange-950 to-black border-4 border-orange-700 rounded-lg max-w-md w-full shadow-2xl animate-pulse">
        <div className="p-8 text-center">
          <div className="mb-6">
            <div className="inline-block px-8 py-4 bg-gradient-to-br from-orange-600 to-orange-800 rounded-full border-4 border-orange-500 shadow-lg mb-4">
              <div className="text-6xl font-bold text-orange-100">{newLevel}</div>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold text-orange-400 mb-4">
            LEVEL UP!
          </h2>
          
          <p className="text-orange-200 text-lg mb-6">
            Congratulations, brave adventurer!
          </p>
          
          <p className="text-orange-300 mb-8">
            You have reached <span className="font-bold text-orange-400">Level {newLevel}</span>!
          </p>
          
          <p className="text-orange-200 text-sm mb-6 italic">
            "With each level gained, new powers and legendary equipment await those who prove their worth."
          </p>
          
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 transition-colors border-2 border-orange-600 font-semibold text-lg shadow-lg"
          >
            Continue Your Journey
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Task Modal Component
function CreateTaskModal({ 
  onClose, 
  onCreate, 
  isCreating 
}: { 
  onClose: () => void; 
  onCreate: (taskData: { taskName: string; taskDescription: string; taskStartTime: string; taskEndTime: string; XP: number }) => Promise<boolean>;
  isCreating: boolean;
}) {
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskEndTime, setTaskEndTime] = useState('');
  const [XP, setXP] = useState(50);
  const [error, setError] = useState('');

  // Set default times (1 hour from now, 2 hours from now)
  useEffect(() => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    setTaskStartTime(startTime.toISOString().slice(0, 16)); // Format for datetime-local input
    setTaskEndTime(endTime.toISOString().slice(0, 16));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!taskName || !taskDescription || !taskStartTime || !taskEndTime) {
      setError('Please fill in all fields');
      return;
    }

    const startDate = new Date(taskStartTime);
    const endDate = new Date(taskEndTime);

    if (endDate <= startDate) {
      setError('End time must be after start time');
      return;
    }

    if (startDate <= new Date()) {
      setError('Start time must be in the future');
      return;
    }

    const success = await onCreate({
      taskName,
      taskDescription,
      taskStartTime: startDate.toISOString(),
      taskEndTime: endDate.toISOString(),
      XP,
    });

    if (!success) {
      setError('Failed to create task. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-950 border-2 border-orange-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-orange-600">Create New Quest</h2>
            <button
              onClick={onClose}
              className="text-orange-500 hover:text-orange-400"
              disabled={isCreating}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-orange-500 mb-1">
                Quest Name *
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                placeholder="Enter quest name"
                required
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-orange-500 mb-1">
                Quest Description *
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700 min-h-[100px]"
                placeholder="Describe your quest..."
                required
                disabled={isCreating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-orange-500 mb-1">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={taskStartTime}
                  onChange={(e) => setTaskStartTime(e.target.value)}
                  className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                  required
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-orange-500 mb-1">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  value={taskEndTime}
                  onChange={(e) => setTaskEndTime(e.target.value)}
                  className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                  required
                  disabled={isCreating}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-orange-500 mb-1">
                XP Reward
              </label>
              <input
                type="number"
                value={XP}
                onChange={(e) => setXP(Number(e.target.value))}
                className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                min="1"
                required
                disabled={isCreating}
              />
				</div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isCreating}
                className="flex-1 bg-orange-900 hover:bg-orange-800 text-orange-100 font-semibold py-2 px-4 rounded border border-orange-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Quest'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="px-4 py-2 text-orange-500 hover:text-orange-400 border border-orange-900 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Task Card Component
function TaskCard({ task, status, formatDate, onClick }: { task: Task; status: string; formatDate: (date: string) => string; onClick: () => void }) {
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [isTimeCritical, setIsTimeCritical] = useState<boolean>(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      if (status === 'active') {
        // Time remaining until end
        const remaining = end.getTime() - now.getTime();
        if (remaining <= 0) {
          setTimeDisplay('Expired');
          setIsTimeCritical(false);
        } else {
          setTimeDisplay(formatTimeRemaining(remaining));
          
          // Calculate percentage of time elapsed
          const totalDuration = end.getTime() - start.getTime();
          const elapsed = now.getTime() - start.getTime();
          const percentageElapsed = (elapsed / totalDuration) * 100;
          
          // Turn red when 95% or more of time has elapsed
          setIsTimeCritical(percentageElapsed >= 95);
        }
      } else if (status === 'upcoming') {
        // Time until start
        const untilStart = start.getTime() - now.getTime();
        if (untilStart <= 0) {
          setTimeDisplay('Starting now');
        } else {
          setTimeDisplay(`Starts in ${formatTimeRemaining(untilStart)}`);
        }
        setIsTimeCritical(false);
      } else if (status === 'expired') {
        // Time since expiration
        const expired = now.getTime() - end.getTime();
        setTimeDisplay(`Expired ${formatTimeElapsed(expired)} ago`);
        setIsTimeCritical(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(interval);
  }, [task.startTime, task.endTime, status]);

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimeElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const statusColors = {
    active: 'border-orange-700 bg-orange-950/30',
    upcoming: 'border-orange-800 bg-orange-950/20',
    expired: 'border-gray-800 bg-gray-950/50 opacity-60',
  };

  const getTimerColor = () => {
    if (status === 'expired') return 'text-gray-500';
    if (status === 'upcoming') return 'text-orange-300';
    if (status === 'active') {
      return isTimeCritical ? 'text-red-500' : 'text-orange-400';
    }
    return 'text-orange-400';
  };

  return (
    <div 
      className={`mb-3 p-3 rounded-lg border-2 ${statusColors[status as keyof typeof statusColors]} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-sm text-orange-400">{task.name}</h4>
        <span className="text-xs font-bold text-orange-500 ml-2">
          {task.XP} XP
        </span>
      </div>
      <p className="text-xs text-orange-300 mb-2 line-clamp-2">
        {task.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 text-xs text-orange-500">
          <div className="flex items-center gap-1">
            <span className="font-medium">Start:</span>
            <span>{formatDate(task.startTime)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">End:</span>
            <span>{formatDate(task.endTime)}</span>
          </div>
        </div>
        {timeDisplay && (
          <div className={`text-xs font-semibold ${getTimerColor()}`}>
            {timeDisplay}
          </div>
        )}
      </div>
		</div>
	);
}

function TaskDetailModal({ task, onClose, formatDate }: { task: Task; onClose: () => void; formatDate: (date: string) => string }) {
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isTimeCritical, setIsTimeCritical] = useState<boolean>(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      let currentStatus: string;
      if (end < now) {
        currentStatus = 'expired';
        const expired = now.getTime() - end.getTime();
        setTimeDisplay(`Expired ${formatTimeElapsed(expired)} ago`);
        setIsTimeCritical(false);
      } else if (start > now) {
        currentStatus = 'upcoming';
        const untilStart = start.getTime() - now.getTime();
        setTimeDisplay(`Starts in ${formatTimeRemaining(untilStart)}`);
        setIsTimeCritical(false);
      } else {
        currentStatus = 'active';
        const remaining = end.getTime() - now.getTime();
        setTimeDisplay(formatTimeRemaining(remaining));
        
        // Calculate percentage of time elapsed
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        const percentageElapsed = (elapsed / totalDuration) * 100;
        
        // Turn red when 5% or more of time has elapsed
        setIsTimeCritical(percentageElapsed >= 5);
      }
      setStatus(currentStatus);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [task.startTime, task.endTime]);

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimeElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const getTimerColor = () => {
    if (status === 'expired') return 'text-gray-500';
    if (status === 'upcoming') return 'text-orange-300';
    if (status === 'active') {
      return isTimeCritical ? 'text-red-500' : 'text-orange-400';
    }
    return 'text-orange-400';
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-950 border-2 border-orange-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-orange-600">{task.name}</h2>
            <button
              onClick={onClose}
              className="text-orange-500 hover:text-orange-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-orange-900 text-orange-200 border border-orange-800">
              {task.XP} XP
            </div>
            {timeDisplay && (
              <div className={`text-lg font-bold ${getTimerColor()}`}>
                {timeDisplay}
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-orange-500 mb-2">Quest Description</h3>
            <p className="text-orange-200 whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-orange-900">
            <div>
              <h4 className="text-xs font-semibold text-orange-500 mb-1 uppercase tracking-wide">Start Time</h4>
              <p className="text-sm text-orange-300">{formatDate(task.startTime)}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-orange-500 mb-1 uppercase tracking-wide">End Time</h4>
              <p className="text-sm text-orange-300">{formatDate(task.endTime)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpirationAlertModal({ task, onExtend, onFinish, onAbandon, onClose }: { task: Task; onExtend: () => Promise<boolean>; onFinish: () => Promise<boolean>; onAbandon: () => Promise<boolean>; onClose: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExtend = async () => {
    setIsProcessing(true);
    await onExtend();
    setIsProcessing(false);
  };

  const handleFinish = async () => {
    setIsProcessing(true);
    await onFinish();
    setIsProcessing(false);
  };

  const handleAbandon = async () => {
    setIsProcessing(true);
    await onAbandon();
    setIsProcessing(false);
  };

  // Calculate 10% extension time for display
  const start = new Date(task.startTime);
  const end = new Date(task.endTime);
  const originalDuration = end.getTime() - start.getTime();
  const extension = originalDuration * 0.1;
  const extensionHours = Math.floor(extension / (1000 * 60 * 60));
  const extensionMinutes = Math.floor((extension % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-950 border-2 border-orange-900 rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-orange-600">Quest Expired!</h2>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="text-orange-500 hover:text-orange-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="mb-6">
            <p className="text-orange-200 mb-4">
              Your quest <span className="font-semibold text-orange-400">"{task.name}"</span> has expired.
            </p>
            <p className="text-orange-300 text-sm mb-4">
              Did you complete this quest?
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleExtend}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-orange-600 font-semibold"
            >
              {isProcessing ? 'Processing...' : `Extend by ${extensionHours}h ${extensionMinutes}m (10% bonus)`}
            </button>
            <button
              onClick={handleFinish}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-green-600 font-semibold"
            >
              {isProcessing ? 'Processing...' : `Finish Quest (${task.XP} XP earned!)`}
            </button>
            <button
              onClick={handleAbandon}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-gray-800 text-orange-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-700 font-semibold"
            >
              {isProcessing ? 'Processing...' : 'Abandon Quest'}
            </button>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-orange-400 hover:text-orange-300 text-sm transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
		</div>
	);
}
