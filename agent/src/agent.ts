import { Agent, AgentNamespace } from "agents";
import { runWithTools } from "@cloudflare/ai-utils";
import { systemPromptDM } from "./system_prompt";
import { logger } from "./logger";


interface Env {
    AI: Ai;
    QuestMasterAgent: AgentNamespace<QuestMasterAgent>;
}

interface DMState {
    tasks: Task[];
    timezone?: string; // User's timezone (e.g., "America/New_York", "Europe/London")
    totalXP: number; // Total XP earned from completed tasks
}

interface Task {
    id: string;
    name: string;
    description: string;
    startTime: Date;
    endTime: Date;
    XP: number;
}

export class QuestMasterAgent extends Agent<Env, DMState> {
    initialState: DMState = {
        tasks: [],
        timezone: undefined,
        totalXP: 0
    };

    private createdTasksThisMessage: Task[] = [];

    TOOLS = [
        {
            name: "getCurrentTime",
            description: "Get the current date and time in ISO 8601 format. Use this to determine appropriate start and end times for tasks.",
            parameters: {
                type: "object",
                properties: {},
            },
            function: this.getCurrentTime.bind(this),
        },
        {
            name: "createTask",
            description: "Create a new task (quest) for the user. IMPORTANT: The taskStartTime and taskEndTime must be different - a task must have a duration. Both times must be in the future relative to the current time. Use getCurrentTime to ensure proper timing.",
            parameters: {
                type: "object",
                properties: {
                    taskName: { type: "string", description: "The name of the task/quest" },
                    taskDescription: { type: "string", description: "An epic, immersive description of the task in fantasy/D&D style" },
                    taskStartTime: { type: "string", format: "date-time", description: "The start time of the task in ISO 8601 format (must be in the future and before taskEndTime)" },
                    taskEndTime: { type: "string", format: "date-time", description: "The end time/deadline of the task in ISO 8601 format (must be after taskStartTime and in the future)" },
                    XP: { type: "number", description: "The experience points (XP) reward for completing this task. Determine based on complexity, duration, and difficulty. Higher for more challenging quests." },
                },
                required: ["taskName", "taskDescription", "taskStartTime", "taskEndTime", "XP"],
            },
            function: this.createTask.bind(this),
        },
        {
            name: "viewTasks",
            description: "View all active tasks (quests) currently in the user's quest log. Returns an array of all tasks.",
            parameters: {
                type: "object",
                properties: {},
            },
            function: this.viewTasks.bind(this),
        },
    ];
    
