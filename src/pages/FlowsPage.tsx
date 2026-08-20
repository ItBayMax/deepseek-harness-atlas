import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, LogIn, Cog, Save, GitFork, LogOut } from 'lucide-react';
import { loadKnowledge, moduleColor } from '../data';
import type { Knowledge, DataFlow } from '../types';
import { Loading, SectionTitle } from '../components/ui';

const ICON: Record<string, any> = { input: LogIn, process: Cog, output: LogOut, decision: GitFork, storage: Save };
const TONE: Record<string, string> = { input: '#34d399', process: '#38bdf8', output: '#a78bfa', decision: '#fbbf24', storage: '#f472b6' };

export default function FlowsPage() {
  const [k, setK] = useState<Knowledge | null>(null);
  const [active, setActive] = useState(0);
  useEffect(() => { loadKnowledge().then(setK); }, []);
  if (!k) return <Loading />;
  if (!k.dataflows.length) return (<div><SectionTitle>核心流程</SectionTitle><p className="text-sm text-slate-500">尚未定义流程，请在 <code>scripts/modules-data.mjs</code> 中添加。</p></div>);
  const flow: DataFlow = k.dataflows[active];
  const modName = (id: string) => k.modules.find((m) => m.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <SectionTitle sub="跨模块的端到端旅程：每一步都可点击进入对应模块。">核心流程</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {k.dataflows.map((f, i) => (
          <button key={f.id} onClick={() => setActive(i)} className={`rounded-lg border px-4 py-2 text-sm transition ${i === active ? 'border-cyan-glow bg-cyan-glow/10 text-cyan-glow' : 'border-ink-700 text-slate-400 hover:border-cyan-glow/40 hover:text-slate-200'}`}>{f.name}</button>
        ))}
      </div>
      <div className="tech-card p-6">
        <h3 className="text-lg font-semibold text-slate-100">{flow.name}</h3>
        <p className="mt-1 text-sm text-slate-400">{flow.descr}</p>
        <div className="mt-6 space-y-1">
          {flow.steps.map((s, i) => {
            const Icon = ICON[s.type] || Cog; const tone = TONE[s.type] || '#38bdf8'; const mod = k.modules.find((m) => m.id === s.moduleId);
            return (
              <div key={i}>
                <div className="flex items-start gap-4 rounded-lg border border-ink-700/50 bg-ink-900/40 p-4 transition hover:border-cyan-glow/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tone + '22', color: tone }}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-mono text-slate-600">{String(i + 1).padStart(2, '0')}</span><span className="font-medium text-slate-100">{s.label}</span></div>
                    {mod && <Link to={`/modules/${mod.id}`} className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-glow"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: moduleColor(mod, k.layers) }} />{modName(s.moduleId)}</Link>}
                  </div>
                  <span className="shrink-0 rounded px-2 py-0.5 text-[10px]" style={{ backgroundColor: tone + '1a', color: tone }}>{s.type}</span>
                </div>
                {i < flow.steps.length - 1 && <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-ink-600" /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
