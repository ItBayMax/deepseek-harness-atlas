import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileCode2, Boxes, AlertTriangle, GitBranch, Puzzle, BookOpen, Code2 } from 'lucide-react';
import { loadKnowledge, loadDoc, loadEndpoints, moduleColor } from '../data';
import type { Knowledge, Module, Endpoint, Snippet } from '../types';
import { Loading } from '../components/ui';
import Markdown from '../components/Markdown';

export default function ModuleDetailPage() {
  const { id } = useParams();
  const [k, setK] = useState<Knowledge | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [docErr, setDocErr] = useState(false);
  const [eps, setEps] = useState<Endpoint[] | null>(null);
  const [tab, setTab] = useState<'overview' | 'snippets' | 'doc' | 'endpoints'>('overview');
  useEffect(() => { loadKnowledge().then(setK); }, []);
  const m: Module | undefined = k?.modules.find((x) => x.id === id);

  useEffect(() => {
    if (!m) return;
    setDoc(null); setDocErr(false); setEps(null); setTab('overview');
    loadDoc(m.doc).then(setDoc).catch(() => setDocErr(true));
    loadEndpoints().then((all) => setEps(all[m.id] || []));
  }, [m?.id]);

  if (!k) return <Loading />;
  if (!m) return <div className="py-16 text-center text-slate-500">未找到模块 <code>{id}</code>。<Link to="/modules" className="text-cyan-glow">返回</Link></div>;
  const c = moduleColor(m, k.layers);
  const depMods = m.deps.map((d) => k.modules.find((x) => x.id === d)).filter(Boolean) as Module[];
  const dependents = k.modules.filter((x) => x.deps.includes(m.id));
  const snippets: Snippet[] = m.snippets || [];

  const tabs: [typeof tab, string][] = [['overview', '总览']];
  if (snippets.length) tabs.push(['snippets', `关键源码 (${snippets.length})`]);
  tabs.push(['doc', '关联文档']);
  if (eps && eps.length > 0) tabs.push(['endpoints', `接口 (${eps.length})`]);

  return (
    <div className="space-y-6">
      <Link to="/modules" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-glow"><ArrowLeft className="h-4 w-4" /> 返回模块地图</Link>
      <div className="tech-card p-6" style={{ borderColor: c + '44' }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} />
          <h1 className="text-2xl font-bold text-slate-50">{m.title}</h1>
          <span className="chip">{m.name}</span>
          <span className="rounded px-2 py-0.5 text-xs bg-ink-800 text-slate-300">{m.side}</span>
        </div>
        <p className="mt-3 max-w-3xl text-slate-300">{m.one_liner}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
          <span className="inline-flex items-center gap-1.5"><FileCode2 className="h-4 w-4" />{m.files} 个文件</span>
          {snippets.length > 0 && <span className="inline-flex items-center gap-1.5 text-cyan-300/90"><Code2 className="h-4 w-4" />{snippets.length} 段关键源码</span>}
          <span className="inline-flex items-center gap-1.5"><GitBranch className="h-4 w-4" />依赖 {m.deps.length} · 被依赖 {dependents.length}</span>
        </div>
        {m.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{m.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-ink-700/60">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm transition ${tab === key ? 'border-cyan-glow text-cyan-glow' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel icon={FileCode2} title="关键类 / 文件"><div className="flex flex-wrap gap-2">{m.key_classes.map((x) => <code key={x} className="rounded bg-ink-800 px-2 py-1 text-xs text-cyan-300">{x}</code>)}</div></Panel>
          <Panel icon={Puzzle} title="设计模式"><div className="flex flex-wrap gap-2">{m.patterns.map((p) => <span key={p} className="chip">{p}</span>)}</div></Panel>
          <Panel icon={GitBranch} title={`依赖 (${depMods.length})`}>{depMods.length ? <div className="flex flex-wrap gap-2">{depMods.map((d) => <Link key={d.id} to={`/modules/${d.id}`} className="chip hover:border-cyan-glow/50 hover:text-cyan-glow">{d.name}</Link>)}</div> : <span className="text-sm text-slate-500">无</span>}</Panel>
          <Panel icon={GitBranch} title={`被依赖 (${dependents.length})`}>{dependents.length ? <div className="flex flex-wrap gap-2">{dependents.map((d) => <Link key={d.id} to={`/modules/${d.id}`} className="chip hover:border-amber-300/50 hover:text-amber-300">{d.name}</Link>)}</div> : <span className="text-sm text-slate-500">无</span>}</Panel>
          <div className="lg:col-span-2"><Panel icon={AlertTriangle} title="要点与陷阱" tone><ul className="space-y-2">{m.risks.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{r}</li>)}</ul></Panel></div>
          <div className="lg:col-span-2 flex flex-wrap gap-3">
            {snippets.length > 0 && <button onClick={() => setTab('snippets')} className="inline-flex items-center gap-2 rounded-lg border border-cyan-glow/40 bg-cyan-glow/5 px-4 py-2 text-sm text-cyan-glow hover:bg-cyan-glow/10"><Code2 className="h-4 w-4" /> 看关键源码片段</button>}
            <button onClick={() => setTab('doc')} className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-4 py-2 text-sm text-slate-200 hover:border-cyan-glow/50"><BookOpen className="h-4 w-4" /> 读关联文档</button>
          </div>
        </div>
      )}

      {tab === 'snippets' && (
        <div className="space-y-5">
          {snippets.map((s, i) => (
            <div key={i} className="tech-card overflow-hidden">
              <div className="border-b border-ink-700/60 bg-ink-850/60 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Code2 className="h-4 w-4 text-cyan-glow" />
                  <span className="font-semibold text-slate-100">{s.title}</span>
                  <code className="ml-auto rounded bg-ink-800 px-2 py-0.5 text-[11px] text-emerald-300/90">{s.file}</code>
                </div>
                {s.note && <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.note}</p>}
              </div>
              <pre className="overflow-x-auto bg-ink-950/70 p-5 text-xs leading-relaxed text-slate-200"><code>{s.code}</code></pre>
            </div>
          ))}
        </div>
      )}

      {tab === 'doc' && (
        <div className="tech-card p-6 lg:p-8">
          <div className="mb-4 border-b border-ink-700/50 pb-3 text-xs text-slate-500">来源：<code className="text-slate-400">{m.doc}</code>（{m.doc.startsWith('claude/') ? 'Claude 解读文档' : '官方文档'}，完整双源目录见「文档库」页）</div>
          {doc ? <Markdown source={doc} /> : docErr ? <div className="text-slate-500">未找到文档：<code>{m.doc}</code></div> : <Loading label="加载文档…" />}
        </div>
      )}

      {tab === 'endpoints' && (
        <div className="tech-card overflow-hidden">
          {eps === null ? <Loading /> : eps.length === 0 ? <div className="p-8 text-center text-slate-500">该模块未录入接口。</div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-ink-700/60 bg-ink-850/60 text-left text-xs uppercase text-slate-400"><th className="px-4 py-2">方法</th><th className="px-4 py-2">路径</th><th className="px-4 py-2">单元</th><th className="px-4 py-2">处理器</th></tr></thead>
              <tbody>{eps.slice(0, 500).map((e, i) => (
                <tr key={i} className="border-b border-ink-700/30 hover:bg-ink-850/40">
                  <td className="px-4 py-1.5"><span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">{e.http}</span></td>
                  <td className="px-4 py-1.5 font-mono text-xs text-slate-300">{e.path}</td>
                  <td className="px-4 py-1.5 text-xs text-slate-400">{e.unit}</td>
                  <td className="px-4 py-1.5 font-mono text-xs text-cyan-300/80">{e.handler}</td>
                </tr>))}
              </tbody></table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({ icon: Icon, title, children, tone }: { icon: any; title: string; children: any; tone?: boolean }) {
  return (
    <div className="tech-card p-5">
      <div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${tone ? 'text-amber-300' : 'text-slate-200'}`}><Icon className="h-4 w-4" /> {title}</div>
      {children}
    </div>
  );
}
