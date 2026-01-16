# Caching Strategy Guide

## Overview

This guide explains when and how to use caching in QuestMaster to optimize performance while maintaining data freshness and user experience.

## Current Caching Implementation

### Frontend API Routes

**GET `/api/tasks`** - Cached with stale-while-revalidate:
```typescript
'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60'
```
- **Fresh for**: 10 seconds
- **Stale but usable**: Up to 60 seconds
- **Why**: Tasks change frequently, but 10s cache reduces load

**POST `/api/agent`** - No cache:
```typescript
'Cache-Control': 'no-cache'
```
- **Why**: Chat responses are unique and shouldn't be cached

### Agent Responses

**Chat/Streaming Responses** - No cache:
- Streaming responses are unique per request
- Should never be cached

## When to Use Caching

### ✅ Good Candidates for Caching

#### 1. **Read-Heavy, Rarely Changing Data**

**Example: User Statistics**
```typescript
// Cache user stats for 30 seconds
// Stats don't change frequently
'Cache-Control': 'public, s-maxage=30'
```

**When to use:**
- User profile data (level, total XP, longest streak)
- Quest history statistics
- Public/static content

**Cache duration:** 30-60 seconds

#### 2. **Expensive Computations**

**Example: Statistics Calculations**
```typescript
// Cache computed statistics
// Expensive to recalculate
'Cache-Control': 'public, s-maxage=60'
```

**When to use:**
- Statistics aggregations
- Complex calculations
- Data transformations

**Cache duration:** 60-300 seconds

#### 3. **Frequently Accessed, Moderately Changing Data**

**Example: Task Lists**
```typescript
// Current implementation
'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60'
```

**When to use:**
- Task lists (current implementation)
- User data that changes occasionally
- Dashboard data

**Cache duration:** 10-30 seconds with stale-while-revalidate

#### 4. **Static or Semi-Static Content**

**Example: System Information**
```typescript
// Cache system info for longer
'Cache-Control': 'public, s-maxage=300'
```

**When to use:**
- App configuration
- Feature flags
- Static content

**Cache duration:** 300+ seconds

### ❌ Don't Cache These

#### 1. **User-Specific, Real-Time Data**

**Examples:**
- Chat messages
- Streaming responses
- Real-time notifications
- Current task status (if frequently updated)

**Why:** Data is unique per request or changes too frequently

#### 2. **Write Operations**

**Examples:**
- POST requests (task creation)
- PATCH requests (task updates)
- DELETE requests

**Why:** These modify state and should always hit the server

#### 3. **Authentication/Session Data**

**Examples:**
- Auth tokens
- Session information
- User permissions

**Why:** Security-sensitive, must be fresh

#### 4. **Time-Sensitive Data**

**Examples:**
- Task expiration status
- Current time-dependent data
- Real-time counters

**Why:** Data becomes stale quickly

## Caching Strategies

### 1. HTTP Cache Headers (Current Approach)

**Best for:** API responses, CDN caching

**Implementation:**
```typescript
// Short cache with stale-while-revalidate
headers: {
  'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60'
}

// Longer cache for static data
headers: {
  'Cache-Control': 'public, s-maxage=300'
}

// No cache for dynamic data
headers: {
  'Cache-Control': 'no-cache'
}
```

**Pros:**
- Simple to implement
- Works with Cloudflare CDN
- Automatic cache invalidation

**Cons:**
- Less control over cache keys
- Can't easily invalidate specific items

### 2. Cloudflare Cache API

**Best for:** Programmatic caching in Workers

**Implementation:**
```typescript
// In agent Worker
const cache = caches.default;
const cacheKey = new Request(`https://example.com/data/${sessionId}`);

// Check cache
const cached = await cache.match(cacheKey);
if (cached) {
  return cached;
}

// Fetch and cache
const response = await fetch(...);
await cache.put(cacheKey, response.clone());
return response;
```

**When to use:**
- Need programmatic cache control
- Custom cache keys
- Cache invalidation logic

**Pros:**
- Full control over caching
- Custom cache keys
- Can invalidate specific items

**Cons:**
- More complex
- Requires manual cache management

### 3. React State Caching (Client-Side)

**Best for:** UI state, reducing API calls

**Implementation:**
```typescript
// Using React Query or SWR
const { data } = useSWR('/api/tasks', fetcher, {
  refreshInterval: 30000, // Refresh every 30s
  revalidateOnFocus: true
});
```

**When to use:**
- Reduce API calls from UI
- Optimistic updates
- Background refetching

**Pros:**
- Better UX (instant updates)
- Reduces server load
- Automatic refetching

**Cons:**
- Client-side only
- Doesn't help with server load

### 4. Durable Object State (Built-in)

**Best for:** Persistent user data

**Current implementation:**
- Tasks stored in Durable Object state
- Automatically persisted
- No need for additional caching

**When to use:**
- User-specific data
- Session state
- Persistent storage

## Recommended Caching Strategy by Endpoint

### GET `/api/tasks`

**Current:** ✅ Cached (10s fresh, 60s stale)

**Recommendation:** Keep current implementation
- Tasks change frequently but not instantly
- 10s cache reduces load significantly
- Stale-while-revalidate provides good UX

**Consider:** Increase to 15-20s if load is high

### GET `/api/tasks?history=true`

**Current:** ❌ Not cached

**Recommendation:** Add caching
```typescript
'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
```
- History changes less frequently
- Statistics are expensive to compute
- 60s cache is reasonable

### GET `/api/agent` (Chat)

**Current:** ✅ No cache (correct)

**Recommendation:** Keep no cache
- Responses are unique
- Streaming can't be cached
- User-specific context

### POST `/api/tasks` (Create)

**Current:** ❌ No cache (correct)

**Recommendation:** Keep no cache
- Write operation
- Must hit server
- State changes

### PATCH/DELETE `/api/tasks`

**Current:** ❌ No cache (correct)

**Recommendation:** Keep no cache
- Write operations
- Must hit server

## Cache Invalidation

### When to Invalidate

1. **After Write Operations**
   - After creating a task → Invalidate task list cache
   - After updating a task → Invalidate task list cache
   - After deleting a task → Invalidate task list cache

2. **After State Changes**
   - Task completion → Invalidate stats cache
   - XP changes → Invalidate user stats cache

### Implementation Options

#### Option 1: Short Cache Duration (Current)
- Let cache expire naturally
- Simple, no invalidation logic needed
- Works well for frequently changing data

#### Option 2: Cache Tags (Enterprise)
```typescript
// Add cache tags
headers: {
  'Cache-Tag': 'tasks,user-123'
}

