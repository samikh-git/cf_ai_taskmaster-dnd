# QuestMaster Frontend

A Next.js web application that provides a chat interface and task dashboard for interacting with the QuestMaster Agent.

## Overview

The frontend is a Next.js 15 application built with React 19 and Tailwind CSS. It provides a user-friendly interface for chatting with the AI Dungeon Master and managing tasks (quests) with a dark, dungeon-themed design.

## Features

- **Chat Interface**: Real-time streaming chat with the AI agent
- **Task Dashboard**: Sidebar displaying all tasks organized by status
  - **Search & Filter**: Search tasks by name/description, filter by status and date
  - **Expandable Search Icon**: Quick-access search that expands when clicked
  - **Auto-refresh**: Tasks automatically refresh every 30 seconds
- **Task Details Modal**: Click on tasks to view full details
- **Account Page**: View level, XP, streaks, and statistics
- **Quest History**: View completed quests and detailed statistics
- **Browser Notifications**: Get reminders for upcoming task deadlines
- **Optimistic Updates**: Instant UI feedback before API confirmation
- **Skeleton Loading States**: Beautiful loading skeletons for all pages
- **Performance Optimized**: Lazy loading, debouncing, caching, and memoization
- **Authentication**: GitHub OAuth via NextAuth.js
- **Dark Theme**: Black and dark orange dungeon-themed UI
- **Responsive Design**: Works on desktop and mobile devices
- **Rate Limiting**: API routes protected with rate limiting

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Font**: Lora (Next.js font)
- **Authentication**: NextAuth.js v4 with GitHub OAuth
- **Icons**: Lucide React
- **Deployment**: Cloudflare Pages (via OpenNext)

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── page.tsx            # Main chat interface and dashboard
│   │   ├── layout.tsx          # Root layout with font configuration
│   │   ├── account/            # Account page (level, XP, streaks)
│   │   ├── history/            # Quest history and statistics
│   │   ├── about/              # About page
│   │   ├── globals.css         # Global styles
│   │   └── api/                # API routes
│   │       ├── agent/
│   │       │   └── route.ts    # Proxy route for agent chat
│   │       ├── tasks/
│   │       │   └── route.ts    # Proxy route for task operations
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts # NextAuth.js authentication
│   ├── components/             # React components
│   │   ├── TaskDashboard.tsx   # Task sidebar dashboard with search/filter
│   │   ├── TaskCard.tsx        # Individual task card (memoized)
│   │   ├── TaskDetailModal.tsx # Task details modal (lazy loaded)
│   │   ├── CreateTaskModal.tsx # Manual task creation modal (lazy loaded)
│   │   ├── ExpirationAlertModal.tsx # Task expiration alert
│   │   ├── LevelUpModal.tsx    # Level up celebration
│   │   ├── Skeletons.tsx       # Loading skeleton components
│   │   └── providers.tsx       # React context providers
│   ├── hooks/                  # Custom React hooks
│   │   ├── useChat.ts          # Chat message handling
│   │   ├── useTasks.ts         # Task management with optimistic updates
│   │   └── useNotifications.ts # Browser notifications
│   ├── lib/                    # Library utilities
│   │   ├── session-utils.ts    # Session ID generation
│   │   ├── rate-limit.ts       # Rate limiting logic
│   │   ├── get-user-id.ts      # User ID extraction
│   │   └── auth-token.ts       # Authentication token generation
│   ├── types/                  # TypeScript types
│   │   └── index.ts            # Shared type definitions
│   ├── constants/              # Constants
│   │   └── index.ts            # App-wide constants
│   └── utils/                  # Utility functions
│       ├── taskOperations.ts   # Task CRUD operations with optimistic updates
│       ├── time.ts             # Time formatting utilities
│       ├── taskFilter.ts       # Task filtering and search logic
│       ├── debounce.ts         # Debounce utility
│       └── validation.ts       # Input validation utilities
├── public/                     # Static assets
└── wrangler.jsonc              # Cloudflare Pages configuration
```

## Development

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
Create a `.env.local` file:

```bash
AGENT_URL=http://localhost:8787
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`

3. **Start the development server:**
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

1. **Login**: Sign in with GitHub OAuth
2. **Send Messages**: Type messages in the input field and press Enter or click Send
3. **View Responses**: AI responses stream in real-time in the chat window
4. **Task Dashboard**: Click the scroll icon to toggle the task sidebar

### Task Dashboard

- **Active Quests**: Tasks that are currently active (between start and end time)
- **Upcoming**: Tasks that haven't started yet
- **Expired**: Tasks that have passed their end time
- **Search**: Click the search icon in the bottom bar to search tasks by name or description
- **Filter**: Use the filter button to filter by status (all/active/upcoming/expired) and date (all/today/this week/this month/future/past)
- **View Details**: Click any task card to view full details in a modal
- **Create Quest**: Click the "+" button to manually create a task
- **Refresh**: Click the refresh icon to reload tasks from the agent

### Account Page

View your:
- Current level and XP progress
- Current streak and longest streak
- Quest completion statistics
- Logout option

### Quest History

View:
- All completed quests
- Completion statistics
- Average completion time
- Recent activity

## API Routes

### `/api/agent` (POST)

Proxies chat messages to the agent and streams responses back.

**Headers:**
- `x-timezone`: User's timezone (automatically detected)

**Request Body:** Plain text message

**Response:** Server-Sent Events (SSE) stream

**Rate Limiting:** 30 requests per minute per user

### `/api/tasks` (GET, POST, PATCH, DELETE)

Proxies task operations to the agent.

**GET**: Fetch all tasks and user stats
**POST**: Create a new task
**PATCH**: Update an existing task
**DELETE**: Delete a task

**Rate Limiting:** 30 requests per minute per user

## Configuration

### Environment Variables

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

### Session Management

Session IDs are generated server-side from authenticated user IDs using NextAuth.js. This ensures:
- Secure session management
- User-specific data isolation
- No client-side session ID manipulation

## Styling

The application uses:
- **Background**: Black (`bg-black`)
- **Accents**: Dark orange (`orange-900`, `orange-800`, etc.)
- **Font**: Lora (Next.js font)
- **Theme**: Dark dungeon aesthetic

## Authentication

Uses NextAuth.js v4 with GitHub OAuth:
- Secure session management
- Server-side session ID generation
- User-specific data isolation

## Features in Detail

### Streaming Responses

The chat interface streams responses from the agent in real-time using Server-Sent Events (SSE). The frontend:
- Parses SSE format (`data: ...` lines)
- Handles JSON metadata messages for task creation
- Updates the UI incrementally as chunks arrive
- Shows a streaming indicator while receiving

### Task Management

Tasks are automatically updated when:
- The agent creates new tasks (via metadata in stream)
- The user refreshes the dashboard
- Tasks expire (filtered by status)
- User manually creates, updates, or deletes tasks

### State Management

- **Messages**: React state for chat messages
- **Tasks**: React state for task list with optimistic updates
- **User Data**: Fetched from agent on mount
- **UI State**: Various useState hooks for UI controls
- **Optimistic Updates**: UI updates immediately, syncs with server after API calls
- **Rollback**: Automatic rollback on API errors

### Optimistic Updates

The frontend implements optimistic updates for better UX:
- **Task Creation**: Tasks appear immediately before API confirmation
- **Task Updates**: Changes reflect instantly (extend, finish, abandon)
- **XP Updates**: XP updates immediately when tasks are completed
- **Error Handling**: Automatic rollback if API calls fail

### Performance Optimizations

- **Lazy Loading**: Modals (TaskDetailModal, CreateTaskModal) load on demand
- **Memoization**: React hooks and callbacks memoized with useCallback/useMemo
- **Debouncing**: Auto-delete expired tasks function debounced
- **HTTP Caching**: GET /api/tasks responses cached (10s s-maxage, 60s stale-while-revalidate)
- **Component Memoization**: TaskCard wrapped with React.memo
- **Reduced Polling**: Expired task checks reduced from 1s to 5s intervals

### Browser Notifications

- Requests permission on first use
- Sends reminders for tasks starting soon
- Respects user's notification preferences

## Browser Support

- Modern browsers with ES2020+ support
- Requires localStorage API
- Requires fetch API and ReadableStream
- Requires Notification API for reminders

### Skeleton Loading States

Comprehensive skeleton loading states for all pages:
- **Main Page**: Full page skeleton on initial load
- **Account Page**: Complete account page skeleton
- **History Page**: History and statistics skeleton
- **Chat Area**: Message skeletons during loading
- **Task Dashboard**: Task list skeletons during refresh
- **Session Loading**: Spinner skeleton during authentication

### Search & Filter

Enhanced task dashboard with:
- **Search**: Real-time search by task name or description
- **Status Filter**: Filter by all/active/upcoming/expired
- **Date Filter**: Filter by all/today/this week/this month/future/past
- **Expandable Search**: Search icon expands to input field when clicked
- **Clear Filters**: Easy filter clearing with visual indicators

## Known Limitations

- No offline support
- Notifications require user permission
- Rate limiting handled by Cloudflare's Rate Limiting API (distributed and persistent)
