import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { getUserIdForRateLimit } from '@/lib/get-user-id';
import { generateUserSessionId, getUserIdFromSession } from '@/lib/session-utils';

// Rate limit: 60 requests per minute per user (tasks are cheaper, allow more)
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Helper to get agent URL based on environment
const getAgentUrl = (sessionId: string) => {
  const agentBaseUrl = process.env.AGENT_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://agent.sami-houssaini.workers.dev'
      : 'http://localhost:8787');
  return `${agentBaseUrl}/agents/quest-master-agent/${sessionId}`;
};

const handleAuthAndRateLimit = async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return {
      response: new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
      userId: null,
      sessionId: null,
    };
  }

  const userId = getUserIdFromSession(session);
  if (!userId) {
    return {
      response: new Response(
        JSON.stringify({ error: 'Invalid session. Please sign in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
      userId: null,
      sessionId: null,
    };
  }

  const rateLimitUserId = getUserIdForRateLimit(request);
  const rateLimitResult = checkRateLimit(rateLimitUserId, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

  if (!rateLimitResult.success) {
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    return {
      response: new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Too many requests. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      ),
      userId: null,
      sessionId: null,
    };
  }

  const sessionId = generateUserSessionId(userId);
  return { response: null, userId, sessionId, rateLimitResult };
};

export async function GET(request: NextRequest) {
  const { response, sessionId, rateLimitResult } = await handleAuthAndRateLimit(request);
  if (response) return response;
  if (!sessionId || !rateLimitResult) return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 }); // Should not happen

  try {
    const agentUrl = getAgentUrl(sessionId);
    
    // Forward timezone header if provided
    const timezoneHeader = request.headers.get('x-timezone');
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (timezoneHeader) {
      fetchHeaders['x-timezone'] = timezoneHeader;
    }

    const agentResponse = await fetch(agentUrl, {
      method: 'GET',
      headers: fetchHeaders,
    });

    if (!agentResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Agent error: ${agentResponse.status}` }),
        { status: agentResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await agentResponse.json();
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching tasks:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch tasks' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: NextRequest) {
  const { response, sessionId, rateLimitResult } = await handleAuthAndRateLimit(request);
  if (response) return response;
  if (!sessionId || !rateLimitResult) return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 }); // Should not happen

  try {
    const body = await request.json() as { tool?: string; params?: any };
    
    // Validate incoming request for manual task creation
    if (body.tool !== 'createTask' || !body.params) {
      return new Response(
        JSON.stringify({ error: 'Invalid request for task creation.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { taskName, taskDescription, taskStartTime, taskEndTime, XP } = body.params;

    if (!taskName || !taskDescription || !taskStartTime || !taskEndTime || XP === undefined || XP === null) {
      return new Response(
        JSON.stringify({ error: 'Missing required task parameters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const agentUrl = getAgentUrl(sessionId);
    
    // Forward timezone header if provided
    const timezoneHeader = request.headers.get('x-timezone');
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json', // Agent expects JSON for direct tool calls
    };
    if (timezoneHeader) {
      fetchHeaders['x-timezone'] = timezoneHeader;
    }

    const agentResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(body), // Send the original body with tool and params
    });

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json() as { error?: string };
      return new Response(
        JSON.stringify({ error: `Agent error: ${agentResponse.status}: ${errorData.error || 'Unknown error'}` }),
        { status: agentResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await agentResponse.json();
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error creating task:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create task' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { response, sessionId, rateLimitResult } = await handleAuthAndRateLimit(request);
  if (response) return response;
  if (!sessionId || !rateLimitResult) return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });

  try {
    const body = await request.json() as { tool?: string; params?: any };
    
    if (body.tool !== 'updateTask' || !body.params) {
      return new Response(
        JSON.stringify({ error: 'Invalid request for task update.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const agentUrl = getAgentUrl(sessionId);
    
    const timezoneHeader = request.headers.get('x-timezone');
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (timezoneHeader) {
      fetchHeaders['x-timezone'] = timezoneHeader;
    }

    const agentResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(body),
    });

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json() as { error?: string };
      return new Response(
        JSON.stringify({ error: `Agent error: ${agentResponse.status}: ${errorData.error || 'Unknown error'}` }),
        { status: agentResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await agentResponse.json();
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error updating task:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update task' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { response, sessionId, rateLimitResult } = await handleAuthAndRateLimit(request);
  if (response) return response;
  if (!sessionId || !rateLimitResult) return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });

  try {
    const body = await request.json() as { tool?: string; params?: any };
    
    if (body.tool !== 'deleteTask' || !body.params) {
      return new Response(
        JSON.stringify({ error: 'Invalid request for task deletion.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const agentUrl = getAgentUrl(sessionId);
    
    const timezoneHeader = request.headers.get('x-timezone');
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (timezoneHeader) {
      fetchHeaders['x-timezone'] = timezoneHeader;
    }

    const agentResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(body),
    });

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json() as { error?: string };
      return new Response(
        JSON.stringify({ error: `Agent error: ${agentResponse.status}: ${errorData.error || 'Unknown error'}` }),
        { status: agentResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await agentResponse.json();
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error deleting task:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete task' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
