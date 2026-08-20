// Multi-language file inventory generator — configured for the DeepSeek Harness repo.
// Walks each configured module root, catalogs every file with best-effort symbols,
// and writes one JSON per module under OUT. This is the ground truth for file coverage & counts.
//
// Usage: node gen-inventory.mjs
// Deps: Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------- CONFIG (dsh project) ----------------
const CONFIG = {
  // Absolute repo root: the deepseek-harness checkout.
  repoRoot: process.env.REPO_ROOT || path.resolve(__dirname, '../../deepseek-harness'),
  // Where to write inventory JSONs (inside the visualizer, consumed by build-knowledge-db.mjs).
  out: process.env.INV_OUT || path.resolve(__dirname, '../_meta/inventory'),
  // Directories to skip anywhere in the tree (build output, deps, vcs, etc.).
  exclude: ['target', 'build', 'dist', 'out', 'lib', 'node_modules', '.git', '.idea', '.gradle',
    '__pycache__', 'venv', '.venv', 'obj', 'coverage', '.turbo', '.cache'],
  // Modules to inventory. `dir` (string) or `dirs` (string[]) relative to repoRoot.
  modules: [
    { name: 'apps-cli', dir: 'apps/cli' },
    { name: 'apps-web', dir: 'apps/web' },
    { name: 'boot', dir: 'packages/boot' },
    { name: 'bundle', dir: 'packages/bundle' },
    { name: 'preset', dir: 'packages/preset' },
    { name: 'vendor', dir: 'vendor' },
    { name: 'core', dir: 'packages/core' },
    { name: 'llm', dir: 'packages/llm' },
    { name: 'compaction', dir: 'packages/compaction' },
    { name: 'context', dir: 'packages/context' },
    { name: 'fs', dir: 'packages/fs' },
    { name: 'shell', dir: 'packages/shell' },
    { name: 'subprocess', dir: 'packages/subprocess' },
    { name: 'terminal', dir: 'packages/terminal' },
    { name: 'sandbox', dir: 'packages/sandbox' },
    { name: 'e2b', dir: 'packages/e2b' },
    { name: 'native', dir: 'native' },
    { name: 'code-runtime', dir: 'packages/code-runtime' },
    { name: 'experimental', dir: 'packages/experimental' },
    { name: 'lsp', dir: 'packages/lsp' },
    { name: 'skill', dir: 'packages/skill' },
    { name: 'subagent', dir: 'packages/subagent' },
    { name: 'workflow', dir: 'packages/workflow' },
    { name: 'jobs', dir: 'packages/jobs' },
    { name: 'goal', dir: 'packages/goal' },
    { name: 'plan', dir: 'packages/plan' },
    { name: 'todo', dir: 'packages/todo' },
    { name: 'schedule', dir: 'packages/schedule' },
    { name: 'guard', dir: 'packages/guard' },
    { name: 'web', dir: 'packages/web' },
    { name: 'spill', dir: 'packages/spill' },
    { name: 'interaction', dir: 'packages/interaction' },
    { name: 'feedback', dir: 'packages/feedback' },
    { name: 'hooks', dir: 'packages/hooks' },
    { name: 'session-pkg', dir: 'packages/session' },
    { name: 'session-query', dir: 'packages/session-query' },
    { name: 'storage', dir: 'packages/storage' },
    { name: 'settings', dir: 'packages/settings' },
    { name: 'credentials', dir: 'packages/credentials' },
    { name: 'identity', dir: 'packages/identity' },
    { name: 'attachment', dir: 'packages/attachment' },
    { name: 'workspace', dir: 'packages/workspace' },
    { name: 'host', dir: 'packages/host' },
    { name: 'api', dir: 'packages/api' },
    { name: 'typert', dir: 'packages/typert' },
    { name: 'sdk', dir: 'packages/sdk' },
    { name: 'acp', dir: 'packages/acp' },
    { name: 'mcp', dir: 'packages/mcp' },
    { name: 'python', dir: 'python' },
    { name: 'extensions', dir: 'packages/extensions' },
    { name: 'examples-root', dir: 'examples' },
    { name: 'examples-pkg', dir: 'packages/examples' },
    { name: 'util', dir: 'packages/util' },
    { name: 'test-support', dir: 'packages/test-support' },
    { name: 'runtime-diagnostics', dir: 'packages/runtime-diagnostics' },
    // packages/client split: kernel (non ui-*) vs UI plugin family (ui-*), computed below.
    { name: 'client-kernel', dirs: () => clientSplit().kernel },
    { name: 'client-ui', dirs: () => clientSplit().ui },
  ],
  // Max bytes to read for symbol parsing (skip huge files).
  maxParseBytes: 2_000_000,
};

