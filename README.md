# QuestMaster

A D&D-themed task management application that transforms mundane tasks into epic quests. Built with Cloudflare Workers, Durable Objects, and Next.js.

## Overview

QuestMaster is a productivity application that gamifies task management through a Dungeon & Dragons theme. Users interact with an AI Dungeon Master that transforms their daily tasks into epic quests, complete with fantasy descriptions, experience points (XP), and immersive storytelling.

The application consists of:
- **Agent**: A Cloudflare Agent (Durable Object) that manages tasks and provides AI-powered interactions
- **Frontend**: A Next.js web application with a chat interface and task dashboard

### Live Demo

Try the application online: **[https://frontend.sami-houssaini.workers.dev](https://frontend.sami-houssaini.workers.dev)**

## Features

- **AI-Powered Dungeon Master**: Interact with an AI agent that frames tasks as quests using Tolkien-esque prose
- **Quest Log (Task Dashboard)**: View and manage all your tasks organized by status (Active, Upcoming, Expired)
- **Experience Points (XP)**: Each task is assigned XP based on complexity and difficulty
- **Streaming Responses**: Real-time streaming chat interface for natural conversations
- **Automatic Task Cleanup**: Expired tasks are automatically cleaned up using Durable Object Alarms
- **Persistent State**: All tasks are stored in Durable Object state, persisting across sessions

## Tech Stack

- **Backend**: Cloudflare Workers, Durable Objects, Cloudflare AI
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI Model**: `@cf/meta/llama-3.1-8b-instruct`
- **Deployment**: Cloudflare Workers & Pages

## Project Structure

```
questmaster/
├── agent/              # Cloudflare Agent (Durable Object)
│   ├── src/
│   │   ├── agent.ts    # QuestMasterAgent class
│   │   ├── index.ts    # Worker entry point
│   │   ├── logger.ts   # Centralized logging utility
│   │   └── system_prompt.ts  # AI system prompt
│   ├── tests/          # Test files
│   └── wrangler.jsonc  # Cloudflare Worker configuration
├── frontend/           # Next.js web application
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx        # Main chat interface
│   │       └── api/            # API routes (proxy to agent)
│   └── wrangler.jsonc  # Cloudflare Pages configuration
└── README.md           # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`
- Cloudflare AI binding configured (for agent)

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

#### Frontend Configuration

The frontend proxies requests to the agent. By default, it connects to `http://localhost:8787` when running locally.

## Usage

1. **Login**: Enter any username and password (demo mode)
2. **Chat with the DM**: Send messages to the AI Dungeon Master
3. **Create Quests**: Ask the DM to create tasks - they'll be transformed into epic quests
4. **View Quest Log**: Use the sidebar dashboard to see all your tasks
5. **Track Progress**: View XP rewards and task deadlines

### Example Interaction

**User**: "I need to finish my report by Friday"

**DM**: "Hail, traveler! I shall inscribe your quest into the ancient tome. Venture into the depths of the Archive of Reports, where shadows of unfinished work lurk, and emerge victorious with a completed tome. This quest shall grant you 50 experience points upon completion..."

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

### Known Security Issues

This application currently has several security vulnerabilities that should be addressed before production use:

1. **Demo Authentication**
   - Currently accepts any username/password combination
   - No user verification or session validation
   - **Planned Fix**: Implement proper authentication (OAuth, Cloudflare Access, or backend authentication with secure session management)

2. **No Rate Limiting**
   - API endpoints lack rate limiting protection
   - Vulnerable to abuse and excessive requests
   - **Planned Fix**: Implement rate limiting on API endpoints to prevent abuse

3. **CORS Configuration**
   - Currently allows requests from all origins
   - No origin validation
   - **Planned Fix**: Configure proper CORS policies with allowed origins whitelist

4. **Input Validation**
   - Limited input validation and sanitization
   - User input is passed directly to the AI model
   - **Planned Fix**: Add comprehensive input validation and sanitization for all user inputs

5. **Session Management**
   - Session IDs stored in localStorage (vulnerable to XSS)
   - No session expiration or validation
   - **Planned Fix**: Implement secure session management with HTTP-only cookies and proper session validation

These security enhancements will be implemented as soon as possible. Until then, this application should only be used for development and testing purposes.

## Development

### Testing

The agent includes test suites:
- Vitest unit tests
- Manual test scripts

See `agent/tests/README.md` for testing instructions.

### Logging

The agent uses a centralized logging system. See `agent/src/logger.ts` for details.

## Architecture

### Agent (Durable Object)

The agent is a Cloudflare Durable Object that:
- Maintains persistent state (tasks) in SQLite
- Handles HTTP requests (GET for tasks, POST for chat)
- Streams AI responses using Server-Sent Events (SSE)
- Automatically cleans up expired tasks using alarms
- Provides tools for task management (createTask, viewTasks, getCurrentTime)

### Frontend

The frontend is a Next.js application that:
- Provides a chat interface for interacting with the agent
- Displays a task dashboard with real-time updates
- Proxies requests to the agent via API routes
- Maintains session state using localStorage

## Contributing

This is a personal project. Feel free to fork and modify for your own use.

## License

Private project - all rights reserved.

