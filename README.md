# QuestMaster

A D&D-themed task management application that transforms mundane tasks into epic quests. Built with Cloudflare Workers, Durable Objects, and Next.js.

## Overview

QuestMaster is a productivity application that gamifies task management through a Dungeon & Dragons theme. Users interact with an AI Dungeon Master that transforms their daily tasks into epic quests, complete with fantasy descriptions, experience points (XP), streaks, levels, and immersive storytelling.

The application consists of:
- **Agent**: A Cloudflare Agent (Durable Object) that manages tasks and provides AI-powered interactions
- **Frontend**: A Next.js web application with a chat interface and task dashboard

### Live Demo

Try the application online: **[https://frontend.sami-houssaini.workers.dev](https://frontend.sami-houssaini.workers.dev)**

## Features

- **AI-Powered Dungeon Master**: Interact with an AI agent that frames tasks as quests using Tolkien-esque prose
- **Quest Log (Task Dashboard)**: View and manage all your tasks organized by status (Active, Upcoming, Expired)
  - **Search & Filter**: Search tasks by name/description, filter by status (all/active/upcoming/expired) and date (all/today/this week/this month/future/past)
  - **Expandable Search**: Quick-access search icon that expands when clicked
- **Experience Points (XP) & Leveling**: Each task is assigned XP based on complexity. Level up every 100 XP
- **Streak System**: Maintain daily completion streaks with grace days (1 per week)
- **Streaming Responses**: Real-time streaming chat interface for natural conversations
- **Optimistic Updates**: UI updates immediately before API confirmation for instant feedback
- **Skeleton Loading States**: Beautiful loading skeletons for all pages and operations
- **Performance Optimized**: Lazy loading, debouncing, HTTP caching, and memoization for smooth experience
- **Automatic Task Cleanup**: Expired tasks are automatically cleaned up using Durable Object Alarms
- **Persistent State**: All tasks are stored in Durable Object state, persisting across sessions
- **User Authentication**: GitHub OAuth authentication via NextAuth.js
- **Quest History**: View completed quests and statistics
- **Browser Notifications**: Get reminders for upcoming task deadlines
- **Timezone Support**: Accurate time handling based on user's timezone
- **Input Validation**: Server-side validation and prompt injection mitigation

## Tech Stack

- **Backend**: Cloudflare Workers, Durable Objects, Cloudflare AI
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI Model**: `@cf/meta/llama-3.1-8b-instruct`
- **Authentication**: NextAuth.js v4 with GitHub OAuth
- **Deployment**: Cloudflare Workers & Pages

## Project Structure

```
questmaster/
├── agent/                    # Cloudflare Agent (Durable Object)
│   ├── src/
│   │   ├── agent.ts          # QuestMasterAgent class
│   │   ├── index.ts          # Worker entry point
│   │   ├── logger.ts         # Centralized logging utility
│   │   ├── system_prompt.ts  # AI system prompt
│   │   ├── tools.ts          # Tool definitions
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── handlers/         # Request handlers
│   │   │   ├── chatHandler.ts
│   │   │   └── requestHandlers.ts
│   │   └── utils/           # Utility functions
│   │       ├── serialization.ts
│   │       ├── statistics.ts
│   │       ├── streak.ts
│   │       └── streaming.ts
│   ├── tests/                # Test files
│   └── wrangler.jsonc        # Cloudflare Worker configuration
├── frontend/                 # Next.js web application
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   │   ├── page.tsx      # Main chat interface
│   │   │   ├── account/      # Account page (level, XP, streaks)
│   │   │   ├── history/      # Quest history and statistics
│   │   │   └── api/          # API routes (proxy to agent)
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Library utilities
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   └── wrangler.jsonc        # Cloudflare Pages configuration
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`
- Cloudflare AI binding configured (for agent)
- GitHub OAuth app (for authentication)

### Installation

1. Clone the repository
2. Install dependencies for both parts:

```bash
# Install agent dependencies
cd agent
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running Locally

#### Start the Agent

```bash
cd agent
npm run dev
```

The agent will be available at `http://localhost:8787`

#### Start the Frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Configuration

#### Agent Configuration

The agent requires a Cloudflare AI binding. Configure this in your Cloudflare dashboard or via `wrangler.toml` (not included in repo).

Key configuration in `agent/wrangler.jsonc`:
- Durable Object: `QuestMasterAgent`
- Compatibility flags: `nodejs_compat`, `durable_object_alarms`
- AI binding: `AI`
- Rate limiting: `CHAT_RATE_LIMITER`, `TASK_RATE_LIMITER`

**Environment Variables** (set via `wrangler secret put AUTH_SECRET` or in Cloudflare dashboard):
- `AUTH_SECRET` (required in production): Secret for validating authentication tokens. Must match `NEXTAUTH_SECRET` from the frontend.

#### Frontend Configuration

Create a `.env.local` file in the `frontend` directory:

```bash
AGENT_URL=http://localhost:8787
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`

## Usage

1. **Login**: Sign in with GitHub OAuth
2. **Chat with the DM**: Send messages to the AI Dungeon Master
3. **Create Quests**: Ask the DM to create tasks - they'll be transformed into epic quests
4. **View Quest Log**: Use the sidebar dashboard to see all your tasks
5. **Track Progress**: View XP, level, and streaks on the account page
6. **Complete Quests**: Finish tasks to earn XP and maintain streaks
7. **View History**: Check your quest history and statistics

### Example Interaction

**User**: "I need to finish my report by Friday"

**DM**: "Hail, traveler! A new day dawns in the realm of productivity. The sun rises over the horizon, casting a warm glow upon the landscape of tasks that lie before you. What quest shall you undertake today? Shall you vanquish the beast of procrastination or conquer the mountain of paperwork? Perhaps you shall embark on a perilous journey to the depths of the Archive of Reports, where shadows of unfinished work lurk, and emerge victorious with a completed tome..."

## Deployment

### Deploy Agent

```bash
cd agent
npm run deploy
```

### Deploy Frontend

```bash
cd frontend
npm run deploy
```

For detailed deployment instructions, see the README files in each directory.

## Security

### Security Features

The application includes comprehensive security measures:

1. **Authentication**: 
   - Frontend: GitHub OAuth via NextAuth.js with secure session management
   - Agent: Signed authentication tokens with HMAC-SHA256 validation
   - Tokens expire after 5 minutes (prevents replay attacks)
   - Session ID in token must match session ID in URL path
2. **Rate Limiting**: Distributed rate limiting using Cloudflare's Rate Limiting API
   - Chat requests: 30 per minute per session
   - Task operations: 60 per minute per session
   - Persistent and distributed across Cloudflare's network
3. **Session Management**: Secure session IDs generated server-side from authenticated user IDs
   - Session IDs use SHA-256 hashing with base64url encoding
   - High entropy (256 bits) for unpredictability
4. **Input Validation**: 
   - Server-side validation for chat inputs and task parameters
   - Prompt injection detection with logging (non-blocking)
   - System prompt reinforcement against manipulation
   - Strict parameter validation for all tool calls

### Known Security Considerations

1. **CORS Configuration**: Currently allows requests from all origins in development. Should be restricted in production.
2. **Input Sanitization**: User input is passed to the AI model. Additional sanitization layers are in place for prompt injection mitigation.

**Note**: Rate limiting uses Cloudflare's built-in Rate Limiting API, providing distributed, persistent rate limiting across the network.

## Development

### Testing

The agent includes test suites:
- Vitest unit tests
- Manual test scripts

See `agent/tests/README.md` for testing instructions.

### Logging

The agent uses a centralized logging system. See `agent/src/logger.ts` for details.

### Code Organization

The codebase is organized into:
- **Agent**: Modular structure with handlers, utils, and types
- **Frontend**: Component-based architecture with custom hooks and utilities

## Architecture

### Agent (Durable Object)

The agent is a Cloudflare Durable Object that:
- Maintains persistent state (tasks, XP, streaks) in SQLite
- Handles HTTP requests (GET for tasks/history, POST for chat/task operations)
- Streams AI responses using Server-Sent Events (SSE)
- Automatically cleans up expired tasks using alarms
- Provides tools for task management (createTask, viewTasks, getCurrentTime, updateTask, deleteTask)
- Calculates streaks and XP rewards
- Tracks quest history and statistics

### Frontend

The frontend is a Next.js application that:
- Provides a chat interface for interacting with the agent
- Displays a task dashboard with real-time updates
- Shows account information (level, XP, streaks)
- Displays quest history and statistics
- Proxies requests to the agent via API routes
- Manages authentication via NextAuth.js
- Handles browser notifications for task reminders

## Recent Updates

### Performance Improvements
- **Lazy Loading**: TaskDetailModal and CreateTaskModal load on demand
- **Debouncing**: Auto-delete expired tasks function debounced for efficiency
- **HTTP Caching**: GET /api/tasks responses cached with appropriate headers
- **Memoization**: React hooks and functions memoized to prevent unnecessary re-renders
- **Optimistic Updates**: UI updates immediately before API confirmation

### UX Enhancements
- **Skeleton Loading States**: Beautiful loading skeletons for all pages and operations
- **Search & Filter**: Enhanced task dashboard with search and filter capabilities
- **Expandable Search**: Quick-access search icon that expands when needed
- **Smooth Animations**: Transition animations for search expansion and UI interactions

### Security & Validation
- **Input Validation**: Comprehensive server-side validation
- **Prompt Injection Mitigation**: Multi-layered defense against prompt injection
- **Enhanced Session Security**: Improved session ID generation with higher entropy

## Contributing

This is a personal project. Feel free to fork and modify for your own use.

Created by [samikh-git](https://github.com/samikh-git)

## License

Private project - all rights reserved.
