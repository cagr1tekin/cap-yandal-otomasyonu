'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui';

export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Button size="lg" onClick={() => signIn('keycloak', { callbackUrl })}>
      <LogIn aria-hidden className="size-4" /> SSO İLE GİRİŞ YAP
    </Button>
  );
}
