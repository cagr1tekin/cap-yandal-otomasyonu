import Link from 'next/link';
import { buttonVariants, Page, PageHero } from '@/components/ui';

export default function NotFound() {
  return (
    <>
      <PageHero title="Sayfa bulunamadı" />
      <Page className="max-w-2xl">
        <p className="text-su-muted">Aradığınız sayfa yok ya da erişim yetkiniz bulunmuyor.</p>
        <Link href="/" className={buttonVariants()}>
          Ana sayfaya dön
        </Link>
      </Page>
    </>
  );
}
