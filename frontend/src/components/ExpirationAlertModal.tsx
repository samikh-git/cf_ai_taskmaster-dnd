'use client';

import { useState } from 'react';
import { Task } from '@/types';

interface ExpirationAlertModalProps {
  task: Task;
  onExtend: () => Promise<void>;
  onFinish: () => Promise<void>;
  onAbandon: () => Promise<void>;
  onClose: () => void;
}

export function ExpirationAlertModal({ task, onExtend, onFinish, onAbandon, onClose }: ExpirationAlertModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExtend = async () => {
    setIsProcessing(true);
    await onExtend();
    setIsProcessing(false);
  };

  const handleFinish = async () => {
    setIsProcessing(true);
    await onFinish();
    setIsProcessing(false);
  };

  const handleAbandon = async () => {
    setIsProcessing(true);
    await onAbandon();
    setIsProcessing(false);
  };

  const start = new Date(task.startTime);
  const end = new Date(task.endTime);
  const originalDuration = end.getTime() - start.getTime();
  const extension = originalDuration * 0.1;
  const extensionHours = Math.floor(extension / (1000 * 60 * 60));
  const extensionMinutes = Math.floor((extension % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-950 border-2 border-orange-900 rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-orange-600">Quest Expired!</h2>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="text-orange-500 hover:text-orange-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="mb-6">
            <p className="text-orange-200 mb-4">
              Your quest <span className="font-semibold text-orange-400">&quot;{task.name}&quot;</span> has expired.
            </p>
            <p className="text-orange-300 text-sm mb-4">
              Did you complete this quest?
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleExtend}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-orange-600 font-semibold"
            >
              {isProcessing ? 'Processing...' : `Extend by ${extensionHours}h ${extensionMinutes}m (10% bonus)`}
            </button>
            <button
              onClick={handleFinish}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-green-600 font-semibold"
            >
              {isProcessing ? 'Processing...' : `Finish Quest (${task.XP} XP earned!)`}
            </button>
            <button
              onClick={handleAbandon}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-gray-800 text-orange-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-700 font-semibold"
            >
              {isProcessing ? 'Processing...' : 'Abandon Quest'}
            </button>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-orange-400 hover:text-orange-300 text-sm transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

