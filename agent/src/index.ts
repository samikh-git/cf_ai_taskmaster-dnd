import { Agent, AgentNamespace, routeAgentRequest } from 'agents';
import { QuestMasterAgent } from './agent';
import { logger } from './logger';
import { validateAuthToken } from './utils/auth';

export { QuestMasterAgent };

export interface Env {
  QuestMasterAgent: AgentNamespace<QuestMasterAgent>;
  AI: Ai;
  CHAT_RATE_LIMITER?: RateLimit;
  TASK_RATE_LIMITER?: RateLimit;
  AUTH_SECRET?: string; // Secret for validating auth tokens (should match NEXTAUTH_SECRET)
}

/**
 * Extract session ID from request URL
 * Expected format: /agents/quest-master-agent/{sessionId} or /agents/quest-master-agent/{sessionId}?...
 */
function extractSessionId(url: URL): string | null {
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected: ['agents', 'quest-master-agent', '{sessionId}']
  if (pathParts.length >= 3 && pathParts[0] === 'agents' && pathParts[1] === 'quest-master-agent') {
    return pathParts[2];
  }
  return null;
}

/**
 * Validate authentication token from request headers
 */
async function validateRequest(request: Request, env: Env, sessionId: string | null): Promise<{ valid: boolean; error?: string }> {
  // Extract auth token from Authorization header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return { valid: false, error: 'No authorization token provided' };
  }

  // Support both "Bearer {token}" and just "{token}" formats
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Get secret from environment (should match NEXTAUTH_SECRET)
  const secret = env.AUTH_SECRET || '';
  if (!secret) {
    logger.warn('AUTH_SECRET not configured - authentication disabled');
    // In development, allow requests without validation if secret not set
    // In production, this should always be set
    return { valid: true };
  }

  // Validate token
  const validationResult = await validateAuthToken(token, secret);
  
  if (!validationResult.valid) {
    logger.warn('Authentication failed:', validationResult.error);
    return { valid: false, error: validationResult.error || 'Invalid authentication token' };
  }

  // Verify that the session ID in the token matches the session ID in the URL
  if (sessionId && validationResult.sessionId !== sessionId) {
    logger.warn('Session ID mismatch:', { url: sessionId, token: validationResult.sessionId });
    return { valid: false, error: 'Session ID mismatch' };
  }

  return { valid: true };
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    logger.request(request.method, url.pathname);
    
    // Extract session ID for rate limiting and auth validation
    const sessionId = extractSessionId(url);
    
    // Validate authentication token (except for non-agent routes)
    if (sessionId) {
      const authResult = await validateRequest(request, env, sessionId);
      if (!authResult.valid) {
        logger.warn('Authentication failed:', authResult.error);
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Invalid authentication token.' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Bearer',
            },
          }
        );
      }
    }
    
    // Apply rate limiting based on request type
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type');
      const isChatRequest = !contentType?.includes('application/json');
      
      if (isChatRequest && env.CHAT_RATE_LIMITER && sessionId) {
        // Rate limit chat requests (30 per minute)
        const rateLimitResult = await env.CHAT_RATE_LIMITER.limit({ key: sessionId });
        if (!rateLimitResult.success) {
          logger.warn('Rate limit exceeded for chat:', sessionId);
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          };
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Too many requests. Please try again later.' }),
            { status: 429, headers }
          );
        }
      } else if (!isChatRequest && env.TASK_RATE_LIMITER && sessionId) {
        // Rate limit task operations (60 per minute)
        const rateLimitResult = await env.TASK_RATE_LIMITER.limit({ key: sessionId });
        if (!rateLimitResult.success) {
          logger.warn('Rate limit exceeded for task operations:', sessionId);
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          };
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Too many requests. Please try again later.' }),
            { status: 429, headers }
          );
        }
      }
    } else if (request.method === 'GET' && env.TASK_RATE_LIMITER && sessionId) {
      // Rate limit GET requests (60 per minute)
      const rateLimitResult = await env.TASK_RATE_LIMITER.limit({ key: sessionId });
      if (!rateLimitResult.success) {
        logger.warn('Rate limit exceeded for GET requests:', sessionId);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        };
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Too many requests. Please try again later.' }),
          { status: 429, headers }
        );
      }
    }
    
    // Routed addressing
    // Automatically routes HTTP requests and/or WebSocket connections to /agents/:agent/:name
    return (await routeAgentRequest(request, env)) || Response.json({ msg: 'no agent here' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;