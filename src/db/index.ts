import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL environment variable is not set. ' +
    'Please configure it in .env file with a valid PostgreSQL connection string. ' +
    'Format: postgresql://user:password@host:port/database'
  );
}

if (databaseUrl.includes('[YOUR_') || databaseUrl.includes('[TU-CONTRASE')) {
  throw new Error(
    'DATABASE_URL contains placeholder values. ' +
    'Please update .env with your actual PostgreSQL connection password.'
  );
}

const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });