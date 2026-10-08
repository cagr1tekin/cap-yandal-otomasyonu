import type { ReactNode } from 'react';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Input } from '@/components/ui';
import type { ActionState } from '@/lib/api';

type Action = (prev: ActionState, data: FormData) => Promise<ActionState>;

/**
 * Gerekçe isteyen tek düğmeli işlem (iptal, çıkarma, ret vb.). Açılır bölümde gerekçe girilir;
 * gizli alanlar hangi kaydın değişeceğini taşır.
 */
export function ReasonAction({
  action,
  fields,
  label,
  placeholder = 'Gerekçe',
  variant = 'outline',
  confirm,
  name = 'reason',
  children,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  placeholder?: string;
  variant?: 'outline' | 'danger' | 'primary' | 'ghost';
  confirm?: string;
  name?: string;
  children?: ReactNode;
}) {
  return (
    <details className="inline-block align-top">
      <summary className="cursor-pointer text-xs font-medium text-su-primary">{label}</summary>
      <ActionForm action={action} className="mt-2 w-64 space-y-2 rounded-lg border border-su-border/70 bg-white p-2">
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children}
        <Input name={name} required minLength={5} placeholder={placeholder} aria-label={`${label}: ${placeholder}`} />
        <SubmitButton size="sm" variant={variant} confirm={confirm}>
          {label}
        </SubmitButton>
      </ActionForm>
    </details>
  );
}

/** Onayla / reddet çifti (ret için gerekçe zorunlu). */
export function ReviewButtons({ action, kind, id, children }: { action: Action; kind: string; id: string; children?: ReactNode }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2 space-y-0">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {children}
      <Input name="note" placeholder="Ret gerekçesi / not" aria-label="Ret gerekçesi ya da not" className="h-8 w-56 py-1 text-xs" />
      <SubmitButton size="sm" name="decision" value="APPROVED">
        Onayla
      </SubmitButton>
      <SubmitButton size="sm" variant="outline" name="decision" value="REJECTED">
        Reddet
      </SubmitButton>
    </ActionForm>
  );
}
