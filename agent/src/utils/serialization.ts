import { Task, CompletedQuest } from '../types';

/**
 * Serialize a Date object to ISO string, handling various input formats
 */
export function serializeDate(date: Date | string): string {
    if (date instanceof Date) {
        return date.toISOString();
    }
    if (typeof date === 'string') {
        return date;
    }
    return new Date(date).toISOString();
}

/**
 * Serialize a Task for JSON response
 */
export function serializeTask(task: Task) {
    return {
        id: task.id,
        name: task.name,
        description: task.description,
        startTime: serializeDate(task.startTime),
        endTime: serializeDate(task.endTime),
        XP: task.XP,
    };
}

/**
 * Serialize a CompletedQuest for JSON response
 */
export function serializeCompletedQuest(quest: CompletedQuest) {
    return {
        id: quest.id,
        name: quest.name,
        description: quest.description,
        startTime: serializeDate(quest.startTime),
        endTime: serializeDate(quest.endTime),
        completionDate: serializeDate(quest.completionDate),
        XP: quest.XP,
    };
}

