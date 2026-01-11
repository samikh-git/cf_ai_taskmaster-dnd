import WebSocket from 'ws';

const AGENT_URL = 'ws://localhost:8787/agents/task-master-agent/test-session';
const WS = new WebSocket(AGENT_URL);

WS.on('open', () => {
  console.log('✅ Connected to TaskMasterAgent');
  
  // Send a test message
  const testMessage = {
    content: 'Hello! I need help with organizing my day. I need to finish this powerpoint presentation for my job, walk my dog, and take out the trash. Please help me organize.'
  };
  
  console.log('📤 Sending message:', testMessage.content);
  WS.send(JSON.stringify(testMessage));
});

WS.on('message', (data) => {
  const message = data.toString();
  console.log('📥 Received:', message);
  
  // Check if it's SSE format
  if (message.startsWith('data: ')) {
    try {
      const jsonData = JSON.parse(message.substring(6));
      if (jsonData.type === 'metadata' && jsonData.tasks) {
        console.log('✅ Tasks created:', JSON.stringify(jsonData.tasks, null, 2));
      }
    } catch (e) {
      // Not JSON, just display the text
      console.log('📝 Response:', message.substring(6));
    }
  } else {
    console.log('📝 Response:', message);
  }
});

WS.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

WS.on('close', (code, reason) => {
  console.log(`🔌 Connection closed: ${code} ${reason.toString()}`);
  process.exit(0);
});

// Close after 10 seconds
setTimeout(() => {
  console.log('⏱️  Closing connection...');
  WS.close();
}, 10000);

