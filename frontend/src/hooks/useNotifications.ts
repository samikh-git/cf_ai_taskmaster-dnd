import { useState, useEffect, useRef } from 'react';
import { Task } from '@/types';
import { REMINDER_TIME_MS, NOTIFICATION_CHECK_INTERVAL_MS } from '@/constants';
import type { Session } from 'next-auth';

export function useNotifications(session: Session | null, tasks: Task[], onError?: (message: string) => void) {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const sentNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!session || tasks.length === 0 || notificationPermission !== 'granted') return;

    const checkForNotifications = () => {
      const now = new Date();
      const reminderTime = REMINDER_TIME_MS;

      tasks.forEach((task) => {
        const start = new Date(task.startTime);
        const end = new Date(task.endTime);
        
        const timeUntilStart = start.getTime() - now.getTime();
        const startNotificationKey = `start-${task.id}`;
        if (timeUntilStart > 0 && timeUntilStart <= reminderTime && !sentNotificationsRef.current.has(startNotificationKey)) {
          new Notification(`Quest Starting Soon: ${task.name}`, {
            body: `Your quest "${task.name}" starts in ${Math.floor(timeUntilStart / 60000)} minutes!`,
            icon: '/favicon.svg',
            tag: startNotificationKey,
          });
          sentNotificationsRef.current.add(startNotificationKey);
        }

        const timeUntilEnd = end.getTime() - now.getTime();
        const endNotificationKey = `end-${task.id}`;
        if (timeUntilEnd > 0 && timeUntilEnd <= reminderTime && !sentNotificationsRef.current.has(endNotificationKey)) {
          new Notification(`Quest Expiring Soon: ${task.name}`, {
            body: `Your quest "${task.name}" expires in ${Math.floor(timeUntilEnd / 60000)} minutes!`,
            icon: '/favicon.svg',
            tag: endNotificationKey,
          });
          sentNotificationsRef.current.add(endNotificationKey);
        }
      });
    };

    checkForNotifications();
    const interval = setInterval(checkForNotifications, NOTIFICATION_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [tasks, session, notificationPermission]);

  const requestPermission = async () => {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } else if (Notification.permission === 'denied') {
      onError?.('Notifications are blocked. Please enable them in your browser settings.');
    }
  };

  return {
    notificationPermission,
    requestPermission,
  };
}

