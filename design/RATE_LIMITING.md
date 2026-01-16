# Rate Limiting Setup

This document explains how rate limiting is implemented to prevent API credit abuse.

## Current Implementation

The application implements rate limiting at the API route level to protect against API credit abuse:

- **Agent API** (`/api/agent`): 30 requests per minute per user
- **Tasks API** (`/api/tasks`): 60 requests per minute per user

Rate limiting is based on:
- User session token (if authenticated via NextAuth)
- IP address (as fallback for unauthenticated users)

## How It Works

1. Each API request checks the user's rate limit status
2. Rate limits are tracked per user/session using an in-memory store
3. When a limit is exceeded, the API returns a `429 Too Many Requests` status
4. Rate limit headers are included in all responses:
   - `X-RateLimit-Limit`: Maximum requests allowed
   - `X-RateLimit-Remaining`: Remaining requests in current window
   - `X-RateLimit-Reset`: Timestamp when the limit resets
   - `Retry-After`: Seconds to wait before retrying

## Cloudflare Rate Limiting (Option A)

For additional protection at the edge, you can configure Cloudflare Rate Limiting:

### Step 1: Enable Cloudflare Rate Limiting

1. Log in to your Cloudflare dashboard
2. Select your domain (frontend.sami-houssaini.workers.dev)
3. Go to **Security** → **WAF** → **Rate limiting rules**

### Step 2: Create a Rate Limiting Rule

Create a rule with these settings:

**Rule Name**: `API Rate Limit`

**When incoming requests match**:
- URI Path: `/api/*`
- Request Method: `POST` or `GET`

**Then**:
- Action: `Block`
- Rate: `100 requests per minute` (adjust based on your needs)
- Duration: `1 minute`

### Step 3: Create Additional Rule for Agent Endpoint

For stricter protection on the AI agent endpoint (which uses API credits):

**Rule Name**: `Agent API Rate Limit`

**When incoming requests match**:
- URI Path: `/api/agent`
- Request Method: `POST`

**Then**:
- Action: `Block`
- Rate: `50 requests per minute` (more restrictive)
- Duration: `1 minute`

### Step 4: Monitor Rate Limiting

1. Go to **Analytics** → **Security Events**
2. Filter by "Rate limiting" to see blocked requests
3. Adjust limits based on legitimate traffic patterns

## Adjusting Rate Limits

To change the rate limits in code, edit:

- `frontend/src/app/api/agent/route.ts`: Change `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`
- `frontend/src/app/api/tasks/route.ts`: Change `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`

## Production Considerations

**Current Implementation (In-Memory)**:
- Works for single-instance deployments
- Rate limits reset on server restart
- Not shared across multiple instances

**For Production at Scale**:
Consider upgrading to a distributed rate limiter:
- **Cloudflare KV**: Store rate limit data in Cloudflare KV
- **Upstash Redis**: Use Upstash for serverless Redis
- **Cloudflare Durable Objects**: For more complex rate limiting logic

Example using Cloudflare KV:
```typescript
// Store rate limit data in Cloudflare KV instead of in-memory Map
// This allows rate limits to persist across restarts and scale horizontally
```

## Testing Rate Limits

1. Make requests quickly to exceed the limit
2. Verify you receive `429 Too Many Requests` response
3. Check rate limit headers in the response
4. Wait for the reset window and try again

## Notes

- Rate limits apply per authenticated user (by session token)
- Unauthenticated users are rate limited by IP address
- Rate limits are independent per API endpoint
- Cloudflare rate limiting provides additional protection at the edge before requests reach your application

