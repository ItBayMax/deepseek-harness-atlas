import { useEffect, useState } from 'react';
import { Folder, FileText, ChevronRight, Settings } from 'lucide-react';
import { SectionTitle } from '../components/ui';

// Live code/doc browser backed by the dev-server fs-API (vite.config.ts fsApiPlugin).
// Lets a reader point the site at the real repo and browse source + docs online.
// Under a static `dist/` deploy the API is absent → shows a graceful notice.

type Entry = { name: string; path: string; type: 'file' | 'directory'; sizeDisplay?: string; extension?: string };
type Root = 'src' | 'docs';

const api = {
  base: (root: Root) => (root === 'src' ? '/api' : '/api/docs'),
  async config() { return (await fetch('/api/config')).json(); },
  async setConfig(body: object) { return (await (await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()); },
  async list(root: Root, p: string) { return (await fetch(`${api.base(root)}/files?path=${encodeURIComponent(p)}`)).json(); },
  async read(root: Root, p: string) { return (await fetch(`${api.base(root)}/file?path=${encodeURIComponent(p)}`)).json(); },
};

export default function BrowsePage() {
  const [root, setRoot] = useState<Root>('src');
  const [cfg, setCfg] = useState<{ srcRoot: string | null; docRoot: string | null } | null>(null);
  const [srcInput, setSrcInput] = useState('');
  const [docInput, setDocInput] = useState('');
  const [cwd, setCwd] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.config().then((c) => { setCfg(c); setSrcInput(c.srcRoot || ''); setDocInput(c.docRoot || ''); }).catch(() => setApiDown(true)); }, []);
  const rootSet = root === 'src' ? cfg?.srcRoot : cfg?.docRoot;

  useEffect(() => { if (rootSet) openDir(''); else setEntries(null); /* eslint-disable-next-line */ }, [root, rootSet]);

  async function openDir(p: string) {
    setErr(''); setFile(null);
    const r = await api.list(root, p);
    if (r.error) { setErr(r.error); return; }
    setCwd(p); setEntries(r.entries);
  }
  async function openFile(p: string) {
    setErr('');
    const r = await api.read(root, p);
    if (r.error) { setErr(r.error); return; }
    setFile({ path: p, content: r.content });
  }
  async function save() {
    const r = await api.setConfig({ srcRoot: srcInput || undefined, docRoot: docInput || undefined });
    setCfg({ srcRoot: r.srcRoot, docRoot: r.docRoot });
    if (!r.valid) setErr(r.error || 'invalid path');
  }

  if (apiDown) return (
    <div><SectionTitle>Code browser</SectionTitle>
      <div className="tech-card p-6 text-sm text-slate-400">The file-system API is only available under the dev server (<code>npm run dev</code> / <code>npm run preview</code>). A static <code>dist/</code> deploy keeps the knowledge base and bundled docs, but not live-repo browsing.</div>
    </div>
  );

  const crumbs = cwd ? cwd.split('/') : [];

  return (
    <div className="space-y-5">
      <SectionTitle sub="Browse the real repository online. Set the source & doc roots, then explore + view files.">Code browser</SectionTitle>

      <div className="tech-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200"><Settings className="h-4 w-4" /> Roots</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={srcInput} onChange={(e) => setSrcInput(e.target.value)} placeholder="Source root (absolute path)" className="rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-glow/50" />
          <input value={docInput} onChange={(e) => setDocInput(e.target.value)} placeholder="Doc root (absolute path)" className="rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-glow/50" />
        </div>
        <button onClick={save} className="mt-2 rounded-lg bg-cyan-glow px-4 py-1.5 text-sm font-semibold text-ink-950 hover:shadow-glow">Save</button>
      </div>

      <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900/70 p-1 w-fit">
        {(['src', 'docs'] as Root[]).map((r) => (<button key={r} onClick={() => setRoot(r)} className={`rounded-md px-3 py-1.5 text-sm transition ${root === r ? 'bg-cyan-glow/15 text-cyan-glow' : 'text-slate-400 hover:text-slate-200'}`}>{r === 'src' ? 'Source' : 'Docs'}</button>))}
      </div>

      {!rootSet && <div className="tech-card p-6 text-sm text-slate-400">Set the {root === 'src' ? 'source' : 'doc'} root above to start browsing.</div>}
      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</div>}

      {rootSet && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="tech-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-ink-700/60 bg-ink-850/60 px-3 py-2 text-xs text-slate-400">
              <button className="hover:text-cyan-glow" onClick={() => openDir('')}>root</button>
              {crumbs.map((c, i) => (<span key={i} className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /><button className="hover:text-cyan-glow" onClick={() => openDir(crumbs.slice(0, i + 1).join('/'))}>{c}</button></span>))}
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {cwd && <button onClick={() => openDir(crumbs.slice(0, -1).join('/'))} className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-slate-400 hover:bg-ink-800/70">../</button>}
              {(entries || []).map((e) => (
                <button key={e.path} onClick={() => e.type === 'directory' ? openDir(e.path) : openFile(e.path)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-slate-300 hover:bg-ink-800/70">
                  {e.type === 'directory' ? <Folder className="h-3.5 w-3.5 text-cyan-glow/70" /> : <FileText className="h-3.5 w-3.5 text-slate-500" />}
                  <span className="truncate">{e.name}</span>
                  {e.sizeDisplay && <span className="ml-auto text-[10px] text-slate-600">{e.sizeDisplay}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="tech-card min-h-[60vh] overflow-hidden">
            {file ? (
              <>
                <div className="border-b border-ink-700/60 bg-ink-850/60 px-4 py-2 font-mono text-xs text-slate-400">{file.path}</div>
                <pre className="overflow-auto p-4 text-[12.5px] leading-relaxed text-slate-300"><code>{file.content}</code></pre>
              </>
            ) : <div className="flex h-full items-center justify-center text-sm text-slate-500">Select a file to view.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
