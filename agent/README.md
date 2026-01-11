# TaskMasterAgent

A Cloudflare Agent that helps users organize their tasks using an epic D&D fantasy theme. The agent transforms mundane tasks into quests and guides users through their productivity journey with immersive, Tolkien-esque narrative.

## Response Format

When connecting to the TaskMasterAgent via WebSocket, the agent sends responses in the following format:

### 1. Text Response (Streamed)

The agent streams text responses directly over the WebSocket connection as chunks. These are the narrative responses from the AI Dungeon Master, written in an epic fantasy style.

**Format:** Plain text chunks sent via `connection.send(chunk)`

**Example:**
```
"Greetings, brave adventurer! I have inscribed your quest into the chronicles..."
"The Archive of Reports awaits your conquest. This task shall grant you..."
```

These text chunks arrive incrementally as the AI generates the response, providing a real-time streaming experience.

### 2. Task Metadata (After Stream Completion)

After the text stream completes, if any tasks were created during the interaction, the agent sends a metadata message containing information about the created tasks.

**Format:** JSON string sent via WebSocket

```json
{
  "type": "metadata",
  "tasks": [
    {
      "id": "uuid-string",
      "name": "Task Name",
      "description": "Task Description",
      "startTime": "2025-01-11T00:00:00.000Z",
      "endTime": "2025-01-11T23:59:59.999Z",
      "XP": 20
    }
  ]
}
```

**Fields:**
- `type`: Always `"metadata"` for task metadata messages
- `tasks`: Array of task objects that were created during this interaction
  - `id`: Unique identifier (UUID) for the task
  - `name`: The task name as provided by the user
  - `description`: The epic fantasy description of the task
  - `startTime`: Start time as ISO 8601 date string
  - `endTime`: End time as ISO 8601 date string
  - `XP`: Experience points awarded for completing this task

### 3. Agent State Updates (Automatic)

The Cloudflare Agents framework automatically sends state update messages when the agent's state changes (e.g., when tasks are created or updated).

**Format:** JSON string sent via WebSocket

```json
{
  "type": "cf_agent_state",
  "state": {
    "tasks": [
      {
        "id": "uuid-string",
        "name": "Task Name",
        "description": "Task Description",
        "startTime": "2025-01-11T00:00:00.000Z",
        "endTime": "2025-01-11T23:59:59.999Z",
        "XP": 20
      }
    ]
  }
}
```

**Note:** These state updates are sent automatically by the framework and contain the current state of all tasks, not just newly created ones.

### 4. MCP Server Updates (Automatic)

The framework also sends MCP (Model Context Protocol) server state updates.

**Format:** JSON string sent via WebSocket

```json
{
  "type": "cf_agent_mcp_servers",
  "mcp": {
    "prompts": [],
    "resources": [],
    "servers": {},
    "tools": []
  }
}
```

## Complete Example Response Flow

When a user sends a message requesting task creation, the response flow looks like this:

1. **Text chunks** (streamed incrementally):
   ```
   "Hail, traveler! I shall inscribe your quest into the ancient tome..."
   "The Archive of Reports beckons - a task worthy of 20 experience points..."
   "May your journey be fruitful!"
   ```

2. **Task metadata** (after stream completes):
   ```json
   {
     "type": "metadata",
     "tasks": [
       {
         "id": "6f410302-1633-4eaa-aec4-373f233b7f55",
         "name": "Finish the report",
         "description": "Venture into the depths of the Archive of Reports...",
         "startTime": "2025-01-11T00:00:00.000Z",
         "endTime": "2025-01-11T23:59:59.999Z",
         "XP": 20
       }
     ]
   }
   ```

3. **State update** (automatic, from framework):
   ```json
   {
     "type": "cf_agent_state",
     "state": {
       "tasks": [...]
     }
   }
   ```

## WebSocket Connection

Connect to the agent using the following URL pattern:

```
ws://localhost:8787/agents/TaskMasterAgent/{session-name}
```

**Example:**
```
ws://localhost:8787/agents/TaskMasterAgent/test-session
```

## Sending Messages

Send messages to the agent as JSON with a `content` field:

```json
{
  "content": "Hello! I need help organizing my tasks."
}
```

## Implementation Details

- The agent uses `connection.send()` to stream text chunks directly over WebSocket
- Text responses are generated using Cloudflare Workers AI with function calling support
- Tasks are created via the `createTask` tool function
- The agent always provides narrative text responses alongside tool usage (per system prompt requirements)

