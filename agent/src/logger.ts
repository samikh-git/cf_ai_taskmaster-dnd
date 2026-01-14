type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private enabled: boolean;
  private level: LogLevel;

  constructor(enabled: boolean = true, level: LogLevel = 'info') {
    this.enabled = enabled;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  // Convenience methods for common patterns
  request(method: string, path: string, details?: any): void {
    this.info(`[${method}] ${path}`, details || '');
  }

  toolCall(toolName: string, params?: any): void {
    this.debug(`Tool: ${toolName}`, params || '');
  }

  taskOperation(operation: string, count: number, details?: any): void {
    this.info(`Tasks: ${operation} (${count})`, details || '');
  }
}

export const logger = new Logger(true, 'info');

