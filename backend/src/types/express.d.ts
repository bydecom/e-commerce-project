import type { Role } from '@prisma/client';
import 'express-serve-static-core';

export {};

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by `authMiddleware` after a valid, non-blacklisted JWT. */
    auth?: {
      userId: number;
      role: Role;
      jti: string;
      exp: number;
    };
  }
}
