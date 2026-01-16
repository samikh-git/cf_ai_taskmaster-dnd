import { AgentNamespace } from "agents";

export interface Env {
    AI: Ai;
    QuestMasterAgent: AgentNamespace<any>;
    CHAT_RATE_LIMITER?: RateLimit;
    TASK_RATE_LIMITER?: RateLimit;
}

export interface DMState {
    tasks: Task[];
    completedQuests: CompletedQuest[];
    timezone?: string;
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate: string | null;
    graceDaysUsedThisWeek: number;
    lastGraceWeekReset: string | null;
}

export interface Task {
    id: string;
    name: string;
    description: string;
    startTime: Date;
    endTime: Date;
    XP: number;
}

export interface CompletedQuest {
    id: string;
    name: string;
    description: string;
    startTime: Date;
    endTime: Date;
    completionDate: Date;
    XP: number;
}

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate: string;
    graceDaysUsedThisWeek: number;
    lastGraceWeekReset: string;
}

