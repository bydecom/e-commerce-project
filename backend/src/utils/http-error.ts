export function httpError(status: number, message: string, errors?: unknown): Error & {
  status: number;
  errors?: unknown;
} {
  const e = new Error(message) as Error & { status: number; errors?: unknown };
  e.status = status;
  e.errors = errors;
  return e;
}
