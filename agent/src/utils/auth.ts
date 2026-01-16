/**
 * Authentication utilities for validating signed tokens from the frontend
 */

export interface TokenValidationResult {
  valid: boolean;
  sessionId: string | null;
  error?: string;
}

/**
 * Validate an authentication token
 * Token format: {sessionId}:{timestamp}:{signature}
 * Signature is HMAC-SHA256 of {sessionId}:{timestamp} using AUTH_SECRET
 */
export async function validateAuthToken(
  token: string | null,
  secret: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
): Promise<TokenValidationResult> {
  if (!token) {
    return { valid: false, sessionId: null, error: 'No token provided' };
  }

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

  // Check token age (prevent replay attacks)
  const age = Date.now() - timestamp;
  if (age > maxAgeMs) {
    return { valid: false, sessionId: null, error: 'Token expired' };
  }

  // Reject tokens from the future (clock skew protection)
  if (age < -60000) { // 1 minute tolerance
    return { valid: false, sessionId: null, error: 'Token timestamp in future' };
  }

  // Verify HMAC signature using Web Crypto API
  const payload = `${sessionId}:${timestamp}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);
  
  try {
    // Import key for HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      return { valid: false, sessionId: null, error: 'Invalid signature' };
    }

    return { valid: true, sessionId };
  } catch (error) {
    return { valid: false, sessionId: null, error: `Signature validation failed: ${error}` };
  }
}

