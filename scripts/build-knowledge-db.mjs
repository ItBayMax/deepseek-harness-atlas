// Build a SQLite knowledge base from a curated dataset, then export browser-consumable JSON.
// File & interface counts are computed from the inventory (single source of truth), NOT hand-typed.
//
// Usage: node build-knowledge-db.mjs
// Deps: node:sqlite (Node 22+ built-in). Run node with --experimental-sqlite if your version warns.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Curated dataset (see modules-data.template.mjs). Provide these named exports.
import { LAYERS, MODULES, RELATIONS, DATAFLOWS, TECH, PATTERNS, FILE_MAP, SNIPPETS } from './modules-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = {
  // Where inventory JSONs live (from gen-inventory.mjs).
  inventoryDir: process.env.INV_OUT || path.resolve(__dirname, '../_meta/inventory'),
  // Optional endpoints.json (from extract-endpoints.mjs) for interface counts.
  endpointsFile: process.env.EP_OUT || path.resolve(__dirname, '../_meta/endpoints.json'),
  // Site public dir.
  publicDir: process.env.PUBLIC_DIR || path.resolve(__dirname, '../public'),
};

const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const invLen = (name) => readJson(path.join(CONFIG.inventoryDir, name + '.json'), []).length;

// Authoritative file count for a module: sum of its FILE_MAP inventory parts (fallback to dataset value).
function fileCount(m) {
  const parts = FILE_MAP && FILE_MAP[m.id];
  if (Array.isArray(parts) && parts.length) return parts.reduce((s, n) => s + invLen(n), 0);
  return m.files || 0;
}
// Interface count from endpoints.json (by module match), fallback to dataset value.
const endpoints = readJson(CONFIG.endpointsFile, []);
const epByModule = {};
for (const e of endpoints) epByModule[e.module] = (epByModule[e.module] || 0) + 1;

const dataDir = path.join(CONFIG.publicDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(CONFIG.publicDir, 'knowledge.sqlite');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
const db = new DatabaseSync(dbPath);
db.exec(`
CREATE TABLE layer(id TEXT PRIMARY KEY, side TEXT, name TEXT, color TEXT, ord INTEGER);
CREATE TABLE module(id TEXT PRIMARY KEY, side TEXT, layer TEXT, name TEXT, title TEXT, files INTEGER, endpoints INTEGER,
  doc TEXT, one_liner TEXT, key_classes TEXT, patterns TEXT, deps TEXT, tags TEXT, risks TEXT, snippets TEXT);
CREATE TABLE relation(from_id TEXT, to_id TEXT, type TEXT, label TEXT, descr TEXT);
CREATE TABLE dataflow(id TEXT PRIMARY KEY, name TEXT, descr TEXT, steps TEXT);
CREATE TABLE tech(name TEXT, category TEXT, side TEXT, descr TEXT, tags TEXT);
CREATE TABLE pattern(name TEXT, cat TEXT, descr TEXT, modules TEXT);
CREATE TABLE stat(k TEXT PRIMARY KEY, v TEXT);
`);

const insLayer = db.prepare('INSERT INTO layer VALUES(?,?,?,?,?)');
for (const l of LAYERS) insLayer.run(l.id, l.side, l.name, l.color, l.order ?? 0);

const insMod = db.prepare('INSERT INTO module VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const J = (v) => JSON.stringify(v || []);
for (const m of MODULES) {
  const files = fileCount(m);
  const eps = m.endpoints != null ? m.endpoints : (epByModule[m.id] || 0);
  insMod.run(m.id, m.side, m.layer, m.name, m.title, files, eps, m.doc, m.oneLiner,
    J(m.keyClasses), J(m.patterns), J(m.deps), J(m.tags), J(m.risks), J(SNIPPETS?.[m.id]));
}

const insRel = db.prepare('INSERT INTO relation VALUES(?,?,?,?,?)');
const ids = new Set(MODULES.map((m) => m.id));
for (const m of MODULES) for (const d of (m.deps || [])) if (ids.has(d)) insRel.run(m.id, d, 'depends', 'depends', `${m.name} → ${d}`);
for (const r of (RELATIONS || [])) insRel.run(r.from, r.to, r.type || 'relates', r.label || '', r.desc || '');

const insFlow = db.prepare('INSERT INTO dataflow VALUES(?,?,?,?)');
for (const f of (DATAFLOWS || [])) insFlow.run(f.id, f.name, f.desc || '', J(f.steps));
const insTech = db.prepare('INSERT INTO tech VALUES(?,?,?,?,?)');
for (const t of (TECH || [])) insTech.run(t.name, t.category, t.side || '', t.desc || '', J(t.tags));
const insPat = db.prepare('INSERT INTO pattern VALUES(?,?,?,?)');
for (const p of (PATTERNS || [])) insPat.run(p.name, p.cat || '', p.desc || '', J(p.modules));

const insStat = db.prepare('INSERT INTO stat VALUES(?,?)');
const stats = {
  modules: MODULES.length,
  endpoints: endpoints.length,
  files_total: MODULES.reduce((s, m) => s + fileCount(m), 0),
  ...(readJson(path.join(CONFIG.publicDir, 'extra-stats.json'), {})),
};
for (const [k, v] of Object.entries(stats)) insStat.run(k, String(v));
db.close();

// Re-read → export JSON for the browser.
const rdb = new DatabaseSync(dbPath, { readOnly: true });
const q = (sql) => rdb.prepare(sql).all();
const parse = (rows, fields) => rows.map((r) => { const o = { ...r }; for (const f of fields) if (o[f] != null) o[f] = JSON.parse(o[f]); return o; });
const out = {
  meta: stats,
  layers: q('SELECT * FROM layer ORDER BY ord'),
  modules: parse(q('SELECT * FROM module'), ['key_classes', 'patterns', 'deps', 'tags', 'risks', 'snippets']),
  relations: q('SELECT * FROM relation'),
  dataflows: parse(q('SELECT * FROM dataflow'), ['steps']),
  tech: parse(q('SELECT * FROM tech'), ['tags']),
  patterns: parse(q('SELECT * FROM pattern'), ['modules']),
};
fs.writeFileSync(path.join(dataDir, 'knowledge.json'), JSON.stringify(out));
if (endpoints.length) {
  const byMod = {}; for (const e of endpoints) (byMod[e.module] = byMod[e.module] || []).push(e);
  fs.writeFileSync(path.join(dataDir, 'endpoints.json'), JSON.stringify(byMod));
}
rdb.close();
console.log('knowledge.sqlite + JSON written | modules', out.modules.length, '| relations', out.relations.length, '| endpoints', endpoints.length);
