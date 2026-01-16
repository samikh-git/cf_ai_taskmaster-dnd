import crypto from 'crypto';

/**
 * Generate a secure, deterministic session ID from a user ID
 * This creates a non-guessable but consistent session ID per user
 * Uses full SHA-256 hash (64 hex characters) + base64url encoding for better entropy
 */
export function generateUserSessionId(userId: string): string {
  if (!userId) {
    throw new Error('User ID is required to generate session ID');
  }

  // Use NEXTAUTH_SECRET as salt for hashing
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
  
  if (!secret) {
    // Fallback: use a deterministic hash (less secure, but better than plain user ID)
    // Use full SHA-256 for better entropy (256 bits instead of 64)
    const hash = crypto
      .createHash('sha256')
      .update(`user-${userId}-questmaster`)
      .digest('hex');
    // Convert to base64url for shorter, more random-looking string (43 chars instead of 64)
    const base64 = Buffer.from(hash, 'hex').toString('base64');
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `qm_${base64url}`;
  }

  // Create a deterministic but non-guessable session ID
  // Include a namespace prefix to prevent collisions and add entropy
  // Use full SHA-256 hash (256 bits of entropy) instead of truncated 16 chars (64 bits)
  const hash = crypto
    .createHash('sha256')
    .update(`questmaster:${userId}:${secret}`)
    .digest('hex');
  
  // Convert to base64url for shorter, more random-looking string
  // Base64url encoding: 256 bits = 43 characters (vs 64 hex characters)
  // This makes it shorter while maintaining full entropy
  const base64 = Buffer.from(hash, 'hex').toString('base64');
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  // Prefix with 'qm_' (questmaster) for identification and add length
  // Final format: qm_{43 base64url chars} = 46 characters total
  return `qm_${base64url}`;
}

import type { Session as NextAuthSession } from 'next-auth';

/**
 * Extract user ID from NextAuth session
 * Accepts NextAuth's Session type which may have user as undefined
 */
export function getUserIdFromSession(session: NextAuthSession | null | undefined): string | null {
  if (!session?.user) {
    return null;
  }

  // Try to get user ID in order of preference
  // Type assertion is safe here because we've already checked session?.user exists
  const user = session.user as { id?: string; email?: string | null; name?: string | null };
  const userId = user.id || 
                 user.email || 
                 user.name;
  
  return userId || null;
}

