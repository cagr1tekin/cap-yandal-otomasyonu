import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readToken } from '@/lib/auth';

/** Keycloak oturumunu da kapatan çıkış (federated logout). */
export async function GET() {
  const token = await readToken();
  const home = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const url = new URL(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
  url.searchParams.set('post_logout_redirect_uri', `${home}/`);
  url.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID!);
  if (token?.idToken) url.searchParams.set('id_token_hint', token.idToken as string);
  const res = NextResponse.redirect(url);
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name.includes('next-auth')) res.cookies.delete(c.name);
  }
  return res;
}
