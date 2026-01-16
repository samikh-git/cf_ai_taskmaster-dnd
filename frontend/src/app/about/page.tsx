'use client';

import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';

export default function AboutPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-black text-orange-200">
      {/* Header */}
      <header className="border-b border-orange-900/50 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-orange-600">QuestMaster</h1>
            </Link>
            <div className="flex items-center gap-4">
              {session ? (
                <Link
                  href="/"
                  className="text-sm text-orange-500 hover:text-orange-400 px-3 py-1 rounded hover:bg-gray-950 transition-colors"
                >
                  Back to App
                </Link>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="text-sm text-orange-500 hover:text-orange-400 px-3 py-1 rounded hover:bg-gray-950 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-orange-600">
              QuestMaster
            </h1>
            <p className="text-xl text-orange-400">
              Transform Your Daily Tasks Into Epic Quests
            </p>
            <p className="text-lg text-orange-300/80 max-w-2xl mx-auto">
              A D&D-themed task management application powered by AI that gamifies productivity 
              through immersive storytelling and fantasy-themed quests.
            </p>
          </div>

          {/* How It Works */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-orange-600 border-b border-orange-900/50 pb-2">
              How It Works
            </h2>
            
            <div className="space-y-6">
              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">
                  1. Sign In with GitHub or Google
                </h3>
                <p className="text-orange-200/90 leading-relaxed">
                  Authenticate using your GitHub or Google account. Your session is securely managed through 
                  NextAuth.js, ensuring only you can access your quests and progress.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">
                  2. Chat with the AI Dungeon Master
                </h3>
                <p className="text-orange-200/90 leading-relaxed">
                  Interact with an AI-powered Dungeon Master that speaks in epic, Tolkien-esque prose. 
                  Simply describe your tasks in natural language, and watch as they&apos;re transformed 
                  into fantastical quests complete with immersive descriptions, deadlines, and experience points.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">
                  3. Manage Your Quest Log
                </h3>
                <p className="text-orange-200/90 leading-relaxed">
                  View all your active quests, upcoming challenges, and expired missions in the Quest Log 
                  dashboard. Each quest displays its name, description, time windows, and XP rewards. 
                  Tasks are automatically organized by status and cleaned up when they expire.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">
                  4. Track Your Progress
                </h3>
                <p className="text-orange-200/90 leading-relaxed">
                  Experience points (XP) are dynamically assigned based on task complexity and difficulty. 
                  The AI Dungeon Master determines appropriate XP rewards, making more challenging quests 
                  more rewarding. Level up every 100 XP and maintain daily completion streaks to earn 
                  bonus rewards. View your progress, statistics, and quest history on your account page.
                </p>
              </div>
            </div>
          </section>

          {/* Technology Stack */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-orange-600 border-b border-orange-900/50 pb-2">
              Technology Stack
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Backend</h3>
                <ul className="space-y-2 text-orange-200/90">
                  <li>• <strong>Cloudflare Workers</strong> - Serverless edge computing</li>
                  <li>• <strong>Durable Objects</strong> - Persistent state management</li>
                  <li>• <strong>Cloudflare AI</strong> - LLM integration (Llama 3.1 8B)</li>
                  <li>• <strong>Durable Object Alarms</strong> - Automatic task cleanup</li>
                </ul>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Frontend</h3>
                <ul className="space-y-2 text-orange-200/90">
                  <li>• <strong>Next.js 15</strong> - React framework with App Router</li>
                  <li>• <strong>React 19</strong> - UI library</li>
                  <li>• <strong>NextAuth.js</strong> - Authentication</li>
                  <li>• <strong>Tailwind CSS</strong> - Styling</li>
                </ul>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">AI & Features</h3>
                <ul className="space-y-2 text-orange-200/90">
                  <li>• <strong>Streaming Responses</strong> - Real-time AI text streaming</li>
                  <li>• <strong>Tool Calling</strong> - AI can create and manage tasks</li>
                  <li>• <strong>Rate Limiting</strong> - Prevents API credit abuse</li>
                  <li>• <strong>Persistent Storage</strong> - Tasks persist across sessions</li>
                </ul>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Deployment</h3>
                <ul className="space-y-2 text-orange-200/90">
                  <li>• <strong>Cloudflare Workers</strong> - Backend deployment</li>
                  <li>• <strong>Cloudflare Pages</strong> - Frontend hosting</li>
                  <li>• <strong>Edge Network</strong> - Global low-latency access</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-orange-600 border-b border-orange-900/50 pb-2">
              Architecture
            </h2>
            
            <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-4">
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Agent (Durable Object)</h3>
                <p className="text-orange-200/90 leading-relaxed">
                  The core of QuestMaster is a Cloudflare Durable Object that maintains persistent 
                  state for each user session. It handles HTTP requests, streams AI responses using 
                  Server-Sent Events (SSE), and automatically cleans up expired tasks using Durable 
                  Object Alarms. Each user gets their own isolated Durable Object instance.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">AI Integration</h3>
                <p className="text-orange-200/90 leading-relaxed">
                  The AI Dungeon Master uses Cloudflare&apos;s AI Workers to run Llama 3.1 8B Instruct 
                  model. It&apos;s equipped with tools that allow it to create tasks, view tasks, and 
                  check the current time. The AI receives detailed system prompts that guide it to 
                  respond in an epic, fantasy-themed style while being helpful and productive.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Frontend</h3>
                <p className="text-orange-200/90 leading-relaxed">
                  The Next.js frontend provides a real-time chat interface that streams AI responses 
                  as they&apos;re generated. A collapsible dashboard displays all quests organized by 
                  status (Active, Upcoming, Expired). The interface includes an account page for tracking 
                  XP, levels, and streaks, plus a history page for viewing completed quests and statistics. 
                  Authentication is handled via NextAuth.js with GitHub and Google OAuth, and requests are proxied 
                  through API routes to avoid CORS issues.
                </p>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-orange-600 border-b border-orange-900/50 pb-2">
              Key Features
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">AI-Powered Quest Creation</h4>
                <p className="text-sm text-orange-200/90">
                  Natural language processing transforms your tasks into epic quests with immersive descriptions.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Real-Time Streaming</h4>
                <p className="text-sm text-orange-200/90">
                  Watch AI responses stream in real-time, creating an engaging conversational experience.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">XP & Leveling System</h4>
                <p className="text-sm text-orange-200/90">
                  Earn experience points for completing quests. Level up every 100 XP and track your progress.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Streak System</h4>
                <p className="text-sm text-orange-200/90">
                  Maintain daily completion streaks with grace days (1 per week). Earn bonus XP for 7+ day streaks.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Quest History</h4>
                <p className="text-sm text-orange-200/90">
                  View all completed quests and detailed statistics including completion rates and average XP.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Browser Notifications</h4>
                <p className="text-sm text-orange-200/90">
                  Get reminders for upcoming task deadlines directly in your browser.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Automatic Cleanup</h4>
                <p className="text-sm text-orange-200/90">
                  Expired tasks are automatically cleaned up using Cloudflare Durable Object Alarms.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Persistent State</h4>
                <p className="text-sm text-orange-200/90">
                  All quests, XP, and streaks are stored in Durable Object state, persisting across sessions.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Timezone Support</h4>
                <p className="text-sm text-orange-200/90">
                  Accurate time handling based on your timezone for proper task scheduling and deadlines.
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-orange-500 mb-2">Rate Limiting</h4>
                <p className="text-sm text-orange-200/90">
                  Built-in rate limiting prevents API credit abuse while allowing normal usage patterns.
                </p>
              </div>
            </div>
          </section>

          {/* Account & Progress */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-orange-600 border-b border-orange-900/50 pb-2">
              Track Your Adventure
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Account Page</h3>
                <p className="text-orange-200/90 leading-relaxed">
                  View your current level, XP progress, and completion streaks. Track your longest streak 
                  and see how close you are to the next level. Earn bonus XP (10% extra) when you maintain 
                  a 7+ day completion streak!
                </p>
              </div>

              <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-semibold text-orange-500">Quest History</h3>
                <p className="text-orange-200/90 leading-relaxed">
                  Review all your completed quests and view detailed statistics including total completions, 
                  completion rate, average XP per quest, and recent activity. See how your productivity 
                  journey has evolved over time.
                </p>
              </div>
            </div>
          </section>

          {/* Example Interaction */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-orange-600 border-b border-orange-900/50 pb-2">
              Example Interaction
            </h2>
            
            <div className="bg-gray-950/50 border border-orange-900/30 rounded-lg p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-orange-500 font-semibold min-w-[80px]">You:</span>
                  <p className="text-orange-200/90">I need to finish my report by Friday</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-orange-500 font-semibold min-w-[80px]">DM:</span>
                  <p className="text-orange-200/90 italic">
                    &quot;A new day dawns in the realm of productivity. The sun rises over the horizon, casting 
                    a warm glow upon the landscape of tasks that lie before you. What quest shall you undertake 
                    today? Shall you vanquish the beast of procrastination or conquer the mountain of paperwork? 
                    Perhaps you shall embark on a perilous journey to the depths of the Archive of Reports, where 
                    shadows of unfinished work lurk, and emerge victorious with a completed tome. This quest shall 
                    grant you 50 experience points upon completion...&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center space-y-4 pt-8">
            {!session ? (
              <>
                <h2 className="text-2xl font-bold text-orange-600">
                  Ready to Begin Your Quest?
                </h2>
                <p className="text-orange-300/80">
                  Sign in with GitHub or Google to start transforming your tasks into epic adventures.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => signIn('github')}
                    className="bg-orange-900 hover:bg-orange-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-orange-800 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Sign in with GitHub
                  </button>
                  <button
                    onClick={() => signIn('google')}
                    className="bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-300 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-orange-600">
                  Continue Your Adventure
                </h2>
                <Link
                  href="/"
                  className="inline-block bg-orange-900 hover:bg-orange-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-orange-800"
                >
                  Return to Quest Log
                </Link>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-900/50 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-orange-400/70">
          <p className="mb-2">QuestMaster - Transform your productivity into an epic adventure</p>
          <p>
            Created by{' '}
            <a
              href="https://github.com/samikh-git"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:text-orange-400 underline transition-colors"
            >
              samikh-git
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

