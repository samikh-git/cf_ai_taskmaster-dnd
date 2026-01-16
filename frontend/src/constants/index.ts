// XP and Leveling
export const XP_PER_LEVEL = 100;

// Time thresholds
export const REMINDER_TIME_MS = 5 * 60 * 1000; // 5 minutes
export const AUTO_DELETE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
export const TASK_REFRESH_INTERVAL_MS = 30000; // 30 seconds
export const NOTIFICATION_CHECK_INTERVAL_MS = 30000; // 30 seconds
export const EXPIRATION_CHECK_INTERVAL_MS = 1000; // 1 second

// Streak
export const STREAK_BONUS_THRESHOLD = 7; // days
export const STREAK_BONUS_PERCENTAGE = 0.1; // 10%

// Timer thresholds
export const TIMER_CRITICAL_PERCENTAGE = 95; // 95% elapsed = red

// Agent URL configuration
export const AGENT_URL_PROD = 'https://agent.sami-houssaini.workers.dev';
export const AGENT_URL_DEV = 'http://localhost:8787';

// Get agent base URL based on environment
export const getAgentBaseUrl = (): string => {
  return process.env.AGENT_URL || 
    (process.env.NODE_ENV === 'production' 
      ? AGENT_URL_PROD
      : AGENT_URL_DEV);
};

