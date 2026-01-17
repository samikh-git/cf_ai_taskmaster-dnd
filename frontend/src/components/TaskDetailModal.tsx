'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types';
import { formatTimeRemaining, formatTimeElapsed } from '@/utils/time';
import { TIMER_CRITICAL_PERCENTAGE } from '@/constants';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  formatDate: (date: string) => string;
  onDelete?: (task: Task) => Promise<void>;
  isDeleting?: boolean;
}

function TaskDetailModal({ task, onClose, formatDate, onDelete, isDeleting = false }: TaskDetailModalProps) {
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isTimeCritical, setIsTimeCritical] = useState<boolean>(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState<boolean>(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeletingLocal(true);
    try {
      await onDelete(task);
      // Close modal after successful deletion
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      // Error toast will be shown by the onError callback
    } finally {
      setIsDeletingLocal(false);
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      let currentStatus: string;
      if (end < now) {
        currentStatus = 'expired';
        const expired = now.getTime() - end.getTime();
        setTimeDisplay(`Expired ${formatTimeElapsed(expired)} ago`);
        setIsTimeCritical(false);
      } else if (start > now) {
        currentStatus = 'upcoming';
        const untilStart = start.getTime() - now.getTime();
        setTimeDisplay(`Starts in ${formatTimeRemaining(untilStart)}`);
        setIsTimeCritical(false);
      } else {
        currentStatus = 'active';
        const remaining = end.getTime() - now.getTime();
        setTimeDisplay(formatTimeRemaining(remaining));
        
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        const percentageElapsed = (elapsed / totalDuration) * 100;
        
        setIsTimeCritical(percentageElapsed >= TIMER_CRITICAL_PERCENTAGE);
      }
      setStatus(currentStatus);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [task.startTime, task.endTime]);

  const getTimerColor = () => {
    if (status === 'expired') return 'text-gray-500';
    if (status === 'upcoming') return 'text-orange-300';
    if (status === 'active') {
      return isTimeCritical ? 'text-red-500' : 'text-orange-400';
    }
    return 'text-orange-400';
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-950 border-2 border-orange-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-orange-600">{task.name}</h2>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting || isDeletingLocal}
                  className="p-2 text-red-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isDeleting || isDeletingLocal ? 'Abandoning quest...' : 'Abandon quest'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-orange-500 hover:text-orange-400 hover:bg-orange-950/30 rounded transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-orange-900 text-orange-200 border border-orange-800">
              {task.XP} XP
            </div>
            {timeDisplay && (
              <div className={`text-lg font-bold ${getTimerColor()}`}>
                {timeDisplay}
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-orange-500 mb-2">Quest Description</h3>
            <p className="text-orange-200 whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-orange-900">
            <div>
              <h4 className="text-xs font-semibold text-orange-500 mb-1 uppercase tracking-wide">Start Time</h4>
              <p className="text-sm text-orange-300">{formatDate(task.startTime)}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-orange-500 mb-1 uppercase tracking-wide">End Time</h4>
              <p className="text-sm text-orange-300">{formatDate(task.endTime)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailModal;
export { TaskDetailModal };

