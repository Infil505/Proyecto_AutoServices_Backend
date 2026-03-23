import { config } from 'dotenv';

// Load environment variables
config();

interface Config {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
  logLevel: string;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  bcryptRounds: number;
}

const getConfig = (): Config => {
  const port = parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const databaseUrl = process.env.DATABASE_URL || '';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  // Validate required environment variables
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!jwtSecret || jwtSecret === 'default-secret-change-in-production') {
    throw new Error('JWT_SECRET environment variable must be set and not use default value');
  }

  return {
    port,
    nodeEnv,
    jwtSecret,
    jwtExpiresIn,
    databaseUrl,
    logLevel,
    corsOrigins,
    rateLimitMax,
    rateLimitWindowMs,
    bcryptRounds,
  };
};

export const config = getConfig();