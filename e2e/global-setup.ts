import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Her koşudan önce veritabanı ve belge deposu seed durumuna döner. */
export default async function globalSetup() {
  execSync('npx prisma db seed', { cwd: resolve(__dirname, '../apps/api'), stdio: 'ignore' });
}
