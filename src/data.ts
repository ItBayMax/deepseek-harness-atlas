import type { Knowledge, Endpoint, DocManifestEntry } from './types';

const BASE = import.meta.env.BASE_URL || './';
const url = (p: string) => `${BASE}${p}`.replace(/([^:])\/\//g, '$1/');

let _knowledge: Knowledge | null = null;
let _endpoints: Record<string, Endpoint[]> | null = null;
let _manifest: DocManifestEntry[] | null = null;

export async function loadKnowledge(): Promise<Knowledge> {
  if (_knowledge) return _knowledge;
  _knowledge = await (await fetch(url('data/knowledge.json'))).json();
  return _knowledge!;
}
export async function loadEndpoints(): Promise<Record<string, Endpoint[]>> {
  if (_endpoints) return _endpoints;
  try { _endpoints = await (await fetch(url('data/endpoints.json'))).json(); } catch { _endpoints = {}; }
  return _endpoints!;
}
export async function loadDocsManifest(): Promise<DocManifestEntry[]> {
  if (_manifest) return _manifest;
  try { _manifest = await (await fetch(url('data/docs-manifest.json'))).json(); } catch { _manifest = []; }
  return _manifest!;
}
export async function loadDoc(docPath: string): Promise<string> {
  const res = await fetch(url(`docs/${docPath}`));
  if (!res.ok) throw new Error(`doc not found: ${docPath}`);
  return res.text();
}

const LAYER_COLOR: Record<string, string> = {};
export function moduleColor(m: { layer: string }, layers: { id: string; color: string }[]): string {
  if (!Object.keys(LAYER_COLOR).length) for (const l of layers) LAYER_COLOR[l.id] = l.color;
  return LAYER_COLOR[m.layer] || '#38bdf8';
}
