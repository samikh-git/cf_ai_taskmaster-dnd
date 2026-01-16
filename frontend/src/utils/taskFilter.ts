import { Task } from '@/types';
import { getTaskStatus } from './time';

export type TaskStatusFilter = 'all' | 'active' | 'upcoming' | 'expired';

export type DateFilter = 'all' | 'today' | 'this-week' | 'this-month' | 'future' | 'past';

export interface TaskFilterOptions {
  searchQuery: string;
  statusFilter: TaskStatusFilter;
  dateFilter: DateFilter;
}

/**
 * Filter tasks based on search query, status, and date
 */
export function filterTasks(tasks: Task[], options: TaskFilterOptions): Task[] {
  let filtered = [...tasks];

  // Search by name or description
  if (options.searchQuery.trim()) {
    const query = options.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(task => 
      task.name.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query)
    );
  }

  // Filter by status
  if (options.statusFilter !== 'all') {
    filtered = filtered.filter(task => getTaskStatus(task) === options.statusFilter);
  }

  // Filter by date
  if (options.dateFilter !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    filtered = filtered.filter(task => {
      const taskStartDate = new Date(task.startTime);
      const taskEndDate = new Date(task.endTime);

      switch (options.dateFilter) {
        case 'today':
          // Tasks that start today or are active today
          return (taskStartDate >= today && taskStartDate <= endOfToday) ||
                 (taskStartDate <= today && taskEndDate >= today);
        
        case 'this-week':
          // Tasks that start this week, are active this week, or end this week
          return (taskStartDate >= startOfWeek && taskStartDate <= endOfWeek) ||
                 (taskStartDate <= startOfWeek && taskEndDate >= startOfWeek);
        
        case 'this-month':
          // Tasks that start this month, are active this month, or end this month
          return (taskStartDate >= startOfMonth && taskStartDate <= endOfMonth) ||
                 (taskStartDate <= startOfMonth && taskEndDate >= startOfMonth);
        
        case 'future':
          // Tasks that start in the future
          return taskStartDate > now;
        
        case 'past':
          // Tasks that have completely ended
          return taskEndDate < now;
        
        default:
          return true;
      }
    });
  }

  return filtered;
}

/**
 * Get default filter options
 */
export function getDefaultFilterOptions(): TaskFilterOptions {
  return {
    searchQuery: '',
    statusFilter: 'all',
    dateFilter: 'all',
  };
}

