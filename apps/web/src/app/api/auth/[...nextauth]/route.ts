import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// Uyuyan API'nin uyanmasını beklemek için (publicApi en fazla 50 sn bekler).
export const maxDuration = 60;

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
