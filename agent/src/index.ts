import { Agent, AgentNamespace, getAgentByName, routeAgentRequest } from 'agents';

import { TaskMasterAgent } from './agent';

export { TaskMasterAgent };

export interface Env {
  // Define your Agent on the environment here
  // Passing your Agent class as a TypeScript type parameter allows you to call
  // methods defined on your Agent.
  TaskMasterAgent: AgentNamespace<TaskMasterAgent>;
  AI: Ai;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // Routed addressing
    // Automatically routes HTTP requests and/or WebSocket connections to /agents/:agent/:name
    // Best for: connecting React apps directly to Agents using useAgent from agents/react
    return (await routeAgentRequest(request, env)) || Response.json({ msg: 'no agent here' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;