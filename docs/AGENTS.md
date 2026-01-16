# AI Agent Documentation

This document provides comprehensive guidance for AI coding assistants (like Cursor, GitHub Copilot, etc.) working on the QuestMaster codebase.

**Note**: QuestMaster was developed with significant assistance from AI coding assistants. AI tools were instrumental in code generation, architecture design, documentation, debugging, and implementing features throughout the project lifecycle. This document serves as both a guide for future AI-assisted development and acknowledgment of the collaborative nature of this project.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Code Patterns](#code-patterns)
- [Common Tasks](#common-tasks)
- [Security Guidelines](#security-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Troubleshooting](#troubleshooting)

## Project Overview

QuestMaster is a D&D-themed task management application that gamifies productivity. Users interact with an AI Dungeon Master that transforms their tasks into epic quests with fantasy descriptions, XP rewards, levels, and streaks.

### Key Components

1. **Agent** (`agent/`): Cloudflare Worker with Durable Object
   - Manages persistent state (tasks, XP, streaks)
   - Handles AI interactions via Cloudflare AI
   - Provides tools for task management
   - Streams responses using Server-Sent Events

2. **Frontend** (`frontend/`): Next.js application
   - Chat interface for AI interactions
   - Task dashboard with search and filters
   - Account page (XP, level, streaks)
   - Quest history and statistics

## Architecture Deep Dive

### Request Flow

```
User Browser
    ↓ HTTPS
Cloudflare Pages (Frontend)
    ↓ NextAuth.js Authentication
    ↓ Signed Token Generation (HMAC-SHA256)
    ↓ HTTPS + Authorization Header
Cloudflare Workers (Agent Entry Point)
    ↓ Authentication Validation
    ↓ Rate Limiting Check
    ↓ Route to Handler
Durable Object (QuestMasterAgent)
    ↓ Process Request
    ↓ AI Model Interaction (if chat)
    ↓ Tool Execution (if needed)
    ↓ Stream Response (SSE)
    ↑ Response
```

### State Management

**Agent State** (`DMState`):
- `tasks`: Array of active tasks
- `completedQuests`: Array of completed tasks with completion dates
- `totalXP`: Total experience points earned
- `currentStreak`: Current daily completion streak
- `longestStreak`: Longest streak achieved
- `lastCompletionDate`: Date of last task completion
- `graceDaysUsedThisWeek`: Grace days used (1 per week allowed)
- `lastGraceWeekReset`: When grace week was last reset
- `timezone`: User's timezone (stored from header)

**Frontend State**:
- Tasks fetched via `useTasks` hook
- Chat messages managed via `useChat` hook
- Optimistic updates for instant feedback
- Rollback on error

### Authentication & Security

1. **Frontend Authentication**:
   - NextAuth.js with GitHub OAuth
   - Session stored in HTTP-only cookies
   - Server-side session ID generation

2. **Agent Authentication**:
   - Signed tokens: `{sessionId}:{timestamp}:{signature}`
   - Signature: HMAC-SHA256 of `{sessionId}:{timestamp}` using `AUTH_SECRET`
   - Token expiration: 5 minutes
   - Validation: Token must match session ID in URL path

3. **Rate Limiting**:
   - Chat: 30 requests/minute per session
   - Tasks: 60 requests/minute per session
   - Uses Cloudflare Rate Limiting API (distributed)

4. **Input Validation**:
   - Server-side validation for all inputs
   - Prompt injection detection
   - Tool parameter validation

## Code Patterns

### Agent Patterns

#### Adding a New Tool

```typescript
// 1. Define tool in agent/src/tools.ts
export function createTools(agent: QuestMasterAgent) {
  return {
    // ... existing tools
    newTool: {
      description: "Description of what the tool does",
      parameters: {
        type: "object",
        properties: {
          param1: { type: "string", description: "..." },
          param2: { type: "number", description: "..." }
        },
        required: ["param1"]
      }
    }
  };
}

// 2. Implement function in agent/src/agent.ts
async newTool(param1: string, param2: number): Promise<string> {
  // Validate inputs
  if (!param1 || param1.length === 0) {
    throw new Error("param1 is required");
  }
  
  // Perform operation
  // Update state if needed
  this.state.someProperty = newValue;
  
  // Return result
  return `Tool executed: ${param1}`;
}
```

#### Handling Requests

```typescript
// In agent/src/agent.ts
async onRequest(request: Request): Promise<Response> {
  // Store timezone if provided
  await this.handleTimezoneHeader(request);
  
  // Route requests
  if (request.method === 'GET') {
    return await handleGetRequest(this, request);
  }
  
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await handlePostRequest(this, request);
    }
    // Chat request
    return handleChatRequest(this, request, this.TOOLS);
  }
  
  return new Response('Method not allowed', { status: 405 });
}
```

#### Streaming Responses

```typescript
// In agent/src/utils/streaming.ts
export async function streamResponse(
  generator: AsyncGenerator<string, void, unknown>
): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Frontend Patterns

#### Custom Hooks

```typescript
// Example: useTasks hook pattern
export function useTasks(session: Session | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    // ... fetch logic
  }, [session]);
  
  // Optimistic updates
  const optimisticallyAddTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
  }, []);
  
  // Rollback on error
  const rollbackTasks = useCallback((previousTasks: Task[]) => {
    setTasks(previousTasks);
  }, []);
  
  return {
    tasks,
    isLoading,
    fetchTasks,
    optimisticallyAddTask,
    rollbackTasks
  };
}
```

#### API Routes

```typescript
// frontend/src/app/api/agent/route.ts
export async function POST(request: Request) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Generate auth token
  const sessionId = await getSessionId(session.user.id);
  const token = await generateAuthToken(sessionId);
  
  // 3. Forward request to agent
  const agentUrl = process.env.AGENT_URL || 'http://localhost:8787';
  const response = await fetch(`${agentUrl}/agents/quest-master-agent/${sessionId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
      'X-User-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    body: await request.text()
  });
  
  // 4. Return response
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
}
```

#### Optimistic Updates

```typescript
// Pattern for optimistic updates
const handleCreateTask = async (taskData: TaskData) => {
  // 1. Save previous state for rollback
  const previousTasks = [...tasks];
  
  // 2. Optimistically update UI
  const optimisticTask = { ...taskData, id: 'temp-' + Date.now() };
  optimisticallyAddTask(optimisticTask);
  
  try {
    // 3. Make API call
    const createdTask = await createTask(taskData);
    
    // 4. Replace optimistic task with real task
    optimisticallyUpdateTask(optimisticTask.id, createdTask);
  } catch (error) {
    // 5. Rollback on error
    rollbackTasks(previousTasks);
    // Show error message
  }
};
```

## Common Tasks

### Adding a New Task Operation

1. **Add tool to agent** (`agent/src/tools.ts`)
2. **Implement function** (`agent/src/agent.ts`)
3. **Add validation** (`agent/src/utils/validation.ts`)
4. **Add frontend function** (`frontend/src/utils/taskOperations.ts`)
5. **Update UI** (components, hooks)
6. **Add tests** (`agent/tests/`)

### Modifying AI Behavior

1. **Edit system prompt** (`agent/src/system_prompt.ts`)
   - Maintain Tolkien-esque fantasy style
   - Update tool usage examples
   - Adjust security directives

2. **Update tool descriptions** (`agent/src/tools.ts`)
   - Clear, concise descriptions
   - Include examples
   - Specify parameter requirements

3. **Adjust validation** (`agent/src/utils/validation.ts`)
   - Add parameter checks
   - Improve error messages
   - Update prompt injection patterns

### Adding a New Page

1. **Create page** (`frontend/src/app/{route}/page.tsx`)
2. **Add navigation** (if needed)
3. **Add skeleton loading** (`frontend/src/components/Skeletons.tsx`)
4. **Update types** (`frontend/src/types/index.ts`)
5. **Add error handling**
6. **Test thoroughly**

## Security Guidelines

### Always Validate

- ✅ Server-side validation for all inputs
- ✅ Authentication checks before processing
- ✅ Rate limiting on all API endpoints
- ✅ Token validation with expiration
- ✅ Session ID matching verification

### Never Trust Client

- ❌ Don't rely on client-side validation alone
- ❌ Don't expose secrets in client code
- ❌ Don't skip authentication checks
- ❌ Don't allow client-controlled session IDs

### Input Sanitization

- Validate length (min/max)
- Trim whitespace
- Check for prompt injection patterns
- Validate tool parameters strictly
- Return clear error messages

### Authentication Flow

1. User authenticates via NextAuth.js
2. Frontend generates signed token
3. Token sent to agent with request
4. Agent validates token before processing
5. Session ID must match between token and URL

## Testing Guidelines

### Agent Tests

```typescript
// agent/tests/agent.test.ts
import { describe, it, expect } from 'vitest';
import { QuestMasterAgent } from '../src/agent';

describe('QuestMasterAgent', () => {
  it('should create a task', async () => {
    // Test implementation
  });
  
  it('should validate task parameters', async () => {
    // Test validation
  });
});
```

### Manual Testing

- Use `agent/tests/manual-agent-test.js` for agent testing
- Use `agent/tests/task-timing-test.js` for timing validation
- Test authentication flow end-to-end
- Test rate limiting
- Test error scenarios

### Frontend Testing

- Build check: `npm run build`
- Type check: `npx tsc --noEmit`
- Manual browser testing
- Test optimistic updates
- Test error handling

## Troubleshooting

### Common Issues

**Agent won't start**
- Check `AUTH_SECRET` in `.dev.vars`
- Verify Cloudflare AI binding
- Check Wrangler version

**Frontend can't connect to agent**
- Verify agent is running on port 8787
- Check `AGENT_URL` in `.env.local`
- Check CORS settings

**Authentication errors**
- Verify `AUTH_SECRET` matches `NEXTAUTH_SECRET`
- Check token generation logic
- Verify session ID extraction

**SQL errors**
- Clear `.wrangler` directory
- Restart dev server
- Check migrations

### Debugging Tips

1. **Check logs**: Agent logs in terminal, frontend logs in browser console
2. **Verify state**: Check Durable Object state via Wrangler
3. **Test endpoints**: Use curl or Postman to test API directly
4. **Check network**: Use browser DevTools Network tab
5. **Verify auth**: Check token generation and validation

## Best Practices

1. **Follow existing patterns** - Match code style and structure
2. **Update types** - Keep TypeScript types synchronized
3. **Add validation** - Always validate on server side
4. **Test thoroughly** - Test locally before committing
5. **Update docs** - Keep documentation current
6. **Consider security** - Validate auth, rate limit, sanitize inputs
7. **Optimize UX** - Use optimistic updates, skeleton states, lazy loading
8. **Handle errors** - Proper error handling and user feedback
9. **Stream responses** - Use SSE for chat responses
10. **Memoize expensive operations** - Use `useMemo` and `useCallback`

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Project Architecture](ARCHITECTURE.md)
- [API Documentation](API.md)
- [Development Guide](DEVELOPMENT.md)

---

**Last Updated**: 2026-01-15

