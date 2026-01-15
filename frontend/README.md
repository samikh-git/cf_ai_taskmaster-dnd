# QuestMaster Frontend

A Next.js web application that provides a chat interface and task dashboard for interacting with the QuestMaster Agent.

## Overview

The frontend is a Next.js 15 application built with React 19 and Tailwind CSS. It provides a user-friendly interface for chatting with the AI Dungeon Master and managing tasks (quests) with a dark, dungeon-themed design.

## Features

- **Chat Interface**: Real-time streaming chat with the AI agent
- **Task Dashboard**: Sidebar displaying all tasks organized by status
- **Task Details Modal**: Click on tasks to view full details
- **Session Management**: Persistent session IDs using localStorage
- **Dark Theme**: Black and dark orange dungeon-themed UI
- **Responsive Design**: Works on desktop and mobile devices
- **Authentication**: Simple login screen (demo mode)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Font**: Garamond (system font)
- **Deployment**: Cloudflare Pages (via OpenNext)

## Project Structure

```
frontend/
├── src/
│   └── app/
│       ├── page.tsx              # Main chat interface and dashboard
│       ├── layout.tsx            # Root layout with font configuration
│       ├── globals.css           # Global styles
│       └── api/
│           ├── agent/
│           │   └── route.ts      # Proxy route for agent chat
│           └── tasks/
│               └── route.ts      # Proxy route for task fetching
├── public/                       # Static assets
└── wrangler.jsonc                # Cloudflare Pages configuration
```

## Development

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your values:
# - AGENT_URL: Set to http://localhost:8787 for local development
# - NEXTAUTH_SECRET: Generate with: openssl rand -base64 32
# - NEXTAUTH_URL: http://localhost:3000 for local development
# - GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET: From GitHub OAuth app settings
```

3. **Start the development server:**
```bash
npm run dev
```

### Local Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

**Note**: The frontend expects the agent to be running at `http://localhost:8787`. Make sure to start the agent first.

### Build

```bash
npm run build
```

### Preview (Cloudflare Runtime)

```bash
npm run preview
```

### Deployment

Deploy to Cloudflare Pages:

```bash
npm run deploy
```

## Usage

### Chat Interface

1. **Login**: Enter any username and password (demo mode - all credentials accepted)
2. **Send Messages**: Type messages in the input field and press Enter or click Send
3. **View Responses**: AI responses stream in real-time in the chat window
4. **Task Dashboard**: Click the menu icon to toggle the task sidebar

### Task Dashboard

- **Active Quests**: Tasks that are currently active (between start and end time)
- **Upcoming**: Tasks that haven't started yet
- **Expired**: Tasks that have passed their end time
- **View Details**: Click any task card to view full details in a modal
- **Refresh**: Click the refresh button to reload tasks from the agent

### Task Cards

Each task card displays:
- Task name (quest title)
- XP reward
- Truncated description
- Start and end times
- Click to view full details

## API Routes

### `/api/agent` (POST)

Proxies chat messages to the agent and streams responses back.

**Headers:**
- `x-session-id`: Session identifier (persisted in localStorage)

**Request Body:** Plain text message

**Response:** Server-Sent Events (SSE) stream

### `/api/tasks` (GET)

Fetches all tasks for the current session.

**Headers:**
- `x-session-id`: Session identifier

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

## Configuration

### Environment Variables

The frontend uses environment variables for configuration. Create a `.env.local` file (or `.env.production` for production) with the following variables:

| Variable | Description | Development | Production |
|----------|-------------|-------------|------------|
| `AGENT_URL` | URL of the Cloudflare Agent Worker | `http://localhost:8787` | `https://agent.sami-houssaini.workers.dev` |
| `NEXTAUTH_SECRET` | Secret key for NextAuth session encryption | Generate with `openssl rand -base64 32` | Same |
| `NEXTAUTH_URL` | Base URL of your application | `http://localhost:3000` | Your production URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | From GitHub OAuth app | Same |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | From GitHub OAuth app | Same |

**Default Behavior:**
- If `AGENT_URL` is not set, the app defaults to:
  - `http://localhost:8787` in development (`NODE_ENV=development`)
  - `https://agent.sami-houssaini.workers.dev` in production (`NODE_ENV=production`)

**Example `.env.local` for development:**
```bash
AGENT_URL=http://localhost:8787
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Session Management

Session IDs are stored in `localStorage` with the key `agent-session-id`. This ensures users maintain the same Durable Object session across page refreshes.

## Styling

The application uses:
- **Background**: Black (`bg-black`)
- **Accents**: Dark orange (`orange-900`, `orange-800`, etc.)
- **Font**: Garamond (system font stack)
- **Theme**: Dark dungeon aesthetic

## Authentication

Currently uses a simple demo authentication:
- Any username/password combination is accepted
- Authentication state is stored in localStorage
- No backend authentication - for demo purposes only

For production, implement proper authentication (OAuth, Cloudflare Access, etc.).

## Features in Detail

### Streaming Responses

The chat interface streams responses from the agent in real-time using Server-Sent Events (SSE). The frontend:
- Parses SSE format (`data: ...` lines)
- Handles JSON metadata messages
- Updates the UI incrementally as chunks arrive

### Task Management

Tasks are automatically updated when:
- The agent creates new tasks (via metadata in stream)
- The user refreshes the dashboard
- Tasks expire (filtered by status)

### State Management

- **Messages**: React state for chat messages
- **Tasks**: React state for task list
- **Session ID**: useRef with localStorage persistence
- **UI State**: Various useState hooks for UI controls

## Browser Support

- Modern browsers with ES2020+ support
- Requires localStorage API
- Requires fetch API and ReadableStream

## Known Limitations

- No offline support
- No push notifications for task deadlines
