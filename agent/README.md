# TaskMaster Agent

A Cloudflare Agent (Durable Object) that provides AI-powered task management with a D&D fantasy theme.

## Overview

The TaskMasterAgent is a Cloudflare Durable Object that acts as an AI Dungeon Master, helping users organize tasks through immersive, fantasy-themed interactions. The agent uses Cloudflare Workers AI to generate responses and manages tasks with persistent state.

## Features

- **AI-Powered Interactions**: Uses `@cf/meta/llama-3.1-8b-instruct` for natural language processing
- **Task Management**: Create, view, and manage tasks (quests) with fantasy descriptions
- **Persistent State**: Tasks are stored in Durable Object state (SQLite)
- **Streaming Responses**: HTTP streaming with Server-Sent Events (SSE)
- **Automatic Cleanup**: Expired tasks are cleaned up automatically using Durable Object Alarms
- **Centralized Logging**: Structured logging system for debugging and monitoring

## Architecture

### Durable Object

The agent extends Cloudflare's `Agent` class and uses Durable Objects for:
- Persistent state storage (tasks)
- Session management
- Automatic task expiration cleanup

### Tools

The agent provides three tools for the AI model:

1. **getCurrentTime**: Returns the current date/time in ISO 8601 format
2. **createTask**: Creates a new task with name, description, start/end times, and XP
3. **viewTasks**: Retrieves all active tasks from state

### State Management

Tasks are stored in the Durable Object's state:

```typescript
interface DMState {
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  XP: number;
}
```

## API

### GET `/agents/task-master-agent/{sessionId}`

Retrieves all tasks for a session.

**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "name": "Task Name",
      "description": "Task Description",
      "startTime": "2026-01-15T14:00:00.000Z",
      "endTime": "2026-01-15T18:00:00.000Z",
      "XP": 50
    }
  ]
}
```

### POST `/agents/task-master-agent/{sessionId}`

Sends a chat message to the agent and receives a streaming response.

**Request Body:** Plain text message

**Response:** Server-Sent Events (SSE) stream containing:
- Text chunks with AI responses
- Metadata message with created tasks (if any)
- `[DONE]` marker when complete

**Example Response Stream:**
```
data: Greetings, adventurer! I shall inscribe your quest...
data: {"type":"metadata","tasks":[...]}
data: [DONE]
```

## Response Format

### Streaming Text

The agent streams text responses in SSE format:
```
data: <text chunk>
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

### Deployment

```bash
npm run deploy
```

## Configuration

### wrangler.jsonc

- **Durable Object**: `TaskMasterAgent` class
- **AI Binding**: `AI` (configure in Cloudflare dashboard)
- **Compatibility Flags**: `nodejs_compat`, `durable_object_alarms`

### Environment Variables

No environment variables required. AI binding must be configured in Cloudflare dashboard.

## Logging

The agent uses a centralized logging system (`src/logger.ts`) with the following levels:
- `debug`: Detailed debugging information
- `info`: General information (default)
- `warn`: Warnings
- `error`: Errors

Logs are prefixed with level tags: `[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`

## System Prompt

The AI agent uses a custom system prompt (`src/system_prompt.ts`) that:
- Frames the agent as a Dungeon Master
- Instructs the AI to use Tolkien-esque, immersive prose
- Emphasizes that tasks should have different start/end times
- Requires narrative text responses alongside tool usage

## Task Cleanup

The agent automatically cleans up expired tasks using Durable Object Alarms:
- An alarm is scheduled for the earliest task expiration
- When the alarm fires, expired tasks are removed
- A new alarm is scheduled for the next earliest expiration

## Files

- `src/agent.ts`: Main agent class with tool definitions and request handling
- `src/index.ts`: Worker entry point
- `src/logger.ts`: Centralized logging utility
- `src/system_prompt.ts`: AI system prompt
- `tests/`: Test files (see `tests/README.md`)
