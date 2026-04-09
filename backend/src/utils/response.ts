export function success<T>(data: T, message = 'OK', meta: unknown = null) {
  return { success: true as const, message, data, meta };
}

export function failure(message: string, errors: unknown = null) {
  return { success: false as const, message, errors };
}
