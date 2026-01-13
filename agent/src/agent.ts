import { Agent } from "agents";

import { runWithTools } from "@cloudflare/ai-utils";
import { systemPromptDM } from "./system_prompt";


interface Env {
    AI: Ai
}

interface DMState {
    tasks: Task[];
}

interface Task {
    id: string;
    name: string;
    description: string;
    startTime: Date;
    endTime: Date;
    XP: number;
}

export class TaskMasterAgent extends Agent<Env, DMState> {
    initialState: DMState = {
        tasks: []
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
        // Handle GET requests for fetching tasks
        if (request.method === 'GET') {
            console.log('=== GET REQUEST FOR TASKS ===');
            const currentState = await this.state;
            console.log(`Current state has ${currentState.tasks.length} task(s)`);
            if (currentState.tasks.length > 0) {
                console.log('Tasks in state:', currentState.tasks.map(t => ({ id: t.id, name: t.name })));
            }
            const tasks = currentState.tasks.map(task => ({
                id: task.id,
                name: task.name,
                description: task.description,
                startTime: task.startTime.toISOString(),
                endTime: task.endTime.toISOString(),
                XP: task.XP
            }));
            
            console.log(`Returning ${tasks.length} task(s) in GET response`);
            return new Response(JSON.stringify({ tasks }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }

        // Handle POST requests for chat messages
        this.createdTasksThisMessage = [];
        console.log('=== STARTING POST REQUEST ===');
        console.log('createdTasksThisMessage reset, current count:', this.createdTasksThisMessage.length);

        const userContent = await request.text();
        console.log('User content:', userContent);

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
        
        console.log('=== RUNWITHTOOLS COMPLETE ===');
        console.log('Tasks created during runWithTools:', this.createdTasksThisMessage.length);
        if (this.createdTasksThisMessage.length > 0) {
            console.log('Created tasks details:', this.createdTasksThisMessage.map(t => ({ id: t.id, name: t.name })));
        }

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
                    // Use agentInstance to access the tasks created during this message
                    const tasksCreated = agentInstance.createdTasksThisMessage;
                    console.log(`=== CHECKING FOR CREATED TASKS AFTER STREAM ===`);
                    console.log(`Tasks created count: ${tasksCreated.length}`);
                    console.log(`Agent instance tasks count: ${agentInstance.createdTasksThisMessage.length}`);
                    
                    // Also verify state has the tasks
                    const currentState = await agentInstance.state;
                    console.log(`Tasks in persisted state: ${currentState.tasks.length}`);
                    if (currentState.tasks.length > 0) {
                        console.log('State tasks:', currentState.tasks.map(t => ({ id: t.id, name: t.name })));
                    }
                    
                    // If createdTasksThisMessage is empty but state has new tasks, use state tasks instead
                    const tasksToSend = tasksCreated.length > 0 ? tasksCreated : currentState.tasks;
                    console.log(`Tasks to send in metadata: ${tasksToSend.length}`);
                    
                    if (tasksToSend.length > 0) {
                        console.log(`Sending ${tasksToSend.length} task(s) metadata after stream`);
                        const serializedTasks = tasksToSend.map((task: Task) => ({
                            id: task.id,
                            name: task.name,
                            description: task.description,
                            startTime: task.startTime.toISOString(),
                            endTime: task.endTime.toISOString(),
                            XP: task.XP
                        }));
                        
                        console.log('Serialized tasks:', JSON.stringify(serializedTasks, null, 2));
                        
                        // Send metadata as SSE formatted data
                        const metadataJson = JSON.stringify({
                            type: "metadata",
                            tasks: serializedTasks
                        });
                        controller.enqueue(encoder.encode(`data: ${metadataJson}\n\n`));
                        console.log('=== METADATA SENT TO STREAM ===');
                    } else {
                        console.log('No tasks to send in metadata');
                    }
                    
                    // Send done marker
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('Error in stream:', error);
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
        console.log('=== TOOL CALL: createTask ===');
        console.log('Parameters received (raw):', JSON.stringify(params, null, 2));
        
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
            console.log('Detected incorrect parameter structure, extracting from nested object...');
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
        
        console.log('Extracted parameters:', {
            taskName,
            taskDescription,
            taskStartTime,
            taskEndTime,
            XP
        });
        
        if (!taskName || !taskDescription || !taskStartTime || !taskEndTime || XP === undefined || XP === null) {
            console.error('Missing required parameters for createTask');
            console.error('taskName:', taskName, typeof taskName);
            console.error('taskDescription:', taskDescription, typeof taskDescription);
            console.error('taskStartTime:', taskStartTime, typeof taskStartTime);
            console.error('taskEndTime:', taskEndTime, typeof taskEndTime);
            console.error('XP:', XP, typeof XP);
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
            
            console.log('Created task object:', {
                id: newTask.id,
                name: newTask.name,
                startTime: newTask.startTime.toISOString(),
                endTime: newTask.endTime.toISOString(),
                XP: newTask.XP
            });
            
            const updatedState = {
                ...currentState,
                tasks: [...currentState.tasks, newTask],
            };
            console.log('Calling setState with:', {
                currentTasks: currentState.tasks.length,
                newTasks: updatedState.tasks.length,
                newTaskId: newTask.id
            });
            
            await this.setState(updatedState);
            console.log('setState completed');

            // Verify state was updated
            const verifyState = await this.state;
            console.log(`State verification: ${verifyState.tasks.length} task(s) in state`);
            if (verifyState.tasks.length > 0) {
                console.log('Tasks in state:', verifyState.tasks.map(t => ({ id: t.id, name: t.name })));
            }

            this.createdTasksThisMessage.push(newTask);
            console.log(`Added task to createdTasksThisMessage. Current count: ${this.createdTasksThisMessage.length}`);
            console.log('Task successfully created and added!');
            
            // Don't call scheduleNextCleanupAlarm here - it triggers immediate cleanup
            // Cleanup should happen via alarms, not synchronously after task creation
            
            console.log('=== TOOL CALL: createTask - COMPLETE ===');
            return newTask;
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }

    async getCurrentTime(): Promise<string> {
        console.log('=== TOOL CALL: getCurrentTime ===');
        const currentTime = new Date().toISOString();
        console.log('Current time:', currentTime);
        console.log('=== TOOL CALL: getCurrentTime - COMPLETE ===');
        return currentTime;
    }

    async viewTasks() {
        console.log('=== TOOL CALL: viewTasks ===');
        const currentState = await this.state;
        console.log(`Retrieving tasks. Total tasks: ${currentState.tasks.length}`);
        if (currentState.tasks.length > 0) {
            console.log('Tasks:', currentState.tasks.map(t => ({
                id: t.id,
                name: t.name,
                startTime: t.startTime.toISOString(),
                endTime: t.endTime.toISOString(),
                XP: t.XP
            })));
        }
        console.log('=== TOOL CALL: viewTasks - COMPLETE ===');
        return currentState.tasks;
    }

    /**
     * Clean up expired tasks from state
     */
    private async cleanupExpiredTasks(): Promise<void> {
        const currentState = await this.state;
        const now = new Date();
        const activeTasks = currentState.tasks.filter(task => task.endTime > now);
        
        if (activeTasks.length !== currentState.tasks.length) {
            const expiredCount = currentState.tasks.length - activeTasks.length;
            console.log(`Cleaning up ${expiredCount} expired task(s)`);
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
            console.log('scheduleNextCleanupAlarm: current tasks:', currentState.tasks.length);
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
            console.log('scheduleNextCleanupAlarm: current time:', new Date(now).toISOString());
            console.log('scheduleNextCleanupAlarm: tasks:', currentState.tasks.map(t => ({
                id: t.id,
                name: t.name,
                endTime: t.endTime instanceof Date ? t.endTime.toISOString() : String(t.endTime),
                endTimeType: typeof t.endTime
            })));
            
            const expirationTimes = currentState.tasks
                .map(task => {
                    const endTime = task.endTime instanceof Date ? task.endTime.getTime() : new Date(task.endTime).getTime();
                    console.log(`Task ${task.id}: endTime=${task.endTime instanceof Date ? task.endTime.toISOString() : task.endTime}, timestamp=${endTime}, now=${now}, isFuture=${endTime > now}`);
                    return endTime;
                })
                .filter(time => time > now); // Only future expirations

            console.log('scheduleNextCleanupAlarm: expirationTimes.length:', expirationTimes.length);
            if (expirationTimes.length === 0) {
                // All tasks are expired, clean up now
                console.log('scheduleNextCleanupAlarm: All tasks expired, cleaning up...');
                await this.cleanupExpiredTasks();
                return;
            }

            const earliestExpiration = Math.min(...expirationTimes);
            const storage = (this as any).ctx?.storage;
            
            if (!storage) {
                console.warn('Storage not available for alarm scheduling');
                return;
            }

            const existingAlarm = await storage.getAlarm();

            // Only update alarm if it's different or doesn't exist
            if (!existingAlarm || existingAlarm !== earliestExpiration) {
                await storage.setAlarm(earliestExpiration);
                console.log(`Scheduled cleanup alarm for ${new Date(earliestExpiration).toISOString()}`);
            }
        } catch (error) {
            console.error('Error scheduling cleanup alarm:', error);
        }
    }

    /**
     * Alarm handler - called when the scheduled alarm time is reached
     * This will clean up expired tasks and schedule the next alarm
     */
    async alarm(): Promise<void> {
        console.log('Alarm triggered - cleaning up expired tasks');
        await this.cleanupExpiredTasks();
        await this.scheduleNextCleanupAlarm();
    }
}