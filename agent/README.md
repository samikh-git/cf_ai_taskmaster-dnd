# QuestMaster Agent

A Cloudflare Agent (Durable Object) that provides AI-powered task management with a D&D fantasy theme.

## Overview

The QuestMasterAgent is a Cloudflare Durable Object that acts as an AI Dungeon Master, helping users organize tasks through immersive, fantasy-themed interactions. The agent uses Cloudflare Workers AI to generate responses and manages tasks with persistent state, XP tracking, streaks, and quest history.

## Features

- **AI-Powered Interactions**: Uses `@cf/meta/llama-3.1-70b-instruct` for natural language processing
- **Task Management**: Create, view, update, and delete tasks (quests) with fantasy descriptions
- **Persistent State**: Tasks, XP, streaks, and history stored in Durable Object state (SQLite)
- **Streaming Responses**: HTTP streaming with Server-Sent Events (SSE)
- **Automatic Cleanup**: Expired tasks are cleaned up automatically using Durable Object Alarms
- **XP & Leveling**: Track experience points and calculate levels (100 XP per level)
- **Streak System**: Daily completion streaks with grace days (1 per week)
- **Quest History**: Track completed quests and calculate statistics
- **Timezone Support**: Accurate time handling based on user's timezone
- **Centralized Logging**: Structured logging system for debugging and monitoring
- **Input Validation**: Comprehensive validation for chat inputs and tool parameters
- **Prompt Injection Mitigation**: Multi-layered defense against prompt injection attacks
- **Authentication**: Signed token validation with HMAC-SHA256
- **Rate Limiting**: Distributed rate limiting using Cloudflare's Rate Limiting API

## Architecture

### Code Organization

The agent codebase is organized into modular components:

```
src/
├── agent.ts              # Main QuestMasterAgent class
├── index.ts              # Worker entry point
├── logger.ts             # Centralized logging utility
├── system_prompt.ts      # AI system prompt
├── tools.ts              # Tool definitions factory
├── types.ts              # TypeScript interfaces
├── handlers/             # Request handlers
│   ├── chatHandler.ts    # Chat/streaming request handling
│   └── requestHandlers.ts # GET/POST request handling
└── utils/                # Utility functions
    ├── serialization.ts  # Date and object serialization
    ├── statistics.ts    # Statistics calculation
    ├── streak.ts        # Streak calculation logic
    ├── streaming.ts     # Stream handling and formatting
    ├── validation.ts    # Input validation and prompt injection detection
    └── auth.ts          # Authentication token validation
```

### Durable Object

The agent extends Cloudflare's `Agent` class and uses Durable Objects for:
- Persistent state storage (tasks, XP, streaks, history)
- Session management
- Automatic task expiration cleanup
- User-specific data isolation

### Tools

The agent provides tools for the AI model:

1. **getCurrentTime**: Returns the current date/time in ISO 8601 format (respects user timezone)
2. **createTask**: Creates a new task with name, description, start/end times, and XP
   - Accepts natural language time descriptions (e.g., "1 hour from now", "tomorrow")
   - Automatically parses relative time descriptions
   - Validates all parameters with detailed error messages
   - Supports retry logic for failed attempts
3. **viewTasks**: Retrieves all active tasks from state
4. **calculateTaskTimes**: Calculates start/end times from natural language descriptions (optional helper tool)

### State Management

State is stored in the Durable Object:

```typescript
interface DMState {
  tasks: Task[];
  completedQuests: CompletedQuest[];
  timezone?: string;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
  graceDaysUsedThisWeek: number;
  lastGraceWeekReset: string | null;
}
```

## API

### GET `/agents/quest-master-agent/{sessionId}`

Retrieves all tasks and user stats for a session.

**Response:**
```json
{
  "tasks": [...],
  "totalXP": 150,
  "currentStreak": 5,
  "longestStreak": 10,
  "lastCompletionDate": "2026-01-15"
}
```

### GET `/agents/quest-master-agent/{sessionId}?history=true`

Retrieves completed quests and statistics.

**Response:**
```json
{
  "completedQuests": [...],
  "statistics": {
    "totalCompleted": 10,
    "totalActive": 5,
    "totalQuests": 15,
    "completionRate": 66.67,
    "totalXP": 500,
    "avgXPPerQuest": 50,
    "recentCompletions": 3
  }
}
```

### POST `/agents/quest-master-agent/{sessionId}`

Sends a chat message to the agent and receives a streaming response.

**Request Body:** Plain text message

**Headers:**
- `x-timezone`: User's timezone (e.g., "America/New_York")

**Response:** Server-Sent Events (SSE) stream containing:
- Text chunks with AI responses (formatted as `data: <text>\n\n`)
- Metadata message with created tasks (if any)
- `[DONE]` marker when complete

**Example Response Stream:**
```
data: Greetings, adventurer! I shall inscribe your quest...
data: {"type":"metadata","tasks":[...]}
data: [DONE]
```

### POST `/agents/quest-master-agent/{sessionId}` (JSON)

Direct task operations (bypassing AI).

**Request Body:**
```json
{
  "tool": "createTask" | "updateTask" | "deleteTask",
  "params": { ... }
}
```

## Response Format

### Streaming Text

The agent streams text responses in SSE format. The `runWithTools` function returns JSON objects like `{"response":" text","p":"..."}`, which are parsed and formatted as:

```
data: <text chunk>
data: <next chunk>
```

### Task Metadata

