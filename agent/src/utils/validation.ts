import { logger } from '../logger';

export interface InjectionDetectionResult {
  suspicious: boolean;
  confidence: 'low' | 'medium' | 'high';
  patterns: string[];
  reason?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
}

export const VALIDATION_CONFIG = {
  CHAT_MAX_LENGTH: 5000,
  CHAT_MIN_LENGTH: 1,
  TASK_NAME_MAX_LENGTH: 200,
  TASK_NAME_MIN_LENGTH: 1,
  TASK_DESCRIPTION_MAX_LENGTH: 2000,
  TASK_DESCRIPTION_MIN_LENGTH: 1,
  XP_MIN: 1,
  XP_MAX: 10000,
  TASK_MAX_DURATION_DAYS: 365,
  TASK_MIN_DURATION_MINUTES: 1,
} as const;

const INJECTION_PATTERNS = {
  high: [
    { pattern: /ignore\s+(previous|all|all\s+previous)\s+instructions?/i, name: 'ignore_instructions' },
    { pattern: /forget\s+(the\s+)?(rules|instructions|system\s+prompt)/i, name: 'forget_rules' },
    { pattern: /you\s+are\s+now/i, name: 'role_reassignment' },
    { pattern: /act\s+as\s+(if\s+)?you\s+are/i, name: 'role_impersonation' },
    { pattern: /disregard\s+(previous|all|your)\s+(instructions?|rules)/i, name: 'disregard_instructions' },
    { pattern: /override\s+(your|the)\s+(system\s+)?prompt/i, name: 'prompt_override' },
  ],
  medium: [
    { pattern: /pretend\s+(you\s+are|that)/i, name: 'pretend_role' },
    { pattern: /system\s*:/i, name: 'system_prefix' },
    { pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i, name: 'prompt_extraction' },
    { pattern: /what\s+are\s+your\s+instructions?/i, name: 'instruction_inquiry' },
    { pattern: /show\s+me\s+(your|the)\s+(prompt|instructions?)/i, name: 'prompt_request' },
    { pattern: /you\s+must\s+(now|always|never)/i, name: 'command_override' },
    { pattern: /switch\s+(to|roles?)/i, name: 'role_switch' },
  ],
  low: [
    { pattern: /developer\s*:/i, name: 'developer_prefix' },
    { pattern: /assistant\s*:/i, name: 'assistant_prefix' },
    { pattern: /admin\s*:/i, name: 'admin_prefix' },
    { pattern: /\[system\]/i, name: 'system_brackets' },
    { pattern: /&lt;system&gt;/i, name: 'system_html' },
  ],
} as const;

export function detectPromptInjection(input: string): InjectionDetectionResult {
  const foundPatterns: { confidence: 'low' | 'medium' | 'high'; name: string }[] = [];
  
  // Check high confidence patterns
  for (const { pattern, name } of INJECTION_PATTERNS.high) {
    if (pattern.test(input)) {
      foundPatterns.push({ confidence: 'high', name });
    }
  }
  
  // Check medium confidence patterns
  for (const { pattern, name } of INJECTION_PATTERNS.medium) {
    if (pattern.test(input)) {
      foundPatterns.push({ confidence: 'medium', name });
    }
  }
  
  // Check low confidence patterns (only if no high/medium found)
  if (foundPatterns.length === 0) {
    for (const { pattern, name } of INJECTION_PATTERNS.low) {
      if (pattern.test(input)) {
        foundPatterns.push({ confidence: 'low', name });
      }
    }
  }
  
  // Determine overall confidence
  const hasHigh = foundPatterns.some(p => p.confidence === 'high');
  const hasMedium = foundPatterns.some(p => p.confidence === 'medium');
  const confidence: 'low' | 'medium' | 'high' = 
    hasHigh ? 'high' : 
    hasMedium ? 'medium' : 
    foundPatterns.length > 0 ? 'low' : 'low';
  
  const suspicious = foundPatterns.length > 0;
  
  return {
    suspicious,
    confidence,
    patterns: foundPatterns.map(p => p.name),
    reason: suspicious 
      ? `Detected ${foundPatterns.length} suspicious pattern(s): ${foundPatterns.map(p => `${p.name} (${p.confidence})`).join(', ')}`
      : undefined,
  };
}

export function logInjectionAttempt(
  input: string,
  detection: InjectionDetectionResult,
  sessionId: string
): void {
  if (!detection.suspicious) return;
  
  const inputSnippet = input.length > 200 
    ? `${input.substring(0, 200)}...` 
    : input;
  
  logger.warn('Potential prompt injection attempt detected', {
    sessionId,
    confidence: detection.confidence,
    patterns: detection.patterns,
    reason: detection.reason,
    inputLength: input.length,
    inputSnippet: inputSnippet.replace(/\n/g, '\\n'),
    timestamp: new Date().toISOString(),
  });
}

