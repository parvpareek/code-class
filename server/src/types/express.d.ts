import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by `protect` middleware on authenticated routes. */
      user?: {
        userId: string;
        role: Role;
      };
    }
  }
}

export {};
