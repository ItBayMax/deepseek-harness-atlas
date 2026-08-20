import type { ReactNode } from 'react';

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="tech-card tech-card-hover p-4 animate-fade-in">
      <div className="text-3xl font-bold tabular-nums" style={{ color: accent || '#e2e8f0' }}>{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold text-slate-100">{children}</h2>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  );
}

export function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="chip" style={color ? { borderColor: color + '55', color } : undefined}>{children}</span>;
}

export function Loading({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-slate-500">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-600 border-t-cyan-glow" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
