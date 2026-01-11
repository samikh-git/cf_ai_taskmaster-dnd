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
    
    async onMessage(connection: Connection, message: WSMessage) {
        console.log(`TaskMasterAgent received message:`, JSON.stringify(message, null, 2));

        this.createdTasksThisMessage = [];

        // Ensure cleanup alarm is scheduled when agent is active
        await this.scheduleNextCleanupAlarm();

        // Ensure message.content is a string
        const userContent = typeof message.content === 'string' 
            ? message.content 
            : typeof message === 'string' 
                ? message 
                : JSON.stringify(message);
        
        if (!userContent || userContent.trim().length === 0) {
            console.error('Received empty or invalid message content');
            connection.send(JSON.stringify({ error: 'Message content is required' }));
            return;
        }

        const answer = await runWithTools(
            this.env.AI,
            // Model with function calling support
            "@hf/nousresearch/hermes-2-pro-mistral-7b",
            {
              // Messages
              messages: [
                {role: "system", content: systemPromptDM}, 
                {role: "user", content: userContent}],
              // Definition of available tools the AI model can leverage
              tools: this.TOOLS,
            },
          );

        const decoder = new TextDecoder();
        
        let baseStream: ReadableStream<Uint8Array>;
        
        if (answer instanceof ReadableStream) {
            baseStream = answer;
        } else if (answer instanceof Response && answer.body) {
            baseStream = answer.body;
        } else {
            const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
            const encoder = new TextEncoder();
            baseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(text));
                    controller.close();
                }
            });
        }
        
        const reader = baseStream.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                
                connection.send(chunk);
            }
        } catch (error) {
            console.error('Error streaming response:', error);
        }
        
        // Check for created tasks after streaming is complete
        const createdTasks = this.createdTasksThisMessage;
        console.log(`Checking for created tasks. Count: ${createdTasks.length}`);
        
        if (createdTasks.length > 0) {
            // Serialize tasks with proper Date handling
            const serializedTasks = createdTasks.map(task => ({
                id: task.id,
                name: task.name,
                description: task.description,
                startTime: task.startTime.toISOString(),
                endTime: task.endTime.toISOString(),
                XP: task.XP
            }));
            
            const metadata = JSON.stringify({
                type: "metadata",
                tasks: serializedTasks
            });
            
            console.log('Sending task metadata:', metadata);
            connection.send(metadata);
        } else {
            console.log('No tasks created in this message, skipping metadata');
        }
        
        return;
    }

    async createTask(taskName: string, taskDescription: string, taskStartTime: string, taskEndTime: string, XP: number) {
        console.log(`Creating task: ${taskName}, ${taskDescription}, ${taskStartTime}, ${taskEndTime}, ${XP}`);
        const currentState = await this.state;
        const newTask: Task = {
            id: crypto.randomUUID(),
            name: taskName,
            description: taskDescription,
            startTime: new Date(taskStartTime),
            endTime: new Date(taskEndTime),
            XP: XP,
        };
        await this.setState({
            ...currentState,
            tasks: [...currentState.tasks, newTask],
        });

        this.createdTasksThisMessage.push(newTask);
        console.log(`Added task to createdTasksThisMessage. Current count: ${this.createdTasksThisMessage.length}`);
        
        // Schedule cleanup alarm after adding a new task
        await this.scheduleNextCleanupAlarm();
        
        return newTask;
    }

    async getCurrentTime(): Promise<string> {
        return new Date().toISOString();
    }

    async viewTasks() {
        const currentState = await this.state;
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
                .map(task => task.endTime.getTime())
                .filter(time => time > now); // Only future expirations

            if (expirationTimes.length === 0) {
                // All tasks are expired, clean up now
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