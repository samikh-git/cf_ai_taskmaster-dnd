/**
 * Simple in-memory rate limiter for authenticated users
 * Tracks requests per user session/ID
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (in production, consider using Redis or Cloudflare KV)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a user has exceeded rate limit
 * @param userId - User identifier (email, session ID, etc.)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result
 */
export function checkRateLimit(
  userId: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute default
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // If no entry or window has expired, create/reset
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(userId, newEntry);
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: newEntry.resetTime,
    };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(userId, entry);

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    'Retry-After': result.success
      ? '0'
      : Math.ceil((result.reset - Date.now()) / 1000).toString(),
  };
}