    async onRequest(request: Request): Promise<Response> {
        // Check for timezone header and store it if not already set
        const timezoneHeader = request.headers.get('x-timezone');
        if (timezoneHeader) {
            const currentState = await this.state;
            if (!currentState.timezone) {
                // Store timezone on first connection
                await this.setState({
                    ...currentState,
                    timezone: timezoneHeader
                });
                logger.info('Stored user timezone:', timezoneHeader);
            }
        }

        // Handle GET requests for fetching tasks
        if (request.method === 'GET') {
            const currentState = await this.state;
            logger.request('GET', '/tasks', { taskCount: currentState.tasks.length });
            
            const tasks = currentState.tasks.map(task => {
                // Handle Date objects that may have been serialized to strings
                const startTime = task.startTime instanceof Date 
                    ? task.startTime.toISOString() 
                    : (typeof task.startTime === 'string' ? task.startTime : new Date(task.startTime).toISOString());
                const endTime = task.endTime instanceof Date 
                    ? task.endTime.toISOString() 
                    : (typeof task.endTime === 'string' ? task.endTime : new Date(task.endTime).toISOString());
                
                return {
                    id: task.id,
                    name: task.name,
                    description: task.description,
                    startTime,
                    endTime,
                    XP: task.XP
                };
            });
            
            return new Response(JSON.stringify({ 
                tasks,
                totalXP: currentState.totalXP || 0
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }

        // Handle POST requests for creating tasks directly (bypassing AI)
        if (request.method === 'POST') {
            const contentType = request.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                try {
                    const body = await request.json() as { tool?: string; params?: any };
                    if (body.tool === 'createTask' && body.params) {
                        logger.request('POST', '/createTask', body.params);
                        const createdTask = await this.createTask(body.params);
                        // Handle Date objects that may have been serialized
                        const startTime = createdTask.startTime instanceof Date 
                            ? createdTask.startTime.toISOString() 
                            : (typeof createdTask.startTime === 'string' ? createdTask.startTime : new Date(createdTask.startTime).toISOString());
                        const endTime = createdTask.endTime instanceof Date 
                            ? createdTask.endTime.toISOString() 
                            : (typeof createdTask.endTime === 'string' ? createdTask.endTime : new Date(createdTask.endTime).toISOString());
                        
                        return new Response(JSON.stringify({ 
                            success: true,
                            task: {
                                id: createdTask.id,
                                name: createdTask.name,
                                description: createdTask.description,
                                startTime,
                                endTime,
                                XP: createdTask.XP
                            }
                        }), {
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            }
                        });
                    }
                    
                    if (body.tool === 'updateTask' && body.params) {
                        logger.request('POST', '/updateTask', body.params);
                        const updatedTask = await this.updateTask(body.params);
                        const startTime = updatedTask.startTime instanceof Date 
                            ? updatedTask.startTime.toISOString() 
                            : (typeof updatedTask.startTime === 'string' ? updatedTask.startTime : new Date(updatedTask.startTime).toISOString());
                        const endTime = updatedTask.endTime instanceof Date 
                            ? updatedTask.endTime.toISOString() 
                            : (typeof updatedTask.endTime === 'string' ? updatedTask.endTime : new Date(updatedTask.endTime).toISOString());
                        
                        return new Response(JSON.stringify({ 
                            success: true,
                            task: {
                                id: updatedTask.id,
                                name: updatedTask.name,
                                description: updatedTask.description,
                                startTime,
                                endTime,
                                XP: updatedTask.XP
                            }
                        }), {
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            }
                        });
                    }
                    
                    if (body.tool === 'deleteTask' && body.params) {
                        logger.request('POST', '/deleteTask', body.params);
                        const addXP = body.params.addXP === true; // Only add XP if explicitly set to true
                        await this.deleteTask(body.params.taskId, addXP);
                        return new Response(JSON.stringify({ 
                            success: true
                        }), {
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            }
                        });
                    }
                } catch (error) {
                    logger.error('Error in direct task creation:', error);
                    return new Response(JSON.stringify({ 
                        success: false,
                        error: error instanceof Error ? error.message : 'Failed to create task'
                    }), {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        }
                    });
                }
            }
        }

        // Handle POST requests for chat messages
        this.createdTasksThisMessage = [];
        logger.request('POST', '/chat');

        const userContent = await request.text();
        logger.debug('User content:', userContent);

        const answer = await runWithTools(
            this.env.AI,
            // Model with function calling support
            "@cf/meta/llama-3.1-8b-instruct",
            {
              // Messages
              messages: [{role: "system", content: systemPromptDM}, {role: "user", content: userContent}],
              // Definition of available tools the AI model can leverage
              tools: this.TOOLS,
            },
              // Enable streaming
            {streamFinalResponse: true},
          );
        
        logger.taskOperation('created during runWithTools', this.createdTasksThisMessage.length);

        // Wrap the stream to append task metadata after streaming completes
        let baseStream: ReadableStream<Uint8Array> | null = null;
        
        if (answer instanceof ReadableStream) {
            baseStream = answer;
        } else if (answer instanceof Response && answer.body) {
            baseStream = answer.body;
        } else {
            // If answer is not a stream, convert to string
            const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
            baseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(text));
                    controller.close();
                }
            });
        }

        // Create a new stream that appends task metadata at the end
        const encoder = new TextEncoder();
        const reader = baseStream.getReader();
        const agentInstance = this; // Capture 'this' for use in the stream
        
        const streamWithMetadata = new ReadableStream({
            async start(controller) {
                try {
                    // Stream the original response
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        controller.enqueue(value);
                    }
                    
                    // Wait longer to ensure tool execution is complete and state is persisted
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // After streaming completes, check for tasks created during this message
                    const tasksCreated = agentInstance.createdTasksThisMessage;
                    const currentState = await agentInstance.state;
                    
                    // If createdTasksThisMessage is empty but state has new tasks, use state tasks instead
                    const tasksToSend = tasksCreated.length > 0 ? tasksCreated : currentState.tasks;
                    
                    if (tasksToSend.length > 0) {
                        logger.taskOperation('sending metadata', tasksToSend.length);
                        const serializedTasks = tasksToSend.map((task: Task) => {
                            // Handle Date objects that may have been serialized to strings
                            const startTime = task.startTime instanceof Date 
                                ? task.startTime.toISOString() 
                                : (typeof task.startTime === 'string' ? task.startTime : new Date(task.startTime).toISOString());
                            const endTime = task.endTime instanceof Date 
                                ? task.endTime.toISOString() 
                                : (typeof task.endTime === 'string' ? task.endTime : new Date(task.endTime).toISOString());
                            
                            return {
                                id: task.id,
                                name: task.name,
                                description: task.description,
                                startTime,
                                endTime,
                                XP: task.XP
                            };
                        });
                        
                        // Send metadata as SSE formatted data
                        const metadataJson = JSON.stringify({
                            type: "metadata",
                            tasks: serializedTasks
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
            }
        });

        return new Response(streamWithMetadata, {
            headers: {
              'content-type': 'text/event-stream',
              'cache-control': 'no-cache',
              'connection': 'keep-alive',
            }
          });
    }

    async createTask(params: any) {
        logger.toolCall('createTask', params);
        
        // runWithTools passes parameters as an object, but the model might structure it incorrectly
        // Handle different parameter structures
        let taskName: string;
        let taskDescription: string;
        let taskStartTime: string;
        let taskEndTime: string;
        let XP: number;
        
        // Check if params is already the correct structure
        if (params && typeof params === 'object' && 'taskName' in params && typeof params.taskName === 'string') {
            // Normal structure
            taskName = params.taskName;
            taskDescription = params.taskDescription;
            taskStartTime = params.taskStartTime;
            taskEndTime = params.taskEndTime;
            XP = params.XP;
        } else if (params && typeof params === 'object' && 'taskName' in params && typeof params.taskName === 'object') {
            // Incorrect structure - all params nested in taskName
            logger.debug('Detected incorrect parameter structure, extracting from nested object...');
            const nested = params.taskName;
            taskName = nested.taskName || nested.name || '';
            taskDescription = nested.taskDescription || nested.description || '';
            taskStartTime = nested.taskStartTime || nested.startTime || '';
            taskEndTime = nested.taskEndTime || nested.endTime || '';
            XP = nested.XP || nested.xp || 0;
        } else {
            // Try to extract from params directly
            taskName = params.taskName || params.name || '';
            taskDescription = params.taskDescription || params.description || '';
            taskStartTime = params.taskStartTime || params.startTime || '';
            taskEndTime = params.taskEndTime || params.endTime || '';
            XP = params.XP || params.xp || 0;
        }
        
        if (!taskName || !taskDescription || !taskStartTime || !taskEndTime || XP === undefined || XP === null) {
            logger.error('Missing required parameters for createTask', {
                taskName, taskDescription, taskStartTime, taskEndTime, XP
            });
            throw new Error(`Missing required parameters: taskName=${taskName}, taskDescription=${taskDescription}, taskStartTime=${taskStartTime}, taskEndTime=${taskEndTime}, XP=${XP}`);
        }
        
        try {
            const currentState = await this.state;
            const newTask: Task = {
                id: crypto.randomUUID(),
                name: taskName,
                description: taskDescription,
                startTime: new Date(taskStartTime),
                endTime: new Date(taskEndTime),
                XP: XP,
            };
            
            const updatedState = {
                ...currentState,
                tasks: [...currentState.tasks, newTask],
            };
            
            await this.setState(updatedState);
            this.createdTasksThisMessage.push(newTask);
            
            logger.taskOperation('created', 1, { taskId: newTask.id, taskName: newTask.name });
            await this.scheduleNextCleanupAlarm();
            
            return newTask;
        } catch (error) {
            logger.error('Error creating task:', error);
            throw error;
        }
    }

    async getCurrentTime(): Promise<string> {
        logger.toolCall('getCurrentTime');
        const currentState = await this.state;
        const timezone = currentState.timezone;
        
        const now = new Date();
        
        if (timezone) {
            // Simply format the date in the user's timezone using Intl.DateTimeFormat
            // This automatically handles DST and all timezone complexities
            const formatter = new Intl.DateTimeFormat('sv-SE', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Returns: YYYY-MM-DD HH:mm:ss (sv-SE locale format)
            const localTime = formatter.format(now).replace(' ', 'T');
            
            // Return with timezone identifier - the AI can use this directly
            const result = `${localTime} (timezone: ${timezone})`;
            logger.debug('Current time:', result);
            return result;
        }
        
        // Fallback to UTC
        return now.toISOString();
    }

    async viewTasks() {
        logger.toolCall('viewTasks');
        const currentState = await this.state;
        logger.taskOperation('retrieved', currentState.tasks.length);
        return currentState.tasks;
    }

    async updateTask(params: { taskId: string; endTime?: string }) {
        logger.toolCall('updateTask', params);
        const currentState = await this.state;
        
        const taskIndex = currentState.tasks.findIndex(t => t.id === params.taskId);
        if (taskIndex === -1) {
            throw new Error(`Task with id ${params.taskId} not found`);
        }
        
        const task = currentState.tasks[taskIndex];
        const updatedTask = { ...task };
        
        if (params.endTime) {
            updatedTask.endTime = new Date(params.endTime);
        }
        
        const updatedTasks = [...currentState.tasks];
        updatedTasks[taskIndex] = updatedTask;
        
        await this.setState({
            ...currentState,
            tasks: updatedTasks,
        });
        
        // Reschedule cleanup alarm if end time changed
        if (params.endTime) {
            await this.scheduleNextCleanupAlarm();
        }
        
        logger.taskOperation('updated', 1);
        return updatedTask;
    }

    async deleteTask(taskId: string, addXP: boolean = false) {
        logger.toolCall('deleteTask', { taskId, addXP });
        const currentState = await this.state;
        
        const taskToDelete = currentState.tasks.find(t => t.id !== taskId);
        if (!taskToDelete) {
            throw new Error(`Task with id ${taskId} not found`);
        }
        
        const updatedTasks = currentState.tasks.filter(t => t.id !== taskId);
        
        // If addXP is true, add the task's XP to totalXP (task was finished)
        let newTotalXP = currentState.totalXP || 0;
        if (addXP) {
            newTotalXP += taskToDelete.XP;
            logger.info(`Added ${taskToDelete.XP} XP. New total: ${newTotalXP}`);
        }
        
        await this.setState({
            ...currentState,
            tasks: updatedTasks,
            totalXP: newTotalXP,
        });
        
        // Reschedule cleanup alarm
        await this.scheduleNextCleanupAlarm();
        
        logger.taskOperation('deleted', 1);
    }

    /**
     * Clean up expired tasks from state
     */
    private async cleanupExpiredTasks(): Promise<void> {
        const currentState = await this.state;
        const now = new Date();
        const activeTasks = currentState.tasks.filter(task => {
            // Handle Date objects that may have been serialized to strings
            const endTime = task.endTime instanceof Date 
                ? task.endTime 
                : new Date(task.endTime);
            return endTime > now;
        });
        
        if (activeTasks.length !== currentState.tasks.length) {
            const expiredCount = currentState.tasks.length - activeTasks.length;
            logger.taskOperation('cleaned up expired', expiredCount);
            await this.setState({
                ...currentState,
                tasks: activeTasks,
            });
        }
    }

    /**
     * Schedule the next alarm for the earliest task expiration
     */
    private async scheduleNextCleanupAlarm(): Promise<void> {
        try {
            const currentState = await this.state;
            if (currentState.tasks.length === 0) {
                // No tasks, delete any existing alarm
                const storage = (this as any).ctx?.storage;
                if (storage) {
                    const existingAlarm = await storage.getAlarm();
                    if (existingAlarm) {
                        await storage.deleteAlarm();
                    }
                }
                return;
            }

            // Find the earliest task expiration time
            const now = Date.now();
            const expirationTimes = currentState.tasks
                .map(task => {
                    const endTime = task.endTime instanceof Date ? task.endTime.getTime() : new Date(task.endTime).getTime();
                    return endTime;
                })
                .filter(time => time > now); // Only future expirations

            if (expirationTimes.length === 0) {
                // All tasks are expired, clean up now
                await this.cleanupExpiredTasks();
                return;
            }

            const earliestExpiration = Math.min(...expirationTimes);
            const storage = (this as any).ctx?.storage;
            
            if (!storage) {
                logger.warn('Storage not available for alarm scheduling');
                return;
            }

            const existingAlarm = await storage.getAlarm();

            // Only update alarm if it's different or doesn't exist
            if (!existingAlarm || existingAlarm !== earliestExpiration) {
                await storage.setAlarm(earliestExpiration);
                logger.debug(`Scheduled cleanup alarm for ${new Date(earliestExpiration).toISOString()}`);
            }
        } catch (error) {
            logger.error('Error scheduling cleanup alarm:', error);
        }
    }

    /**
     * Alarm handler - called when the scheduled alarm time is reached
     * This will clean up expired tasks and schedule the next alarm
     */
    async alarm(): Promise<void> {
        logger.info('Alarm triggered - cleaning up expired tasks');
        await this.cleanupExpiredTasks();
        await this.scheduleNextCleanupAlarm();
    }
}