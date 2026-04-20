import type { Role } from '@prisma/client';

export {};

declare global {
  namespace Express {
    interface Request {
      /** Populated by `authMiddleware` / `optionalAuthMiddleware` after a valid, non-blacklisted JWT. */
      auth?: {
        userId: number;
        role: Role;
        jti: string;
        exp: number;
      };
    }
  }
}
