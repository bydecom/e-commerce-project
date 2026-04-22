export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  name?: string | null;
  phone?: string | null;
  provinceId?: string | null;
  districtId?: string | null;
  wardId?: string | null;
  streetAddress?: string | null;
  fullAddress?: string | null;
  role: Role;
  /** ISO string from API when backend exposes `createdAt` */
  createdAt?: string;
  // Admin list stats (may be omitted in other endpoints)
  orderCount?: number;
  totalSpent?: number;
  lastOrderAt?: string | null;
}