// Purge by tag
await fetch('https://api.cloudflare.com/...', {
  method: 'POST',
  body: JSON.stringify({
    tags: ['tasks', 'user-123']
  })
});
```

#### Option 3: Versioned Cache Keys
```typescript
// Include version in cache key
const cacheKey = `/api/tasks?v=${stateVersion}`;

// Update version when state changes
stateVersion++;
```

## Performance Considerations

### Cache Hit Rate

**Target:** 70-90% cache hit rate for cached endpoints

**Monitor:**
- Cache hit ratio in Cloudflare Analytics
- Response times
- Server load

### Cache Size

**Considerations:**
- Cloudflare CDN cache: Unlimited (within account limits)
- Worker Cache API: Limited by Worker memory
- Client-side cache: Limited by browser

### Cache Warming

**When needed:**
- After deployments
- For frequently accessed data
- To improve initial load times

**Implementation:**
```typescript
// Warm cache on deployment
async function warmCache() {
  const commonSessions = ['user-1', 'user-2'];
  for (const session of commonSessions) {
    await fetch(`/api/tasks?session=${session}`);
  }
}
```

## Best Practices

### 1. **Use Stale-While-Revalidate**

```typescript
'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60'
```

**Benefits:**
- Instant response (serves stale)
- Background refresh
- Better UX

### 2. **Cache User-Specific Data Appropriately**

- Use session ID in cache key
- Don't cache across users
- Invalidate on user actions

### 3. **Monitor Cache Performance**

- Track cache hit rates
- Monitor response times
- Watch for stale data issues

### 4. **Set Appropriate TTLs**

- **Short (10-30s)**: Frequently changing data
- **Medium (60-300s)**: Moderately changing data
- **Long (300s+)**: Rarely changing data

### 5. **Don't Over-Cache**

- Only cache when it helps
- Consider invalidation complexity
- Monitor for stale data

## Examples

### Example 1: Task List Caching

```typescript
// GET /api/tasks
export async function GET(request: Request) {
  // ... fetch tasks ...
  
  return new Response(JSON.stringify(tasks), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60'
    }
  });
}
```

**Why:** Tasks change frequently but 10s cache reduces load

### Example 2: Statistics Caching

```typescript
// GET /api/tasks?history=true
export async function GET(request: Request) {
  // ... calculate statistics ...
  
  return new Response(JSON.stringify(stats), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}
```

**Why:** Statistics are expensive and change less frequently

### Example 3: No Cache for Real-Time Data

```typescript
// POST /api/agent (chat)
export async function POST(request: Request) {
  // ... stream response ...
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
}
```

**Why:** Each response is unique and shouldn't be cached

## Monitoring

### Metrics to Track

1. **Cache Hit Rate**
   - Target: 70-90% for cached endpoints
   - Monitor in Cloudflare Analytics

2. **Response Times**
   - Cached responses should be faster
   - Compare cached vs uncached

3. **Server Load**
   - Should decrease with caching
   - Monitor Durable Object invocations

4. **Stale Data Issues**
   - User reports of outdated data
   - Monitor error rates

## Troubleshooting

### Issue: Stale Data

**Symptoms:** Users see outdated information

**Solutions:**
- Reduce cache TTL
- Add cache invalidation
- Use stale-while-revalidate

### Issue: Low Cache Hit Rate

**Symptoms:** Most requests miss cache

**Solutions:**
- Increase cache TTL
- Check cache key consistency
- Verify cache headers are set

### Issue: High Memory Usage

**Symptoms:** Worker memory limits reached

**Solutions:**
- Reduce cache size
- Use shorter TTLs
- Consider external cache (Redis)

## Summary

### Quick Reference

| Data Type | Cache? | Duration | Strategy |
|-----------|-------|----------|----------|
| Task List | ✅ Yes | 10s | stale-while-revalidate |
| Statistics | ✅ Yes | 60s | stale-while-revalidate |
| Chat Responses | ❌ No | - | no-cache |
| Write Operations | ❌ No | - | no-cache |
| User Profile | ✅ Yes | 30s | stale-while-revalidate |
| Static Content | ✅ Yes | 300s+ | long cache |

### Key Principles

1. **Cache read-heavy, rarely changing data**
2. **Use stale-while-revalidate for better UX**
3. **Don't cache write operations**
4. **Monitor cache performance**
5. **Set appropriate TTLs**
6. **Invalidate when state changes**

---

**Last Updated:** January 2025

