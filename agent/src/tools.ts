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
            name: "calculateTaskTimes",
            description: "Calculate start and end times for a task based on relative time descriptions. This tool handles natural language time descriptions and returns proper ISO 8601 timestamps. Use this instead of manually calculating times from getCurrentTime. Examples: '1 hour from now', 'tomorrow', 'in 3 hours', 'next week'.",
            parameters: {
                type: "object",
                properties: {
                    startTimeDescription: {
                        type: "string",
                        description: "Description of when the task should start. Examples: '1 hour from now', 'tomorrow', 'in 2 hours', 'today', or an ISO 8601 timestamp. If not provided, defaults to 1 hour from now.",
                    },
                    endTimeDescription: {
                        type: "string",
                        description: "Description of when the task should end. Examples: '3 hours from now', 'tomorrow afternoon', 'in 5 hours', or an ISO 8601 timestamp. If not provided, will use durationHours/durationMinutes or default to 2 hours after start.",
                    },
                    durationHours: {
                        type: "number",
                        description: "Duration in hours from start time to end time. Used if endTimeDescription is not provided. Example: 2 for a 2-hour task.",
                    },
                    durationMinutes: {
                        type: "number",
                        description: "Duration in minutes from start time to end time. Can be combined with durationHours. Example: 30 for a 30-minute task.",
                    },
                },
                required: [],
            },
            function: agent.calculateTaskTimes.bind(agent),
        },
        {
            name: "createTask",
            description: "MANDATORY: Use this tool whenever the user asks you to create, add, or set up a task. Do not just describe the task - you MUST call this tool to actually create it. CRITICAL: You MUST call getCurrentTime first, use its return value to calculate times, and pass actual ISO 8601 timestamp strings (NOT the string 'getCurrentTime'). XP must be a number (NOT a string).",
            parameters: {
                type: "object",
                properties: {
                    taskName: { 
                        type: "string", 
                        description: "The name of the task/quest. Must be a string." 
                    },
                    taskDescription: { 
                        type: "string", 
                        description: "An epic, immersive description of the task in fantasy/D&D style. Must be a string." 
                    },
                    taskStartTime: { 
                        type: "string", 
                        format: "date-time", 
                        description: "The start time. Can be either: (1) ISO 8601 format (e.g., '2026-01-16T14:00:00.000Z'), OR (2) natural language relative time description (e.g., '1 hour from now', 'tomorrow', 'in 2 hours'). The system will automatically parse relative descriptions. Must be in the future and before taskEndTime." 
                    },
                    taskEndTime: { 
                        type: "string", 
                        format: "date-time", 
                        description: "The end time/deadline. Can be either: (1) ISO 8601 format (e.g., '2026-01-16T16:00:00.000Z'), OR (2) natural language relative time description (e.g., '3 hours from now', 'tomorrow afternoon', 'in 5 hours'). The system will automatically parse relative descriptions. Must be after taskStartTime and in the future." 
                    },
                    XP: { 
                        type: "number", 
                        description: "The experience points reward as a NUMBER (e.g., 100). DO NOT pass as a string like '100'. Must be an integer between 1 and 10000. Determine based on complexity, duration, and difficulty (typically 10-50 for simple, 50-100 for medium, 100+ for complex)." 
                    },
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

