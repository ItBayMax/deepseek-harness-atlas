// Backend route/endpoint extractor — multi-framework, best-effort.
// Emits records {module, unit, http, path, handler, file}. Treat as CANDIDATES to verify.
//
// Usage: node extract-endpoints.mjs
// Deps: Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';

const CONFIG = {
  repoRoot: process.env.REPO_ROOT || process.cwd(),
  out: process.env.EP_OUT || path.join(process.cwd(), 'docs/_meta/endpoints.json'),
  exclude: ['target', 'build', 'dist', 'out', 'node_modules', '.git', 'generated', 'gen'],
  // File extensions to scan.
  ext: ['.java', '.kt', '.scala', '.ts', '.js', '.py', '.go', '.rb', '.cs'],
  // Skip modules/paths known to contain generated/sample routes (phantoms).
  skipPathContains: [],
};

const results = [];

// Framework patterns. Each returns [{http, path, handler}] for a file.
const patterns = [
  // Spring MVC / Java: class-level @RequestMapping prefix + method @GetMapping("/x") etc.
  function spring(src) {
    if (!/@(Rest)?Controller|@RequestMapping|@(Get|Post|Put|Delete|Patch)Mapping/.test(src)) return [];
    let classPrefix = '';
    const clsIdx = src.search(/\b(class|interface)\s+\w+/);
    const header = src.slice(0, clsIdx < 0 ? 0 : clsIdx);
    const hp = header.match(/@RequestMapping\s*\((?:[^)]*?(?:value|path)\s*=\s*)?["']([^"']+)["']/);
    if (hp) classPrefix = hp[1];
    const body = src.slice(clsIdx < 0 ? 0 : clsIdx);
    const out = [];
    const re = /@(RequestMapping|Get|Post|Put|Delete|Patch)Mapping\s*(\(([^)]*)\))?/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const ann = m[1]; const args = m[3] || '';
      const pm = args.match(/(?:value|path)?\s*=?\s*["']([^"']+)["']/) || args.match(/\{?\s*["']([^"']+)["']/);
      const p = pm ? pm[1] : '';
      let http = ann === 'RequestMapping' ? (args.match(/RequestMethod\.(\w+)/)?.[1] || 'ANY') : ann.toUpperCase();
      const after = body.slice(m.index, m.index + 600);
      const hn = after.match(/(?:public|protected|private|fun|def)[^;{(]*?\b(\w+)\s*\(/);
      out.push({ http, path: ('/' + [classPrefix, p].filter(Boolean).join('/')).replace(/\/+/g, '/'), handler: hn ? hn[1] : '' });
    }
    return out;
  },
  // Express / Koa / Nest-ish JS: app.get('/x', ...), router.post(`/x`, ...)
  function express(src) {
    const out = []; const re = /\b(?:app|router)\.(get|post|put|delete|patch|all)\s*\(\s*(["'`])([^"'`]+)\2/g;
    let m; while ((m = re.exec(src)) !== null) out.push({ http: m[1].toUpperCase(), path: m[3], handler: '' });
    // Nest decorators: @Get('x')
    const re2 = /@(Get|Post|Put|Delete|Patch)\s*\(\s*(["'`])([^"'`]*)\2?\s*\)/g;
    while ((m = re2.exec(src)) !== null) out.push({ http: m[1].toUpperCase(), path: m[3] || '/', handler: '' });
    return out;
  },
  // Flask/FastAPI Python: @app.route('/x'), @router.get('/x')
  function python(src) {
    const out = [];
    let m; const re = /@(?:app|router|blueprint|\w+)\.(get|post|put|delete|patch|route)\s*\(\s*(["'])([^"']+)\2([^)]*)/g;
    while ((m = re.exec(src)) !== null) {
      let http = m[1].toUpperCase();
      if (http === 'ROUTE') { const mm = m[4].match(/methods\s*=\s*\[([^\]]*)\]/); http = mm ? mm[1].replace(/["'\s]/g, '') : 'GET'; }
      out.push({ http, path: m[3], handler: '' });
    }
    return out;
  },
  // Go (gin/echo/chi): r.GET("/x", handler)
  function golang(src) {
    const out = []; const re = /\.\s*(GET|POST|PUT|DELETE|PATCH|Handle(?:Func)?)\s*\(\s*"([^"]+)"/g;
    let m; while ((m = re.exec(src)) !== null) out.push({ http: m[1].replace('HandleFunc', 'ANY').replace('Handle', 'ANY'), path: m[2], handler: '' });
    return out;
  },
];

function moduleOf(rel) { return rel.split('/')[0]; }

function scan(file) {
  const rel = path.relative(CONFIG.repoRoot, file).replace(/\\/g, '/');
  if (CONFIG.skipPathContains.some((s) => rel.includes(s))) return;
  let src; try { src = fs.readFileSync(file, 'utf8'); } catch { return; }
  const eps = [];
  for (const p of patterns) { try { eps.push(...p(src)); } catch { /* ignore */ } }
  if (!eps.length) return;
  const mod = moduleOf(rel);
  const unit = path.basename(file).replace(/\.\w+$/, '');
  for (const e of eps) results.push({ module: mod, unit, http: e.http, path: e.path, handler: e.handler, file: rel });
}

(function walk(d) {
  let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    if (CONFIG.exclude.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (CONFIG.ext.includes(path.extname(e.name).toLowerCase())) scan(p);
  }
})(CONFIG.repoRoot);

fs.mkdirSync(path.dirname(CONFIG.out), { recursive: true });
fs.writeFileSync(CONFIG.out, JSON.stringify(results, null, 1));
const byMod = {}; for (const r of results) byMod[r.module] = (byMod[r.module] || 0) + 1;
console.log('endpoints:', results.length, '→', CONFIG.out);
console.log(JSON.stringify(byMod, null, 1));
