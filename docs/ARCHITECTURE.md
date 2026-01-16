# QuestMaster Architecture

## Overview

QuestMaster is a full-stack application built on Cloudflare's edge computing platform. It consists of two main components:

1. **Agent** - A Cloudflare Worker with Durable Objects that manages state and AI interactions
2. **Frontend** - A Next.js application deployed on Cloudflare Pages

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                           │
└────────────────────┬──────────────────────────────────────--┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Pages (Frontend)                    |
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js App Router                                  │   │
│  │  - Chat Interface                                    │   │
│  │  - Task Dashboard                                    │   │
│  │  - Account/History Pages                             │   │
│  │  - API Routes (Proxy)                                │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  NextAuth.js (GitHub OAuth)                          │   │
│  │  - Session Management                                │   │
│  │  - Auth Token Generation                             │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬──────────────────────────────────────--┘
                     │ HTTPS + Auth Token
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Cloudflare Workers (Agent)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Worker Entry Point (index.ts)                       │   │
│  │  - Authentication                                    │   │
│  │  - Rate Limiting                                     │   │
│  │  - Request Routing                                   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Durable Object (QuestMasterAgent)                   │   │
│  │  ┌────────────────────────────────────────────────┐  │   |
│  │  │  State Management                              │  │   |
│  │  │  - Tasks Array                                 │  │   |
│  │  │  - XP & Streaks                                │  │   |
│  │  │  - Quest History                               │  │   |
│  │  └────────────────────────────────────────────────┘  │   |
│  │  ┌────────────────────────────────────────────────┐  │   | 
│  │  │  AI Integration                                │  │   |
│  │  │  - Cloudflare Workers AI                       │  │   | 
│  │  │  - Tool Calling (createTask, viewTasks, etc.)  │  │   |
│  │  │  - Streaming Responses                         │  │   |
│  │  ┌────────────────────────────────────────────────┐  │   |
│  │  │  Alarms                                        │  │   |
│  │  │  - Task Expiration Cleanup                     │  │   |
│  │  └────────────────────────────────────────────────┘  │   |
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────-┘
```

## Component Details

### Frontend (Next.js)

**Technology Stack:**
- Next.js 15 (App Router)
- React 19
- Tailwind CSS 4
- NextAuth.js v4
- TypeScript

**Key Features:**
- Server-Side Rendering (SSR)
- API Routes for proxying requests
- Client-side state management
- Optimistic UI updates
- Real-time streaming (SSE)

**Directory Structure:**
```
frontend/src/
├── app/              # Next.js App Router
│   ├── page.tsx     # Main chat interface
│   ├── account/     # Account page
│   ├── history/     # Quest history
│   └── api/         # API routes (proxy to agent)
├── components/      # React components
├── hooks/           # Custom React hooks
├── lib/             # Utilities (auth, session, etc.)
├── types/           # TypeScript types
└── utils/           # Helper functions
```

### Agent (Cloudflare Worker + Durable Object)

**Technology Stack:**
- Cloudflare Workers Runtime
- Durable Objects (for state)
- Cloudflare Workers AI
- TypeScript

**Key Features:**
- Persistent state storage
- AI-powered interactions
- Tool calling system
- Automatic task cleanup
- Rate limiting
- Authentication

**Directory Structure:**
```
agent/src/
├── agent.ts         # QuestMasterAgent class
├── index.ts         # Worker entry point
├── handlers/        # Request handlers
│   ├── chatHandler.ts
│   └── requestHandlers.ts
├── utils/           # Utilities
│   ├── auth.ts
│   ├── validation.ts
│   ├── streaming.ts
│   └── ...
└── types.ts         # TypeScript interfaces
```

## Data Flow

### Task Creation Flow

```
1. User sends message → Frontend
2. Frontend → API Route (/api/agent)
3. API Route → Agent Worker (with auth token)
4. Agent → AI Model (with tools)
5. AI → Tool Call (createTask)
6. Agent → State Update (Durable Object)
7. Agent → Stream Response (SSE)
8. Frontend → Update UI (optimistic + real)
```

### Task Retrieval Flow

```
1. User opens dashboard → Frontend
2. Frontend → API Route (/api/tasks)
3. API Route → Agent Worker (GET request)
4. Agent → Durable Object State
5. Agent → Return Tasks (JSON)
6. Frontend → Display Tasks
```

## State Management

### Durable Object State

The `QuestMasterAgent` Durable Object maintains persistent state:

```typescript
interface DMState {
  tasks: Task[];                    // Active tasks
  completedQuests: CompletedQuest[]; // Completed tasks
  timezone?: string;                // User timezone
  totalXP: number;                  // Total experience points
  currentStreak: number;            // Current daily streak
  longestStreak: number;            // Best streak achieved
  lastCompletionDate: string | null; // Last completion date
  graceDaysUsedThisWeek: number;    // Grace days used
  lastGraceWeekReset: string | null; // Grace week reset date
}
```

**Persistence:**
- Stored in Durable Object's SQLite storage
- Persists across deployments
- Isolated per session ID (user)

### Frontend State

The frontend uses React state management:

- **Messages**: Chat message history
- **Tasks**: Task list with optimistic updates
- **User Data**: XP, level, streaks
- **UI State**: Modals, filters, search

## Authentication Flow

```
1. User → GitHub OAuth Login
2. NextAuth.js → GitHub API
3. GitHub → Callback with code
4. NextAuth.js → Create Session
5. Frontend → Generate Session ID (from user ID)
6. Frontend → Generate Auth Token (HMAC-SHA256)
7. Frontend → Include Token in Requests
8. Agent → Validate Token
9. Agent → Extract Session ID
10. Agent → Process Request
```

**Token Format:**
```
{sessionId}:{timestamp}:{signature}
```

**Security:**
- Tokens expire after 5 minutes
- HMAC-SHA256 signature validation
- Session ID must match URL path
- Shared secret (AUTH_SECRET/NEXTAUTH_SECRET)

## AI Integration

### Model
- **Model**: `@cf/meta/llama-3.1-70b-instruct`
- **Provider**: Cloudflare Workers AI
- **Capabilities**: Text generation, tool calling

### Tools Available to AI

1. **getCurrentTime**: Get current time (ISO 8601)
2. **createTask**: Create a new task/quest
3. **viewTasks**: View all active tasks
4. **calculateTaskTimes**: Calculate task times from descriptions

### Tool Calling Flow

```
1. User Message → AI Model
2. AI → Decides to call tool
3. AI → Returns tool call JSON
4. Agent → Executes tool function
5. Tool → Updates state / Returns data
6. Agent → Sends tool result to AI
7. AI → Generates response
8. Agent → Streams response to user
```

## Task Lifecycle

```
Created → Active → Completed/Expired
   │         │            │
   │         │            └─→ Moved to completedQuests
   │         │            └─→ Auto-deleted after expiration
   │         │
   │         └─→ Between startTime and endTime
   │
   └─→ Before startTime (Upcoming)
