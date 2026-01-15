import crypto from 'crypto';

/**
 * Generate a secure, deterministic session ID from a user ID
 * This creates a non-guessable but consistent session ID per user
 */
export function generateUserSessionId(userId: string): string {
  if (!userId) {
    throw new Error('User ID is required to generate session ID');
  }

  // Use NEXTAUTH_SECRET as salt for hashing
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
  
  if (!secret) {
    // Fallback: use a deterministic hash (less secure, but better than plain user ID)
    const hash = crypto
      .createHash('sha256')
      .update(`user-${userId}`)
      .digest('hex')
      .substring(0, 16);
    return `user-${hash}`;
  }

  // Create a deterministic but non-guessable session ID
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}-${secret}`)
    .digest('hex')
    .substring(0, 16);
  
  return `user-${hash}`;
}

/**
 * Extract user ID from NextAuth session
 */
export function getUserIdFromSession(session: any): string | null {
  if (!session?.user) {
    return null;
  }

  // Try to get user ID in order of preference
  const userId = (session.user as any).id || 
                 session.user.email || 
                 session.user.name;
  
  return userId || null;
}

