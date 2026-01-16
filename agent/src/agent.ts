import { Agent, AgentNamespace } from "agents";
import { logger } from "./logger";
import { Env, DMState, Task, CompletedQuest } from "./types";
import { createTools } from "./tools";
import { handleGetRequest, handlePostRequest } from "./handlers/requestHandlers";
import { handleChatRequest } from "./handlers/chatHandler";
import { calculateStreak } from "./utils/streak";
import { validateTaskParameters } from "./utils/validation";

export class QuestMasterAgent extends Agent<Env, DMState> {
    initialState: DMState = {
        tasks: [],
        completedQuests: [],
        timezone: undefined,
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
        graceDaysUsedThisWeek: 0,
        lastGraceWeekReset: null
    };

    public createdTasksThisMessage: Task[] = [];

    get TOOLS() {
        return createTools(this);
    }
    
    async onRequest(request: Request): Promise<Response> {
        // Store timezone if provided
        await this.handleTimezoneHeader(request);

        // Route to appropriate handler
        if (request.method === 'GET') {
            const response = await handleGetRequest(this, request);
            if (response) return response;
        }

        if (request.method === 'POST') {
            const contentType = request.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const response = await handlePostRequest(this, request);
                if (response) return response;
            }
            // If not JSON, treat as chat request
            return handleChatRequest(this, request, this.TOOLS);
        }

