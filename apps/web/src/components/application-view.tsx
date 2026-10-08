import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge, RuleList, VerdictBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Table, Td, Th } from '@/components/ui';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import { acceptAction, verifyAction, withdrawApplicationAction } from '@/lib/actions';
import type { ApplicationDetail } from '@/lib/types';

const verificationTone = { PENDING: 'warn', VERIFIED: 'ok', MISMATCH: 'bad' } as const;

/** Başvuru ayrıntısı: öğrenci kendi başvurusunu, komisyon doğrulama ekranını aynı bileşenle görür. */
export function ApplicationView({ a, staff }: { a: ApplicationDetail; staff: boolean }) {
  const d = a.snapshot.declared;
  const percent = d.classRank && d.classSize ? Math.round((d.classRank / d.classSize) * 1000) / 10 : null;
  const declared: [string, string, string][] = [
    ['Genel not ortalaması', fmtGpa(d.gano), 'Transkript'],
    ['Başlayacağı yarıyıl', `${d.semesterNo}.`, 'Transkript'],
    ['Tüm dersleri alıp geçti', d.completedAllCourses ? 'Evet' : 'Hayır', 'Transkript'],
    ['Sınıf başarı sırası', d.classRank ? `${d.classRank} / ${d.classSize} (ilk %${String(percent).replace('.', ',')})` : '—', 'İlk %20 belgesi'],
    ['Kayıt yılı', String(d.entryYear), 'YKS belgesi'],
    ['YKS yerleştirme puanı', d.entryScore != null ? String(d.entryScore).replace('.', ',') : '—', 'YKS belgesi'],
    ['YKS başarı sırası', d.successRank != null ? d.successRank.toLocaleString('tr-TR') : '—', 'YKS belgesi'],
  ];

  return (
    <>
      <Card>
        <CardTitle
          aside={
            <div className="flex flex-wrap items-center gap-2">
              <ApplicationBadge value={a.status} />
              <Badge tone={verificationTone[a.verification]}>{LABELS.verification[a.verification]}</Badge>
            </div>
          }
        >
          {a.snapshot.fullName} <span className="text-sm font-normal text-su-subtle">{a.studentNo}</span>
          <span className="block text-xs font-normal text-su-muted">
            Ana dal: {a.student.program.name} ({a.student.program.faculty}) · Bilgisayar Mühendisliği {LABELS.track[a.offering.type]} · {termLabel(a.offering.term)} · başvuru {fmtDateTime(a.submittedAt)}
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <VerdictBadge value={a.eligibility.verdict} />
          <span className="text-su-muted">
            {a.path === 'RANK' ? 'Başarı sırası yolu (sınıfında ilk %20)' : 'Taban puan yolu (YKS puanı ≥ taban puan)'} · kural seti {a.ruleSet.version}
          </span>
          {a.ranking && (
            <Badge tone="neutral">
              {a.ranking.rank}. sıra · {LABELS.proposal[a.ranking.proposal]}
            </Badge>
          )}
          <Link href={`/yazdir/dilekce/${a.id}`} className="ml-auto text-sm">
            Başvuru dilekçesi (yazdır)
          </Link>
        </div>
        {a.verificationNote && (
          <Alert tone={a.verification === 'MISMATCH' ? 'bad' : 'info'} className="mt-3" title={`Komisyon notu (${a.verifiedBy}, ${fmtDateTime(a.verifiedAt)})`}>
            {a.verificationNote}
          </Alert>
        )}
        {a.withdrawReason && <p className="mt-3 text-sm text-su-muted">Geri çekme gerekçesi: {a.withdrawReason}</p>}
      </Card>

      {a.can.accept && (
        <Card className="border-ok/40">
          <CardTitle>Kesin kayıt</CardTitle>
          <p className="mb-3 text-sm text-su-muted">
            Programa kabul edildiniz. Kesin kaydınızı onayladığınızda komisyon Kabul ve Ders Protokolünüzü hazırlar; protokol beş imzayla tamamlanır ve ilk ders kayıt formunuzu doldurursunuz.
            {a.offering.registrationDeadline && ` Son gün: ${fmtDate(a.offering.registrationDeadline)}.`}
          </p>
          <ActionForm action={acceptAction}>
            <input type="hidden" name="id" value={a.id} />
            <SubmitButton variant="accent" confirm="Kesin kaydınız yapılacak. Onaylıyor musunuz?">
              Kesin kaydımı onaylıyorum
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
      {a.enrollment && (
        <Alert tone="ok" title="Kesin kayıt yapıldı.">
          <Link href={`/kayitlar/${a.enrollment.id}`}>Kayıt sayfasını aç</Link> (protokol, ders kayıt formu, muafiyet).
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Öğrencinin beyanı</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Bilgi</Th>
                <Th>Beyan</Th>
                <Th>Karşılaştırılacak belge</Th>
              </tr>
            </thead>
            <tbody>
              {declared.map(([label, value, source]) => (
                <tr key={label}>
                  <Td>{label}</Td>
                  <Td className="font-semibold">{value}</Td>
                  <Td className="text-xs text-su-muted">{source}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-su-muted">Beyan, başvurunun yapıldığı andaki değerlerdir ({fmtDateTime(a.snapshot.takenAt)}); öğrenci bilgilerini sonradan değiştirse de başvuru değişmez.</p>
        </Card>
        <Card>
          <CardTitle>Belgeler</CardTitle>
          {a.sameFaculty && a.offering.type === 'CAP' && (
            <p className="mb-2 text-xs text-su-muted">Fakülte içi başvuru: transkript ve ilk %20 belgesi istenmez (Rehber). GNO ve sıra, fakülte öğrenci işlerinden teyit edilir.</p>
          )}
          {a.documents.length === 0 ? (
            <Empty>Başvuruya eklenmiş belge yok.</Empty>
          ) : (
            <ul className="divide-y divide-su-border/60 text-sm">
              {a.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{LABELS.document[doc.kind]}</span>
                    <span className="block text-xs text-su-subtle">
                      {doc.fileName} · {fmtDateTime(doc.uploadedAt)}
                    </span>
                  </span>
                  <a href={`/api/belge/${doc.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    Aç
                  </a>
                </li>
              ))}
            </ul>
          )}
          {a.can.verify && (
            <ActionForm action={verifyAction} className="mt-4 rounded-lg bg-su-bg p-3">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Not" hint="Uyuşmazlıkta zorunlu: hangi bilgi belgeyle uyuşmuyor?">
                <Input name="note" placeholder="Örn. transkriptte GNO 2,68; beyan 2,75" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton size="sm" name="status" value="VERIFIED">
                  Beyan belgelerle uyuşuyor
                </SubmitButton>
                <SubmitButton size="sm" variant="danger" name="status" value="MISMATCH" confirm="Başvuru değerlendirme dışı kalacak ve öğrenciye bildirilecek. Devam edilsin mi?">
                  Uyuşmuyor
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Kural değerlendirmesi</CardTitle>
        <RuleList results={a.eligibility.results} hideNa />
      </Card>

      {a.can.withdraw && (
        <Card>
          <CardTitle>Başvuruyu geri çek</CardTitle>
          <ActionForm action={withdrawApplicationAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={a.id} />
            <div className="min-w-64 flex-1">
              <Field label="Gerekçe">
                <Input name="reason" required minLength={5} />
              </Field>
            </div>
            <SubmitButton variant="outline" confirm="Başvuru geri çekilecek. Devam edilsin mi?">
              Geri çek
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      {staff && a.audit.length > 0 && (
        <Card>
          <CardTitle>İşlem geçmişi</CardTitle>
          <ul className="space-y-1 text-xs text-su-muted">
            {a.audit.map((r) => (
              <li key={r.id}>
                {fmtDateTime(r.at)} · <span className="font-mono">{r.action}</span> · {r.actor}
                {r.reason && ` · ${r.reason}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
