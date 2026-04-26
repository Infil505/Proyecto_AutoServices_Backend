import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
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

// Hot-path cache — populated from DB on startup and kept in sync on mutations.
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

  static async loadFromDb(): Promise<void> {
    if (!initialized) return;
    try {
      const rows = await db.select().from(pushSubscriptions);
      for (const row of rows) {
        subscriptions.set(row.endpoint, {
          subscription: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          userPhone: row.userPhone,
          userType: row.userType,
          companyPhone: row.companyPhone ?? undefined,
        });
      }
      logger.info(`[PushService] Loaded ${rows.length} subscription(s) from DB`);
    } catch (err) {
      logger.error(`[PushService] Failed to load subscriptions from DB: ${err}`);
    }
  }

  static isEnabled() {
    return initialized;
  }

  // Sync: Map updated immediately so broadcast works right away.
  // DB write is fire-and-forget — if it fails the subscription works until restart.
  static saveSubscription(record: SubscriptionRecord): void {
    subscriptions.set(record.subscription.endpoint, record);
    db.insert(pushSubscriptions)
      .values({
        userPhone: record.userPhone,
        userType: record.userType,
        companyPhone: record.companyPhone ?? null,
        endpoint: record.subscription.endpoint,
        p256dh: record.subscription.keys.p256dh,
        auth: record.subscription.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userPhone: record.userPhone,
          userType: record.userType,
          companyPhone: record.companyPhone ?? null,
          p256dh: record.subscription.keys.p256dh,
          auth: record.subscription.keys.auth,
        },
      })
      .catch((err: unknown) =>
        logger.warn(`[PushService] Failed to persist subscription for ${record.userPhone}: ${err}`)
      );
  }

  static removeSubscription(endpoint: string): void {
    subscriptions.delete(endpoint);
    db.delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .catch((err: unknown) =>
        logger.warn(`[PushService] Failed to remove subscription from DB: ${err}`)
      );
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
    const sends: Promise<void>[] = [];

    for (const [endpoint, record] of subscriptions) {
      const effectiveCompanyPhone = record.companyPhone ?? record.userPhone;
      const canReceive =
        record.userType === 'super_admin' ||
        (record.userType === 'company' && appointment.companyPhone === effectiveCompanyPhone) ||
        (record.userType === 'technician' && appointment.technicianPhone === record.userPhone);

      if (!canReceive) continue;

      sends.push(
        webpush.sendNotification(record.subscription, payload).then(() => {}).catch((err: unknown) => {
          const e = err as { statusCode?: number; message?: string };
          if (e.statusCode === 410 || e.statusCode === 404) {
            toRemove.push(endpoint);
          } else {
            logger.warn(`[PushService] Push failed for ${record.userPhone}: ${e.message}`);
          }
        })
      );
    }

    await Promise.all(sends);

    for (const endpoint of toRemove) {
      subscriptions.delete(endpoint);
      db.delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .catch((err: unknown) =>
          logger.warn(`[PushService] Failed to remove stale subscription from DB: ${err}`)
        );
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
