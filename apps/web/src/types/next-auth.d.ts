import type { Role } from '@cap/contracts';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { name?: string | null; email?: string | null; username: string; roles: Role[] };
    error?: unknown;
  }
}
