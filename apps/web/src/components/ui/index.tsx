import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/format';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-su-primary text-white hover:bg-su-primary-dark',
        accent: 'bg-su-accent text-su-primary-dark hover:bg-su-accent-dark',
        outline: 'border border-su-primary text-su-primary bg-white hover:bg-su-primary-soft',
        ghost: 'text-su-primary hover:bg-su-primary-soft',
        danger: 'bg-bad text-white hover:bg-red-800',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({ className, variant, size, ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('rounded-2xl border border-su-border/70 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(13,45,94,0.06)]', className)} {...props} />;
}

export function CardTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <h2 className="text-lg text-su-heading">{children}</h2>
      {aside}
    </div>
  );
}

const badgeTones = {
  neutral: 'bg-su-primary-soft text-su-primary',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  accent: 'bg-su-accent text-su-primary-dark',
  muted: 'bg-slate-100 text-su-muted',
} as const;

export type Tone = keyof typeof badgeTones;

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const alertIcons = { info: Info, ok: CheckCircle2, warn: AlertTriangle, bad: XCircle };
const alertTones = {
  info: 'border-su-primary/20 bg-su-primary-soft text-su-primary-dark',
  ok: 'border-ok/25 bg-ok-soft text-ok',
  warn: 'border-warn/25 bg-warn-soft text-warn',
  bad: 'border-bad/25 bg-bad-soft text-bad',
};

export function Alert({ tone = 'info', title, children, className }: { tone?: keyof typeof alertTones; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = alertIcons[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-4 text-sm', alertTones[tone], className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-su-text/90">{children}</div>}
      </div>
    </div>
  );
}

/** Etiket, id verilmişse htmlFor ile; verilmemişse girdiyi sararak bağlanır (erişilebilir ad). */
export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  const labelCls = 'block text-sm font-medium text-su-heading';
  if (htmlFor) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={htmlFor} className={labelCls}>
          {label}
        </label>
        {children}
        {hint && <p className="text-xs text-su-muted">{hint}</p>}
      </div>
    );
  }
  return (
    <label className="block space-y-1.5">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="block text-xs text-su-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-su-border bg-white px-3 py-2 text-sm text-su-text placeholder:text-su-subtle focus:border-su-primary focus:outline-none focus:ring-2 focus:ring-su-primary/20';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(inputCls, 'pr-8', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputCls, 'min-h-24', className)} {...props} />;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-su-border/70', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('bg-su-bg px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-su-muted', className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('border-t border-su-border/60 px-3 py-2.5 align-top', className)}>{children}</td>;
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, max ? Math.round((value / max) * 100) : 0));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-su-muted">
        <span>{label}</span>
        <span>
          {value}/{max} (%{pct})
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-pill bg-su-primary-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-pill bg-su-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Selçuk iç sayfalarındaki lacivert başlık bandı. */
export function PageHero({ title, subtitle, crumbs, actions }: { title: string; subtitle?: ReactNode; crumbs?: string[]; actions?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-su-primary text-white">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-20%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          {crumbs && <p className="mb-2 text-xs uppercase tracking-wider text-white/60">{crumbs.join(' / ')}</p>}
          <h1 className="text-2xl font-medium text-white sm:text-[32px]">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm text-white/75">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6', className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-su-border bg-su-bg px-4 py-8 text-center text-sm text-su-muted">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-su-border/70 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-su-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-su-primary">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-su-muted">{hint}</p>}
    </div>
  );
}
