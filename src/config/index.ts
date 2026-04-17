
interface Config {
  port: number;
  wsPort: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  databaseUrl: string;
  logLevel: string;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  bcryptRounds: number;
  shutdownUser: string;
  shutdownPassword: string;
  resendApiKey: string;
  resendFromEmail: string;
  redisUrl: string;
  metricsApiKey: string;
  trustProxy: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidEmail: string;
}

const getConfig = (): Config => {
  const port = parseInt(process.env.PORT || '3000', 10);
  const wsPort = parseInt(process.env.WS_PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const databaseUrl = process.env.DATABASE_URL || '';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const shutdownUser = process.env.SHUTDOWN_USER || 'admin_shutdown';
  const shutdownPassword = process.env.SHUTDOWN_PASSWORD || 'change_this_password';
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@autoservices.com';
  const redisUrl = process.env.REDIS_URL || '';
  const metricsApiKey = process.env.METRICS_API_KEY || '';
  const trustProxy = process.env.TRUST_PROXY !== 'false';
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:noreply@autoservices.com';

  // Validate required environment variables (only in production)
  if (nodeEnv === 'production') {
    if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required');
    if (!jwtSecret || jwtSecret === 'default-secret-change-in-production')
      throw new Error('JWT_SECRET environment variable must be set and not use default value');
    if (!process.env.SHUTDOWN_PASSWORD || process.env.SHUTDOWN_PASSWORD === 'change_this_password')
      throw new Error('SHUTDOWN_PASSWORD environment variable must be set and not use default value');
    if (!process.env.JWT_EXPIRES_IN)
      throw new Error('JWT_EXPIRES_IN environment variable is required in production');
    if (!process.env.JWT_REFRESH_EXPIRES_IN)
      throw new Error('JWT_REFRESH_EXPIRES_IN environment variable is required in production');
    if (!metricsApiKey)
      throw new Error('METRICS_API_KEY environment variable is required in production');
  }

  return {
    port,
    wsPort,
    nodeEnv,
    jwtSecret,
    jwtExpiresIn,
    jwtRefreshExpiresIn,
    databaseUrl,
    logLevel,
    corsOrigins,
    rateLimitMax,
    rateLimitWindowMs,
    bcryptRounds,
    shutdownUser,
    shutdownPassword,
    resendApiKey,
    resendFromEmail,
    redisUrl,
    metricsApiKey,
    trustProxy,
    vapidPublicKey,
    vapidPrivateKey,
    vapidEmail,
  };
};

export const config = getConfig();