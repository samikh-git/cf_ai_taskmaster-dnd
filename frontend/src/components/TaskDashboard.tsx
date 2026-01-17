'use client';

import { useState, lazy, Suspense, useMemo } from 'react';
import { Task } from '@/types';
import { TaskCard } from './TaskCard';
import { formatDate, getTaskStatus } from '@/utils/time';
import { TaskListSkeleton } from './Skeletons';
import { filterTasks, getDefaultFilterOptions, type TaskFilterOptions, type TaskStatusFilter, type DateFilter } from '@/utils/taskFilter';

// Lazy load CreateTaskModal for better performance
const CreateTaskModal = lazy(() => import('@/components/CreateTaskModal'));

interface TaskDashboardProps {
  tasks: Task[];
  isLoadingTasks: boolean;
  onRefresh: () => void;
  onTaskClick: (task: Task) => void;
  onCreateTask: (taskData: {
    taskName: string;
    taskDescription: string;
    taskStartTime: string;
    taskEndTime: string;
    XP: number;
  }) => Promise<boolean>;
  isCreatingTask: boolean;
  showDashboard: boolean;
  onClose: () => void;
  showSkeletonOnLoad?: boolean;
}

export function TaskDashboard({
  tasks,
  isLoadingTasks,
  onRefresh,
  onTaskClick,
  onCreateTask,
  isCreatingTask,
  showDashboard,
  onClose,
  showSkeletonOnLoad = true,
}: TaskDashboardProps) {
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState<TaskFilterOptions>(getDefaultFilterOptions());
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Filter tasks based on search and filters
  // This must be called before any early returns to maintain hook order
  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, filterOptions);
  }, [tasks, filterOptions]);

  if (!showDashboard) return null;

  const activeTasks = filteredTasks.filter(t => getTaskStatus(t) === 'active');
  const upcomingTasks = filteredTasks.filter(t => getTaskStatus(t) === 'upcoming');
  const expiredTasks = filteredTasks.filter(t => getTaskStatus(t) === 'expired');

  const hasActiveFilter = filterOptions.searchQuery.trim() !== '' || 
                          filterOptions.statusFilter !== 'all' || 
                          filterOptions.dateFilter !== 'all';

  const clearFilters = () => {
    setFilterOptions(getDefaultFilterOptions());
  };

  return (
    <>
      <div className="w-80 bg-gray-950 border-r border-orange-900 flex flex-col h-full">
        <header className="bg-black border-b border-orange-900 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-orange-600">Quest Log</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-900 transition-colors ${showFilters ? 'bg-gray-900' : ''}`}
                title="Toggle filters"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
              <button
                onClick={onRefresh}
                disabled={isLoadingTasks}
                className="text-orange-500 hover:text-orange-400 disabled:opacity-50 p-2 rounded hover:bg-gray-900 transition-colors"
                title={isLoadingTasks ? 'Refreshing...' : 'Refresh tasks'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="text-orange-500 hover:text-orange-400 p-2 rounded hover:bg-gray-900 transition-colors"
                title="Close Quest Log"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="space-y-2 pt-3 mt-3 border-t border-orange-900">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-orange-500 uppercase">Filters</label>
                {hasActiveFilter && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Status Filter */}
                <div>
                  <label className="block text-xs text-orange-400 mb-1">Status</label>
                  <select
                    value={filterOptions.statusFilter}
                    onChange={(e) => setFilterOptions({ ...filterOptions, statusFilter: e.target.value as TaskStatusFilter })}
                    className="w-full bg-gray-900 border border-orange-900 rounded px-2 py-1 text-xs text-orange-100 focus:outline-none focus:border-orange-700"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-xs text-orange-400 mb-1">Date</label>
                  <select
                    value={filterOptions.dateFilter}
                    onChange={(e) => setFilterOptions({ ...filterOptions, dateFilter: e.target.value as DateFilter })}
                    className="w-full bg-gray-900 border border-orange-900 rounded px-2 py-1 text-xs text-orange-100 focus:outline-none focus:border-orange-700"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="this-week">This Week</option>
                    <option value="this-month">This Month</option>
                    <option value="future">Future</option>
                    <option value="past">Past</option>
                  </select>
                </div>
              </div>

              {hasActiveFilter && (
                <div className="text-xs text-orange-500 mt-2">
                  Showing {filteredTasks.length} of {tasks.length} quests
                </div>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingTasks && showSkeletonOnLoad ? (
            <>
              <div>
                <div className="h-4 bg-orange-800/30 rounded w-32 mb-2 animate-pulse" />
                <TaskListSkeleton count={2} />
              </div>
              <div>
                <div className="h-4 bg-orange-800/30 rounded w-28 mb-2 animate-pulse" />
                <TaskListSkeleton count={2} />
              </div>
            </>
          ) : tasks.length === 0 ? (
            <div className="text-center text-orange-500 mt-8">
              <p className="text-sm">No quests yet.</p>
              <p className="text-xs mt-1">Ask the agent to create a task!</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center text-orange-500 mt-8">
              <p className="text-sm">No quests match your filters.</p>
              <button
                onClick={clearFilters}
                className="text-xs text-orange-400 hover:text-orange-300 mt-2 underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-orange-500 mb-2 uppercase tracking-wide">
                    Active Quests ({activeTasks.length})
                  </h3>
                  {activeTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      status="active"
                      formatDate={formatDate}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
              )}

              {upcomingTasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-orange-400 mb-2 uppercase tracking-wide">
                    Upcoming ({upcomingTasks.length})
                  </h3>
                  {upcomingTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      status="upcoming"
                      formatDate={formatDate}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
              )}

              {expiredTasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-orange-600 mb-2 uppercase tracking-wide">
                    Expired ({expiredTasks.length})
                  </h3>
                  {expiredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      status="expired"
                      formatDate={formatDate}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-black border-t border-orange-900 px-4 py-3 min-h-[76px] flex items-center shrink-0">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2 justify-end">
              {/* Search Bar - Expandable */}
              <div className={`relative flex items-center transition-all duration-300 ease-in-out ${
                isSearchExpanded ? 'flex-1' : 'w-10'
              }`}>
                {isSearchExpanded ? (
                  <>
                    <input
                      type="text"
                      placeholder="Search quests..."
                      value={filterOptions.searchQuery}
                      onChange={(e) => setFilterOptions({ ...filterOptions, searchQuery: e.target.value })}
                      onBlur={() => {
                        // Keep expanded if there's a search query
                        if (!filterOptions.searchQuery.trim()) {
                          setIsSearchExpanded(false);
                        }
                      }}
                      autoFocus
                      className="w-full bg-gray-900 border border-orange-900 rounded-full px-4 py-2 pr-8 text-sm text-orange-100 placeholder-orange-600 focus:outline-none focus:border-orange-700"
                    />
                    {filterOptions.searchQuery && (
                      <button
                        onClick={() => {
                          setFilterOptions({ ...filterOptions, searchQuery: '' });
                          setIsSearchExpanded(false);
                        }}
                        className="absolute right-2 text-orange-500 hover:text-orange-400 p-1"
                        title="Clear search"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setIsSearchExpanded(true)}
                    className="w-10 h-10 bg-gray-900 hover:bg-gray-800 border border-orange-900 rounded-full flex items-center justify-center text-orange-500 hover:text-orange-400 transition-colors"
                    title="Search quests"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Create Task Button */}
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="bg-orange-900 hover:bg-orange-800 text-orange-100 p-2 rounded-full border border-orange-800 transition-colors shadow-lg hover:shadow-xl hover:scale-105 w-10 h-10 flex items-center justify-center"
                title="Create New Quest"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            
            {/* Show search query indicator when collapsed but has query */}
            {!isSearchExpanded && filterOptions.searchQuery && (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="text-xs text-orange-500 hover:text-orange-400 underline text-right self-end"
              >
                {filterOptions.searchQuery.length > 20 
                  ? `Searching: "${filterOptions.searchQuery.substring(0, 20)}..."` 
                  : `Searching: "${filterOptions.searchQuery}"`}
              </button>
            )}
          </div>
        </div>
      </div>

      {showCreateTaskModal && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-950 border-2 border-orange-900 rounded-lg p-6">
              <div className="text-orange-500">Loading...</div>
            </div>
          </div>
        }>
          <CreateTaskModal
            onClose={() => setShowCreateTaskModal(false)}
            onCreate={async (taskData) => {
              const success = await onCreateTask(taskData);
              if (success) {
                setShowCreateTaskModal(false);
              }
              return success;
            }}
            isCreating={isCreatingTask}
          />
        </Suspense>
      )}
    </>
  );
}

