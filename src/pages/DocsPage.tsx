import { useEffect, useMemo, useState } from 'react';
import { FileText, ChevronRight, Search, Sparkles, BookOpen } from 'lucide-react';
import { loadDocsManifest, loadDoc } from '../data';
import type { DocManifestEntry } from '../types';
import { Loading, SectionTitle } from '../components/ui';
import Markdown from '../components/Markdown';

const SOURCE_META: Record<string, { label: string; icon: any; tone: string }> = {
  claude: { label: 'Claude 解读文档', icon: Sparkles, tone: '#22d3ee' },
  official: { label: '官方文档', icon: BookOpen, tone: '#34d399' },
};

const OFFICIAL_GROUP_LABEL: Record<string, string> = {
  '(root)': '总纲',
  subsystems: '子系统',
  cookbook: '实战手册',
  'cordis-tutorial': 'Cordis 教程',
  'cordis-api': 'Cordis API',
  user: '用户指南',
};

/** Sub-group inside a source: first dir under the source prefix ('(root)' for top-level files). */
function subGroupOf(p: string): string {
  const parts = p.split('/');
  return parts.length > 2 ? parts[1] : '(root)';
}

export default function DocsPage() {
  const [manifest, setManifest] = useState<DocManifestEntry[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadDocsManifest().then((mf) => {
      setManifest(mf);
      const top = mf.find((d) => d.path.startsWith('claude/00-')) || mf.find((d) => d.source === 'claude') || mf[0];
      if (top) setSel(top.path);
    });
  }, []);
  useEffect(() => { if (!sel) return; setDoc(null); loadDoc(sel).then(setDoc).catch(() => setDoc('# 文档加载失败')); }, [sel]);

  const navigateDoc = (href: string) => {
    if (!sel || !manifest) return;
    const rawPath = decodeURIComponent(href.split('#')[0]);
    const stack = sel.split('/').slice(0, -1);
    for (const p of rawPath.split('/')) { if (p === '..') stack.pop(); else if (p !== '.' && p !== '') stack.push(p); }
    const target = stack.join('/');
    if (manifest.some((d) => d.path === target)) { setSel(target); window.scrollTo({ top: 0 }); }
  };

  const bySource = useMemo(() => {
    if (!manifest) return {};
    const kw = q.trim().toLowerCase();
    const out: Record<string, Record<string, DocManifestEntry[]>> = {};
    for (const d of manifest) {
      if (kw && !(d.title + d.path).toLowerCase().includes(kw)) continue;
      const src = d.source || 'official';
      const grp = subGroupOf(d.path);
      ((out[src] = out[src] || {})[grp] = out[src][grp] || []).push(d);
    }
    for (const src of Object.keys(out)) for (const g of Object.keys(out[src])) out[src][g].sort((a, b) => a.path.localeCompare(b.path));
    return out;
  }, [manifest, q]);

  if (!manifest) return <Loading />;
  if (!manifest.length) return (<div><SectionTitle>文档库</SectionTitle><p className="text-sm text-slate-500">未找到文档。请运行 <code>npm run data</code> 同步 Markdown。</p></div>);

  const sourceOrder = ['claude', 'official'].filter((s) => bySource[s]);

  return (
    <div className="space-y-5">
      <SectionTitle sub={`共 ${manifest.length} 篇 · 左栏分「Claude 解读」与「官方文档（中文优先）」两部分 · 支持 mermaid 图`}>双源文档库</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索文档标题 / 路径…" className="w-full rounded-lg border border-ink-700 bg-ink-900/70 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-glow/50" />
          </div>
          <div className="space-y-5">
            {sourceOrder.map((src) => {
              const meta = SOURCE_META[src] || { label: src, icon: FileText, tone: '#94a3b8' };
              const groups = bySource[src];
              const groupKeys = Object.keys(groups).sort((a, b) => (a === '(root)' ? -1 : b === '(root)' ? 1 : a.localeCompare(b)));
              const total = groupKeys.reduce((s, g) => s + groups[g].length, 0);
              return (
                <div key={src} className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-3">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <meta.icon className="h-4 w-4" style={{ color: meta.tone }} />
                    <span className="text-sm font-bold" style={{ color: meta.tone }}>{meta.label}</span>
                    <span className="ml-auto rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-slate-400">{total}</span>
                  </div>
                  <div className="space-y-3">
                    {groupKeys.map((g) => (
                      <div key={g}>
                        {!(groupKeys.length === 1 && g === '(root)') && (
                          <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {src === 'official' ? (OFFICIAL_GROUP_LABEL[g] || g) : g === '(root)' ? '' : g}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {groups[g].map((d) => (
                            <button key={d.path} onClick={() => setSel(d.path)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${sel === d.path ? 'bg-cyan-glow/10 text-cyan-glow' : 'text-slate-400 hover:bg-ink-800/70 hover:text-slate-200'}`}>
                              <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{d.title}</span>{sel === d.path && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
        <div className="tech-card min-h-[60vh] p-6 lg:p-8">
          {sel && (
            <div className="mb-4 flex items-center gap-2 border-b border-ink-700/50 pb-3 text-xs text-slate-500">
              {(() => { const meta = SOURCE_META[sel.split('/')[0]]; return meta ? (<><meta.icon className="h-3.5 w-3.5" style={{ color: meta.tone }} /><span style={{ color: meta.tone }}>{meta.label}</span></>) : null; })()}
              <span className="font-mono">{sel}</span>
            </div>
          )}
          {doc ? <Markdown source={doc} onNavigateDoc={navigateDoc} /> : <Loading label="加载文档…" />}
        </div>
      </div>
    </div>
  );
}
