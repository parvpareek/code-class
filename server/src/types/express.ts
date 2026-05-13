import type { Role } from '@prisma/client';

/** Loaded from `index.ts` so ts-node always applies `Request.user` before route modules. */
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
