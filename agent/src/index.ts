çimport { Agent, AgentNamespace, routeAgentRequest } from 'agents';
import { TaskMasterAgent } from './agent';
import { logger } from './logger';

export { TaskMasterAgent };

export interface Env {
  TaskMasterAgent: AgentNamespace<TaskMasterAgent>;
  AI: Ai;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    logger.request(request.method, new URL(request.url).pathname);
    
    // Routed addressing
    // Automatically routes HTTP requests and/or WebSocket connections to /agents/:agent/:name
    return (await routeAgentRequest(request, env)) || Response.json({ msg: 'no agent here' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;