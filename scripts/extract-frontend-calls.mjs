// Client-side API/RPC/socket call extractor — best-effort. Emits {verb, url, file}.
// Pairs with extract-endpoints.mjs to build a caller↔callee map. Treat as CANDIDATES.
//
// Usage: node extract-frontend-calls.mjs
// Deps: Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';

const CONFIG = {
  repoRoot: process.env.REPO_ROOT || process.cwd(),
  // Client roots to scan (relative to repoRoot). Empty = whole repo minus excludes.
  scanDirs: [],
  out: process.env.FE_OUT || path.join(process.cwd(), 'docs/_meta/frontend-api-calls.json'),
  exclude: ['node_modules', 'dist', 'build', '.git', '__tests__', '__snapshots__', 'coverage'],
  ext: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.vue', '.svelte'],
  // Project-specific request helpers to also match, e.g. ['read','post','put','del','request'].
  helperVerbs: ['read', 'post', 'put', 'patch', 'del', 'get', 'request'],
};

const calls = [];
const verbMap = { get: 'GET', read: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', del: 'DELETE', delete: 'DELETE' };

function scan(file) {
  const rel = path.relative(CONFIG.repoRoot, file).replace(/\\/g, '/');
  let src; try { src = fs.readFileSync(file, 'utf8'); } catch { return; }

  // axios / fetch / helper(url, ...) with string or template-literal first arg
  const helpers = ['axios\\.get', 'axios\\.post', 'axios\\.put', 'axios\\.delete', 'axios\\.patch', 'fetch', ...CONFIG.helperVerbs];
  const re = new RegExp(`\\b(${helpers.join('|')})\\s*\\(\\s*(\`[^\`]+\`|'[^']+'|"[^"]+")`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    let url = m[2].slice(1, -1).replace(/\$\{[^}]+\}/g, '{var}');
    if (!url.startsWith('/') && !/^https?:|^api/.test(url)) continue; // drop non-URL strings
    const verb = verbMap[m[1].replace('axios.', '')] || (m[1] === 'fetch' ? 'FETCH' : 'CALL');
    calls.push({ verb, url, file: rel });
  }
  // socket/event emits
  const se = /\.emit\(\s*('[^']+'|"[^"]+")/g;
  while ((m = se.exec(src)) !== null) calls.push({ verb: 'EMIT', url: m[1].slice(1, -1), file: rel });
}

function walk(d) {
  let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    if (CONFIG.exclude.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (CONFIG.ext.includes(path.extname(e.name).toLowerCase())) scan(p);
  }
}

const roots = CONFIG.scanDirs.length ? CONFIG.scanDirs.map((d) => path.join(CONFIG.repoRoot, d)) : [CONFIG.repoRoot];
for (const r of roots) walk(r);

fs.mkdirSync(path.dirname(CONFIG.out), { recursive: true });
fs.writeFileSync(CONFIG.out, JSON.stringify(calls, null, 1));
const uniq = new Set(calls.filter((c) => c.verb !== 'EMIT').map((c) => c.verb + ' ' + c.url));
console.log('calls:', calls.length, '| unique http:', uniq.size, '| emits:', calls.filter((c) => c.verb === 'EMIT').length, '→', CONFIG.out);
