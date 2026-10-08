'use client';

import { useActionState, useState, useTransition } from 'react';
import { IMPORT_KINDS, LABELS } from '@cap/contracts';
import { Alert, Badge, Button, Card, CardTitle, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { importAction, type ImportState } from '@/lib/actions';

const tone = { EKLE: 'ok', GUNCELLE: 'neutral', ATLA: 'muted', HATA: 'bad' } as const;

/** Önce deneme, sonra aktarım: aynı CSV iki adımda gönderilir. */
export function ImportForm() {
  const [state, run] = useActionState(importAction, null as ImportState);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<string>('ATTEMPTS');
  const submit = (mode: 'dry' | 'commit') => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const form = e.currentTarget.form!;
    const data = new FormData(form);
    data.set('mode', mode);
    start(() => run(data));
  };
  return (
    <Card>
      <CardTitle>CSV yükle</CardTitle>
      <form className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Veri türü">
            <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {IMPORT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {LABELS.importKind[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CSV dosyası">
            <Input name="file" type="file" accept=".csv,text/csv" />
          </Field>
        </div>
        <Field label="ya da CSV metni (ilk satır başlık)">
          <Textarea name="csv" defaultValue={state?.csv ?? ''} className="font-mono text-xs" placeholder={'studentNo;courseCode;termId;grade\n243302016;3301156;T-2025-GUZ;CB'} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" disabled={pending} onClick={submit('dry')}>
            {pending ? 'Çalışıyor…' : 'Dene (yazmaz)'}
          </Button>
          <Button type="submit" disabled={pending || !state?.result || state.result.commit || state.kind !== kind} onClick={submit('commit')}>
            Aktar
          </Button>
        </div>
      </form>
      {state?.message && (
        <Alert tone={state.ok ? (state.result?.errors ? 'warn' : 'ok') : 'bad'} title={state.message} className="mt-4">
          {state.problem?.errors?.map((e) => <p key={e.path}>{e.message}</p>)}
        </Alert>
      )}
      {state?.result && (
        <Table className="mt-4">
          <thead>
            <tr>
              <Th>Satır</Th>
              <Th>Anahtar</Th>
              <Th>Sonuç</Th>
              <Th>Açıklama</Th>
            </tr>
          </thead>
          <tbody>
            {state.result.results.map((r) => (
              <tr key={r.row}>
                <Td>{r.row}</Td>
                <Td className="font-mono text-xs">{r.key}</Td>
                <Td>
                  <Badge tone={tone[r.action as keyof typeof tone] ?? 'muted'}>{r.action}</Badge>
                </Td>
                <Td className="text-xs">{r.message}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
