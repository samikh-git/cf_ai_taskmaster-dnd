'use client';

import { useState, useEffect } from 'react';

interface CreateTaskModalProps {
  onClose: () => void;
  onCreate: (taskData: {
    taskName: string;
    taskDescription: string;
    taskStartTime: string;
    taskEndTime: string;
    XP: number;
  }) => Promise<boolean>;
  isCreating: boolean;
}

function CreateTaskModal({ onClose, onCreate, isCreating }: CreateTaskModalProps) {
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskEndTime, setTaskEndTime] = useState('');
  const [XP, setXP] = useState(50);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000);
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    setTaskStartTime(startTime.toISOString().slice(0, 16));
    setTaskEndTime(endTime.toISOString().slice(0, 16));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!taskName || !taskDescription || !taskStartTime || !taskEndTime) {
      setError('Please fill in all fields');
      return;
    }

    const startDate = new Date(taskStartTime);
    const endDate = new Date(taskEndTime);

    if (endDate <= startDate) {
      setError('End time must be after start time');
      return;
    }

    if (startDate <= new Date()) {
      setError('Start time must be in the future');
      return;
    }

    const success = await onCreate({
      taskName,
      taskDescription,
      taskStartTime: startDate.toISOString(),
      taskEndTime: endDate.toISOString(),
      XP,
    });

    if (!success) {
      setError('Failed to create task. Please try again.');
    }
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
            <h2 className="text-2xl font-bold text-orange-600">Create New Quest</h2>
            <button
              onClick={onClose}
              className="text-orange-500 hover:text-orange-400"
              disabled={isCreating}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-orange-500 mb-1">
                Quest Name *
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                placeholder="Enter quest name"
                required
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-orange-500 mb-1">
                Quest Description *
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700 min-h-[100px]"
                placeholder="Describe your quest..."
                required
                disabled={isCreating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-orange-500 mb-1">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={taskStartTime}
                  onChange={(e) => setTaskStartTime(e.target.value)}
                  className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                  required
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-orange-500 mb-1">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  value={taskEndTime}
                  onChange={(e) => setTaskEndTime(e.target.value)}
                  className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                  required
                  disabled={isCreating}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-orange-500 mb-1">
                XP Reward
              </label>
              <input
                type="number"
                value={XP}
                onChange={(e) => setXP(Number(e.target.value))}
                className="w-full bg-gray-900 border border-orange-900 rounded px-3 py-2 text-orange-100 focus:outline-none focus:border-orange-700"
                min="1"
                required
                disabled={isCreating}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isCreating}
                className="flex-1 bg-orange-900 hover:bg-orange-800 text-orange-100 font-semibold py-2 px-4 rounded border border-orange-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Quest'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="px-4 py-2 text-orange-500 hover:text-orange-400 border border-orange-900 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateTaskModal;
export { CreateTaskModal };

