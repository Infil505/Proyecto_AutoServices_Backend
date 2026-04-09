import { Errors } from './errors.js';

/**
 * Maps PostgreSQL error codes to HTTP-friendly responses.
 * Call inside catch blocks after DB operations.
 *
 * If the error is not a recognized DB error, re-throws so the
 * global handler returns 500.
 */
export function handleDbError(err: unknown): { status: number; error: string } {
  const code = (err as any)?.code;
  switch (code) {
    case '23505': return Errors.DB_UNIQUE_VIOLATION;   // unique_violation
    case '23503': return Errors.DB_FK_VIOLATION;       // foreign_key_violation
    case '23502': return Errors.DB_NULL_VIOLATION;     // not_null_violation
    case '23514': return Errors.DB_CHECK_VIOLATION;    // check_violation
    default:      throw err; // let global error handler return 500
  }
}
