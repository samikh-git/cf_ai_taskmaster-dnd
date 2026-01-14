import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sessionId = request.headers.get('x-session-id') || `session-${Date.now()}`;
    
    const agentBaseUrl = process.env.AGENT_URL || 'https://agent.sami-houssaini.workers.dev';
    const agentUrl = `${agentBaseUrl}/agents/task-master-agent/${sessionId}`;
    
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
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
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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