export function validateChatInput(input: string): ValidationResult {
  // Check if input is empty or only whitespace
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < VALIDATION_CONFIG.CHAT_MIN_LENGTH) {
    return {
      valid: false,
      error: `Input must be at least ${VALIDATION_CONFIG.CHAT_MIN_LENGTH} character(s) long.`,
    };
  }
  
  // Check maximum length
  if (input.length > VALIDATION_CONFIG.CHAT_MAX_LENGTH) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${VALIDATION_CONFIG.CHAT_MAX_LENGTH} characters.`,
    };
  }
  
  // Check for control characters (except newlines and tabs)
  const controlCharPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
  if (controlCharPattern.test(input)) {
    return {
      valid: false,
      error: 'Input contains invalid control characters.',
    };
  }
  
  return { valid: true };
}

export function validateTaskName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Task name is required and must be a string.' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < VALIDATION_CONFIG.TASK_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Task name must be at least ${VALIDATION_CONFIG.TASK_NAME_MIN_LENGTH} character(s) long.`,
    };
  }
  
  if (trimmed.length > VALIDATION_CONFIG.TASK_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Task name exceeds maximum length of ${VALIDATION_CONFIG.TASK_NAME_MAX_LENGTH} characters.`,
    };
  }
  
  // Check for control characters
  const controlCharPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
  if (controlCharPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Task name contains invalid control characters.',
    };
  }
  
  return { valid: true };
}

export function validateTaskDescription(description: string): ValidationResult {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Task description is required and must be a string.' };
  }
  
  const trimmed = description.trim();
  
  if (trimmed.length < VALIDATION_CONFIG.TASK_DESCRIPTION_MIN_LENGTH) {
    return {
      valid: false,
      error: `Task description must be at least ${VALIDATION_CONFIG.TASK_DESCRIPTION_MIN_LENGTH} character(s) long.`,
    };
  }
  
  if (trimmed.length > VALIDATION_CONFIG.TASK_DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: `Task description exceeds maximum length of ${VALIDATION_CONFIG.TASK_DESCRIPTION_MAX_LENGTH} characters.`,
    };
  }
  
  // Check for control characters (except newlines and tabs)
  const controlCharPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
  if (controlCharPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Task description contains invalid control characters.',
    };
  }
  
  return { valid: true };
}

export function validateDateRange(
  startTime: string,
  endTime: string,
  currentTime: Date = new Date()
): ValidationResult {
  let start: Date;
  let end: Date;
  
  // Validate ISO 8601 format
  try {
    start = new Date(startTime);
    end = new Date(endTime);
    
    if (isNaN(start.getTime())) {
      return { valid: false, error: `Invalid start time format: ${startTime}. Must be ISO 8601 format.` };
    }
    
    if (isNaN(end.getTime())) {
      return { valid: false, error: `Invalid end time format: ${endTime}. Must be ISO 8601 format.` };
    }
  } catch (error) {
    return { valid: false, error: `Invalid date format. Must be ISO 8601 format (e.g., "2026-01-15T14:00:00.000Z").` };
  }
  
  // Check that start time is in the future
  if (start.getTime() < currentTime.getTime()) {
    return { valid: false, error: `Start time must be in the future. Provided: ${startTime}` };
  }
  
  // Check that end time is after start time
  if (end.getTime() <= start.getTime()) {
    return { valid: false, error: `End time must be after start time. Start: ${startTime}, End: ${endTime}` };
  }
  
  // Check minimum duration (1 minute)
  const minDurationMs = VALIDATION_CONFIG.TASK_MIN_DURATION_MINUTES * 60 * 1000;
  const durationMs = end.getTime() - start.getTime();
  if (durationMs < minDurationMs) {
    return {
      valid: false,
      error: `Task duration must be at least ${VALIDATION_CONFIG.TASK_MIN_DURATION_MINUTES} minute(s).`,
    };
  }
  
  // Check maximum duration (1 year)
  const maxDurationMs = VALIDATION_CONFIG.TASK_MAX_DURATION_DAYS * 24 * 60 * 60 * 1000;
  if (durationMs > maxDurationMs) {
    return {
      valid: false,
      error: `Task duration cannot exceed ${VALIDATION_CONFIG.TASK_MAX_DURATION_DAYS} days.`,
    };
  }
  
  return { valid: true };
}

export function validateXP(xp: number | undefined | null): ValidationResult {
  if (xp === undefined || xp === null) {
    return { valid: false, error: 'XP is required.' };
  }
  
  if (typeof xp !== 'number') {
    return { valid: false, error: `XP must be a number. Got: ${typeof xp}` };
  }
  
  if (!Number.isInteger(xp)) {
    return { valid: false, error: `XP must be an integer. Got: ${xp}` };
  }
  
  if (xp < VALIDATION_CONFIG.XP_MIN) {
    return {
      valid: false,
      error: `XP must be at least ${VALIDATION_CONFIG.XP_MIN}. Got: ${xp}`,
    };
  }
  
  if (xp > VALIDATION_CONFIG.XP_MAX) {
    return {
      valid: false,
      error: `XP cannot exceed ${VALIDATION_CONFIG.XP_MAX}. Got: ${xp}`,
    };
  }
  
  return { valid: true };
}

export function validateTaskParameters(params: {
  taskName?: string;
  taskDescription?: string;
  taskStartTime?: string;
  taskEndTime?: string;
  XP?: number;
}, currentTime?: Date): TaskValidationResult {
  const errors: string[] = [];
  
  // Validate task name
  const nameResult = validateTaskName(params.taskName || '');
  if (!nameResult.valid) {
    errors.push(`Task name: ${nameResult.error}`);
  }
  
  // Validate task description
  const descResult = validateTaskDescription(params.taskDescription || '');
  if (!descResult.valid) {
    errors.push(`Task description: ${descResult.error}`);
  }
  
  // Validate date range
  if (params.taskStartTime && params.taskEndTime) {
    const dateResult = validateDateRange(params.taskStartTime, params.taskEndTime, currentTime);
    if (!dateResult.valid) {
      errors.push(`Date range: ${dateResult.error}`);
    }
  } else {
    if (!params.taskStartTime) {
      errors.push('Start time is required.');
    }
    if (!params.taskEndTime) {
      errors.push('End time is required.');
    }
  }
  
  // Validate XP
  const xpResult = validateXP(params.XP);
  if (!xpResult.valid) {
    errors.push(`XP: ${xpResult.error}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

