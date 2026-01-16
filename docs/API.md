# QuestMaster API Documentation

## Overview

The QuestMaster API is provided by the Agent Worker and accessed through the Frontend API routes. All requests require authentication via signed tokens.

## Base URLs

- **Production**: `https://agent.sami-houssaini.workers.dev`
- **Development**: `http://localhost:8787`

## Authentication

All requests require an `Authorization` header with a Bearer token:

```
Authorization: Bearer {sessionId}:{timestamp}:{signature}
```

**Token Format:**
- `sessionId`: User session identifier
- `timestamp`: Unix timestamp (milliseconds)
- `signature`: HMAC-SHA256 signature of `{sessionId}:{timestamp}`

**Token Expiration:** 5 minutes

**Generation:** Tokens are generated server-side by the frontend using `NEXTAUTH_SECRET`.

## Rate Limiting

- **Chat Requests**: 30 per minute per session
- **Task Operations**: 60 per minute per session

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds until limit resets

## Endpoints

### Chat Endpoint

#### POST `/agents/quest-master-agent/{sessionId}`

Send a chat message to the AI Dungeon Master and receive a streaming response.

**Request:**
```http
POST /agents/quest-master-agent/{sessionId}
Content-Type: text/plain
Authorization: Bearer {token}
x-timezone: America/New_York

{message text}
```

**Response:** Server-Sent Events (SSE) stream

**Stream Format:**
```
data: {text chunk}

data: {"type":"metadata","tasks":[...]}

data: [DONE]
```

**Example:**
```bash
curl -X POST \
  "https://agent.sami-houssaini.workers.dev/agents/quest-master-agent/user-123" \
  -H "Authorization: Bearer user-123:1234567890:signature" \
  -H "Content-Type: text/plain" \
  -H "x-timezone: America/New_York" \
  -d "Create a quest to finish my report"
```

**Response Stream:**
```
data: Greetings, adventurer! I shall inscribe your quest into the chronicles...

data: {"type":"metadata","tasks":[{"id":"...","name":"...","XP":50}]}

data: [DONE]
```

**Status Codes:**
- `200`: Success (streaming)
- `400`: Invalid input
- `401`: Authentication failed
- `429`: Rate limit exceeded
- `500`: Server error

---

### Get Tasks

#### GET `/agents/quest-master-agent/{sessionId}`

Retrieve all active tasks and user statistics.

**Request:**
```http
GET /agents/quest-master-agent/{sessionId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "name": "Quest Name",
      "description": "Epic fantasy description",
      "startTime": "2026-01-15T14:00:00.000Z",
      "endTime": "2026-01-15T18:00:00.000Z",
      "XP": 50
    }
  ],
  "totalXP": 150,
  "currentStreak": 5,
  "longestStreak": 10,
  "lastCompletionDate": "2026-01-15"
}
```

**Example:**
```bash
curl -X GET \
  "https://agent.sami-houssaini.workers.dev/agents/quest-master-agent/user-123" \
  -H "Authorization: Bearer user-123:1234567890:signature"
```

**Status Codes:**
- `200`: Success
- `401`: Authentication failed
- `429`: Rate limit exceeded
- `500`: Server error

---

### Get Quest History

#### GET `/agents/quest-master-agent/{sessionId}?history=true`

Retrieve completed quests and statistics.

**Request:**
```http
GET /agents/quest-master-agent/{sessionId}?history=true
Authorization: Bearer {token}
```

**Response:**
```json
{
  "completedQuests": [
    {
      "id": "uuid",
      "name": "Completed Quest",
      "description": "Description",
      "completedAt": "2026-01-15T18:00:00.000Z",
      "XP": 50
    }
  ],
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

**Example:**
```bash
curl -X GET \
  "https://agent.sami-houssaini.workers.dev/agents/quest-master-agent/user-123?history=true" \
  -H "Authorization: Bearer user-123:1234567890:signature"
```

**Status Codes:**
- `200`: Success
- `401`: Authentication failed
- `429`: Rate limit exceeded
- `500`: Server error

---

### Direct Task Operations

#### POST `/agents/quest-master-agent/{sessionId}` (JSON)

Perform direct task operations without AI interaction.

**Request:**
```http
POST /agents/quest-master-agent/{sessionId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "tool": "createTask" | "updateTask" | "deleteTask",
  "params": { ... }
}
```

#### Create Task

```json
{
  "tool": "createTask",
  "params": {
    "taskName": "Quest Name",
    "taskDescription": "Epic description",
    "taskStartTime": "2026-01-15T14:00:00.000Z",
    "taskEndTime": "2026-01-15T18:00:00.000Z",
    "XP": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "uuid",
    "name": "Quest Name",
    ...
  }
}
```

#### Update Task

```json
{
  "tool": "updateTask",
  "params": {
    "taskId": "uuid",
    "endTime": "2026-01-15T20:00:00.000Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "task": { ... }
}
```

#### Delete Task

```json
{
  "tool": "deleteTask",
  "params": {
    "taskId": "uuid"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid parameters
- `401`: Authentication failed
- `404`: Task not found
- `429`: Rate limit exceeded
- `500`: Server error

---

## Data Types

### Task

```typescript
interface Task {
  id: string;                    // UUID
  name: string;                  // Task name
  description: string;          // Fantasy description
  startTime: Date;              // ISO 8601 timestamp
  endTime: Date;                // ISO 8601 timestamp
  XP: number;                   // Experience points (1-10000)
}
```

### CompletedQuest

```typescript
interface CompletedQuest {
  id: string;
  name: string;
  description: string;
  completedAt: Date;            // ISO 8601 timestamp
  XP: number;
}
```

### Statistics

```typescript
interface Statistics {
  totalCompleted: number;
  totalActive: number;
  totalQuests: number;
  completionRate: number;       // Percentage
  totalXP: number;
  avgXPPerQuest: number;
  recentCompletions: number;     // Last 7 days
}
```

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message description"
}
```

### Common Errors

**400 Bad Request:**
```json
{
  "error": "Task validation failed: Invalid start time format"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized. Invalid authentication token."
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded. Too many requests. Please try again later."
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Frontend API Routes

The frontend provides proxy routes that add authentication and handle CORS:

### POST `/api/agent`

Proxies chat messages to the agent.

**Request:** Same as agent chat endpoint
**Response:** Same SSE stream

### GET `/api/tasks`

Proxies task retrieval.

**Request:** `GET /api/tasks`
**Response:** Same as agent GET endpoint

### POST `/api/tasks`

Creates a new task.

**Request:**
```json
{
  "taskName": "...",
  "taskDescription": "...",
  "taskStartTime": "...",
  "taskEndTime": "...",
  "XP": 50
}
```

### PATCH `/api/tasks`

Updates a task.

**Request:**
```json
{
  "taskId": "uuid",
  "endTime": "..." // optional
}
```

### DELETE `/api/tasks`

Deletes a task.

**Request:**
```json
{
  "taskId": "uuid"
}
```

## WebSocket Support

Currently not implemented. All communication uses HTTP/SSE.

## Versioning

No versioning currently. All endpoints use the latest version.

## Changelog

### Current Version
- Natural language time parsing in `createTask`
- Retry logic for failed task creation
- Enhanced error messages
- Task timing validation

