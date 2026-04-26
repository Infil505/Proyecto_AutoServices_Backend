import { Hono } from 'hono';
import { PushService } from '../services/pushService.js';
import type { AppContext } from '../types.js';
import { Errors } from '../utils/errors.js';

const MAX_SUBSCRIPTIONS_PER_USER = 20;

const router = new Hono<AppContext>();

router.post('/', async (c) => {
  const user = c.var.user;
  if (!user) return c.json(Errors.MISSING_AUTH_HEADER, 401);

  if (!PushService.isEnabled()) {
    return c.json({ message: 'Push notifications not configured on server' }, 503);
  }

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const keys = body?.keys as Record<string, string> | undefined;

  if (
    !body?.endpoint ||
    typeof body.endpoint !== 'string' ||
    !keys?.p256dh ||
    !keys?.auth
  ) {
    return c.json({ error: 'Invalid push subscription object' }, 400);
  }

  // Allow re-registering an existing endpoint (browser refresh / key rotation).
  // Only apply the cap to genuinely new endpoints.
  const isUpdate = PushService.hasSubscription(body.endpoint);
  if (!isUpdate && PushService.countByUser(user.phone as string) >= MAX_SUBSCRIPTIONS_PER_USER) {
    return c.json({ error: 'Maximum push subscriptions per user reached' }, 429);
  }

  PushService.saveSubscription({
    subscription: { endpoint: body.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    userPhone: user.phone as string,
    userType: user.type as string,
    companyPhone: user.companyPhone as string | undefined,
  });

  return c.json({ message: 'Subscription saved' }, 201);
});

router.delete('/', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.endpoint && typeof body.endpoint === 'string') {
    PushService.removeSubscription(body.endpoint);
  }
  return c.json({ message: 'Subscription removed' });
});

export default router;
