import { config } from '../config/index.js';

export type ICSInput = {
  uid: string;
  title: string;
  description: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM or HH:MM:SS (normalized internally)
  durationMinutes: number;
  location?: string;
};

export function generateICS(input: ICSInput): Buffer {
  const tz = config.googleCalendarTimeZone;
  const startHHMM = input.startTime.slice(0, 5);
  const [sh, sm] = startHHMM.split(':').map(Number);
  const totalMins = (sh ?? 0) * 60 + (sm ?? 0) + input.durationMinutes;
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;

  const dateCompact = input.date.replace(/-/g, '');
  const startCompact = startHHMM.replace(':', '') + '00';
  const endCompact = `${String(eh).padStart(2, '0')}${String(em).padStart(2, '0')}00`;
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const desc = input.description.replace(/\n/g, '\\n').replace(/,/g, '\\,');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AutoServices//AutoServices//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${input.uid}@autoservices`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${tz}:${dateCompact}T${startCompact}`,
    `DTEND;TZID=${tz}:${dateCompact}T${endCompact}`,
    `SUMMARY:${input.title}`,
    `DESCRIPTION:${desc}`,
    ...(input.location ? [`LOCATION:${input.location}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return Buffer.from(lines.join('\r\n'), 'utf-8');
}
