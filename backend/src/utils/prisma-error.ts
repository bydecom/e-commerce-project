import { Prisma } from '@prisma/client';

export type PrismaErrorCode =
  | 'UNIQUE_CONSTRAINT_VIOLATION'  // P2002 — duplicate value on a unique field
  | 'FOREIGN_KEY_VIOLATION'        // P2003, P2014 — record referenced by another table
  | 'RECORD_NOT_FOUND'             // P2001, P2025 — targeted record does not exist
  | 'NULL_CONSTRAINT_VIOLATION'    // P2011, P2012 — required field was null/missing
  | 'PRISMA_VALIDATION_ERROR'      // PrismaClientValidationError — malformed query
  | 'INTERNAL_DB_ERROR';           // any other PrismaClientKnownRequestError code

interface PrismaHttpError {
  status: number;
  message: string;
  errors: { code: PrismaErrorCode };
}

const KNOWN_CODE_MAP: Record<string, PrismaHttpError> = {
  P2001: { status: 404, message: 'Record not found',                    errors: { code: 'RECORD_NOT_FOUND' } },
  P2002: { status: 409, message: 'Unique constraint violation',         errors: { code: 'UNIQUE_CONSTRAINT_VIOLATION' } },
  P2003: { status: 409, message: 'Operation blocked by related records', errors: { code: 'FOREIGN_KEY_VIOLATION' } },
  P2011: { status: 400, message: 'Required field is null',              errors: { code: 'NULL_CONSTRAINT_VIOLATION' } },
  P2012: { status: 400, message: 'Required field is missing',           errors: { code: 'NULL_CONSTRAINT_VIOLATION' } },
  P2014: { status: 409, message: 'Operation blocked by related records', errors: { code: 'FOREIGN_KEY_VIOLATION' } },
  P2025: { status: 404, message: 'Record not found',                    errors: { code: 'RECORD_NOT_FOUND' } },
};

/**
 * Converts a Prisma error into a typed HTTP error descriptor.
 * Returns null for non-Prisma errors so the caller can fall through.
 */
export function toPrismaHttpError(e: unknown): PrismaHttpError | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return KNOWN_CODE_MAP[e.code] ?? {
      status: 500,
      message: 'Internal Server Error',
      errors: { code: 'INTERNAL_DB_ERROR' as const },
    };
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: 'Invalid database query', errors: { code: 'PRISMA_VALIDATION_ERROR' } };
  }

  return null;
}
