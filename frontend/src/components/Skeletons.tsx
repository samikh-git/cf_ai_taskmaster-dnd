'use client';

/**
 * Skeleton loading components for better UX during data loading
 */

export function TaskCardSkeleton() {
  return (
    <div className="mb-3 p-3 rounded-lg border-2 border-orange-900/50 bg-gray-950/50 animate-pulse">
      <div className="flex items-start justify-between mb-1">
        <div className="h-4 bg-orange-900/50 rounded w-3/4" />
        <div className="h-4 bg-orange-800/50 rounded w-12" />
      </div>
      <div className="space-y-2 mb-2">
        <div className="h-3 bg-orange-900/30 rounded w-full" />
        <div className="h-3 bg-orange-900/30 rounded w-5/6" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 space-y-1">
          <div className="h-3 bg-orange-800/30 rounded w-32" />
          <div className="h-3 bg-orange-800/30 rounded w-32" />
        </div>
        <div className="h-4 bg-orange-700/30 rounded w-20" />
      </div>
    </div>
  );
}

export function TaskListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </>
  );
}

export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-orange-900/50 border border-orange-800/50'
            : 'bg-gray-950/50 border border-orange-900/50'
        } animate-pulse`}
      >
        <div className="space-y-2">
          <div className="h-4 bg-orange-900/30 rounded w-full" />
          <div className="h-4 bg-orange-900/30 rounded w-5/6" />
          <div className="h-4 bg-orange-900/30 rounded w-4/6" />
        </div>
        <div className="h-3 bg-orange-800/20 rounded w-20 mt-2" />
      </div>
    </div>
  );
}

export function TaskDashboardSkeleton() {
  return (
    <div className="w-80 bg-gray-950 border-r border-orange-900 flex flex-col h-full">
      <div className="bg-black border-b border-orange-900 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-orange-900/50 rounded w-24 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-orange-900/30 rounded animate-pulse" />
            <div className="h-8 w-8 bg-orange-900/30 rounded animate-pulse" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="h-4 bg-orange-800/30 rounded w-32 mb-2 animate-pulse" />
          <TaskListSkeleton count={2} />
        </div>
        <div>
          <div className="h-4 bg-orange-800/30 rounded w-28 mb-2 animate-pulse" />
          <TaskListSkeleton count={2} />
        </div>
      </div>

      <div className="bg-black border-t border-orange-900 px-4 py-3 flex justify-end items-center min-h-[76px] shrink-0">
        <div className="h-10 w-10 bg-orange-900/50 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

export function ChatInputSkeleton() {
  return (
    <div className="border-t border-orange-900 px-4 py-3 bg-black shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-10 bg-gray-900/50 rounded-lg border border-orange-900/50 animate-pulse" />
        <div className="h-10 w-10 bg-orange-900/50 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ContentSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-orange-900/30 rounded animate-pulse ${
            i === lines - 1 ? 'w-5/6' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex h-screen bg-black items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        <div className="text-orange-400">Loading...</div>
      </div>
    </div>
  );
}

export function MainPageSkeleton() {
  return (
    <div className="flex h-screen bg-black">
      <TaskDashboardSkeleton />
      <div className="flex-1 flex flex-col bg-gray-950 h-full">
        <header className="bg-black border-b border-orange-900 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-orange-900/50 rounded w-32 animate-pulse" />
            <div className="flex gap-4">
              <div className="h-6 bg-orange-900/30 rounded w-16 animate-pulse" />
              <div className="h-6 bg-orange-900/30 rounded w-20 animate-pulse" />
              <div className="h-8 w-8 bg-orange-900/30 rounded-full animate-pulse" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <MessageSkeleton />
          <MessageSkeleton isUser />
        </div>
        <ChatInputSkeleton />
      </div>
    </div>
  );
}

export function AccountPageSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      <header className="bg-black border-b border-orange-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-orange-900/30 rounded animate-pulse" />
            <div className="h-6 bg-orange-900/50 rounded w-24 animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-orange-900/30 rounded animate-pulse" />
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg shadow-xl p-8">
          {/* User Info Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-orange-900/30 rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-6 bg-orange-900/50 rounded w-32 animate-pulse" />
                <div className="h-4 bg-orange-900/30 rounded w-48 animate-pulse" />
              </div>
            </div>
          </div>
          {/* Level Display Skeleton */}
          <div className="mb-8">
            <div className="text-center mb-6">
              <div className="inline-block px-6 py-3 bg-orange-900/30 rounded-lg border-2 border-orange-900/50 animate-pulse">
                <div className="h-4 bg-orange-800/30 rounded w-12 mb-2 mx-auto" />
                <div className="h-12 bg-orange-800/30 rounded w-16 mx-auto" />
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="h-4 bg-orange-900/30 rounded w-32 animate-pulse" />
                <div className="h-4 bg-orange-900/30 rounded w-16 animate-pulse" />
              </div>
              <div className="w-full bg-gray-800 rounded-full h-6 border border-orange-900/50 animate-pulse" />
              <div className="h-4 bg-orange-900/30 rounded w-40 mx-auto mt-2 animate-pulse" />
            </div>
          </div>
          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-orange-900">
            {[1, 2].map((i) => (
              <div key={i} className="bg-gray-900 border border-orange-900 rounded-lg p-4">
                <div className="h-4 bg-orange-900/30 rounded w-24 mb-2 animate-pulse" />
                <div className="h-8 bg-orange-900/50 rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
          {/* Streak Skeleton */}
          <div className="mt-8 pt-6 border-t border-orange-900">
            <div className="h-6 bg-orange-900/50 rounded w-32 mb-4 animate-pulse" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-gray-900 border border-orange-900 rounded-lg p-4">
                  <div className="h-4 bg-orange-900/30 rounded w-28 mb-2 animate-pulse" />
                  <div className="h-10 bg-orange-900/50 rounded w-12 animate-pulse" />
                  <div className="h-3 bg-orange-900/30 rounded w-12 mt-1 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryPageSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      <header className="bg-black border-b border-orange-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-orange-900/30 rounded animate-pulse" />
            <div className="h-6 bg-orange-900/50 rounded w-32 animate-pulse" />
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Statistics Skeleton */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-950 border-2 border-orange-900 rounded-lg p-4">
              <div className="h-4 bg-orange-900/30 rounded w-24 mb-2 animate-pulse" />
              <div className="h-10 bg-orange-900/50 rounded w-16 animate-pulse" />
              <div className="h-3 bg-orange-900/30 rounded w-32 mt-2 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Completed Quests Skeleton */}
        <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-6">
          <div className="h-8 bg-orange-900/50 rounded w-48 mb-6 animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 border border-orange-900 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-orange-900/50 rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-orange-900/30 rounded w-full animate-pulse" />
                    <div className="h-4 bg-orange-900/30 rounded w-5/6 animate-pulse" />
                  </div>
                  <div className="h-6 bg-orange-900/50 rounded w-16 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-orange-900">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-4 bg-orange-900/30 rounded w-full animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

