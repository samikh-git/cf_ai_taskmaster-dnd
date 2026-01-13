'use client';

import { useState, useEffect, useRef } from 'react';

const AGENT_URL = 'http://localhost:8787/agents/task-master-agent/';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showDashboard, setShowDashboard] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize session ID synchronously from localStorage
  const getSessionId = (): string => {
    if (typeof window === 'undefined') {
      return `session-${Date.now()}`;
    }
    let storedSessionId = localStorage.getItem('agent-session-id');
    if (!storedSessionId) {
      storedSessionId = `session-${Date.now()}`;
      localStorage.setItem('agent-session-id', storedSessionId);
      console.log('Created new session ID:', storedSessionId);
    } else {
      console.log('Loaded existing session ID:', storedSessionId);
    }
    return storedSessionId;
  };
  
  const sessionIdRef = useRef<string>(getSessionId());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch tasks from agent state (source of truth)
  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      const sessionId = sessionIdRef.current;
      console.log('Fetching tasks from agent state, session:', sessionId);
      const response = await fetch('/api/tasks', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      
      if (response.ok) {
        const data = await response.json() as { tasks?: Task[] };
        if (data.tasks) {
          console.log('Fetched tasks from agent state:', data.tasks.length);
          // Always use agent state as source of truth - replace completely
          setTasks(data.tasks);
        } else {
          console.log('No tasks in response, setting empty array');
          setTasks([]);
        }
      } else {
        console.error('Failed to fetch tasks:', response.status, response.statusText);
        // On error, preserve existing tasks
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // On error, preserve existing tasks
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Refresh tasks every 30 seconds
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  // Debug: Log when tasks change
  useEffect(() => {
    console.log('Tasks state changed. Count:', tasks.length);
    if (tasks.length > 0) {
      console.log('Tasks in state:', tasks);
    }
  }, [tasks]);

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
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'x-session-id': sessionIdRef.current,
        },
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
                  // Handle task metadata
                  console.log('=== TASK METADATA RECEIVED ===');
                  console.log('Tasks:', parsed.tasks);
                  console.log('Task count:', parsed.tasks.length);
                  
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === assistantMessageId) {
                      lastMessage.tasks = parsed.tasks;
                    }
                    return updated;
                  });
                  // When we receive task metadata, fetch from agent state after a delay
                  // This ensures we get the authoritative state from the Durable Object
                  if (parsed.tasks && parsed.tasks.length > 0) {
                    console.log('Received task metadata:', parsed.tasks.length, 'task(s)');
                    console.log('Task details:', parsed.tasks);
                    // Optimistically update UI with metadata
                    setTasks((prev) => {
                      const taskMap = new Map<string, Task>();
                      // Add existing tasks
                      prev.forEach(task => taskMap.set(task.id, task));
                      // Add/update with new tasks from metadata
                      parsed.tasks.forEach((newTask: Task) => {
                        if (newTask.id && newTask.name) {
                          taskMap.set(newTask.id, newTask);
                        }
                      });
                      return Array.from(taskMap.values());
                    });
                    // Fetch from agent state after delay to ensure consistency
                    setTimeout(() => {
                      console.log('Fetching tasks from agent state after metadata...');
                      fetchTasks();
                    }, 1000);
                  } else {
                    console.log('No tasks in metadata');
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
        
        // Skip [DONE] marker
        if (trimmedBuffer === '[DONE]') {
          // Stream is complete
          console.log('Stream complete');
        } else if (trimmedBuffer.startsWith('data: ')) {
          const data = trimmedBuffer.substring(6);
          if (data && data !== '[DONE]') {
            // Try to parse as JSON for metadata
            if (data.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'metadata' && parsed.tasks) {
                  console.log('=== TASK METADATA IN BUFFER ===');
                  console.log('Tasks:', parsed.tasks);
                  // Handle task metadata
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === assistantMessageId) {
                      lastMessage.tasks = parsed.tasks;
                    }
                    return updated;
                  });
                  // When we receive task metadata in buffer, fetch from agent state
                  if (parsed.tasks && parsed.tasks.length > 0) {
                    console.log('Received task metadata in buffer:', parsed.tasks.length, 'task(s)');
                    // Optimistically update UI
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
                    // Fetch from agent state after delay
                    setTimeout(() => {
                      console.log('Fetching tasks from agent state after buffer metadata...');
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
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      
      console.error('Error sending message:', error);
      
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
  const expiredTasks = tasks.filter(t => getTaskStatus(t) === 'expired');

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Task Dashboard Sidebar */}
      {showDashboard && (
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Quest Log
              </h2>
              <button
                onClick={() => setShowDashboard(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={fetchTasks}
              disabled={isLoadingTasks}
              className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {isLoadingTasks ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <p className="text-sm">No quests yet.</p>
                <p className="text-xs mt-1">Ask the agent to create a task!</p>
              </div>
            ) : (
              <>
                {activeTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 uppercase tracking-wide">
                      Active Quests ({activeTasks.length})
                    </h3>
                    {activeTasks.map((task) => (
                      <TaskCard key={task.id} task={task} status="active" formatDate={formatDate} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                )}
                
                {upcomingTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
                      Upcoming ({upcomingTasks.length})
                    </h3>
                    {upcomingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} status="upcoming" formatDate={formatDate} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                )}
                
                {expiredTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Expired ({expiredTasks.length})
                    </h3>
                    {expiredTasks.map((task) => (
                      <TaskCard key={task.id} task={task} status="expired" formatDate={formatDate} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!showDashboard && (
                <button
                  onClick={() => setShowDashboard(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Show Quest Log"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                TaskMaster D&D Agent
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isLoading ? 'Processing...' : 'Ready'}
              </span>
            </div>
          </div>
        </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <p className="text-lg mb-2">Welcome to TaskMaster D&D Agent!</p>
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
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="wrap-break-word text-sm leading-relaxed">
                {message.content ? (
                  <>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {streamingMessageId === message.id && (
                      <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                    )}
                  </>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">Thinking...</span>
                )}
              </div>
              <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                {formatTime(message.timestamp)}
              </div>
              
              {/* Task Metadata */}
              {message.tasks && message.tasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Quests Created:
                  </div>
                  {message.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{task.name}</div>
                      <div className="text-gray-600 dark:text-gray-300 mt-1">{task.description}</div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
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
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "Processing..." : "Type your message..."}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '120px' }}
            maxLength={10000}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Send
          </button>
        </div>
      </div>
      </div>
      
      {/* Task Detail Modal */}
      {selectedTask && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedTask(null);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedTask.name}</h2>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <div className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {selectedTask.XP} XP
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quest Description</h3>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Start Time</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedTask.startTime)}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">End Time</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedTask.endTime)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({ task, status, formatDate, onClick }: { task: Task; status: string; formatDate: (date: string) => string; onClick: () => void }) {
  const statusColors = {
    active: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    upcoming: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    expired: 'border-gray-300 bg-gray-50 dark:bg-gray-700/50 opacity-60',
  };

  return (
    <div 
      className={`mb-3 p-3 rounded-lg border-2 ${statusColors[status as keyof typeof statusColors]} dark:border-opacity-50 cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{task.name}</h4>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 ml-2">
          {task.XP} XP
        </span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
        {task.description}
      </p>
      <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <span className="font-medium">Start:</span>
          <span>{formatDate(task.startTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">End:</span>
          <span>{formatDate(task.endTime)}</span>
        </div>
      </div>
    </div>
  );
}
