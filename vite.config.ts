import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

// Dev-server plugin: file-system APIs so the site can browse the real repository online.
// Configure a source root and a doc root at runtime; list dirs; read files (guarded).
// These endpoints exist only under `vite dev`/`preview`; a static `dist/` deploy still works
// (it keeps the exported knowledge JSON + bundled docs, just without live-repo browsing).
function fsApiPlugin(): Plugin {
  // Default roots for this workspace: browse the deepseek-harness source and the two doc sets.
  const defaultSrc = path.resolve(__dirname, '../../deepseek-harness');
  const defaultDoc = path.resolve(__dirname, '../..');
  let srcRoot: string | null = process.env.SRC_ROOT || (fs.existsSync(defaultSrc) ? defaultSrc : null);
  let docRoot: string | null = process.env.DOC_ROOT || (fs.existsSync(defaultDoc) ? defaultDoc : null);
  const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.pdf',
    '.zip', '.gz', '.tar', '.jar', '.class', '.exe', '.dll', '.so', '.woff', '.woff2', '.ttf', '.mp4', '.mp3', '.sqlite']);
  const MAX = 2 * 1024 * 1024;
  const human = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const safe = (root: string | null, p: string) => {
    if (!root) return null;
    const norm = path.normalize(p);
    if (norm.startsWith('..') || path.isAbsolute(norm)) return null;
    const resolved = path.resolve(root, norm);
    return resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
  };
  const json = (res: any, code: number, body: unknown) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  const listDir = (root: string | null, req: any, res: any) => {
    if (!root) return json(res, 400, { error: 'root not configured' });
    const rel = new URL(req.url, 'http://x').searchParams.get('path') || '';
    const abs = safe(root, rel);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return json(res, 404, { error: 'not a directory' });
    const entries = fs.readdirSync(abs, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') && d.name !== 'node_modules')
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
      .map((d) => {
        const full = path.join(abs, d.name); let size = 0;
        try { size = d.isFile() ? fs.statSync(full).size : 0; } catch { /* */ }
        return { name: d.name, path: path.relative(root, full).replace(/\\/g, '/'), type: d.isDirectory() ? 'directory' : 'file', size, sizeDisplay: d.isFile() ? human(size) : '', extension: d.isFile() ? path.extname(d.name).toLowerCase() : undefined };
      });
    json(res, 200, { path: rel, entries });
  };
  const readFile = (root: string | null, req: any, res: any) => {
    if (!root) return json(res, 400, { error: 'root not configured' });
    const rel = new URL(req.url, 'http://x').searchParams.get('path') || '';
    const abs = safe(root, rel);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return json(res, 404, { error: 'not a file' });
    const ext = path.extname(abs).toLowerCase();
    if (BINARY.has(ext)) return json(res, 400, { error: 'binary file' });
    const stat = fs.statSync(abs);
    if (stat.size > MAX) return json(res, 400, { error: 'file too large' });
    const content = fs.readFileSync(abs, 'utf8');
    json(res, 200, { path: rel, content, extension: ext, size: stat.size, sizeDisplay: human(stat.size), lineCount: content.split('\n').length });
  };
  return {
    name: 'fs-api',
    configureServer(server) {
      server.middlewares.use('/api/config', (req, res) => {
        if (req.method === 'GET') return json(res, 200, { srcRoot, docRoot });
        if (req.method === 'POST') {
          let body = ''; req.on('data', (c: Buffer) => (body += c)); req.on('end', () => {
            try {
              const d = JSON.parse(body || '{}'); const out: any = { valid: true };
              for (const key of ['srcRoot', 'docRoot'] as const) {
                if (typeof d[key] === 'string' && d[key]) {
                  const r = path.resolve(d[key]);
                  if (fs.existsSync(r) && fs.statSync(r).isDirectory()) { if (key === 'srcRoot') srcRoot = r; else docRoot = r; }
                  else { out.valid = false; out.error = `${key}: not a directory`; }
                }
              }
              out.srcRoot = srcRoot; out.docRoot = docRoot; json(res, 200, out);
            } catch { json(res, 400, { valid: false, error: 'bad json' }); }
          });
          return;
        }
        json(res, 405, { error: 'method not allowed' });
      });
      server.middlewares.use('/api/files', (req, res) => listDir(srcRoot, req, res));
      server.middlewares.use('/api/file', (req, res) => readFile(srcRoot, req, res));
      server.middlewares.use('/api/docs/files', (req, res) => listDir(docRoot, req, res));
      server.middlewares.use('/api/docs/file', (req, res) => readFile(docRoot, req, res));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), fsApiPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1600 },
});
