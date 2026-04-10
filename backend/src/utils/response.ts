export function success<T>(data: T, message = 'OK', meta: unknown = null) {
  return { success: true as const, message, data, meta };
}

/** Same shape as `success`; alias for controller naming. */
export const successResponse = success;

export function failure(message: string, errors: unknown = null) {
  return { success: false as const, message, errors };
}
