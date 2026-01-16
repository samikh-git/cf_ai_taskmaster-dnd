import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENT_URL = 'http://localhost:8787';
const BASE_URL = AGENT_URL;

// Generate auth token for testing
function generateAuthToken(sessionId, secret) {
  if (!secret) {
    return null;
  }
  
  const timestamp = Date.now();
  const payload = `${sessionId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `${payload}:${signature}`;
}

// Get AUTH_SECRET from multiple sources
function getAuthSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }
  
  try {
    const wranglerPath = join(__dirname, '..', 'wrangler.jsonc');
    const wranglerContent = readFileSync(wranglerPath, 'utf-8');
    const match = wranglerContent.match(/"AUTH_SECRET"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    // Ignore
  }
  
  return '';
}

const AUTH_SECRET = getAuthSecret();

console.log('🧪 Task Timing Validation Test Suite');
console.log('='.repeat(50));
console.log('Testing that tasks are created with appropriate times');
console.log(`Auth: ${AUTH_SECRET ? '✅ Enabled' : '⚠️  Disabled'}`);
console.log('');

// Helper to make HTTP requests
async function httpRequest(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      ...(body && typeof body === 'string' ? { 'Content-Type': 'text/plain' } : {}),
      ...(body && typeof body === 'object' ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  };
  
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    return { error: error.message };
  }
}

// Send a chat message and wait for task metadata
async function sendChatMessage(sessionId, message) {
  const authToken = AUTH_SECRET ? generateAuthToken(sessionId, AUTH_SECRET) : null;
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  headers['Content-Type'] = 'text/plain';
  headers['x-timezone'] = 'America/New_York';
  
  const url = `${BASE_URL}/agents/quest-master-agent/${sessionId}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    });
    
    if (!response.ok) {
      return { success: false, status: response.status, tasks: [] };
    }
    
    // Read SSE stream for task metadata
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const tasks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            if (json.type === 'metadata' && json.tasks) {
              tasks.push(...json.tasks);
            }
          } catch {
            // Text chunk, ignore
          }
        }
      }
    }
    
    return { success: true, status: response.status, tasks };
  } catch (error) {
    return { success: false, error: error.message, tasks: [] };
  }
}

// Get tasks via GET endpoint
async function getTasks(sessionId) {
  const authToken = AUTH_SECRET ? generateAuthToken(sessionId, AUTH_SECRET) : null;
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const result = await httpRequest('GET', `/agents/quest-master-agent/${sessionId}`, null, headers);
  
  if (result.status === 200 && result.data && result.data.tasks) {
    return result.data.tasks;
  }
  return [];
}

