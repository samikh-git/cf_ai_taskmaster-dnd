# Tests Directory

This directory contains all testing-related files for the QuestMasterAgent.

## Files

- `agent.test.ts` - Comprehensive test suite for agent tools and functionality
- `index.test.ts` - Basic routing and HTTP endpoint tests
- `vitest.config.js` - Vitest configuration file for Cloudflare Workers
- `manual-test.js` - Manual HTTP test script
- `manual-agent-test.js` - Comprehensive manual agent test script
- `task-timing-test.js` - Task timing validation test suite

## Running Tests

### Manual Tests (Recommended)

**Test Agent Functionality:**

```bash
npm run test:agent
```

This comprehensive manual test script will:
1. Check if the dev server is running
2. Test HTTP endpoint connectivity
3. Send test messages to verify:
   - `getCurrentTime` tool usage
   - `createTask` tool usage
   - `viewTasks` tool usage
4. Display received responses and task metadata
5. Provide a test summary

**Test HTTP Connection:**

```bash
npm run test:manual
```

This simpler script tests basic HTTP connectivity and message sending.

**Test Task Timing Validation:**

```bash
npm run test:timing
```

This test suite validates that tasks are created with appropriate times:
- Verifies start times are in the future
- Verifies end times are after start times
- Validates ISO 8601 timestamp formats
- Tests natural language time parsing (e.g., "tomorrow", "next week", "in 3 hours")
- Checks for reasonable task durations
- Validates explicit timestamp handling

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

To run the manual test scripts, first start the dev server:

```bash
npm run dev
```

Then in another terminal, run:

```bash
npm run test:manual
# or
npm run test:agent
```

The manual test scripts will:
1. Connect to the QuestMasterAgent HTTP endpoint
2. Send test messages
3. Display any responses
4. Show task metadata if tasks are created

## Test Architecture

Tests use `@cloudflare/vitest-pool-workers` which provides:
- `getDurableObjectInstance`: Direct access to Durable Object instances
- `runDurableObjectAlarm`: Manually trigger alarms for testing
- `env`: Mocked environment bindings
- `SELF`: Reference to the worker itself for integration testing

Each test gets a fresh agent instance to ensure isolation. Tests use unique agent names based on timestamps to prevent state conflicts.

## Testing Best Practices

1. **Isolation**: Each test should use a unique session ID to avoid state conflicts
2. **Cleanup**: Tests should clean up any created tasks or state
3. **Async Handling**: All agent methods are async - use proper await syntax
4. **Error Handling**: Test both success and error cases
5. **Streaming**: For chat tests, handle SSE stream parsing correctly
