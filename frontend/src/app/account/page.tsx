'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  XP: number;
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [totalXP, setTotalXP] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (session) {
      fetchXP();
    }
  }, [session, status, router]);

  const fetchXP = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json() as { totalXP?: number };
        if (data.totalXP !== undefined) {
          setTotalXP(data.totalXP);
        }
      }
    } catch (error) {
      console.error('Error fetching XP:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate level (level up every 100 XP, starting at level 1)
  const level = Math.floor(totalXP / 100) + 1;
  const xpInCurrentLevel = totalXP % 100;
  const xpNeededForNextLevel = 100 - xpInCurrentLevel;
  const progressPercentage = (xpInCurrentLevel / 100) * 100;

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex h-screen bg-black items-center justify-center p-4">
        <div className="text-orange-400">Loading...</div>
      </div>
    );
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
            <h1 className="text-xl font-bold text-orange-600">Account</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg shadow-xl p-8">
          {/* User Info */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-16 h-16 rounded-full border-2 border-orange-900"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-orange-600">
                  {session.user?.name || 'Adventurer'}
                </h2>
                {session.user?.email && (
                  <p className="text-orange-400 text-sm">{session.user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Level Display */}
          <div className="mb-8">
            <div className="text-center mb-6">
              <div className="inline-block px-6 py-3 bg-orange-900 rounded-lg border-2 border-orange-800">
                <div className="text-sm text-orange-300 mb-1">Level</div>
                <div className="text-5xl font-bold text-orange-100">{level}</div>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-orange-400 font-semibold">Experience Points</span>
                <span className="text-orange-300 text-sm">
                  {totalXP} XP
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-6 border border-orange-900 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-700 to-orange-600 h-6 rounded-full transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${progressPercentage}%` }}
                >
                  {xpInCurrentLevel > 0 && (
                    <span className="text-xs font-bold text-orange-100">
                      {xpInCurrentLevel}/100
                    </span>
                  )}
                </div>
              </div>
              <div className="text-center mt-2 text-sm text-orange-400">
                {xpNeededForNextLevel > 0 ? (
                  <span>{xpNeededForNextLevel} XP until Level {level + 1}</span>
                ) : (
                  <span className="text-orange-300 font-semibold">Ready to level up!</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-orange-900">
            <div className="bg-gray-900 border border-orange-900 rounded-lg p-4">
              <div className="text-sm text-orange-400 mb-1">Total XP</div>
              <div className="text-2xl font-bold text-orange-200">{totalXP}</div>
            </div>
            <div className="bg-gray-900 border border-orange-900 rounded-lg p-4">
              <div className="text-sm text-orange-400 mb-1">Current Level</div>
              <div className="text-2xl font-bold text-orange-200">{level}</div>
            </div>
          </div>

          {/* Level Info */}
          <div className="mt-8 pt-6 border-t border-orange-900">
            <h3 className="text-lg font-semibold text-orange-500 mb-3">Leveling System</h3>
            <div className="text-orange-300 text-sm space-y-2">
              <p>• Gain 100 XP to level up</p>
              <p>• Complete quests to earn XP</p>
              <p>• More challenging quests grant more XP</p>
              <p>• Your level reflects your dedication to the quest</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

