import { QuestMasterAgent } from './agent';

/**
 * Define the tools available to the AI agent
 */
export function createTools(agent: QuestMasterAgent) {
    return [
        {
            name: "getCurrentTime",
            description: "Get the current date and time in ISO 8601 format. Use this to determine appropriate start and end times for tasks.",
            parameters: {
                type: "object",
                properties: {},
            },
            function: agent.getCurrentTime.bind(agent),
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
            function: agent.createTask.bind(agent),
        },
        {
            name: "viewTasks",
            description: "View all active tasks (quests) currently in the user's quest log. Returns an array of all tasks.",
            parameters: {
                type: "object",
                properties: {},
            },
            function: agent.viewTasks.bind(agent),
        },
    ];
}

