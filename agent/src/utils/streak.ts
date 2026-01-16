import { DMState, StreakData } from '../types';

/**
 * Calculate and update streak based on completion date
 */
export function calculateStreak(currentState: DMState, completionDate: Date): StreakData {
    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];

    // Reset grace days if it's a new week (Monday)
    let graceDaysUsed = currentState.graceDaysUsedThisWeek || 0;
    let lastGraceReset = currentState.lastGraceWeekReset;

    if (lastGraceReset) {
        const lastResetDate = new Date(lastGraceReset);
        const daysSinceReset = Math.floor((today.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24));
        // Reset grace days on Monday (day 0) or if more than 7 days have passed
        if (daysSinceReset >= 7 || (today.getDay() === 1 && daysSinceReset > 0)) {
            graceDaysUsed = 0;
            lastGraceReset = todayDateStr;
        }
    } else {
        lastGraceReset = todayDateStr;
    }

    let currentStreak = currentState.currentStreak || 0;
    let longestStreak = currentState.longestStreak || 0;
    const lastCompletion = currentState.lastCompletionDate;

    if (!lastCompletion) {
        // First completion ever
        currentStreak = 1;
        longestStreak = 1;
    } else {
        const lastCompletionDate = new Date(lastCompletion);
        const completionDateStr = completionDate.toISOString().split('T')[0];
        const lastCompletionDateStr = lastCompletionDate.toISOString().split('T')[0];
        const daysDiff = Math.floor((completionDate.getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24));

        if (completionDateStr === lastCompletionDateStr) {
            // Same day completion - don't change streak
        } else if (daysDiff === 1) {
            // Consecutive day - increment streak
            currentStreak += 1;
        } else if (daysDiff === 2 && graceDaysUsed < 1) {
            // One day missed, use grace day
            currentStreak += 1;
            graceDaysUsed += 1;
        } else {
            // Streak broken
            currentStreak = 1;
        }

        // Update longest streak
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
        }
    }

    return {
        currentStreak,
        longestStreak,
        lastCompletionDate: completionDate.toISOString().split('T')[0],
        graceDaysUsedThisWeek: graceDaysUsed,
        lastGraceWeekReset: lastGraceReset,
    };
}

