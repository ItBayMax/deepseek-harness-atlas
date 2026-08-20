import { Suspense, lazy, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, GitBranch, Boxes, Workflow, Cpu, Puzzle, BookOpen, FolderTree, Network, Menu, X, GitCommitHorizontal } from 'lucide-react';
import { Loading } from './components/ui';
import { loadKnowledge } from './data';
import type { Knowledge } from './types';

const HomePage = lazy(() => import('./pages/HomePage'));
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'));
const LineagePage = lazy(() => import('./pages/LineagePage'));
const ModulesPage = lazy(() => import('./pages/ModulesPage'));
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage'));
const FlowsPage = lazy(() => import('./pages/FlowsPage'));
const TechPage = lazy(() => import('./pages/TechPage'));
const PatternsPage = lazy(() => import('./pages/PatternsPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const BrowsePage = lazy(() => import('./pages/BrowsePage'));

const NAV = [
  { to: '/', icon: LayoutDashboard, label: '总览', end: true },
  { to: '/architecture', icon: Layers, label: '架构分层' },
  { to: '/lineage', icon: GitBranch, label: '依赖脉络' },
  { to: '/modules', icon: Boxes, label: '模块地图' },
  { to: '/flows', icon: Workflow, label: '核心流程' },
  { to: '/tech', icon: Cpu, label: '技术栈' },
  { to: '/patterns', icon: Puzzle, label: '设计模式' },
  { to: '/docs', icon: BookOpen, label: '文档库' },
  { to: '/browse', icon: FolderTree, label: '源码浏览' },
];

/** 全站常驻的分析基线徽章：一眼看到文档与数据基于上游哪个 release/commit。数据来自 extra-stats.json（经 knowledge.meta 透传），dsh-delta-sync 同步时随口径一起更新。 */
function BaselineBadge() {
  const [k, setK] = useState<Knowledge | null>(null);
  useEffect(() => { loadKnowledge().then(setK); }, []);
  const release = k?.meta['baseline_release'];
  if (!release) return null;
  const commit = String(k.meta['baseline_commit'] ?? '');
  const synced = k.meta['baseline_synced'];
  return (
    <div className="mx-3 mb-1 rounded-lg border border-cyan-glow/25 bg-cyan-glow/[.06] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-300/90">
        <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0" />
        <span>分析基线 {release}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
        <code className="font-mono text-slate-400">{commit.slice(0, 7)}</code>
        {synced && <span>同步于 {synced}</span>}
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside className={`fixed z-40 flex h-full w-64 flex-col border-r border-ink-700/70 bg-ink-900/95 backdrop-blur-md transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-ink-700/70 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-glow to-blue-600 shadow-glow">
            <Network className="h-5 w-5 text-ink-950" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 glow-text">DeepSeek Harness</div>
            <div className="text-[11px] text-slate-500">架构学习知识库</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <n.icon className="h-4 w-4 shrink-0" /><span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <BaselineBadge />
        <div className="border-t border-ink-700/70 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
          <div>基于源码深度分析构建</div>
          <div className="mt-0.5">SQLite 知识库 · 静态站点</div>
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="flex h-full bg-ink-950 bg-radial-glow">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-700/70 bg-ink-900/60 px-4 py-3 backdrop-blur-md lg:hidden">
          <button onClick={() => setOpen((v) => !v)} className="rounded-md p-1.5 text-slate-300 hover:bg-ink-800">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold text-slate-100">DeepSeek Harness 架构学习</span>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-5 py-6 lg:px-8 lg:py-8">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/architecture" element={<ArchitecturePage />} />
                <Route path="/lineage" element={<LineagePage />} />
                <Route path="/modules" element={<ModulesPage />} />
                <Route path="/modules/:id" element={<ModuleDetailPage />} />
                <Route path="/flows" element={<FlowsPage />} />
                <Route path="/tech" element={<TechPage />} />
                <Route path="/patterns" element={<PatternsPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/browse" element={<BrowsePage />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
