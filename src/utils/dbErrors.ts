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
    case '23505': // unique_violation
      return { status: 409, error: 'Resource already exists' };
    case '23503': // foreign_key_violation
      return { status: 400, error: 'Referenced resource does not exist' };
    case '23502': // not_null_violation
      return { status: 400, error: 'A required field is missing' };
    case '23514': // check_violation
      return { status: 400, error: 'A field value does not meet the required constraints' };
    default:
      throw err; // let global error handler return 500
  }
}
