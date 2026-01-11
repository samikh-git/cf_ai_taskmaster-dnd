import WebSocket from 'ws';

const AGENT_URL = 'ws://localhost:8787/agents/task-master-agent/manual-test-session';
const BASE_URL = 'http://localhost:8787';

console.log('🧪 Manual Agent Test Suite');
console.log('='.repeat(50));
console.log('');

// Helper function to make HTTP requests
async function httpRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null,
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
    return { status: response.status, data };
  } catch (error) {
    return { error: error.message };
  }
}

// Test WebSocket connection and message handling
function testWebSocket() {
  return new Promise((resolve, reject) => {
    console.log('📡 Testing WebSocket Connection...');
    const ws = new WebSocket(AGENT_URL);
    
    let messagesReceived = [];
    let testResults = {
      connected: false,
      messagesReceived: 0,
      hasTaskMetadata: false,
      errors: [],
    };

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      testResults.connected = true;
      
      // Send test messages
      setTimeout(() => {
        console.log('📤 Sending test message: "Get current time"');
        ws.send(JSON.stringify({ content: 'What is the current time?' }));
      }, 500);
      
      setTimeout(() => {
        console.log('📤 Sending test message: "Create a test task"');
        ws.send(JSON.stringify({ 
          content: 'Create a test quest called "Manual Test Quest" that starts in 1 hour and ends in 2 hours, worth 100 XP' 
        }));
      }, 2000);
      
      setTimeout(() => {
        console.log('📤 Sending test message: "View all tasks"');
        ws.send(JSON.stringify({ content: 'Show me all my current quests' }));
      }, 4000);
      
      setTimeout(() => {
        ws.close();
      }, 8000);
    });

    ws.on('message', (data) => {
      const message = data.toString();
      testResults.messagesReceived++;
      messagesReceived.push(message);
      
      // Check if message contains task metadata
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'metadata' && parsed.tasks) {
          testResults.hasTaskMetadata = true;
          console.log('✅ Received task metadata:', JSON.stringify(parsed.tasks, null, 2));
        } else {
          console.log('📥 Received text response:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
        }
      } catch {
        console.log('📥 Received text chunk:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      testResults.errors.push(error.message);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
      console.log('');
      testResults.messagesReceived = messagesReceived.length;
      resolve(testResults);
    });

    setTimeout(() => {
      if (!testResults.connected) {
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

// Test HTTP endpoint
async function testHTTPEndpoint() {
  console.log('🌐 Testing HTTP Endpoint...');
  const result = await httpRequest('GET', '/agent/task-master-agent/http-test');
  if (result.status && result.status !== 404) {
    console.log(`✅ HTTP endpoint responded with status ${result.status}`);
    return true;
  } else {
    console.log(`❌ HTTP endpoint test failed: ${result.error || '404 Not Found'}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('Starting manual tests...');
  console.log('Make sure the dev server is running: npm run dev');
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
    http: false,
    websocket: null,
  };

  try {
    // Test HTTP endpoint
    results.http = await testHTTPEndpoint();
    console.log('');
  } catch (error) {
    console.error('❌ HTTP test failed:', error.message);
  }

  try {
    // Test WebSocket
    results.websocket = await testWebSocket();
  } catch (error) {
    console.error('❌ WebSocket test failed:', error.message);
    results.websocket = { error: error.message };
  }

  // Print summary
  console.log('');
  console.log('='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`HTTP Endpoint: ${results.http ? '✅ PASS' : '❌ FAIL'}`);
  
  if (results.websocket) {
    if (results.websocket.error) {
      console.log(`WebSocket: ❌ FAIL - ${results.websocket.error}`);
    } else {
      console.log(`WebSocket Connection: ${results.websocket.connected ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Messages Received: ${results.websocket.messagesReceived} ${results.websocket.messagesReceived > 0 ? '✅' : '❌'}`);
      console.log(`Task Metadata Received: ${results.websocket.hasTaskMetadata ? '✅ PASS' : '⚠️  NOT RECEIVED (may be normal if no tasks created)'}`);
      if (results.websocket.errors.length > 0) {
        console.log(`Errors: ${results.websocket.errors.join(', ')}`);
      }
    }
  }

  console.log('');
  console.log('💡 Tips:');
  console.log('  - Check the dev server logs for detailed agent responses');
  console.log('  - The agent should respond with narrative text and task metadata');
  console.log('  - Tasks should be created with proper start/end times');
  console.log('  - Use the agent interactively to test more features');
  console.log('');
}

// Run if executed directly
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

