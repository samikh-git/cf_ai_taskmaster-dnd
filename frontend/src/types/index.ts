export interface Task {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  XP: number;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  tasks?: Task[];
}

export interface CompletedQuest {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  completionDate: string;
  XP: number;
}

export interface Statistics {
  totalCompleted: number;
  totalActive: number;
  totalQuests: number;
  completionRate: number;
  totalXP: number;
  totalXPFromCompleted: number;
  avgXPPerQuest: number;
  avgCompletionTimeMs: number;
  recentCompletions: number;
}

