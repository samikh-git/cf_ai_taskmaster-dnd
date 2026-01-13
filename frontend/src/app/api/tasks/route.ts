import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.headers.get('x-session-id') || request.nextUrl.searchParams.get('sessionId') || `session-${Date.now()}`;
    
    const agentUrl = `http://localhost:8787/agents/task-master-agent/${sessionId}`;
    
    const response = await fetch(agentUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch tasks' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

