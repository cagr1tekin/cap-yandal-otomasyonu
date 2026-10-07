import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Her koşudan önce: veritabanı seed'e döner, sahte OBİS sıfırlanır. */
export default async function globalSetup() {
  execSync('npx prisma db seed', { cwd: resolve(__dirname, '../apps/api'), stdio: 'ignore' });
  const obis = process.env.OBIS_URL ?? 'http://127.0.0.1:4100';
  const res = await fetch(`${obis}/_admin/reset`, { method: 'POST', headers: { 'x-api-key': process.env.OBIS_API_KEY ?? 'mock-obis-dev-key' } });
  if (!res.ok) throw new Error(`Sahte OBİS sıfırlanamadı: ${res.status}`);
}