```

**Automatic Cleanup:**
- Durable Object Alarms schedule cleanup
- Alarm fires when earliest task expires
- Expired tasks moved to completedQuests
- New alarm scheduled for next expiration

## Rate Limiting

**Implementation:**
- Cloudflare Rate Limiting API
- Distributed and persistent
- Per-session ID (user-specific)

**Limits:**
- Chat requests: 30/minute
- Task operations: 60/minute

**Location:**
- Applied in Worker entry point (`index.ts`)
- Before routing to Durable Object

## Error Handling

### Frontend
- Try-catch blocks in API calls
- Error boundaries (React)
- User-friendly error messages
- Optimistic update rollback

### Agent
- Validation errors return 400
- Authentication errors return 401
- Rate limit errors return 429
- Server errors return 500
- Detailed error logging

## Performance Optimizations

### Frontend
- **Lazy Loading**: Modals loaded on demand
- **Memoization**: React hooks and components
- **Debouncing**: Search and auto-delete functions
- **HTTP Caching**: GET requests cached (10s)
- **Optimistic Updates**: Instant UI feedback

### Agent
- **Streaming**: Responses streamed (SSE)
- **Efficient State**: Minimal state updates
- **Alarm Scheduling**: Efficient task cleanup
- **Tool Caching**: Tools recreated on each access (no cache)

## Security Measures

1. **Authentication**: Signed tokens with expiration
2. **Rate Limiting**: Prevents abuse
3. **Input Validation**: Server-side validation
4. **Prompt Injection**: Detection and mitigation
5. **Session Security**: High-entropy session IDs
6. **CORS**: Configured for production domains

## Deployment Architecture

### Production
- **Frontend**: Cloudflare Pages (via OpenNext)
- **Agent**: Cloudflare Workers
- **Storage**: Durable Objects (SQLite)
- **AI**: Cloudflare Workers AI

### Development
- **Frontend**: Next.js dev server (localhost:3000)
- **Agent**: Wrangler dev server (localhost:8787)
- **Storage**: Local Durable Object storage (.wrangler)
- **AI**: Cloudflare Workers AI (same as production)

## Scalability

### Horizontal Scaling
- Durable Objects scale automatically
- Each session ID maps to one Durable Object instance
- Cloudflare handles load balancing

### State Isolation
- Each user has isolated state (by session ID)
- No shared state between users
- Concurrent requests handled per instance

### Limitations
- Durable Object per session (not shared)
- State size limits (128KB per object)
- Alarm scheduling limits

## Monitoring & Observability

### Logging
- Centralized logger (`logger.ts`)
- Structured logging with levels
- Request/response logging
- Error tracking

### Metrics
- Cloudflare Analytics
- Durable Object usage
- AI API usage
- Rate limit hits

## Future Considerations

1. **Database**: Consider external DB for large datasets
2. **Caching**: Add Redis for frequently accessed data
3. **Webhooks**: Real-time updates via WebSockets
4. **Multi-user**: Shared quests/parties
5. **Mobile App**: React Native version
6. **Offline Support**: Service Worker caching

