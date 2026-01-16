'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AccountPageSkeleton } from '@/components/Skeletons';

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [totalXP, setTotalXP] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [lastCompletionDate, setLastCompletionDate] = useState<string | null>(null);
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
        const data = await response.json() as { 
          totalXP?: number; 
          currentStreak?: number; 
          longestStreak?: number; 
          lastCompletionDate?: string | null;
        };
        if (data.totalXP !== undefined) {
          setTotalXP(data.totalXP);
        }
        if (data.currentStreak !== undefined) {
          setCurrentStreak(data.currentStreak);
        }
        if (data.longestStreak !== undefined) {
          setLongestStreak(data.longestStreak);
        }
        if (data.lastCompletionDate !== undefined) {
          setLastCompletionDate(data.lastCompletionDate);
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
    return <AccountPageSkeleton />;
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
          <button
            onClick={() => signOut()}
            className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-950 transition-colors"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg shadow-xl p-8">
          {/* User Info */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={64}
                  height={64}
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

          {/* Streak Display */}
          <div className="mt-8 pt-6 border-t border-orange-900">
            <h3 className="text-lg font-semibold text-orange-500 mb-4">Daily Streak</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-900 border border-orange-900 rounded-lg p-4">
                <div className="text-sm text-orange-400 mb-1">Current Streak</div>
                <div className="text-3xl font-bold text-orange-200">{currentStreak}</div>
                <div className="text-xs text-orange-500 mt-1">days</div>
              </div>
              <div className="bg-gray-900 border border-orange-900 rounded-lg p-4">
                <div className="text-sm text-orange-400 mb-1">Longest Streak</div>
                <div className="text-3xl font-bold text-orange-200">{longestStreak}</div>
                <div className="text-xs text-orange-500 mt-1">days</div>
              </div>
            </div>
            
            {currentStreak >= 7 && (
              <div className="bg-orange-950 border-2 border-orange-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-orange-300 font-semibold">Streak Bonus Active!</span>
                </div>
                <p className="text-orange-200 text-sm">
                  You&apos;re earning <span className="font-bold text-orange-400">+10% XP bonus</span> on all quest completions!
                </p>
              </div>
            )}
            
            {lastCompletionDate && (
              <div className="text-xs text-orange-500 mb-4">
                Last completion: {new Date(lastCompletionDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            )}
            
            <div className="text-orange-300 text-sm space-y-2">
              <p>• Complete at least one quest per day to maintain your streak</p>
              <p>• 7+ day streak grants +10% XP bonus on all completions</p>
              <p>• One grace day per week if you miss a day</p>
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

          {/* History Link */}
          <div className="mt-8 pt-6 border-t border-orange-900">
            <Link
              href="/history"
              className="block w-full px-6 py-3 bg-orange-900 hover:bg-orange-800 text-orange-100 rounded-lg border-2 border-orange-800 transition-colors text-center font-semibold"
            >
              View Quest History & Statistics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

