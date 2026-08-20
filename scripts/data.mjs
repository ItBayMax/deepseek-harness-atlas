// 数据管线编排器（predev / prebuild 入口）。
//
// 三个生成步骤对源的依赖不同，因此逐步守卫，而不是一把梭：
//   gen-inventory.mjs      需要 deepseek-harness 仓库 —— 缺则跳过（清单已提交）
//   build-knowledge-db.mjs 只读已提交的 modules-data/_meta/inventory/extra-stats —— 始终可跑
//   sync-docs.mjs          需要两个文档根（deepseek-ai/docs + deepseek-harness/docs），
//                          它开头会 rmSync public/docs —— 任一根缺失就跳过，
//                          否则克隆者跑 npm run dev 会把提交进仓库的 111 篇文档删光。
//
// 这让本仓库对两类使用者都正确：
//   分析者（有上游仓库）：全量再生。
//   学习者（仅 clone 本仓库）：跳过再生，直接使用提交的数据与文档。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../deepseek-harness');
const claudeDocsRoot = process.env.CLAUDE_DOCS_ROOT || path.resolve(__dirname, '../../docs');
const officialDocsRoot = process.env.OFFICIAL_DOCS_ROOT || path.join(harnessRoot, 'docs');

const run = (script) => execFileSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit' });

if (fs.existsSync(harnessRoot)) {
  run('gen-inventory.mjs');
} else {
  console.log(`[data] 跳过 gen-inventory：未找到 deepseek-harness（${harnessRoot}），使用已提交的 _meta/inventory。`);
}

run('build-knowledge-db.mjs');

if (fs.existsSync(claudeDocsRoot) && fs.existsSync(officialDocsRoot)) {
  run('sync-docs.mjs');
} else {
  console.log('[data] 跳过 sync-docs：文档源不全，保留已提交的 public/docs 与 docs-manifest。');
}
