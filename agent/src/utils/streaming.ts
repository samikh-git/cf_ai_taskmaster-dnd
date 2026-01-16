import { Task } from '../types';
import { serializeTask } from './serialization';
import { logger } from '../logger';

/**
 * Create a stream with task metadata appended at the end
 */
export function createStreamWithMetadata(
    baseStream: ReadableStream<Uint8Array>,
    createdTasks: Task[],
    getAllTasks: () => Promise<Task[]>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = baseStream.getReader();

    return new ReadableStream({
        async start(controller) {
            try {
                // Stream the original response and format as SSE
                // runWithTools returns JSON chunks like {"response":" text","p":"..."}
                // We need to parse these and extract the response field
                let buffer = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    // Decode the chunk and add to buffer
                    buffer += decoder.decode(value, { stream: true });
                    
                    // Process complete JSON objects from buffer
                    // JSON objects appear to be separated or concatenated
                    while (buffer.length > 0) {
                        const jsonStart = buffer.indexOf('{');
                        if (jsonStart === -1) break;
                        
                        // Find matching closing brace
                        let braceCount = 0;
                        let jsonEnd = -1;
                        for (let i = jsonStart; i < buffer.length; i++) {
                            if (buffer[i] === '{') braceCount++;
                            if (buffer[i] === '}') braceCount--;
                            if (braceCount === 0) {
                                jsonEnd = i + 1;
                                break;
                            }
                        }
                        
                        if (jsonEnd === -1) {
                            // Incomplete JSON, keep in buffer
                            break;
                        }
                        
                        // Extract JSON object
                        const jsonStr = buffer.substring(jsonStart, jsonEnd);
                        buffer = buffer.substring(jsonEnd);
                        
                        try {
                            const json = JSON.parse(jsonStr);
                            if (json.response !== null && json.response !== undefined) {
                                const responseText = String(json.response);
                                if (responseText) {
                                    controller.enqueue(encoder.encode(`data: ${responseText}\n\n`));
                                }
                            }
                        } catch (e) {
                            logger.debug('Failed to parse JSON:', jsonStr.substring(0, 100));
                        }
                    }
                }

                // Wait to ensure tool execution is complete and state is persisted
                await new Promise(resolve => setTimeout(resolve, 500));

                // After streaming completes, check for tasks created during this message
                const tasksCreated = createdTasks;
                const currentStateTasks = await getAllTasks();

                // If createdTasks is empty but state has new tasks, use state tasks instead
                const tasksToSend = tasksCreated.length > 0 ? tasksCreated : currentStateTasks;

                if (tasksToSend.length > 0) {
                    logger.taskOperation('sending metadata', tasksToSend.length);
                    const serializedTasks = tasksToSend.map(serializeTask);

                    // Send metadata as SSE formatted data
                    const metadataJson = JSON.stringify({
                        type: "metadata",
                        tasks: serializedTasks,
                    });
                    controller.enqueue(encoder.encode(`data: ${metadataJson}\n\n`));
                }

                // Send done marker
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            } catch (error) {
                logger.error('Error in stream:', error);
                controller.error(error);
            }
        },
    });
}

/**
 * Normalize the answer from runWithTools into a ReadableStream
 */
export function normalizeStream(answer: any): ReadableStream<Uint8Array> {
    if (answer instanceof ReadableStream) {
        return answer;
    }
    if (answer instanceof Response && answer.body) {
        return answer.body;
    }
    // If answer is not a stream, convert to string
    const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
    return new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(text));
            controller.close();
        },
    });
}

