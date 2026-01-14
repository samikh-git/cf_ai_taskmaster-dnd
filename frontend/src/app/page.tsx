'use client';

import { useState, useEffect, useRef } from 'react';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
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

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      const sessionId = sessionIdRef.current;
      const response = await fetch('/api/tasks', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      
      if (response.ok) {
        const data = await response.json() as { tasks?: Task[] };
        if (data.tasks) {
          setTasks(data.tasks);
        } else {
          setTasks([]);
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStatus = localStorage.getItem('taskmaster-auth');
      setIsAuthenticated(authStatus === 'true');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
      // Refresh tasks every 30 seconds
      const interval = setInterval(fetchTasks, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);


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

  // Handle login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    // Simple authentication - for demo purposes
    // In production, you'd verify against a backend/Cloudflare Access
    if (username && password) {
      // For now, accept any username/password (you can add validation)
      localStorage.setItem('taskmaster-auth', 'true');
      localStorage.setItem('taskmaster-username', username);
      setIsAuthenticated(true);
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Please enter both username and password');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('taskmaster-auth');
    localStorage.removeItem('taskmaster-username');
    setIsAuthenticated(false);
    setMessages([]);
    setTasks([]);
  };

  // Show login screen if not authenticated
  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-black items-center justify-center p-4">
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-orange-600 mb-2">
              TaskMaster D&D
            </h1>
            <p className="text-orange-400">
              Enter the realm of productivity
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-orange-400 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-orange-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-700 bg-black text-orange-200 placeholder-orange-800"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-orange-400 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-orange-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-700 bg-black text-orange-200 placeholder-orange-800"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            
            {loginError && (
              <div className="text-red-400 text-sm text-center">
                {loginError}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-orange-900 hover:bg-orange-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors border border-orange-800"
            >
              Enter Realm
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-orange-600">
            <p>Demo mode: Any username/password will work</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black">
      {/* Task Dashboard Sidebar */}
      {showDashboard && (
        <div className="w-80 bg-gray-950 border-r border-orange-900 flex flex-col">
          <div className="p-4 border-b border-orange-900">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-orange-600">
                Quest Log
              </h2>
              <button
                onClick={() => setShowDashboard(false)}
                className="text-orange-500 hover:text-orange-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={fetchTasks}
              disabled={isLoadingTasks}
              className="text-xs text-orange-500 hover:text-orange-400 disabled:opacity-50"
            >
              {isLoadingTasks ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
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
                
                {expiredTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
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
      <div className="flex-1 flex flex-col bg-gray-950">
        {/* Header */}
        <header className="bg-black border-b border-orange-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!showDashboard && (
                <button
                  onClick={() => setShowDashboard(true)}
                  className="p-2 text-orange-500 hover:text-orange-400 hover:bg-gray-950 rounded"
                  title="Show Quest Log"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl font-bold text-orange-600">
                TaskMaster D&D Agent
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-orange-500'}`} />
                <span className="text-sm text-orange-400">
                  {isLoading ? 'Processing...' : 'Ready'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-orange-500 hover:text-orange-400 px-3 py-1 rounded hover:bg-gray-950 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-orange-500 mt-12">
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
      <div className="bg-black border-t border-orange-900 px-4 py-3">
        <div className="flex gap-2">
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
            className="px-6 py-2 bg-orange-900 text-white rounded-lg hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium border border-orange-800"
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
          <div className="bg-gray-950 border-2 border-orange-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold text-orange-600">{selectedTask.name}</h2>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-orange-500 hover:text-orange-400"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <div className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-orange-900 text-orange-200 border border-orange-800">
                  {selectedTask.XP} XP
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-orange-500 mb-2">Quest Description</h3>
                <p className="text-orange-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-orange-900">
                <div>
                  <h4 className="text-xs font-semibold text-orange-500 mb-1 uppercase tracking-wide">Start Time</h4>
                  <p className="text-sm text-orange-300">{formatDate(selectedTask.startTime)}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-orange-500 mb-1 uppercase tracking-wide">End Time</h4>
                  <p className="text-sm text-orange-300">{formatDate(selectedTask.endTime)}</p>
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
    active: 'border-orange-700 bg-orange-950/30',
    upcoming: 'border-orange-800 bg-orange-950/20',
    expired: 'border-gray-800 bg-gray-950/50 opacity-60',
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
    </div>
  );
}
