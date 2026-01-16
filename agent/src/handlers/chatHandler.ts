import { QuestMasterAgent } from '../agent';
import { runWithTools } from '@cloudflare/ai-utils';
import { systemPromptDM } from '../system_prompt';
import { logger } from '../logger';
import { normalizeStream, createStreamWithMetadata } from '../utils/streaming';
import { validateChatInput, detectPromptInjection, logInjectionAttempt } from '../utils/validation';

/**
 * Extract session ID from request URL
 */
function extractSessionIdFromRequest(request: Request): string | null {
    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        // Expected: ['agents', 'quest-master-agent', '{sessionId}']
        if (pathParts.length >= 3 && pathParts[0] === 'agents' && pathParts[1] === 'quest-master-agent') {
            return pathParts[2];
        }
    } catch (error) {
        logger.debug('Failed to extract session ID from request URL:', error);
    }
    return null;
}

/**
 * Handle chat requests with AI streaming
 */
export async function handleChatRequest(
    agent: QuestMasterAgent,
    request: any,
    tools: any[]
): Promise<Response> {
    agent.createdTasksThisMessage = [];
    logger.request('POST', '/chat');

    const userContent = await request.text();
    
    // Validate input length and content
    const inputValidation = validateChatInput(userContent);
    if (!inputValidation.valid) {
        logger.warn('Chat input validation failed:', inputValidation.error);
        return new Response(
            JSON.stringify({ error: inputValidation.error }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
    
    // Detect prompt injection attempts (log but don't block)
    const sessionId = extractSessionIdFromRequest(request);
    const injectionDetection = detectPromptInjection(userContent);
    if (injectionDetection.suspicious && sessionId) {
        logInjectionAttempt(userContent, injectionDetection, sessionId);
    }
    
    logger.debug('User content:', userContent.substring(0, 200));

    const answer = await runWithTools(
        agent.env.AI,
        '@cf/meta/llama-3.1-8b-instruct',
        {
            messages: [
                { role: 'system', content: systemPromptDM },
                { role: 'user', content: userContent },
            ],
            tools,
        },
        { streamFinalResponse: true }
    );

    logger.taskOperation('created during runWithTools', agent.createdTasksThisMessage.length);

    const baseStream = normalizeStream(answer);
    const streamWithMetadata = createStreamWithMetadata(
        baseStream,
        agent.createdTasksThisMessage,
        async () => {
            const state = await agent.state;
            return state.tasks;
        }
    );

    return new Response(streamWithMetadata, {
        headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            'connection': 'keep-alive',
        },
    });
}