// Validate task timing
function validateTaskTiming(task, testName) {
  const errors = [];
  const warnings = [];
  const now = new Date();
  
  // Check required fields
  if (!task.id) {
    errors.push('Task missing id');
  }
  if (!task.name) {
    errors.push('Task missing name');
  }
  if (!task.startTime) {
    errors.push('Task missing startTime');
    return { valid: false, errors, warnings };
  }
  if (!task.endTime) {
    errors.push('Task missing endTime');
    return { valid: false, errors, warnings };
  }
  
  // Parse times
  const startTime = new Date(task.startTime);
  const endTime = new Date(task.endTime);
  
  // Check if times are valid dates
  if (isNaN(startTime.getTime())) {
    errors.push(`Invalid startTime format: ${task.startTime}`);
  }
  if (isNaN(endTime.getTime())) {
    errors.push(`Invalid endTime format: ${task.endTime}`);
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  // Check start time is in the future (with 1 minute tolerance for clock skew)
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  if (startTime <= oneMinuteAgo) {
    errors.push(`Start time is in the past: ${startTime.toISOString()} (current: ${now.toISOString()})`);
  }
  
  // Check end time is after start time
  if (endTime <= startTime) {
    errors.push(`End time must be after start time. Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}`);
  }
  
  // Check for reasonable duration (warnings, not errors)
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = durationMs / (60 * 1000);
  
  if (durationMinutes < 1) {
    warnings.push(`Very short task duration: ${durationMinutes.toFixed(2)} minutes`);
  }
  if (durationMinutes > 365 * 24 * 60) {
    warnings.push(`Very long task duration: ${(durationMinutes / (365 * 24 * 60)).toFixed(2)} years`);
  }
  
  // Check if start time is too far in the future (more than 10 years)
  const tenYearsFromNow = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  if (startTime > tenYearsFromNow) {
    warnings.push(`Start time is very far in the future: ${startTime.toISOString()}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMinutes: Math.round(durationMinutes),
  };
}

// Test cases
const testCases = [
  {
    name: 'Explicit ISO timestamps',
    message: (now) => {
      const start = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const end = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
      return `Create a quest called "Explicit Time Test" that starts at ${start.toISOString()} and ends at ${end.toISOString()}, worth 50 XP`;
    },
    expectedDuration: { min: 110, max: 130 }, // ~2 hours in minutes
  },
  {
    name: 'Natural language: "tomorrow afternoon"',
    message: () => 'I need to finish a report by tomorrow afternoon. Make it worth 75 XP.',
    expectedDuration: { min: 60, max: 24 * 60 }, // Should be tomorrow, so at least 1 hour from now
  },
  {
    name: 'Natural language: "in 3 hours"',
    message: (now) => {
      const targetTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      return `Create a quest to review documents that should be done in 3 hours (by ${targetTime.toISOString()}), worth 30 XP`;
    },
    expectedDuration: { min: 150, max: 200 }, // ~3 hours
  },
  {
    name: 'Natural language: "next week"',
    message: () => 'I have a project due next week. Create a quest for it worth 100 XP.',
    expectedDuration: { min: 6 * 24 * 60, max: 8 * 24 * 60 }, // 6-8 days
  },
  {
    name: 'Relative time: "in 1 hour"',
    message: () => 'Create a quest that starts in 1 hour and lasts 2 hours, worth 40 XP.',
    expectedDuration: { min: 110, max: 130 }, // ~2 hours
  },
];

// Main test runner
async function runTests() {
  console.log('Starting task timing validation tests...');
  console.log('Make sure the dev server is running: npm run dev');
  console.log('');
  
  const sessionId = `timing-test-${Date.now()}`;
  console.log(`📝 Using session ID: ${sessionId}`);
  console.log('');
  
  // Check if server is accessible
  console.log('🔍 Checking if server is accessible...');
  const healthCheck = await httpRequest('GET', '/');
  if (healthCheck.error) {
    console.error('❌ Cannot connect to server. Make sure it is running:');
    console.error('   npm run dev');
    process.exit(1);
  }
  console.log('✅ Server is accessible');
  console.log('');
  
  const now = new Date();
  const results = [];
  
  // Run each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`   Message: "${testCase.message(now).substring(0, 80)}${testCase.message(now).length > 80 ? '...' : ''}"`);
    
    try {
      // Send chat message
      const chatResult = await sendChatMessage(sessionId, testCase.message(now));
      
      if (!chatResult.success) {
        console.log(`   ❌ Failed to send message: ${chatResult.error || `status ${chatResult.status}`}`);
        results.push({
          test: testCase.name,
          success: false,
          error: `Request failed: ${chatResult.error || chatResult.status}`,
        });
        continue;
      }
      
      // Wait a bit for task to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get tasks from GET endpoint
      const tasks = await getTasks(sessionId);
      
      if (tasks.length === 0) {
        console.log(`   ⚠️  No tasks found. The agent may not have created a task.`);
        results.push({
          test: testCase.name,
          success: false,
          error: 'No tasks were created',
        });
        continue;
      }
      
      // Find the most recent task (should be the one we just created)
      const task = tasks[tasks.length - 1];
      console.log(`   📦 Found task: "${task.name}"`);
      
      // Validate timing
      const validation = validateTaskTiming(task, testCase.name);
      
      if (!validation.valid) {
        console.log(`   ❌ Timing validation failed:`);
        validation.errors.forEach(err => console.log(`      - ${err}`));
        results.push({
          test: testCase.name,
          success: false,
          task: task.name,
          errors: validation.errors,
          warnings: validation.warnings,
        });
        continue;
      }
      
      // Check expected duration if specified
      if (testCase.expectedDuration) {
        const { min, max } = testCase.expectedDuration;
        if (validation.durationMinutes < min || validation.durationMinutes > max) {
          console.log(`   ⚠️  Duration outside expected range:`);
          console.log(`      Expected: ${min}-${max} minutes`);
          console.log(`      Actual: ${validation.durationMinutes} minutes`);
          validation.warnings.push(`Duration ${validation.durationMinutes} min outside expected range ${min}-${max} min`);
        }
      }
      
      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.log(`   ⚠️  Warnings:`);
        validation.warnings.forEach(warn => console.log(`      - ${warn}`));
      }
      
      console.log(`   ✅ Timing validation passed`);
      console.log(`      Start: ${validation.startTime}`);
      console.log(`      End: ${validation.endTime}`);
      console.log(`      Duration: ${validation.durationMinutes} minutes`);
      
      results.push({
        test: testCase.name,
        success: true,
        task: task.name,
        startTime: validation.startTime,
        endTime: validation.endTime,
        durationMinutes: validation.durationMinutes,
        warnings: validation.warnings,
      });
      
    } catch (error) {
      console.log(`   ❌ Test failed with error: ${error.message}`);
      results.push({
        test: testCase.name,
        success: false,
        error: error.message,
      });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print summary
  console.log('\n');
  console.log('='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  results.forEach((result, idx) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${idx + 1}. ${result.test}: ${status}`);
    
    if (result.success) {
      passed++;
      if (result.durationMinutes) {
        console.log(`   Duration: ${result.durationMinutes} minutes`);
      }
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      }
    } else {
      failed++;
      if (result.errors) {
        result.errors.forEach(e => console.log(`   Error: ${e}`));
      } else if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });
  
  console.log('');
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('');
  
  if (failed === 0) {
    console.log('🎉 All timing validation tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
  console.log('');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

