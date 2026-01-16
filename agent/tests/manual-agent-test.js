import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENT_URL = 'http://localhost:8787';
const BASE_URL = AGENT_URL;

// Generate auth token for testing (matches frontend implementation)
function generateAuthToken(sessionId, secret) {
  if (!secret) {
    return null; // No auth if secret not provided
  }
  
  const timestamp = Date.now();
  const payload = `${sessionId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `${payload}:${signature}`;
}

// Try to get AUTH_SECRET from multiple sources
function getAuthSecret() {
  // First, try environment variables
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }
  
  // Try to read from wrangler.jsonc (for local dev)
  try {
    const wranglerPath = join(__dirname, '..', 'wrangler.jsonc');
    const wranglerContent = readFileSync(wranglerPath, 'utf-8');
    // Extract AUTH_SECRET value - match the pattern "AUTH_SECRET": "value"
    // The value can be very long, so we use a non-greedy match with proper escaping
    const match = wranglerContent.match(/"AUTH_SECRET"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    // If we can't read wrangler.jsonc, that's okay - we'll use empty string
    // Don't warn here as it's expected in some environments
  }
  
  return '';
}

const AUTH_SECRET = getAuthSecret();

console.log('🧪 Manual Agent Test Suite');
console.log('='.repeat(50));
console.log('Testing QuestMasterAgent');
if (AUTH_SECRET) {
  console.log(`Auth: ✅ Enabled (secret length: ${AUTH_SECRET.length} chars)`);
} else {
  console.log(`Auth: ⚠️  Disabled (local dev - no AUTH_SECRET found)`);
  console.log(`   Note: If agent requires auth, set AUTH_SECRET env var or ensure wrangler.jsonc is readable`);
}
console.log('');

// Helper function to make HTTP requests
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

// Test HTTP POST endpoint with SSE streaming (chat)
async function testChatEndpoint(sessionId, message) {
  console.log(`💬 Testing Chat Endpoint (SSE Streaming): "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  
  // Always generate and send token if AUTH_SECRET is available
  const authToken = AUTH_SECRET ? generateAuthToken(sessionId, AUTH_SECRET) : null;
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (AUTH_SECRET) {
    console.warn('   ⚠️  AUTH_SECRET is set but token generation failed');
  }
  headers['Content-Type'] = 'text/plain';
  headers['x-timezone'] = 'America/New_York'; // Test timezone support
  
  const url = `${BASE_URL}/agents/quest-master-agent/${sessionId}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    });
    
    if (!response.ok) {
      console.log(`   ❌ Responded with status ${response.status}`);
      const text = await response.text();
      console.log(`   Response: ${text.substring(0, 200)}`);
      return { success: false, status: response.status };
    }
    
    console.log(`   ✅ Responded with status ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunks = 0;
    let hasMetadata = false;
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          chunks++;
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }
          
          try {
            const json = JSON.parse(data);
            if (json.type === 'metadata' && json.tasks) {
              hasMetadata = true;
              console.log(`   ✅ Received task metadata: ${json.tasks.length} task(s)`);
              if (json.tasks.length > 0) {
                json.tasks.forEach((task, idx) => {
                  console.log(`      Task ${idx + 1}: "${task.name}" (${task.XP} XP)`);
                });
              }
            }
          } catch {
            // Text chunk
            fullResponse += data;
            if (chunks <= 3) {
              console.log(`   📥 Received: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
            }
          }
        }
      }
    }
    
    console.log(`   Total SSE chunks received: ${chunks}`);
    console.log(`   Response length: ${fullResponse.length} characters`);
    return { success: true, status: response.status, hasMetadata, chunks, responseLength: fullResponse.length };
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test GET endpoint (view tasks)
async function testGETTasksEndpoint(sessionId) {
  console.log('🔍 Testing GET Endpoint (View Tasks)...');
  
  // Always generate and send token if AUTH_SECRET is available
  const authToken = AUTH_SECRET ? generateAuthToken(sessionId, AUTH_SECRET) : null;
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (AUTH_SECRET) {
    console.warn('   ⚠️  AUTH_SECRET is set but token generation failed');
  }
  
  const result = await httpRequest('GET', `/agents/quest-master-agent/${sessionId}`, null, headers);
  
  if (result.status && result.status === 200) {
    console.log(`   ✅ Responded with status ${result.status}`);
    if (result.data && result.data.tasks) {
      console.log(`   Found ${result.data.tasks.length} task(s)`);
      console.log(`   Total XP: ${result.data.totalXP || 0}`);
      console.log(`   Current Streak: ${result.data.currentStreak || 0} days`);
      if (result.data.tasks.length > 0) {
        result.data.tasks.forEach((task, idx) => {
          console.log(`   Task ${idx + 1}: "${task.name}" (${task.XP} XP)`);
        });
      }
    }
    return { success: true, data: result.data };
  } else {
    console.log(`   ❌ Test failed: ${result.error || `status ${result.status}`}`);
    return { success: false, status: result.status };
  }
}

// Test GET endpoint (view history)
async function testGETHistoryEndpoint(sessionId) {
  console.log('📚 Testing GET Endpoint (View History)...');
  
  // Always generate and send token if AUTH_SECRET is available
  const authToken = AUTH_SECRET ? generateAuthToken(sessionId, AUTH_SECRET) : null;
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (AUTH_SECRET) {
    console.warn('   ⚠️  AUTH_SECRET is set but token generation failed');
  }
  
  const result = await httpRequest('GET', `/agents/quest-master-agent/${sessionId}?history=true`, null, headers);
  
  if (result.status && result.status === 200) {
    console.log(`   ✅ Responded with status ${result.status}`);
    if (result.data && result.data.completedQuests) {
      console.log(`   Found ${result.data.completedQuests.length} completed quest(s)`);
      if (result.data.statistics) {
        console.log(`   Statistics:`, JSON.stringify(result.data.statistics, null, 2));
      }
    }
    return { success: true, data: result.data };
  } else {
    console.log(`   ❌ Test failed: ${result.error || `status ${result.status}`}`);
    return { success: false, status: result.status };
  }
}

// Test POST endpoint with JSON (direct task operations)
async function testPOSTTaskOperation(sessionId, operation, params) {
  console.log(`🔧 Testing POST Endpoint (Direct Task Operation: ${operation})...`);
  
  // Always generate and send token if AUTH_SECRET is available
  const authToken = AUTH_SECRET ? generateAuthToken(sessionId, AUTH_SECRET) : null;
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (AUTH_SECRET) {
    console.warn('   ⚠️  AUTH_SECRET is set but token generation failed');
  }
  headers['Content-Type'] = 'application/json';
  
  const body = {
    tool: operation,
    params: params,
  };
  
  const result = await httpRequest('POST', `/agents/quest-master-agent/${sessionId}`, body, headers);
  
  if (result.status && result.status === 200) {
    console.log(`   ✅ Responded with status ${result.status}`);
    if (result.data && result.data.success) {
      console.log(`   Operation successful`);
      if (result.data.task) {
        console.log(`   Task: "${result.data.task.name}" (${result.data.task.XP} XP)`);
      }
    }
    return { success: true, data: result.data };
  } else {
    console.log(`   ❌ Test failed: ${result.error || `status ${result.status}`}`);
    if (result.data && result.data.error) {
      console.log(`   Error: ${result.data.error}`);
    }
    return { success: false, status: result.status };
  }
}

// Main test runner
async function runTests() {
  console.log('Starting manual tests...');
  console.log('Make sure the dev server is running: npm run dev');
  console.log('');
  
  // Generate a unique session ID for this test run
  const sessionId = `manual-test-${Date.now()}`;
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

  // Run tests
  const results = {
    chat1: null,      // Get current time
    chat2: null,      // Create a task
    chat3: null,      // View tasks via chat
    chat4: null,      // Natural language task creation
    getTasks: null,
    getHistory: null,
    postCreateTask: null,
  };

  try {
    // Test 1: Chat - Get current time
    results.chat1 = await testChatEndpoint(sessionId, 'What is the current time?');
    console.log('');
  } catch (error) {
    console.error('❌ Chat test 1 failed:', error.message);
    results.chat1 = { success: false, error: error.message };
  }

  try {
    // Test 2: Chat - Create a task with explicit times
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    results.chat2 = await testChatEndpoint(
      sessionId,
      `Create a test quest called "Manual Test Quest" that starts at ${startTime.toISOString()} and ends at ${endTime.toISOString()}, worth 100 XP`
    );
    console.log('');
  } catch (error) {
    console.error('❌ Chat test 2 failed:', error.message);
    results.chat2 = { success: false, error: error.message };
  }

  try {
    // Test 3: Chat - View tasks
    results.chat3 = await testChatEndpoint(sessionId, 'Show me all my current quests');
    console.log('');
  } catch (error) {
    console.error('❌ Chat test 3 failed:', error.message);
    results.chat3 = { success: false, error: error.message };
  }

  try {
    // Test 4: Chat - Natural language task creation
    results.chat4 = await testChatEndpoint(sessionId, 'I need to finish a report by tomorrow afternoon. Make it worth 50 XP.');
    console.log('');
  } catch (error) {
    console.error('❌ Chat test 4 failed:', error.message);
    results.chat4 = { success: false, error: error.message };
  }

  try {
    // Test 5: GET tasks endpoint
    results.getTasks = await testGETTasksEndpoint(sessionId);
    console.log('');
  } catch (error) {
    console.error('❌ GET tasks test failed:', error.message);
    results.getTasks = { success: false, error: error.message };
  }

  try {
    // Test 6: GET history endpoint
    results.getHistory = await testGETHistoryEndpoint(sessionId);
    console.log('');
  } catch (error) {
    console.error('❌ GET history test failed:', error.message);
    results.getHistory = { success: false, error: error.message };
  }

  try {
    // Test 7: POST direct task creation (optional - tests JSON endpoint)
    const now = new Date();
    const startTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    const endTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
    results.postCreateTask = await testPOSTTaskOperation(sessionId, 'createTask', {
      taskName: 'Direct API Test Quest',
      taskDescription: 'A quest created via direct API call',
      taskStartTime: startTime.toISOString(),
      taskEndTime: endTime.toISOString(),
      XP: 75,
    });
    console.log('');
  } catch (error) {
    console.error('❌ POST createTask test failed:', error.message);
    results.postCreateTask = { success: false, error: error.message };
  }

  // Print summary
  console.log('');
  console.log('='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  
  console.log(`Chat Test 1 (Get Time): ${results.chat1?.success ? '✅ PASS' : '❌ FAIL'}`);
  if (results.chat1?.chunks) {
    console.log(`   Chunks: ${results.chat1.chunks}, Length: ${results.chat1.responseLength} chars`);
  }
  
  console.log(`Chat Test 2 (Create Task): ${results.chat2?.success ? '✅ PASS' : '❌ FAIL'}`);
  if (results.chat2?.hasMetadata) {
    console.log(`   Task metadata received: ✅`);
  }
  
  console.log(`Chat Test 3 (View Tasks): ${results.chat3?.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`Chat Test 4 (Natural Language): ${results.chat4?.success ? '✅ PASS' : '❌ FAIL'}`);
  if (results.chat4?.hasMetadata) {
    console.log(`   Task metadata received: ✅`);
  }
  
  console.log(`GET Tasks Endpoint: ${results.getTasks?.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`GET History Endpoint: ${results.getHistory?.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`POST CreateTask Endpoint: ${results.postCreateTask?.success ? '✅ PASS' : '❌ FAIL'}`);

  console.log('');
  console.log('💡 Tips:');
  console.log('  - Check the dev server logs for detailed agent responses');
  console.log('  - The agent should respond with narrative text and task metadata');
  console.log('  - Tasks should be created with proper start/end times');
  console.log('  - Use the agent interactively to test more features');
  console.log('  - Set AUTH_SECRET environment variable to test authentication');
  console.log('');
  
  // Exit with appropriate code
  const allPassed = 
    results.chat1?.success &&
    results.chat2?.success &&
    results.chat3?.success &&
    results.chat4?.success &&
    results.getTasks?.success &&
    results.getHistory?.success &&
    results.postCreateTask?.success;
  
  process.exit(allPassed ? 0 : 1);
}

// Run if executed directly
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
