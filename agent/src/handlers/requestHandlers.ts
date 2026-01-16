import { QuestMasterAgent } from '../agent';
import { logger } from '../logger';
import { serializeTask, serializeCompletedQuest } from '../utils/serialization';
import { calculateStatistics } from '../utils/statistics';

/**
 * Handle GET requests for tasks and history
 */
export async function handleGetRequest(
    agent: QuestMasterAgent,
    request: any
): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check if requesting history/stats
    if (path.includes('/history') || url.searchParams.get('history') === 'true') {
        return handleHistoryRequest(agent);
    }

    // Regular tasks endpoint
    return handleTasksRequest(agent);
}

async function handleHistoryRequest(agent: QuestMasterAgent): Promise<Response> {
    const currentState = await agent.state;
    logger.request('GET', '/history', { completedCount: currentState.completedQuests?.length || 0 });

    const completedQuests = (currentState.completedQuests || []).map(serializeCompletedQuest);

    const statistics = calculateStatistics(
        currentState.completedQuests || [],
        currentState.totalXP || 0,
        currentState.tasks.length
    );

    return new Response(
        JSON.stringify({
            completedQuests,
            statistics,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

async function handleTasksRequest(agent: QuestMasterAgent): Promise<Response> {
    const currentState = await agent.state;
    logger.request('GET', '/tasks', { taskCount: currentState.tasks.length });

    const tasks = currentState.tasks.map(serializeTask);

    return new Response(
        JSON.stringify({
            tasks,
            totalXP: currentState.totalXP || 0,
            currentStreak: currentState.currentStreak || 0,
            longestStreak: currentState.longestStreak || 0,
            lastCompletionDate: currentState.lastCompletionDate || null,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

/**
 * Handle POST requests for direct task operations (bypassing AI)
 */
export async function handlePostRequest(
    agent: QuestMasterAgent,
    request: any
): Promise<Response | null> {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        return null;
    }

    try {
        const body = (await request.json()) as { tool?: string; params?: any };

        if (body.tool === 'createTask' && body.params) {
            return handleCreateTask(agent, body.params);
        }

        if (body.tool === 'updateTask' && body.params) {
            return handleUpdateTask(agent, body.params);
        }

        if (body.tool === 'deleteTask' && body.params) {
            return handleDeleteTask(agent, body.params);
        }
    } catch (error) {
        logger.error('Error in direct task operation:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process tool call',
            }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }

    return null;
}

async function handleCreateTask(agent: QuestMasterAgent, params: any): Promise<Response> {
    logger.request('POST', '/createTask', params);
    const createdTask = await agent.createTask(params);
    return new Response(
        JSON.stringify({
            success: true,
            task: serializeTask(createdTask),
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

async function handleUpdateTask(agent: QuestMasterAgent, params: any): Promise<Response> {
    logger.request('POST', '/updateTask', params);
    const updatedTask = await agent.updateTask(params);
    return new Response(
        JSON.stringify({
            success: true,
            task: serializeTask(updatedTask),
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

async function handleDeleteTask(agent: QuestMasterAgent, params: any): Promise<Response> {
    logger.request('POST', '/deleteTask', params);
    const addXP = params.addXP === true;
    await agent.deleteTask(params.taskId, addXP);
    return new Response(
        JSON.stringify({
            success: true,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