function clientSplit() {
  const base = path.join(CONFIG.repoRoot, 'packages/client');
  const subs = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
  const kernel = [], ui = [];
  for (const e of subs) (e.name.startsWith('ui-') ? ui : kernel).push(`packages/client/${e.name}`);
  return { kernel, ui };
}

const CODE_EXT = new Set(['.java', '.kt', '.scala', '.groovy', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.go', '.rb', '.rs', '.cs', '.php', '.c', '.cc', '.cpp', '.h', '.hpp', '.swift', '.g4']);

function listFiles(dir) {
  const out = [];
  (function walk(d) {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (CONFIG.exclude.includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    }
  })(dir);
  return out;
}

// ---- language-agnostic-ish symbol extraction (best effort) ----
function parseWeb(src) {
  const o = {};
  const exps = [...new Set((src.match(/export\s+(?:default\s+)?(?:const|function|class|let|var|abstract\s+class)\s+(\w+)/g) || [])
    .map(s => s.replace(/export\s+(?:default\s+)?(?:const|function|class|let|var|abstract\s+class)\s+/, '')))].slice(0, 15);
  if (/export\s+default/.test(src)) exps.unshift('(default)');
  if (exps.length) o.exports = exps;
  const fc = src.match(/^\s*\/\/\s*(.+)|^\s*\/\*+([\s\S]*?)\*\//);
  if (fc) o.doc = (fc[1] || fc[2] || '').replace(/\n\s*\*?\s?/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  return o;
}
function parsePy(src) {
  const o = {};
  const cls = [...new Set((src.match(/^\s*class\s+(\w+)/gm) || []).map(s => s.replace(/^\s*class\s+/, '')))].slice(0, 10);
  const fns = [...new Set((src.match(/^\s*def\s+(\w+)/gm) || []).map(s => s.replace(/^\s*def\s+/, '')))].slice(0, 20);
  if (cls.length) o.classes = cls;
  if (fns.length) o.methods = fns;
  return o;
}
function parseGeneric(src) {
  const o = {};
  const fc = src.match(/^\s*(?:\/\/|#)\s*(.+)/);
  if (fc) o.doc = fc[1].trim().slice(0, 140);
  return o;
}
function symbolsFor(ext, src) {
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) return parseWeb(src);
  if (ext === '.py') return parsePy(src);
  return parseGeneric(src);
}

function inventory(rootDirs) {
  const files = rootDirs.flatMap((d) => listFiles(path.join(CONFIG.repoRoot, d)));
  return files.map((f) => {
    const rel = path.relative(CONFIG.repoRoot, f).replace(/\\/g, '/');
    const ext = path.extname(f).toLowerCase();
    const stat = fs.statSync(f);
    const entry = { f: rel, size: stat.size };
    if (CODE_EXT.has(ext) && stat.size < CONFIG.maxParseBytes) {
      try { const src = fs.readFileSync(f, 'utf8'); entry.loc = src.split('\n').length; Object.assign(entry, symbolsFor(ext, src)); } catch { /* binary/unreadable */ }
    }
    return entry;
  });
}

// ---- run ----
fs.mkdirSync(CONFIG.out, { recursive: true });
let total = 0;
for (const mod of CONFIG.modules) {
  const dirs = typeof mod.dirs === 'function' ? mod.dirs() : mod.dirs || [mod.dir];
  const inv = inventory(dirs);
  total += inv.length;
  fs.writeFileSync(path.join(CONFIG.out, `${mod.name}.json`), JSON.stringify(inv));
  console.log(`${mod.name}: ${inv.length} files`);
}
console.log(`\nTotal: ${total} files → ${CONFIG.out}`);
