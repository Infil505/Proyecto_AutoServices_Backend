import { Errors } from './errors.js';

/**
 * Maps PostgreSQL error codes to HTTP-friendly responses.
 * Call inside catch blocks after DB operations.
 *
 * Drizzle (postgres-js) sometimes wraps the original PostgresError,
 * so we probe multiple paths to find the PG error code.
 *
 * If the error is not a recognized DB error, re-throws so the
 * global handler returns 500.
 */
export function handleDbError(err: unknown): { status: number; error: string } {
  const e = err as any;
  const code: string | undefined =
    e?.code ??          // postgres-js direct error
    e?.cause?.code ??   // Drizzle wraps with cause
    e?.original?.code;  // some adapters use original

  switch (code) {
    case '23505': return Errors.DB_UNIQUE_VIOLATION;   // unique_violation
    case '23503': return Errors.DB_FK_VIOLATION;       // foreign_key_violation
    case '23502': return Errors.DB_NULL_VIOLATION;     // not_null_violation
    case '23514': return Errors.DB_CHECK_VIOLATION;    // check_violation
    // Transaction aborted because an earlier query in the same tx failed.
    // The real constraint error was on the previous statement.
    case '25P02': return Errors.DB_UNIQUE_VIOLATION;   // in_failed_sql_transaction → treat as conflict
    default:      throw err; // let global error handler return 500
  }
}
