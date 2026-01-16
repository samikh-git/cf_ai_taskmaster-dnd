'use client';

import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { ScrollText, User } from 'lucide-react';
import { Task } from '@/types';
import { XP_PER_LEVEL } from '@/constants';
import { formatDate } from '@/utils/time';
import { TaskDashboard } from '@/components/TaskDashboard';
import { ExpirationAlertModal } from '@/components/ExpirationAlertModal';
import { LevelUpModal } from '@/components/LevelUpModal';
import { MessageSkeleton, PageSkeleton, MainPageSkeleton } from '@/components/Skeletons';

// Lazy load modals for better initial page load performance
const TaskDetailModal = lazy(() => import('@/components/TaskDetailModal'));
import { useTasks } from '@/hooks/useTasks';
import { useChat } from '@/hooks/useChat';
import { useNotifications } from '@/hooks/useNotifications';
import { extendTask, finishTask, abandonTask, createTask } from '@/utils/taskOperations';

export default function Home() {
  const { data: session, status } = useSession();
  const [showDashboard, setShowDashboard] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [levelUpAlert, setLevelUpAlert] = useState<number | null>(null);
  const previousLevelRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);
  const hasProcessedInitialLoadRef = useRef(false);

  const {
    tasks,
    totalXP,
    isLoadingTasks,
    expiredTaskAlert,
    setExpiredTaskAlert,
    setProcessedExpiredTasks,
    fetchTasks,
    userTimezoneRef,
    optimisticallyAddTask,
    optimisticallyUpdateTask,
    optimisticallyDeleteTask,
    optimisticallyUpdateXP,
    rollbackTasks,
    rollbackXP,
  } = useTasks(session);

  // Ensure tasks is always an array to avoid undefined issues
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  
  // Memoize the optimistic tasks callback to avoid recreating it on every render
  // This must be defined before useChat to maintain hook order
  const handleOptimisticTasks = useCallback((tasks: Task[]) => {
    tasks.forEach(task => optimisticallyAddTask(task));
  }, [optimisticallyAddTask]);

  const {
    messages,
    input,
    setInput,
    isLoading,
    hasError,
    streamingMessageId,
    messagesEndRef,
    sendMessage: sendChatMessage,
  } = useChat({
    onOptimisticTasks: handleOptimisticTasks,
  });

  const { notificationPermission, requestPermission } = useNotifications(session, safeTasks);

  useEffect(() => {
    // Skip if still loading tasks (wait for initial data to load)
    if (isLoadingTasks) {
      return;
    }

    // Skip if totalXP is undefined
    if (totalXP === undefined) {
      return;
    }

    const newLevel = Math.floor(totalXP / XP_PER_LEVEL) + 1;
    const oldLevel = previousLevelRef.current;

    // On initial load, we need to wait until we have the real totalXP value
    // (not the initial 0). We'll know it's the real value when:
    // 1. We've finished loading, AND
    // 2. We haven't processed the initial load yet, AND
    // 3. We have a valid totalXP (could be 0 if user has no XP, but that's fine)
    if (isInitialLoadRef.current && !hasProcessedInitialLoadRef.current) {
      // Set the level silently on first load - this is the baseline
      previousLevelRef.current = newLevel;
      isInitialLoadRef.current = false;
      hasProcessedInitialLoadRef.current = true;
      // Don't update previousLevelRef again here - it's already set
      return;
    }

    // Only show level up if:
    // 1. We've processed the initial load (so we have a baseline)
    // 2. We have a previous level to compare
    // 3. The new level is actually higher than the previous level
    if (hasProcessedInitialLoadRef.current && oldLevel !== null && newLevel > oldLevel) {
      setLevelUpAlert(newLevel);
    }

    // Always update the previous level ref after initial load is processed
    // This ensures we track the current level for future comparisons
    if (hasProcessedInitialLoadRef.current) {
      previousLevelRef.current = newLevel;
    }
  }, [totalXP, isLoadingTasks]);

  const handleSendMessage = async () => {
    await sendChatMessage(input, userTimezoneRef.current || null, fetchTasks);
  };

  const handleExtendTask = async (task: Task) => {
    // Save previous state for rollback
    const previousTasks = [...tasks];

    const success = await extendTask(task, userTimezoneRef.current, {
      onOptimisticUpdate: (updates) => {
        optimisticallyUpdateTask(task.id, updates);
        setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
        setExpiredTaskAlert(null);
      },
      onRollback: () => {
        rollbackTasks(previousTasks);
      },
    });

    if (success) {
      // Sync with server after successful API call
      await fetchTasks();
    }
    return success;
  };

  const handleFinishTask = async (task: Task) => {
    // Save previous state for rollback
    const previousTasks = [...tasks];
    const previousXP = totalXP;

    const success = await finishTask(task, userTimezoneRef.current, {
      onOptimisticDelete: () => {
        optimisticallyDeleteTask(task.id);
        setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
        setExpiredTaskAlert(null);
      },
      onOptimisticXP: (xp) => {
        optimisticallyUpdateXP(xp);
      },
      onRollback: () => {
        rollbackTasks(previousTasks);
      },
      onRollbackXP: () => {
        rollbackXP(previousXP);
      },
    });

    if (success) {
      // Sync with server after successful API call
      await fetchTasks();
    }
    return success;
  };

  const handleAbandonTask = async (task: Task) => {
    // Save previous state for rollback
    const previousTasks = [...tasks];

    const success = await abandonTask(task, userTimezoneRef.current, {
      onOptimisticDelete: () => {
        optimisticallyDeleteTask(task.id);
        setProcessedExpiredTasks(prev => new Set(prev).add(task.id));
        setExpiredTaskAlert(null);
      },
      onRollback: () => {
        rollbackTasks(previousTasks);
      },
    });

    if (success) {
      // Sync with server after successful API call
      await fetchTasks();
    }
    return success;
  };

  const handleCreateTask = async (taskData: {
    taskName: string;
    taskDescription: string;
    taskStartTime: string;
    taskEndTime: string;
    XP: number;
  }) => {
    setIsCreatingTask(true);
    try {
      // Save previous state for rollback
      const previousTasks = [...tasks];

      const success = await createTask(taskData, userTimezoneRef.current, {
        onOptimisticAdd: (task) => {
          optimisticallyAddTask(task);
        },
        onRollback: () => {
          rollbackTasks(previousTasks);
        },
      });

      if (success) {
        // Sync with server after successful API call
        await fetchTasks();
      }
      return success;
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleDismissExpiredTask = async (task: Task) => {
    const taskId = task.id;
    setProcessedExpiredTasks(prev => new Set(prev).add(taskId));
    setExpiredTaskAlert(null);

    try {
      // Save previous state for rollback
      const previousTasks = [...tasks];

      await abandonTask(task, userTimezoneRef.current, {
        onOptimisticDelete: () => {
          optimisticallyDeleteTask(taskId);
        },
        onRollback: () => {
          rollbackTasks(previousTasks);
        },
      });

      // Sync with server after successful API call
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting dismissed task:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (status === 'loading') {
    return <PageSkeleton />;
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

  // Show full page skeleton on initial load when tasks are loading and no data exists
  if (isLoadingTasks && tasks.length === 0 && totalXP === undefined) {
    return <MainPageSkeleton />;
  }

  return (
    <div className="flex h-screen bg-black">
      <TaskDashboard
        tasks={tasks}
        isLoadingTasks={isLoadingTasks}
        onRefresh={fetchTasks}
        onTaskClick={setSelectedTask}
        onCreateTask={handleCreateTask}
        isCreatingTask={isCreatingTask}
        showDashboard={showDashboard}
        onClose={() => setShowDashboard(false)}
      />

      <div className="flex-1 flex flex-col bg-gray-950 h-full">
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
              {typeof window !== 'undefined' && 'Notification' in window && (
                <button
                  onClick={requestPermission}
                  className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-950 transition-colors"
                  title={
                    notificationPermission === 'granted'
                      ? 'Notifications enabled'
                      : notificationPermission === 'denied'
                      ? 'Notifications blocked - click to see instructions'
                      : 'Enable notifications'
                  }
                >
                  {notificationPermission === 'granted' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {/* Show welcome message only when not loading and no messages */}
          {messages.length === 0 && !isLoading && !isLoadingTasks && (
            <div className="text-center text-orange-500 mt-12">
              <p className="text-lg mb-2">Welcome to QuestMaster!</p>
              <p className="text-sm">Start a conversation to begin managing your quests.</p>
            </div>
          )}
          
          {/* Show skeleton when chat is loading (initial or during message send) */}
          {isLoading && messages.length === 0 && <MessageSkeleton />}
          
          {/* Show skeleton during initial tasks load even if we have messages */}
          {isLoadingTasks && tasks.length === 0 && messages.length === 0 && (
            <MessageSkeleton />
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
                    <div className="flex items-center gap-2 text-orange-500">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-orange-200' : 'text-orange-500'}`}>
                  {formatTime(message.timestamp)}
                </div>
                
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

        <div className="bg-black border-t border-orange-900 px-4 py-3 min-h-[76px] flex items-center">
          <div className="flex gap-2 w-full">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isLoading ? "Processing your request..." : "Type your message..."}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-orange-900 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-700 bg-gray-950 text-orange-200 placeholder-orange-800 disabled:opacity-50"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                maxLength={10000}
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
            <button
              onClick={handleSendMessage}
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

      {selectedTask && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-6">
              <div className="text-orange-500">Loading...</div>
            </div>
          </div>
        }>
          <TaskDetailModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            formatDate={formatDate}
          />
        </Suspense>
      )}

      {expiredTaskAlert && (
        <ExpirationAlertModal
          task={expiredTaskAlert}
          onExtend={() => handleExtendTask(expiredTaskAlert)}
          onFinish={() => handleFinishTask(expiredTaskAlert)}
          onAbandon={() => handleAbandonTask(expiredTaskAlert)}
          onClose={() => handleDismissExpiredTask(expiredTaskAlert)}
        />
      )}

      {levelUpAlert && (
        <LevelUpModal
          newLevel={levelUpAlert}
          onClose={() => setLevelUpAlert(null)}
        />
      )}
    </div>
  );
}
