import { NextRequest } from 'next/server';

/**
 * Get a user identifier for rate limiting
 * Tries to get from NextAuth session cookie, falls back to IP
 */
export function getUserIdForRateLimit(request: NextRequest): string {
  // Try to get session token from cookies (NextAuth stores session in cookies)
  const cookies = request.cookies;
  const sessionToken = cookies.get('next-auth.session-token')?.value || 
                       cookies.get('__Secure-next-auth.session-token')?.value;

  if (sessionToken) {
    // Use session token as identifier (unique per user)
    return `session:${sessionToken}`;
  }

  // Fallback to IP address if no session
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';

  return `ip:${ip}`;
}

