import { google } from 'googleapis';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

export type CalendarEventInput = {
  title: string;
  description: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:MM
  durationMinutes: number;
  location?: string;
  attendeeEmails?: string[];
};

export type CalendarResult = { eventId: string; htmlLink: string };

function buildAuth() {
  if (!config.googleServiceAccountEmail || !config.googlePrivateKey) return null;
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: config.googleServiceAccountEmail,
      private_key: config.googlePrivateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function buildEventBody(input: CalendarEventInput) {
  const tz = config.googleCalendarTimeZone;
  const endTime = addMinutes(input.startTime, input.durationMinutes);
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description,
    start: { dateTime: `${input.date}T${input.startTime}:00`, timeZone: tz },
    end:   { dateTime: `${input.date}T${endTime}:00`, timeZone: tz },
  };
  if (input.location) body.location = input.location;
  if (input.attendeeEmails?.length) {
    body.attendees = input.attendeeEmails.map(email => ({ email }));
  }
  return body;
}

export class CalendarService {
  static async createEvent(input: CalendarEventInput): Promise<CalendarResult | null> {
    const auth = buildAuth();
    if (!auth) return null;
    try {
      const cal = google.calendar({ version: 'v3', auth });
      const res = await cal.events.insert({
        calendarId: config.googleCalendarId,
        requestBody: buildEventBody(input),
        sendUpdates: 'all',
      });
      const { id, htmlLink } = res.data;
      if (!id || !htmlLink) return null;
      return { eventId: id, htmlLink };
    } catch (err) {
      logger.error(`CalendarService.createEvent failed: ${err}`);
      return null;
    }
  }

  static async updateEvent(eventId: string, input: CalendarEventInput): Promise<CalendarResult | null> {
    const auth = buildAuth();
    if (!auth) return null;
    try {
      const cal = google.calendar({ version: 'v3', auth });
      const res = await cal.events.update({
        calendarId: config.googleCalendarId,
        eventId,
        requestBody: buildEventBody(input),
        sendUpdates: 'all',
      });
      const { id, htmlLink } = res.data;
      if (!id || !htmlLink) return null;
      return { eventId: id, htmlLink };
    } catch (err) {
      logger.error(`CalendarService.updateEvent failed: ${err}`);
      return null;
    }
  }

  static async deleteEvent(eventId: string): Promise<void> {
    const auth = buildAuth();
    if (!auth) return;
    try {
      const cal = google.calendar({ version: 'v3', auth });
      await cal.events.delete({
        calendarId: config.googleCalendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (err) {
      logger.error(`CalendarService.deleteEvent failed: ${err}`);
    }
  }
}
