export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  role: Role;
  /** ISO string from API when backend exposes `createdAt` */
  createdAt?: string;
}
