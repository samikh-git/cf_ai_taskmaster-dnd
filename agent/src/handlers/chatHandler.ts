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

    // Track retry attempts for task creation
    let retryCount = 0;
    const maxRetries = 2; // Allow up to 2 retries (3 total attempts)
    let messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPromptDM },
        { role: 'user', content: userContent },
    ];

    let answer;
    let lastError: Error | null = null;

    // Retry loop for task creation errors
    while (retryCount <= maxRetries) {
        try {
            answer = await runWithTools(
                agent.env.AI,
                '@cf/meta/llama-3.1-70b-instruct', // Using 70B model for better tool calling reliability
                {
                    messages,
                    tools,
                },
                { streamFinalResponse: true }
            );
            
            // Success - break out of retry loop
            break;
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message || String(error);
            
            // Check if this is a task creation error that we should retry
            const isTaskCreationError = errorMessage.includes('Task creation failed') || 
                                       errorMessage.includes('Task validation failed') ||
                                       errorMessage.includes('Task parameter validation failed');
            
            if (isTaskCreationError && retryCount < maxRetries) {
                retryCount++;
                logger.warn(`Task creation failed, retrying (attempt ${retryCount + 1}/${maxRetries + 1}):`, errorMessage);
                
                // Add the error as a user message so the model can see what went wrong and retry
                messages.push({
                    role: 'assistant',
                    content: `I encountered an error while creating the task. Let me try again with corrected parameters.`
                });
                messages.push({
                    role: 'user',
                    content: `The previous attempt failed with this error: ${errorMessage}\n\nPlease try creating the task again with corrected parameters.`
                });
                
                // Reset created tasks for this retry
                agent.createdTasksThisMessage = [];
            } else {
                // Not a retryable error or max retries reached - throw it
                logger.error('Non-retryable error or max retries reached:', errorMessage);
                throw error;
            }
        }
    }

    if (!answer && lastError) {
        throw lastError;
    }

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