After streaming completes, if tasks were created, a metadata message is sent:

```json
{
  "type": "metadata",
  "tasks": [
    {
      "id": "uuid",
      "name": "Task Name",
      "description": "Epic fantasy description",
      "startTime": "2026-01-15T14:00:00.000Z",
      "endTime": "2026-01-15T18:00:00.000Z",
      "XP": 50
    }
  ]
}
```

## Development

### Setup

```bash
npm install
```

### Local Development

```bash
npm run dev
```

The agent will be available at `http://localhost:8787`

### Testing

Run unit tests:
```bash
npm test
```

Run manual tests:
```bash
npm run test:manual
npm run test:agent
```

See `tests/README.md` for detailed testing instructions.

### Deployment

```bash
npm run deploy
```

## Configuration

### wrangler.jsonc

- **Durable Object**: `QuestMasterAgent` class
- **AI Binding**: `AI` (configure in Cloudflare dashboard)
- **Compatibility Flags**: `nodejs_compat`, `durable_object_alarms`

### Environment Variables

- `AUTH_SECRET` (required in production): Secret for validating authentication tokens. Should match `NEXTAUTH_SECRET` from the frontend.
- AI binding must be configured in Cloudflare dashboard.

**Note**: If `AUTH_SECRET` is not set, authentication is disabled (development mode only). In production, this must be set to ensure secure access.

### Rate Limiting

The agent uses Cloudflare's built-in Rate Limiting API for distributed, persistent rate limiting:

- **Chat requests**: 30 per minute per session ID
- **Task operations**: 60 per minute per session ID

Rate limits are applied per session ID (user-specific) and are distributed across Cloudflare's network. They persist across server restarts and work across all instances.

Configuration is defined in `wrangler.jsonc`:

```jsonc
"ratelimits": [
  {
    "name": "CHAT_RATE_LIMITER",
    "namespace_id": 1001,
    "simple": {
      "limit": 30,
      "period": 60
    }
  },
  {
    "name": "TASK_RATE_LIMITER",
    "namespace_id": 1002,
    "simple": {
      "limit": 60,
      "period": 60
    }
  }
]
```

Rate limiting is implemented in `src/index.ts` before requests are routed to the Durable Object.

**Reference**: [Cloudflare Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Logging

The agent uses a centralized logging system (`src/logger.ts`) with the following levels:
- `debug`: Detailed debugging information
- `info`: General information (default)
- `warn`: Warnings
- `error`: Errors

Logs are prefixed with level tags: `[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`

Logging methods:
- `logger.request()`: HTTP request logging
- `logger.toolCall()`: Tool invocation logging
- `logger.taskOperation()`: Task CRUD operation logging

## System Prompt

The AI agent uses a custom system prompt (`src/system_prompt.ts`) that:
- Frames the agent as a Dungeon Master
- Instructs the AI to use Tolkien-esque, immersive prose
- Emphasizes that tasks should have different start/end times
- Requires narrative text responses alongside tool usage
- Minimizes references to current time/date (uses getCurrentTime silently)
- Includes security directives to resist prompt injection attempts
- Provides explicit examples of correct tool usage
- Includes retry instructions for failed task creation
- Supports natural language time descriptions in createTask

## Task Cleanup

The agent automatically cleans up expired tasks using Durable Object Alarms:
- An alarm is scheduled for the earliest task expiration
- When the alarm fires, expired tasks are removed
- A new alarm is scheduled for the next earliest expiration
- If no tasks remain, the alarm is cancelled

## XP and Streaks

### Experience Points

- Tasks award XP based on complexity and difficulty
- Level up every 100 XP
- Streak bonus: +10% XP for 7+ day streaks

### Streak System

- Current streak: Consecutive days with at least one completed quest
- Grace days: 1 per week (resets on Monday)
- Longest streak: Tracks the highest streak achieved

## Input Validation

The agent includes comprehensive input validation:

### Chat Input Validation
- **Length Checks**: Minimum 1 character, maximum 10,000 characters
- **Prompt Injection Detection**: Pattern detection for common injection attempts (logged, non-blocking)
- **System Prompt Reinforcement**: AI instructed to resist prompt injection attempts

### Task Parameter Validation
- **Task Name**: Required, 1-200 characters, trimmed
- **Task Description**: Required, 1-2000 characters, trimmed
- **Date Range**: Start time must be before end time, both must be valid ISO 8601 dates, both must be in the future
- **XP**: Must be a positive number between 1 and 10,000
- **Strict Validation**: All parameters validated before task creation

## Authentication

The agent validates authentication tokens for all requests:
- **Token Format**: HMAC-SHA256 signed tokens containing session ID and timestamp
- **Validation**: Tokens verified using shared secret (AUTH_SECRET)
- **Expiration**: Tokens expire after 5 minutes
- **Session Matching**: Session ID in token must match URL path session ID
- **Error Handling**: Invalid tokens return 401 Unauthorized

## Files

- `src/agent.ts`: Main agent class with tool definitions and request handling
- `src/index.ts`: Worker entry point with rate limiting and authentication
- `src/logger.ts`: Centralized logging utility
- `src/system_prompt.ts`: AI system prompt with security directives
- `src/tools.ts`: Tool definitions factory
- `src/types.ts`: TypeScript interfaces
- `src/handlers/`: Request handlers for different endpoints
- `src/utils/`: Utility functions for serialization, statistics, streaks, streaming, validation, and authentication
- `tests/`: Test files (see `tests/README.md`)
