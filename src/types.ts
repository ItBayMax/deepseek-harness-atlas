// Matches the JSON exported by scripts/build-knowledge-db.mjs

export interface Layer { id: string; side: string; name: string; color: string; ord: number; }

export interface Snippet { title: string; file: string; lang: string; note: string; code: string; }

export interface Module {
  id: string; side: string; layer: string; name: string; title: string;
  files: number; endpoints: number; doc: string; one_liner: string;
  key_classes: string[]; patterns: string[]; deps: string[]; tags: string[]; risks: string[];
  snippets: Snippet[];
}

export interface Relation { from_id: string; to_id: string; type: string; label: string; descr: string; }
export interface DataFlowStep { moduleId: string; label: string; type: string; }
export interface DataFlow { id: string; name: string; descr: string; steps: DataFlowStep[]; }
export interface Tech { name: string; category: string; side: string; descr: string; tags: string[]; }
export interface Pattern { name: string; cat: string; descr: string; modules: string[]; }

export interface Knowledge {
  meta: Record<string, number | string>;
  layers: Layer[];
  modules: Module[];
  relations: Relation[];
  dataflows: DataFlow[];
  tech: Tech[];
  patterns: Pattern[];
}

export interface Endpoint { module: string; unit: string; http: string; path: string; handler: string; file: string; }
export interface DocManifestEntry { path: string; title: string; size: number; source: string; }
