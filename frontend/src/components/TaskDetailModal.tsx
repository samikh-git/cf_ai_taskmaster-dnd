'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types';
import { formatTimeRemaining, formatTimeElapsed } from '@/utils/time';
import { TIMER_CRITICAL_PERCENTAGE } from '@/constants';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  formatDate: (date: string) => string;
}

function TaskDetailModal({ task, onClose, formatDate }: TaskDetailModalProps) {
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isTimeCritical, setIsTimeCritical] = useState<boolean>(false);

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
            <button
              onClick={onClose}
              className="text-orange-500 hover:text-orange-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

