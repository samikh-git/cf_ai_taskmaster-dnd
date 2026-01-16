# Development Guide

## Prerequisites

- **Node.js**: 18+ (recommended: 20+)
- **npm**: 9+ (comes with Node.js)
- **Wrangler CLI**: `npm install -g wrangler`
- **Cloudflare Account**: For AI bindings and deployment
- **GitHub Account**: For OAuth (development)

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd taskmaster-dnd
```

### 2. Install Dependencies

```bash
# Install agent dependencies
cd agent
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure Environment Variables

#### Agent Configuration

Create `agent/.dev.vars`:
```bash
AUTH_SECRET=your-secret-here
```

Generate secret:
```bash
openssl rand -base64 32
```

#### Frontend Configuration

Create `frontend/.env.local`:
```bash
AGENT_URL=http://localhost:8787
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Note:** `AUTH_SECRET` and `NEXTAUTH_SECRET` should be the same value.

### 4. Set Up GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret

### 5. Configure Cloudflare AI Binding

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your account
3. Go to Settings → Bindings → AI
4. Add AI binding (if not already configured)

## Running Locally

### Start Agent

```bash
cd agent
npm run dev
```

Agent runs at `http://localhost:8787`

### Start Frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Frontend runs at `http://localhost:3000`

## Development Workflow

### Code Structure

**Agent:**
- `src/agent.ts` - Main agent class
- `src/handlers/` - Request handlers
- `src/utils/` - Utility functions
- `src/types.ts` - TypeScript types

**Frontend:**
- `src/app/` - Next.js pages and API routes
- `src/components/` - React components
- `src/hooks/` - Custom hooks
- `src/lib/` - Library utilities
- `src/utils/` - Helper functions

### Making Changes

1. **Edit Code**: Make your changes
2. **Test Locally**: Both services auto-reload
3. **Run Tests**: `npm test` (agent) or `npm run build` (frontend)
4. **Commit**: Follow conventional commits
5. **Deploy**: See deployment guide

### Testing

#### Agent Tests

```bash
cd agent

# Unit tests
npm test

# Manual tests
npm run test:agent
npm run test:timing
```

#### Frontend Tests

```bash
cd frontend

# Build check
npm run build

# Type check
npx tsc --noEmit
```

### Debugging

#### Agent Debugging

- Check Wrangler logs in terminal
- Use `logger.debug()` for detailed logs
- Check `.wrangler/` directory for local state

#### Frontend Debugging

- Use browser DevTools
- Check Network tab for API calls
- Use React DevTools for component state
- Check server logs in terminal

### Common Issues

#### Agent Won't Start

- Check `AUTH_SECRET` is set in `.dev.vars`
- Verify Cloudflare AI binding is configured
- Check Wrangler version: `wrangler --version`

#### Frontend Can't Connect to Agent

- Verify agent is running on port 8787
- Check `AGENT_URL` in `.env.local`
- Check CORS settings (should allow localhost)

#### Authentication Errors

- Verify `AUTH_SECRET` matches `NEXTAUTH_SECRET`
- Check GitHub OAuth callback URL
- Clear browser cookies/session

#### SQL Errors

- Clear `.wrangler` directory: `rm -rf .wrangler`
- Restart dev server
- Check migrations in `wrangler.jsonc`

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types
- Use explicit return types for functions
- Avoid `any` type

### React

- Use functional components
- Prefer hooks over class components
- Use `useCallback` and `useMemo` for optimization
- Keep components small and focused

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase

### Comments

- Use JSDoc for functions
- Explain "why" not "what"
- Keep comments up to date

## Git Workflow

### Branching

- `main` - Production-ready code
- `develop` - Development branch (if used)
- Feature branches: `feature/description`
- Bug fixes: `fix/description`

### Commits

Use conventional commits:

```
feat: add search functionality
fix: resolve task expiration bug
docs: update API documentation
refactor: simplify task operations
test: add timing validation tests
```

### Pull Requests

- Clear title and description
- Link related issues
- Request review before merging
- Ensure tests pass

## Performance Considerations

### Frontend

- **Lazy Loading**: Use for modals and heavy components
- **Memoization**: Memoize expensive computations
- **Debouncing**: Debounce search and auto-save
- **Caching**: Use HTTP caching headers

### Agent

- **Streaming**: Stream responses for better UX
- **Efficient State**: Minimize state updates
- **Alarm Scheduling**: Efficient task cleanup
- **Tool Execution**: Keep tools fast

## Security Best Practices

1. **Never commit secrets**: Use `.dev.vars` and `.env.local`
2. **Validate input**: Always validate on server
3. **Sanitize output**: Prevent XSS attacks
4. **Use HTTPS**: Always in production
5. **Rate limiting**: Protect against abuse
6. **Authentication**: Validate all requests

## Adding New Features

### Adding a New Tool

1. Define tool in `agent/src/tools.ts`
2. Implement function in `agent/src/agent.ts`
3. Update system prompt if needed
4. Add tests
5. Update documentation

### Adding a New Page

1. Create page in `frontend/src/app/`
2. Add route to navigation (if needed)
3. Add skeleton loading state
4. Update types if needed
5. Test thoroughly

### Adding a New API Endpoint

1. Add handler in `agent/src/handlers/`
2. Add route in `agent/src/index.ts`
3. Add frontend proxy route (if needed)
4. Add authentication/rate limiting
5. Add tests
6. Update API documentation

## Dependencies

### Adding Dependencies

**Agent:**
```bash
cd agent
npm install <package>
```

**Frontend:**
```bash
cd frontend
npm install <package>
```

### Updating Dependencies

```bash
npm update
npm audit fix
```

### Removing Dependencies

```bash
npm uninstall <package>
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :8787  # Agent
lsof -i :3000  # Frontend

# Kill process
kill -9 <PID>
```

### Module Not Found

- Clear `node_modules` and reinstall
- Check `package.json` versions
- Verify import paths

### Type Errors

- Run `npx tsc --noEmit` to check types
- Check `tsconfig.json` settings
- Verify type definitions are installed

### Build Errors

- Clear `.next` directory: `rm -rf .next`
- Clear `.wrangler` directory: `rm -rf .wrangler`
- Reinstall dependencies
- Check Node.js version

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)

## Getting Help

1. Check existing documentation
2. Search GitHub issues
3. Check Cloudflare Workers community
4. Review code comments
5. Ask in team chat (if applicable)

