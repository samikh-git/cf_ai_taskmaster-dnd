# Tests Directory

This directory contains all testing-related files for the QuestMasterAgent.

## Files

- `agent.test.ts` - Comprehensive test suite for agent tools and functionality
- `index.test.ts` - Basic routing and HTTP endpoint tests
- `vitest.config.js` - Vitest configuration file for Cloudflare Workers
- `manual-test.js` - Manual WebSocket test script

## Running Tests

### Manual Tests (Recommended)

**Test Agent Functionality:**

```bash
npm run test:agent
```

This comprehensive manual test script will:
1. Check if the dev server is running
2. Test HTTP endpoint connectivity
3. Test WebSocket connection
4. Send test messages to verify:
   - `getCurrentTime` tool usage
   - `createTask` tool usage
   - `viewTasks` tool usage
5. Display received responses and task metadata
6. Provide a test summary

**Test WebSocket Connection:**

```bash
npm run test:manual
```

This simpler script just tests basic WebSocket connectivity and message sending.

### Automated Tests (Vitest - Optional)

Run all automated tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test -- --watch
```

Run a specific test file:

```bash
npm test -- agent.test.ts
```

### Test Coverage

The test suite (`agent.test.ts`) covers:

1. **Tool Functions**:
   - `getCurrentTime`: Validates ISO 8601 format and accuracy
   - `createTask`: Task creation with all properties
   - `viewTasks`: Retrieving task lists

2. **State Management**:
   - Task persistence across method calls
   - Multiple task creation and retrieval
   - State isolation between test runs

3. **Task Expiration**:
   - Alarm scheduling when tasks are created
   - Automatic cleanup of expired tasks
   - Alarm handler execution

4. **Alarm System**:
   - Scheduling alarms for earliest task expiration
   - Alarm cancellation when no tasks remain
   - Multiple task expiration handling

5. **Edge Cases**:
   - Tasks with identical start/end times
   - Very large XP values
   - Empty task names and descriptions

### Manual Testing

To run the manual WebSocket test script, first start the dev server:

```bash
npm run dev
```

Then in another terminal, run:

```bash
npm run test:manual
```

The manual test script will:
1. Connect to the QuestMasterAgent WebSocket endpoint
2. Send a test message
3. Display any responses
4. Close after 10 seconds

## Test Architecture

Tests use `@cloudflare/vitest-pool-workers` which provides:
- `getDurableObjectInstance`: Direct access to Durable Object instances
- `runDurableObjectAlarm`: Manually trigger alarms for testing
- `env`: Mocked environment bindings
- `SELF`: Reference to the worker itself for integration testing

Each test gets a fresh agent instance to ensure isolation. Tests use unique agent names based on timestamps to prevent state conflicts.

