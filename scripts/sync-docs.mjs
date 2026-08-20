// Copy Markdown docs into the visualization site from TWO sources and build a manifest:
//   claude/   — Claude 解读文档 (deepseek-ai/docs)
//   official/ — 官方文档 (deepseek-harness/docs, 中文优先: prefer .zh.md, fall back to .md)
//
// Usage: node sync-docs.mjs
// Deps: Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = {
  sources: [
    {
      key: 'claude',
      label: 'Claude 解读文档',
      root: process.env.CLAUDE_DOCS_ROOT || path.resolve(__dirname, '../../docs'),
      zhPreferred: false,
    },
    {
      key: 'official',
      label: '官方文档',
      root: process.env.OFFICIAL_DOCS_ROOT || path.resolve(__dirname, '../../deepseek-harness/docs'),
      // Keep .zh.md; keep .md only when no .zh.md sibling exists.
      zhPreferred: true,
    },
  ],
  publicDir: process.env.PUBLIC_DIR || path.resolve(__dirname, '../public'),
  skipDirs: ['node_modules', '.git', 'dist', '_meta', 'i18n', 'postmortem'],
};

const OUT = path.join(CONFIG.publicDir, 'docs');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
for (const src of CONFIG.sources) {
  if (!fs.existsSync(src.root)) { console.warn(`WARN: docs root missing: ${src.root}`); continue; }
  (function copyMd(srcDir, rel = '') {
    let entries;
    try { entries = fs.readdirSync(srcDir, { withFileTypes: true }); } catch { return; }
    const names = new Set(entries.map((e) => e.name));
    for (const e of entries) {
      if (CONFIG.skipDirs.includes(e.name)) continue;
      const abs = path.join(srcDir, e.name);
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) { copyMd(abs, r); continue; }
      if (!e.name.endsWith('.md')) continue;
      if (src.zhPreferred && !e.name.endsWith('.zh.md')) {
        // plain .md with a .zh.md sibling → skip (Chinese-first)
        const zhSibling = e.name.replace(/\.md$/, '.zh.md');
        if (names.has(zhSibling)) continue;
      }
      const dst = path.join(OUT, src.key, r);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(abs, dst);
      count++;
    }
  })(src.root);
}

const manifest = [];
(function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else if (e.name.endsWith('.md')) {
      const content = fs.readFileSync(path.join(dir, e.name), 'utf8');
      const title = (content.match(/^#\s+(.+)$/m) || [])[1] || e.name;
      manifest.push({ path: r, title: title.trim(), size: content.length, source: r.split('/')[0] });
    }
  }
})(OUT);

fs.mkdirSync(path.join(CONFIG.publicDir, 'data'), { recursive: true });
fs.writeFileSync(path.join(CONFIG.publicDir, 'data', 'docs-manifest.json'), JSON.stringify(manifest));
console.log(`synced ${count} docs → ${OUT}; manifest ${manifest.length} entries`);
