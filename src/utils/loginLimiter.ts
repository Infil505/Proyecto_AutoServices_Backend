const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LimitEntry { attempts: number; lockedUntil: number }

const store = new Map<string, LimitEntry>();

export function checkLoginAllowed(phone: string): { allowed: boolean; retryAfterMs?: number } {
  const entry = store.get(phone);
  if (!entry) return { allowed: true };
  const now = Date.now();
  if (now > entry.lockedUntil) { store.delete(phone); return { allowed: true }; }
  if (entry.attempts >= MAX_ATTEMPTS) return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  return { allowed: true };
}

export function recordFailedAttempt(phone: string): void {
  const now = Date.now();
  const entry = store.get(phone) ?? { attempts: 0, lockedUntil: now + WINDOW_MS };
  if (now > entry.lockedUntil) { entry.attempts = 0; entry.lockedUntil = now + WINDOW_MS; }
  entry.attempts++;
  store.set(phone, entry);
}

export function resetLoginAttempts(phone: string): void {
  store.delete(phone);
}

// Evict expired entries hourly
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of store) {
    if (now > entry.lockedUntil) store.delete(phone);
  }
}, 3_600_000).unref();
