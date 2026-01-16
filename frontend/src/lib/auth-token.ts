import crypto from 'crypto';

/**
 * Generate a signed authentication token for agent requests
 * Token format: {sessionId}:{timestamp}:{signature}
 * Signature is HMAC-SHA256 of {sessionId}:{timestamp} using NEXTAUTH_SECRET
 */
export function generateAuthToken(sessionId: string): string {
  if (!sessionId) {
    throw new Error('Session ID is required to generate auth token');
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required to generate auth tokens');
  }

  // Token expires after 5 minutes
  const timestamp = Date.now();
  const payload = `${sessionId}:${timestamp}`;
  
  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `${payload}:${signature}`;
}

/**
 * Validate an auth token (for testing/debugging)
 * This is primarily used by the agent, but available here for testing
 */
export function validateAuthToken(token: string, maxAgeMs: number = 5 * 60 * 1000): { valid: boolean; sessionId: string | null; error?: string } {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
  if (!secret) {
    return { valid: false, sessionId: null, error: 'Secret not configured' };
  }

  const parts = token.split(':');
  if (parts.length !== 3) {
    return { valid: false, sessionId: null, error: 'Invalid token format' };
  }

  const [sessionId, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    return { valid: false, sessionId: null, error: 'Invalid timestamp' };
  }

  // Check token age
  const age = Date.now() - timestamp;
  if (age > maxAgeMs) {
    return { valid: false, sessionId: null, error: 'Token expired' };
  }

  // Verify signature
  const payload = `${sessionId}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return { valid: false, sessionId: null, error: 'Invalid signature' };
  }

  return { valid: true, sessionId };
}