        return new Response('Method not allowed', { status: 405 });
    }

    private async handleTimezoneHeader(request: Request): Promise<void> {
        const timezoneHeader = request.headers.get('x-timezone');
        if (timezoneHeader) {
            const currentState = await this.state;
            if (!currentState.timezone) {
                await this.setState({
                    ...currentState,
                    timezone: timezoneHeader,
                });
                logger.info('Stored user timezone:', timezoneHeader);
            }
        }
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
        
        // Handle XP type conversion - convert string to number if needed
        if (typeof XP === 'string') {
            const parsedXP = parseInt(XP, 10);
            if (!isNaN(parsedXP)) {
                XP = parsedXP;
                logger.debug('Converted XP from string to number:', { original: params.XP, converted: XP });
            } else {
                XP = 0;
            }
        }
        
        // Handle relative time descriptions - if times are not ISO 8601, try to parse them
        const currentState = await this.state;
        const currentTime = new Date();
        
        // Check if startTime looks like a relative description (not ISO 8601)
        if (taskStartTime && !taskStartTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            logger.debug('Parsing relative start time description:', taskStartTime);
            const parsedStart = this.parseTimeDescription(taskStartTime, currentTime);
            taskStartTime = parsedStart.toISOString();
        }
        
        // Check if endTime looks like a relative description (not ISO 8601)
        if (taskEndTime && !taskEndTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            logger.debug('Parsing relative end time description:', taskEndTime);
            const parsedEnd = this.parseTimeDescription(taskEndTime, currentTime);
            taskEndTime = parsedEnd.toISOString();
        }
        
        // Validate all task parameters with strict validation
        const validationResult = validateTaskParameters(
            {
                taskName,
                taskDescription,
                taskStartTime,
                taskEndTime,
                XP,
            },
            currentTime
        );
        
        if (!validationResult.valid) {
            // Create a detailed error message that helps the model correct its parameters
            const errorDetails = validationResult.errors.map(err => {
                // Provide specific guidance for common errors
                if (err.includes('Invalid start time format')) {
                    return `${err} Please provide either an ISO 8601 timestamp (e.g., "2026-01-16T14:00:00.000Z") or a natural language description (e.g., "1 hour from now", "tomorrow").`;
                }
                if (err.includes('Invalid end time format')) {
                    return `${err} Please provide either an ISO 8601 timestamp (e.g., "2026-01-16T16:00:00.000Z") or a natural language description (e.g., "3 hours from now", "tomorrow afternoon").`;
                }
                if (err.includes('XP must be a number')) {
                    return `${err} Please provide XP as a number (e.g., 50) not a string (not "50").`;
                }
                if (err.includes('Start time must be in the future')) {
                    return `${err} Please calculate a future time. If you used a relative description, try something like "1 hour from now" or "tomorrow".`;
                }
                if (err.includes('End time must be after start time')) {
                    return `${err} Make sure the end time is later than the start time.`;
                }
                return err;
            }).join('\n');
            
            const errorMessage = `Task creation failed. Please correct the following errors and try again:\n${errorDetails}\n\nCurrent parameters:\n- taskName: "${taskName}"\n- taskStartTime: "${taskStartTime}"\n- taskEndTime: "${taskEndTime}"\n- XP: ${XP} (type: ${typeof XP})\n\nPlease call createTask again with corrected parameters.`;
            
            logger.error('Task parameter validation failed:', {
                errors: validationResult.errors,
                params: { taskName, taskDescription, taskStartTime, taskEndTime, XP }
            });
            throw new Error(errorMessage);
        }
        
        try {
            const newTask: Task = {
                id: crypto.randomUUID(),
                name: taskName.trim(),
                description: taskDescription.trim(),
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

    async calculateTaskTimes(params: { 
        startTimeDescription?: string; 
        endTimeDescription?: string;
        durationHours?: number;
        durationMinutes?: number;
    }): Promise<{ startTime: string; endTime: string }> {
        logger.toolCall('calculateTaskTimes', params);
        const currentState = await this.state;
        const now = new Date();
        
        let startTime: Date;
        let endTime: Date;
        
        // Parse start time description
        if (params.startTimeDescription) {
            startTime = this.parseTimeDescription(params.startTimeDescription, now);
        } else {
            // Default: start in 1 hour
            startTime = new Date(now.getTime() + 60 * 60 * 1000);
        }
        
        // Parse end time description or calculate from duration
        if (params.endTimeDescription) {
            endTime = this.parseTimeDescription(params.endTimeDescription, now);
        } else if (params.durationHours || params.durationMinutes) {
            const durationMs = (params.durationHours || 0) * 60 * 60 * 1000 + 
                             (params.durationMinutes || 0) * 60 * 1000;
            endTime = new Date(startTime.getTime() + durationMs);
        } else {
            // Default: end 2 hours after start
            endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
        }
        
        // Ensure end time is after start time
        if (endTime <= startTime) {
            endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default to 1 hour duration
        }
        
        // Ensure start time is in the future
        if (startTime <= now) {
            startTime = new Date(now.getTime() + 60 * 60 * 1000); // Default to 1 hour from now
        }
        
        return {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
        };
    }

    private parseTimeDescription(description: string, referenceTime: Date): Date {
        const desc = description.toLowerCase().trim();
        const now = referenceTime;
        
        // Handle "now" or "immediately"
        if (desc === 'now' || desc === 'immediately' || desc === 'asap') {
            return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now (minimum)
        }
        
        // Handle relative hours: "1 hour", "2 hours", "in 3 hours"
        const hourMatch = desc.match(/(?:in\s+)?(\d+)\s+hour(?:s)?/);
        if (hourMatch) {
            const hours = parseInt(hourMatch[1], 10);
            return new Date(now.getTime() + hours * 60 * 60 * 1000);
        }
        
        // Handle relative minutes: "30 minutes", "in 15 minutes"
        const minuteMatch = desc.match(/(?:in\s+)?(\d+)\s+minute(?:s)?/);
        if (minuteMatch) {
            const minutes = parseInt(minuteMatch[1], 10);
            return new Date(now.getTime() + minutes * 60 * 1000);
        }
        
        // Handle "tomorrow"
        if (desc.includes('tomorrow')) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(12, 0, 0, 0); // Default to noon
            return tomorrow;
        }
        
        // Handle "next week"
        if (desc.includes('next week')) {
            const nextWeek = new Date(now);
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextWeek.setHours(9, 0, 0, 0); // Default to 9 AM
            return nextWeek;
        }
        
        // Handle "today"
        if (desc.includes('today')) {
            const today = new Date(now);
            today.setHours(now.getHours() + 2, 0, 0, 0); // 2 hours from now
            return today;
        }
        
        // Try to parse as ISO 8601
        try {
            const parsed = new Date(description);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        } catch {
            // Ignore
        }
        
        // Default: 1 hour from now
        return new Date(now.getTime() + 60 * 60 * 1000);
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
        
        // If addXP is true, add the task's XP to totalXP and move to completed quests
        let newTotalXP = currentState.totalXP || 0;
        let updatedCompletedQuests = [...(currentState.completedQuests || [])];
        let streakBonus = 0;
        
        if (addXP) {
            const completionDate = new Date();
            
            // Calculate streak
            const streakData = calculateStreak(currentState, completionDate);
            
            // Calculate streak bonus (10% bonus for 7+ day streak)
            const baseXP = taskToDelete.XP;
            if (streakData.currentStreak >= 7) {
                streakBonus = Math.floor(baseXP * 0.1);
                logger.info(`Streak bonus: +${streakBonus} XP (${streakData.currentStreak} day streak)`);
            }
            
            const totalXPForQuest = baseXP + streakBonus;
            newTotalXP += totalXPForQuest;
            logger.info(`Added ${baseXP} XP (+${streakBonus} streak bonus). New total: ${newTotalXP}`);
            
            // Move task to completed quests history
            const completedQuest: CompletedQuest = {
                ...taskToDelete,
                completionDate: completionDate,
            };
            updatedCompletedQuests.push(completedQuest);
            logger.info(`Moved quest "${taskToDelete.name}" to completed quests history`);
            
            await this.setState({
                ...currentState,
                tasks: updatedTasks,
                completedQuests: updatedCompletedQuests,
                totalXP: newTotalXP,
                currentStreak: streakData.currentStreak,
                longestStreak: streakData.longestStreak,
                lastCompletionDate: streakData.lastCompletionDate,
                graceDaysUsedThisWeek: streakData.graceDaysUsedThisWeek,
                lastGraceWeekReset: streakData.lastGraceWeekReset,
            });
        } else {
            await this.setState({
                ...currentState,
                tasks: updatedTasks,
            });
        }
        
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
    // @ts-ignore - Agent base class defines alarm as optional, but we need to implement it
    async alarm(): Promise<void> {
        logger.info('Alarm triggered - cleaning up expired tasks');
        await this.cleanupExpiredTasks();
        await this.scheduleNextCleanupAlarm();
    }
}