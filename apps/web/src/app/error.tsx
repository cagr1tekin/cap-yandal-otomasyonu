'use client';

import { Alert, Button, Page } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page className="max-w-2xl">
      <Alert tone="bad" title="Bir şeyler ters gitti.">
        <p>{error.message || 'Beklenmeyen bir hata oluştu.'}</p>
        {error.digest && <p className="text-xs">Hata kodu: {error.digest}</p>}
      </Alert>
      <Button onClick={reset}>Tekrar dene</Button>
    </Page>
  );
}
