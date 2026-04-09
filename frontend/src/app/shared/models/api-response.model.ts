export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta | null;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: unknown;
}
