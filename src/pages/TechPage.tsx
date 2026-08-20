import { useEffect, useState } from 'react';
import { loadKnowledge } from '../data';
import type { Knowledge, Tech } from '../types';
import { Loading, SectionTitle } from '../components/ui';

export default function TechPage() {
  const [k, setK] = useState<Knowledge | null>(null);
  useEffect(() => { loadKnowledge().then(setK); }, []);
  if (!k) return <Loading />;
  const byCat: Record<string, Tech[]> = {};
  for (const t of k.tech) (byCat[t.category] = byCat[t.category] || []).push(t);
  const cats = Object.keys(byCat);

  return (
    <div className="space-y-6">
      <SectionTitle sub="技术栈按类别分组。">技术栈</SectionTitle>
      {cats.length === 0 && <p className="text-sm text-slate-500">尚未录入技术栈条目。</p>}
      {cats.map((cat) => (
        <section key={cat}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{cat}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byCat[cat].map((t) => (
              <div key={t.name} className="tech-card tech-card-hover p-4">
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-100">{t.name}</span>{t.side && <span className="rounded px-1.5 py-0.5 text-[10px] bg-ink-800 text-slate-300">{t.side}</span>}</div>
                <p className="mt-2 text-sm text-slate-400">{t.descr}</p>
                {t.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{t.tags.map((tg) => <span key={tg} className="chip text-[10px]">{tg}</span>)}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
