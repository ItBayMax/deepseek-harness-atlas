import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadKnowledge } from '../data';
import type { Knowledge } from '../types';
import { Loading, SectionTitle } from '../components/ui';

const TONE: Record<string, string> = { architectural: '#38bdf8', behavioral: '#fbbf24', structural: '#34d399', creational: '#f472b6', ui: '#a78bfa' };

export default function PatternsPage() {
  const [k, setK] = useState<Knowledge | null>(null);
  useEffect(() => { loadKnowledge().then(setK); }, []);
  if (!k) return <Loading />;
  const name = (id: string) => k.modules.find((m) => m.id === id)?.name || id;
  const cats = [...new Set(k.patterns.map((p) => p.cat))];

  return (
    <div className="space-y-6">
      <SectionTitle sub="从源码中提炼的设计模式，每条附证据模块（点击跳转）。">设计模式</SectionTitle>
      {cats.length === 0 && <p className="text-sm text-slate-500">尚未录入设计模式。</p>}
      {cats.map((cat) => {
        const tone = TONE[cat] || '#38bdf8';
        return (
          <section key={cat}>
            <div className="mb-3 flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: tone }} /><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{cat}</h3></div>
            <div className="grid gap-4 md:grid-cols-2">
              {k.patterns.filter((p) => p.cat === cat).map((p) => (
                <div key={p.name} className="tech-card p-5" style={{ borderColor: tone + '33' }}>
                  <h4 className="font-semibold text-slate-100">{p.name}</h4>
                  <p className="mt-2 text-sm text-slate-400">{p.descr}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{p.modules.map((mid) => <Link key={mid} to={`/modules/${mid}`} className="chip hover:border-cyan-glow/50 hover:text-cyan-glow">{name(mid)}</Link>)}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
