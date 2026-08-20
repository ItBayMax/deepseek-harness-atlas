import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers, GitBranch, Workflow, Boxes, Zap } from 'lucide-react';
import { loadKnowledge } from '../data';
import type { Knowledge } from '../types';
import { Stat, Loading } from '../components/ui';

export default function HomePage() {
  const [k, setK] = useState<Knowledge | null>(null);
  useEffect(() => { loadKnowledge().then(setK); }, []);
  if (!k) return <Loading />;
  const m = k.meta;
  const num = (key: string) => (m[key] != null ? String(m[key]) : '—');

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-ink-700/70 bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 p-8 lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-glow/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-glow/30 bg-cyan-glow/5 px-3 py-1 text-xs text-cyan-glow">
            <Zap className="h-3.5 w-3.5" /> 源码深度分析 · 架构学习地图
          </div>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-50 lg:text-4xl">
            DeepSeek Harness <span className="glow-text text-cyan-glow">架构学习知识库</span>
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            dsh 是一个「一切皆插件」的 agent 运行时：模型适配器、工具注册表、会话日志、甚至 agent 循环本身都是
            Cordis 插件。本站从宏观（分层、依赖脉络、核心流程）钻到微观（关键源码片段、单个文件），
            并排呈现<strong className="text-slate-200">官方文档</strong>与 <strong className="text-slate-200">Claude 解读文档</strong>。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/architecture" className="inline-flex items-center gap-2 rounded-lg bg-cyan-glow px-4 py-2 text-sm font-semibold text-ink-950 transition hover:shadow-glow-lg">
              <Layers className="h-4 w-4" /> 架构分层 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/docs" className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-glow/50 hover:bg-ink-800">
              <GitBranch className="h-4 w-4" /> 双源文档库
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="学习模块" value={num('modules')} accent="#38bdf8" />
          <Stat label="源文件（清单统计）" value={Number(num('files_total')).toLocaleString?.() ?? num('files_total')} accent="#a78bfa" />
          <Stat label="dsh 功能包（packages/*/*）" value={num('packages')} sub={`pnpm workspace 全成员 ${num('workspace_total')}`} accent="#34d399" />
          <Stat label="架构分层" value={k.layers.length} accent="#fbbf24" />
          <Stat label="设计模式" value={k.patterns.length} accent="#22d3ee" />
        </div>
      </section>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/architecture', icon: Layers, title: '架构分层', desc: '宿主 9 层 + 浏览器 2 层，点击模块钻取详情与关键源码', color: '#38bdf8' },
            { to: '/lineage', icon: GitBranch, title: '依赖脉络', desc: '模块依赖族谱：点亮任一模块的祖先与后代', color: '#34d399' },
            { to: '/flows', icon: Workflow, title: '核心流程', desc: '一次 turn 的旅程 · 工具守卫管线 · 启动组合 · 浏览器引导', color: '#fbbf24' },
            { to: '/docs', icon: Boxes, title: '双源文档库', desc: '官方文档（中文优先）+ Claude 解读文档，交叉印证', color: '#f472b6' },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="tech-card tech-card-hover group p-5">
              <c.icon className="h-6 w-6" style={{ color: c.color }} />
              <h4 className="mt-3 font-semibold text-slate-100">{c.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-500 transition group-hover:text-cyan-glow">进入 <ArrowRight className="h-3 w-3" /></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
