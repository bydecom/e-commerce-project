export function parsePagination(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '10', 10) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
