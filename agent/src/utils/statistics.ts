import { CompletedQuest } from '../types';
import { serializeCompletedQuest } from './serialization';

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

/**
 * Calculate statistics from completed quests
 */
export function calculateStatistics(
    completedQuests: CompletedQuest[],
    totalXP: number,
    totalActive: number
): Statistics {
    const totalCompleted = completedQuests.length;
    const totalQuests = totalCompleted + totalActive;
    const completionRate = totalQuests > 0 ? (totalCompleted / totalQuests) * 100 : 0;

    // Calculate average completion time
    let totalCompletionTime = 0;
    let validCompletions = 0;
    completedQuests.forEach(quest => {
        const start = new Date(quest.startTime).getTime();
        const completion = new Date(quest.completionDate).getTime();
        if (completion >= start) {
            totalCompletionTime += (completion - start);
            validCompletions++;
        }
    });
    const avgCompletionTime = validCompletions > 0 ? totalCompletionTime / validCompletions : 0;

    // Calculate XP statistics
    const totalXPFromCompleted = completedQuests.reduce((sum, quest) => sum + quest.XP, 0);
    const avgXPPerQuest = totalCompleted > 0 ? totalXPFromCompleted / totalCompleted : 0;

    // Calculate recent completions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCompletions = completedQuests.filter(quest => {
        const completion = new Date(quest.completionDate);
        return completion >= sevenDaysAgo;
    }).length;

    return {
        totalCompleted,
        totalActive,
        totalQuests,
        completionRate: Math.round(completionRate * 100) / 100,
        totalXP,
        totalXPFromCompleted,
        avgXPPerQuest: Math.round(avgXPPerQuest * 100) / 100,
        avgCompletionTimeMs: avgCompletionTime,
        recentCompletions,
    };
}

