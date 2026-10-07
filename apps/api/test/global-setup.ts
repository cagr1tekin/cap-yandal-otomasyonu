import { execSync } from 'node:child_process';

/** Test veritabanını (cap_test) göçlerle kurar ve seed verisini yükler. */
export default function globalSetup() {
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'postgresql://cap:cap_dev@localhost:5442/cap_test?schema=public' };
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });
}
