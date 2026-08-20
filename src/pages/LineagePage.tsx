import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadKnowledge, moduleColor } from '../data';
import type { Knowledge, Module, Relation } from '../types';
import { Loading, SectionTitle } from '../components/ui';

interface Node { m: Module; x: number; y: number; }
const NODE_W = 150, NODE_H = 40, COL_GAP = 210, ROW_GAP = 54;

export default function LineagePage() {
  const [k, setK] = useState<Knowledge | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const nav = useNavigate();
  useEffect(() => { loadKnowledge().then(setK); }, []);

  const layout = useMemo(() => {
    if (!k) return null;
    const layerOrder = [...k.layers].sort((a, b) => a.ord - b.ord);
    const nodes: Record<string, Node> = {};
    let maxRows = 0;
    layerOrder.forEach((l, ci) => {
      const mods = k.modules.filter((m) => m.layer === l.id);
      mods.forEach((m, ri) => { nodes[m.id] = { m, x: ci * COL_GAP + 20, y: ri * ROW_GAP + 20 }; });
      maxRows = Math.max(maxRows, mods.length);
    });
    return { nodes, width: layerOrder.length * COL_GAP + 40, height: maxRows * ROW_GAP + 40, layerOrder };
  }, [k]);

  if (!k || !layout) return <Loading />;
  const { nodes, width, height, layerOrder } = layout;
  const rels: Relation[] = k.relations;
  const related = new Set<string>();
  const activeEdges = new Set<string>();
  if (focus) {
    related.add(focus);
    const up = (id: string) => rels.filter((r) => r.from_id === id).forEach((r) => { activeEdges.add(r.from_id + '>' + r.to_id); if (!related.has(r.to_id)) { related.add(r.to_id); up(r.to_id); } });
    const down = (id: string) => rels.filter((r) => r.to_id === id).forEach((r) => { activeEdges.add(r.from_id + '>' + r.to_id); if (!related.has(r.from_id)) { related.add(r.from_id); down(r.from_id); } });
    up(focus); down(focus);
  }
  const edgePath = (a: Node, b: Node) => {
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2, mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="space-y-4">
      <SectionTitle sub="箭头 A→B 表示 A 依赖/调用 B。单击节点点亮其完整脉络（祖先+后代），再点取消；双击进入模块详情。">
        依赖脉络
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {layerOrder.map((l) => (<span key={l.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />{l.name}</span>))}
      </div>
      <div className="tech-card overflow-auto p-4">
        <svg width={width} height={height} className="min-w-full">
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" fill="#38bdf8" /></marker>
            <marker id="arrd" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" fill="#334155" /></marker>
          </defs>
          {rels.map((r, i) => {
            const a = nodes[r.from_id], b = nodes[r.to_id]; if (!a || !b) return null;
            const strong = !!focus && activeEdges.has(r.from_id + '>' + r.to_id);
            const dim = !!focus && !strong;
            return <path key={i} d={edgePath(a, b)} fill="none" stroke={strong ? '#22d3ee' : dim ? '#1a2740' : '#2b3a54'} strokeWidth={strong ? 2 : 1} strokeDasharray={r.type === 'data-flow' ? '4 3' : undefined} opacity={dim ? 0.25 : 0.9} markerEnd={strong ? 'url(#arr)' : 'url(#arrd)'} />;
          })}
          {Object.values(nodes).map(({ m, x, y }) => {
            const dim = !!focus && !related.has(m.id); const isFocus = focus === m.id; const c = moduleColor(m, k.layers);
            return (
              <g key={m.id} transform={`translate(${x},${y})`} className="cursor-pointer" opacity={dim ? 0.28 : 1} onClick={() => setFocus(isFocus ? null : m.id)} onDoubleClick={() => nav(`/modules/${m.id}`)}>
                <rect width={NODE_W} height={NODE_H} rx={7} fill={isFocus ? c : '#0d1424'} stroke={c} strokeWidth={isFocus ? 2.5 : 1.3} />
                <circle cx={12} cy={NODE_H / 2} r={4} fill={c} />
                <text x={24} y={NODE_H / 2 - 2} fill={isFocus ? '#05070d' : '#e2e8f0'} fontSize={11} fontWeight={600}>{m.name.length > 17 ? m.name.slice(0, 16) + '…' : m.name}</text>
                <text x={24} y={NODE_H / 2 + 11} fill={isFocus ? '#05070daa' : '#64748b'} fontSize={9}>{m.files} 文件{m.endpoints ? ` · ${m.endpoints} 接口` : ''}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {focus && (() => {
        const m = k.modules.find((x) => x.id === focus)!;
        const deps = k.relations.filter((r) => r.from_id === focus);
        const depd = k.relations.filter((r) => r.to_id === focus);
        const name = (id: string) => k.modules.find((x) => x.id === id)?.name || id;
        return (
          <div className="tech-card animate-fade-in p-5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: moduleColor(m, k.layers) }} />
              <button className="font-semibold text-slate-100 hover:text-cyan-glow" onClick={() => nav(`/modules/${m.id}`)}>{m.title}</button>
              <span className="chip">{m.name}</span><span className="text-xs text-slate-500">脉络覆盖 {related.size} 个模块</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{m.one_liner}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-glow">依赖 ({deps.length})</div>
                <div className="flex flex-wrap gap-2">{deps.length ? deps.map((d, i) => <button key={i} onClick={() => nav(`/modules/${d.to_id}`)} className="chip hover:border-cyan-glow/50 hover:text-cyan-glow">{name(d.to_id)}</button>) : <span className="text-xs text-slate-600">无</span>}</div></div>
              <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">被依赖 ({depd.length})</div>
                <div className="flex flex-wrap gap-2">{depd.length ? depd.map((d, i) => <button key={i} onClick={() => nav(`/modules/${d.from_id}`)} className="chip hover:border-amber-300/50 hover:text-amber-300">{name(d.from_id)}</button>) : <span className="text-xs text-slate-600">无</span>}</div></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
