// Reusable Markdown renderer for the visualization site.
// - Renders mermaid diagrams (lazy-loaded, dark theme, graceful fallback on parse error).
// - HASH-ROUTER SAFE: assigns GitHub-style slug ids to headings and intercepts in-doc `#` anchor
//   clicks to smooth-scroll (a plain <a href="#x"> under HashRouter would be swallowed as a route).
// - Cross-doc `.md` links routed via onNavigateDoc; external http(s) links open in a new tab.
//
// Deps: marked, mermaid (lazy). Generic — no project-specific content.
import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';

let mermaidPromise: Promise<any> | null = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          background: '#0a0e1a', primaryColor: '#111a2e', primaryBorderColor: '#243450',
          primaryTextColor: '#e2e8f0', lineColor: '#38bdf8', fontSize: '13px',
        },
        securityLevel: 'loose',
        flowchart: { htmlLabels: true, curve: 'basis' },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

let mermaidSeq = 0;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

// GitHub-style slug: lowercase, drop punctuation (keep letters incl. CJK, digits, spaces, hyphens), spaces→hyphens.
function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N} \-_]/gu, '').replace(/\s+/g, '-');
}

export default function Markdown({ source, onNavigateDoc }: { source: string; onNavigateDoc?: (docPath: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const blocksRef = useRef<string[]>([]);

  // 1) Parse markdown; extract ```mermaid blocks to placeholders first (version-agnostic).
  useEffect(() => {
    const blocks: string[] = [];
    const withPlaceholders = source.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_m, code) => {
      const i = blocks.push(code) - 1;
      return `\n<div class="mermaid-slot" data-idx="${i}"></div>\n`;
    });
    blocksRef.current = blocks;
    marked.setOptions({ gfm: true, breaks: false });
    setHtml(marked.parse(withPlaceholders) as string);
  }, [source]);

  // 2) After DOM commit: add heading ids (for anchors) + render mermaid.
  useEffect(() => {
    const root = ref.current;
    if (!root || !html) return;
    let cancelled = false;

    const seen: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((h) => {
      let s = slugify(h.textContent || '');
      if (!s) return;
      if (seen[s] != null) { seen[s] += 1; s = `${s}-${seen[s]}`; } else { seen[s] = 0; }
      h.id = s;
      h.style.scrollMarginTop = '80px';
    });

    (async () => {
      const blocks = blocksRef.current;
      if (!blocks.length) return;
      const mermaid = await getMermaid();
      if (cancelled || !ref.current) return;
      for (const slot of Array.from(ref.current.querySelectorAll<HTMLElement>('.mermaid-slot'))) {
        const idx = Number(slot.dataset.idx);
        const code = blocks[idx];
        if (code == null || slot.dataset.rendered) continue;
        slot.dataset.rendered = '1';
        try {
          const { svg } = await mermaid.render(`mmd-${mermaidSeq++}`, code);
          if (cancelled) return;
          slot.innerHTML = svg;
        } catch {
          slot.innerHTML = `<pre class="md-pre"><code>${esc(code)}</code></pre>`;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [html]);

  // 3) Intercept link clicks: #anchor → smooth scroll; .md → onNavigateDoc; http(s) → new tab.
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) {
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      const el = ref.current?.querySelector(`[id="${CSS.escape(id)}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (/^https?:\/\//.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    if (href && !href.startsWith('mailto:') && (href.endsWith('.md') || href.includes('.md#'))) {
      e.preventDefault();
      onNavigateDoc?.(href);
    }
  };

  return <div ref={ref} className="md-body" onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
