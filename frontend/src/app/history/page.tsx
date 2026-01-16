'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HistoryPageSkeleton } from '@/components/Skeletons';

interface CompletedQuest {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  completionDate: string;
  XP: number;
}

interface Statistics {
  totalCompleted: number;
  totalActive: number;
  totalQuests: number;
  completionRate: number;
  totalXP: number;
  totalXPFromCompleted: number;
  avgXPPerQuest: number;
  avgCompletionTimeMs: number;
  recentCompletions: number;
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [completedQuests, setCompletedQuests] = useState<CompletedQuest[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (session) {
      fetchHistory();
    }
  }, [session, status, router]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks?history=true');
      if (response.ok) {
        const data = await response.json() as { completedQuests?: CompletedQuest[]; statistics?: Statistics };
        if (data.completedQuests) {
          setCompletedQuests(data.completedQuests);
        }
        if (data.statistics) {
          setStatistics(data.statistics);
        }
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  if (status === 'loading' || isLoading) {
    return <HistoryPageSkeleton />;
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-orange-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-950 transition-colors"
              title="Back to Quest Log"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-orange-600">Quest History</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Statistics Dashboard */}
        {statistics && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-4">
              <div className="text-sm text-orange-400 mb-1">Total Completed</div>
              <div className="text-3xl font-bold text-orange-200">{statistics.totalCompleted}</div>
              <div className="text-xs text-orange-500 mt-1">
                {statistics.totalActive} active
              </div>
            </div>

            <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-4">
              <div className="text-sm text-orange-400 mb-1">Completion Rate</div>
              <div className="text-3xl font-bold text-orange-200">
                {statistics.completionRate.toFixed(1)}%
              </div>
              <div className="text-xs text-orange-500 mt-1">
                {statistics.totalQuests} total quests
              </div>
            </div>

            <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-4">
              <div className="text-sm text-orange-400 mb-1">Total XP Earned</div>
              <div className="text-3xl font-bold text-orange-200">{statistics.totalXPFromCompleted}</div>
              <div className="text-xs text-orange-500 mt-1">
                Avg: {statistics.avgXPPerQuest.toFixed(0)} XP/quest
              </div>
            </div>

            <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-4">
              <div className="text-sm text-orange-400 mb-1">Recent Activity</div>
              <div className="text-3xl font-bold text-orange-200">{statistics.recentCompletions}</div>
              <div className="text-xs text-orange-500 mt-1">
                Completed in last 7 days
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats */}
        {statistics && statistics.avgCompletionTimeMs > 0 && (
          <div className="mb-8 bg-gray-950 border-2 border-orange-900 rounded-lg p-4">
            <div className="text-sm text-orange-400 mb-2">Average Completion Time</div>
            <div className="text-2xl font-bold text-orange-200">
              {formatDuration(statistics.avgCompletionTimeMs)}
            </div>
            <div className="text-xs text-orange-500 mt-1">
              Average time from start to completion
            </div>
          </div>
        )}

        {/* Completed Quests List */}
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-orange-600 mb-6">
            Completed Quests ({completedQuests.length})
          </h2>

          {completedQuests.length === 0 ? (
            <div className="text-center text-orange-500 py-12">
              <p className="text-lg mb-2">No completed quests yet.</p>
              <p className="text-sm">Finish your first quest to see it here!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedQuests
                .sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime())
                .map((quest) => (
                  <div
                    key={quest.id}
                    className="bg-gray-900 border border-orange-900 rounded-lg p-4 hover:border-orange-800 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-orange-400 mb-1">
                          {quest.name}
                        </h3>
                        <p className="text-sm text-orange-300 mb-3 line-clamp-2">
                          {quest.description}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-orange-900 text-orange-200 border border-orange-800">
                          {quest.XP} XP
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-orange-500 pt-3 border-t border-orange-900">
                      <div>
                        <span className="font-medium text-orange-400">Started:</span>{' '}
                        {formatDate(quest.startTime)}
                      </div>
                      <div>
                        <span className="font-medium text-orange-400">Completed:</span>{' '}
                        {formatDate(quest.completionDate)}
                      </div>
                      <div>
                        <span className="font-medium text-orange-400">Deadline:</span>{' '}
                        {formatDate(quest.endTime)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

