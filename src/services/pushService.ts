import webpush from 'web-push';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

type PushSubscriptionData = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type SubscriptionRecord = {
  subscription: PushSubscriptionData;
  userPhone: string;
  userType: string;
  companyPhone?: string;
};

type AppointmentEvent = {
  companyPhone?: string | null;
  technicianPhone?: string | null;
  [key: string]: unknown;
};

const subscriptions = new Map<string, SubscriptionRecord>();

let initialized = false;

export class PushService {
  static init() {
    if (!config.vapidPublicKey || !config.vapidPrivateKey) {
      logger.warn('VAPID keys not set — push notifications disabled. Run: bunx web-push generate-vapid-keys');
      return;
    }
    webpush.setVapidDetails(config.vapidEmail, config.vapidPublicKey, config.vapidPrivateKey);
    initialized = true;
    logger.info('Push notification service initialized');
  }

  static isEnabled() {
    return initialized;
  }

  static saveSubscription(record: SubscriptionRecord) {
    subscriptions.set(record.subscription.endpoint, record);
  }

  static removeSubscription(endpoint: string) {
    subscriptions.delete(endpoint);
  }

  static getSubscriptionCount() {
    return subscriptions.size;
  }

  static async broadcast(event: string, appointment: AppointmentEvent) {
    if (!initialized) return;

    const titles: Record<string, string> = {
      'appointment:created': 'Nueva cita creada',
      'appointment:updated': 'Cita actualizada',
      'appointment:deleted': 'Cita cancelada',
      'appointment:assigned': 'Cita asignada',
    };

    const payload = JSON.stringify({
      type: event,
      title: titles[event] ?? 'AutoServices',
      body: 'Tienes una actualización en tus citas',
      appointment,
    });

    const toRemove: string[] = [];

    for (const [endpoint, record] of subscriptions) {
      const effectiveCompanyPhone = record.companyPhone ?? record.userPhone;
      const canReceive =
        record.userType === 'super_admin' ||
        (record.userType === 'company' && appointment.companyPhone === effectiveCompanyPhone) ||
        (record.userType === 'technician' && appointment.technicianPhone === record.userPhone);

      if (!canReceive) continue;

      try {
        await webpush.sendNotification(record.subscription, payload);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        if (e.statusCode === 410 || e.statusCode === 404) {
          toRemove.push(endpoint);
        } else {
          logger.warn(`Push failed for ${record.userPhone}: ${e.message}`);
        }
      }
    }

    for (const endpoint of toRemove) {
      subscriptions.delete(endpoint);
    }
  }

  static attachToEvents(emitter: { on: (event: string, listener: (data: AppointmentEvent) => void) => void }) {
    const events = ['appointment:created', 'appointment:updated', 'appointment:deleted', 'appointment:assigned'];
    for (const event of events) {
      emitter.on(event, (appointment: AppointmentEvent) => {
        void PushService.broadcast(event, appointment);
      });
    }
  }
}
