import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Task } from '@/types';
import { validateChatInput } from '@/utils/validation';

export interface UseChatOptions {
  onOptimisticTasks?: (tasks: Task[]) => void;
}

export function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (message: string, userTimezone: string | null, fetchTasks: () => Promise<void>) => {
    // Reset validation error
    setValidationError(null);
    
    // Validate input before sending
    const validation = validateChatInput(message);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid input');
      return;
    }
    
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      content: message,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setHasError(false);

    const assistantMessageId = `msg-${Date.now()}-${Math.random()}`;
    setStreamingMessageId(assistantMessageId);
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
    }]);

    abortControllerRef.current = new AbortController();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
      };
      if (userTimezone) {
        headers['x-timezone'] = userTimezone;
      }

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers,
        body: message,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        // Handle validation errors from backend
        if (response.status === 400) {
          try {
            const errorData = await response.json() as { error?: string };
            const errorMessage = errorData.error || 'Invalid input. Please check your message.';
            setValidationError(errorMessage);
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: msg.content + `\n\n[Error: ${errorData.error || 'Invalid input'}]` }
                : msg
            ));
            return;
          } catch {
            // If JSON parsing fails, use generic error
          }
        }
        
        if (!response.body) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const json = JSON.parse(data);
              if (json.type === 'metadata' && json.tasks) {
                // Optimistically add tasks immediately
                if (options?.onOptimisticTasks && Array.isArray(json.tasks)) {
                  options.onOptimisticTasks(json.tasks);
                }
                // Still sync with server after a short delay
                setTimeout(() => {
                  fetchTasks();
                }, 1000);
              }
            } catch {
              if (data.trim()) {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: msg.content + data }
                    : msg
                ));
              }
            }
          }
        }
      }

      if (buffer.trim() && !buffer.startsWith('data: ')) {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: msg.content + buffer }
            : msg
        ));
      }

      setStreamingMessageId(null);
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.error('Error sending message:', error);
      setHasError(true);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: msg.content + '\n\n[Error: Failed to send message. Please try again.]' }
          : msg
      ));
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }, [isLoading, options]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    hasError,
    validationError,
    streamingMessageId,
    messagesEndRef,
    sendMessage,
    abortControllerRef,
  };
}

