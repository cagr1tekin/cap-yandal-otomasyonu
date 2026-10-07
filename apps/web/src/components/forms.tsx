'use client';

import { createContext, useActionState, useContext, useTransition, type ComponentProps, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, buttonVariants } from '@/components/ui';
import type { ActionState } from '@/lib/api';
import { cn } from '@/lib/format';
import type { VariantProps } from 'class-variance-authority';

const PendingContext = createContext(false);

export function SubmitButton({
  children,
  pending = 'İşleniyor…',
  confirm,
  disabled,
  ...props
}: { children: ReactNode; pending?: string; confirm?: string } & VariantProps<typeof buttonVariants> &
  Omit<ComponentProps<'button'>, 'type' | 'onClick' | 'children'>) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const isPending = status.pending || ctxPending;
  return (
    <Button
      type="submit"
      disabled={isPending || disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...props}
    >
      {isPending ? pending : children}
    </Button>
  );
}

/**
 * Sunucu eylemi + sonuç mesajı. Hata ayrıntıları (kural sonuçları, alan hataları) gösterilir.
 * React 19'un `action` prop'u gönderimden sonra formu sıfırladığı için gönderim elle yapılır:
 * hata durumunda kullanıcının girdiği değerler korunur.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={cn('space-y-3', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(data));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      <ActionResult state={state} />
    </form>
  );
}

export function ActionResult({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  const p = state.problem;
  return (
    <Alert tone={state.ok ? 'ok' : 'bad'} title={state.message}>
      {p?.results?.length ? (
        <ul className="list-disc space-y-0.5 pl-4">
          {p.results.map((r) => (
            <li key={r.code}>
              <span className="font-medium">{r.title}:</span> {r.message} <span className="text-xs opacity-75">({r.article})</span>
            </li>
          ))}
        </ul>
      ) : null}
      {p?.errors?.length ? (
        <ul className="list-disc pl-4">
          {p.errors.map((e) => (
            <li key={e.path}>{e.message}</li>
          ))}
        </ul>
      ) : null}
      {p?.warnings?.length ? (
        <ul className="list-disc pl-4">
          {p.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}
