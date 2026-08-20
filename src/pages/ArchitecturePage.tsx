import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadKnowledge, moduleColor } from '../data';
import type { Knowledge, Module } from '../types';
import { Loading, SectionTitle } from '../components/ui';

const TIP_W = 340; // tooltip width used for viewport clamping

export default function ArchitecturePage() {
  const [k, setK] = useState<Knowledge | null>(null);
  const [hover, setHover] = useState<Module | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const tipRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => { loadKnowledge().then(setK); }, []);
  if (!k) return <Loading />;

  const sides = [...new Set(k.layers.map((l) => l.side))];

  // Clamp the floating card inside the viewport: flip above the cursor near the
  // bottom edge, and pull left near the right edge.
  const tipStyle = (): React.CSSProperties => {
    const margin = 14;
    const h = tipRef.current?.offsetHeight ?? 150;
    let left = pos.x + margin;
    if (left + TIP_W + margin > window.innerWidth) left = pos.x - TIP_W - margin;
    if (left < margin) left = margin;
    let top = pos.y + margin;
    if (top + h + margin > window.innerHeight) top = pos.y - h - margin;
    if (top < margin) top = margin;
    return { left, top, width: TIP_W };
  };

  return (
    <div className="space-y-6">
      <SectionTitle sub="自上而下：调用方在上、被调方在下。悬停查看模块摘要，点击进入详情（含关键源码片段）。">架构分层</SectionTitle>
      {sides.map((side) => {
        const layers = k.layers.filter((l) => l.side === side).sort((a, b) => a.ord - b.ord);
        return (
          <section key={side} className="tech-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-700/60 bg-ink-850/60 px-5 py-3">
              <h3 className="font-semibold text-slate-100">{side}</h3>
              <span className="chip">{k.modules.filter((m) => m.side === side).length} 个模块</span>
            </div>
            <div className="space-y-3 p-5">
              {layers.map((layer) => {
                const mods = k.modules.filter((m) => m.layer === layer.id);
                if (!mods.length) return null;
                return (
                  <div key={layer.id} className="flex flex-col gap-2 rounded-lg border border-ink-700/40 bg-ink-900/40 p-3 sm:flex-row sm:items-center">
                    <div className="flex w-full shrink-0 items-center gap-2 sm:w-48">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: layer.color }} />
                      <span className="text-sm font-medium text-slate-300">{layer.name}</span>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {mods.map((m) => (
                        <button key={m.id} onClick={() => nav(`/modules/${m.id}`)}
                          onMouseEnter={(e) => { setHover(m); setPos({ x: e.clientX, y: e.clientY }); }}
                          onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHover(null)}
                          className="group rounded-md border bg-ink-850/80 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow"
                          style={{ borderColor: moduleColor(m, k.layers) + '55' }}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: moduleColor(m, k.layers) }} />
                            <span className="text-sm font-medium text-slate-200">{m.name}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{m.files} 文件</span>
                            {m.endpoints > 0 && <span className="text-emerald-400/80">{m.endpoints} 接口</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {hover && (
        <div ref={tipRef} className="pointer-events-none fixed z-50 animate-fade-in rounded-xl border bg-ink-900/95 p-4 shadow-glow backdrop-blur-md"
          style={{ ...tipStyle(), borderColor: moduleColor(hover, k.layers) + '66' }}>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: moduleColor(hover, k.layers) }} />
            <span className="font-semibold text-slate-100">{hover.title}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span className="chip text-[10px]">{hover.name}</span>
            <span>{hover.files} 文件</span>
            <span>依赖 {hover.deps.length}</span>
            {(hover.snippets?.length ?? 0) > 0 && <span className="text-cyan-300/80">{hover.snippets.length} 段关键源码</span>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{hover.one_liner}</p>
          <p className="mt-2 text-[11px] text-slate-500">点击进入模块详情</p>
        </div>
      )}
    </div>
  );
}
