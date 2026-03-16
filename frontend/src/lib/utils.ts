import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/**
 * Convert a cron expression to a human-readable French string.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 */
export function humanizeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  const time = `${hour.padStart(2, '0')}h${minute.padStart(2, '0')}`;

  // Every minute
  if (minute === '*' && hour === '*') return 'Chaque minute';

  // Every hour at specific minute
  if (hour === '*' && minute !== '*') return `Toutes les heures à :${minute.padStart(2, '0')}`;

  // Daily at specific time
  if (dayOfMonth === '*' && dayOfWeek === '*') return `Tous les jours à ${time}`;

  // Specific day(s) of week
  if (dayOfMonth === '*' && dayOfWeek !== '*') {
    const dayNames = dayOfWeek.split(',').map((d) => {
      const n = parseInt(d, 10);
      return DAYS_FR[n] ?? d;
    });

    if (dayNames.length === 1) return `Chaque ${dayNames[0]} à ${time}`;
    return `Chaque ${dayNames.join(', ')} à ${time}`;
  }

  // Specific day of month
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    return `Le ${dayOfMonth} de chaque mois à ${time}`;
  }

  return cron;
}
