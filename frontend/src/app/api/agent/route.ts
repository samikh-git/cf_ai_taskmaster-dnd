import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth.config';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { getUserIdForRateLimit } from '@/lib/get-user-id';
import { generateUserSessionId, getUserIdFromSession } from '@/lib/session-utils';
import { generateAuthToken } from '@/lib/auth-token';
import { getAgentBaseUrl } from '@/constants';

// Rate limit: 30 requests per minute per user (to prevent API credit abuse)
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get user ID from session
  const userId = getUserIdFromSession(session);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Invalid session. Please sign in again.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check rate limit before processing
  const rateLimitUserId = getUserIdForRateLimit(request);
  const rateLimitResult = checkRateLimit(rateLimitUserId, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

  if (!rateLimitResult.success) {
    const headers = getRateLimitHeaders(rateLimitResult);
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded. Too many requests. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      }
    );
  }

  try {
    const body = await request.text();
    
    // Generate session ID server-side from authenticated user (ignore client-provided session ID)
    const sessionId = generateUserSessionId(userId);
    
    // Generate authentication token for agent validation
    let authToken: string;
    try {
      authToken = generateAuthToken(sessionId);
    } catch (error) {
      console.error('Error generating auth token:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to generate authentication token' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Use environment variable or default based on NODE_ENV
    const agentBaseUrl = getAgentBaseUrl();
    const agentUrl = `${agentBaseUrl}/agents/quest-master-agent/${sessionId}`;
    
    // Forward timezone header and include auth token
    const timezoneHeader = request.headers.get('x-timezone');
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'text/plain',
      'Authorization': `Bearer ${authToken}`,
    };
    if (timezoneHeader) {
      fetchHeaders['x-timezone'] = timezoneHeader;
    }

    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: body,
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Agent error: ${response.status}` }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Stream the response back to the client
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...rateLimitHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error proxying to agent:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to agent' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

