import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileCode2, Boxes } from 'lucide-react';
import { loadKnowledge, moduleColor } from '../data';
import type { Knowledge } from '../types';
import { Loading, SectionTitle } from '../components/ui';

export default function ModulesPage() {
  const [k, setK] = useState<Knowledge | null>(null);
  const [q, setQ] = useState('');
  const [side, setSide] = useState('all');
  useEffect(() => { loadKnowledge().then(setK); }, []);
  const sides = useMemo(() => (k ? ['all', ...new Set(k.modules.map((m) => m.side))] : ['all']), [k]);
  const filtered = useMemo(() => {
    if (!k) return [];
    const kw = q.trim().toLowerCase();
    return k.modules.filter((m) => (side === 'all' || m.side === side) &&
      (!kw || (m.name + m.title + m.one_liner + m.tags.join() + m.key_classes.join()).toLowerCase().includes(kw)));
  }, [k, q, side]);
  if (!k) return <Loading />;

  return (
    <div className="space-y-5">
      <SectionTitle sub={`${k.modules.length} 个学习模块（按包组整编）。可按名称 / 关键类 / 标签搜索，点击进入详情与关键源码。`}>模块地图</SectionTitle>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模块 / 关键类 / 标签…"
            className="w-full rounded-lg border border-ink-700 bg-ink-900/70 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-glow/50" />
        </div>
        <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900/70 p-1">
          {sides.map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`rounded-md px-3 py-1.5 text-sm transition ${side === s ? 'bg-cyan-glow/15 text-cyan-glow' : 'text-slate-400 hover:text-slate-200'}`}>{s === 'all' ? '全部' : s}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <Link key={m.id} to={`/modules/${m.id}`} className="tech-card tech-card-hover group flex flex-col p-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: moduleColor(m, k.layers) }} />
              <h3 className="font-semibold text-slate-100 group-hover:text-cyan-glow">{m.name}</h3>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{m.title}</div>
            <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-400">{m.one_liner}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><FileCode2 className="h-3.5 w-3.5" />{m.files}</span>
              {m.endpoints > 0 && <span className="inline-flex items-center gap-1 text-emerald-400/80"><Boxes className="h-3.5 w-3.5" />{m.endpoints}</span>}
            </div>
            {m.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{m.tags.slice(0, 4).map((t) => <span key={t} className="chip text-[10px]">{t}</span>)}</div>}
          </Link>
        ))}
      </div>
      {filtered.length === 0 && <div className="py-16 text-center text-slate-500">没有匹配的模块</div>}
    </div>
  );
}
