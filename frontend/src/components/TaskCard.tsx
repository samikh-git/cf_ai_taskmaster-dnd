'use client';

import { useState, useEffect, memo } from 'react';
import { Task } from '@/types';
import { formatTimeRemaining, formatTimeElapsed } from '@/utils/time';
import { TIMER_CRITICAL_PERCENTAGE } from '@/constants';

interface TaskCardProps {
  task: Task;
  status: string;
  formatDate: (date: string) => string;
  onClick: () => void;
}

export const TaskCard = memo(function TaskCard({ task, status, formatDate, onClick }: TaskCardProps) {
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [isTimeCritical, setIsTimeCritical] = useState<boolean>(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      if (status === 'active') {
        const remaining = end.getTime() - now.getTime();
        if (remaining <= 0) {
          setTimeDisplay('Expired');
          setIsTimeCritical(false);
        } else {
          setTimeDisplay(formatTimeRemaining(remaining));
          
          const totalDuration = end.getTime() - start.getTime();
          const elapsed = now.getTime() - start.getTime();
          const percentageElapsed = (elapsed / totalDuration) * 100;
          
          setIsTimeCritical(percentageElapsed >= TIMER_CRITICAL_PERCENTAGE);
        }
      } else if (status === 'upcoming') {
        const untilStart = start.getTime() - now.getTime();
        if (untilStart <= 0) {
          setTimeDisplay('Starting now');
        } else {
          setTimeDisplay(`Starts in ${formatTimeRemaining(untilStart)}`);
        }
        setIsTimeCritical(false);
      } else if (status === 'expired') {
        const expired = now.getTime() - end.getTime();
        setTimeDisplay(`Expired ${formatTimeElapsed(expired)} ago`);
        setIsTimeCritical(false);
      }
    };

    updateTimer();
    // Update timer every 5 seconds instead of every 1 second for better performance
    // Still responsive enough for user experience, but reduces CPU usage significantly
    const interval = setInterval(updateTimer, 5000);

    return () => clearInterval(interval);
  }, [task.startTime, task.endTime, status]);

  const statusColors = {
    active: 'border-orange-700 bg-orange-950/30',
    upcoming: 'border-orange-800 bg-orange-950/20',
    expired: 'border-gray-800 bg-gray-950/50 opacity-60',
  };

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
      className={`mb-3 p-3 rounded-lg border-2 ${statusColors[status as keyof typeof statusColors]} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-sm text-orange-400">{task.name}</h4>
        <span className="text-xs font-bold text-orange-500 ml-2">
          {task.XP} XP
        </span>
      </div>
      <p className="text-xs text-orange-300 mb-2 line-clamp-2">
        {task.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 text-xs text-orange-500">
          <div className="flex items-center gap-1">
            <span className="font-medium">Start:</span>
            <span>{formatDate(task.startTime)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">End:</span>
            <span>{formatDate(task.endTime)}</span>
          </div>
        </div>
        {timeDisplay && (
          <div className={`text-xs font-semibold ${getTimerColor()}`}>
            {timeDisplay}
          </div>
        )}
      </div>
    </div>
  );
});

