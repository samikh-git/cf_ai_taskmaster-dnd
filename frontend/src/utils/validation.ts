export const VALIDATION_CONFIG = {
  CHAT_MAX_LENGTH: 5000,
  CHAT_MIN_LENGTH: 1,
} as const;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate chat input on the frontend
 * Provides immediate feedback before sending to API
 */
export function validateChatInput(input: string): ValidationResult {
  const trimmed = input.trim();
  
  if (!trimmed || trimmed.length < VALIDATION_CONFIG.CHAT_MIN_LENGTH) {
    return {
      valid: false,
      error: `Message must be at least ${VALIDATION_CONFIG.CHAT_MIN_LENGTH} character(s) long.`,
    };
  }
  
  if (input.length > VALIDATION_CONFIG.CHAT_MAX_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${VALIDATION_CONFIG.CHAT_MAX_LENGTH} characters.`,
    };
  }
  
  return { valid: true };
}

