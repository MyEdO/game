// CODEMOD DE DÉMÉNAGEMENT de modules (#2882) : `node deplacer.cjs <racine> <table.json> [--sec]`.
// table.json : { "src/state/bus.ts": "src/noyau/bus.ts", ... } (chemins relatifs à la racine).
// 1. `git mv` de chaque fichier (sauf --sec) ;
// 2. réécrit tout spécificateur de module (import, export … from, import(), import type, vi.mock/
//    doMock/importActual/importMock/unmock, require) qui vise un fichier déplacé, ou qui part d'un fichier
//    déplacé, dans src/, scripts/, server/src et les fichiers de config de la racine ; garde la forme
//    (alias `@/`, extension présente ou non, `./` initial) ;
// 3. repointe les chemins littéraux `src/<ancien>[.ts]` dans les fichiers texte suivis, hors des quatre
//    dossiers d'historique (`HISTORIQUE` : docs/plans/, docs/superpowers/, docs/retours/, .claude/soldes/).
// Rend le compte des réécritures par famille.
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const ROOT = path.resolve(process.argv[2]);
const TABLE = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const SEC = process.argv.includes('--sec');
const abs = (p) => path.join(ROOT, p);
const OLD2NEW = new Map(Object.entries(TABLE).map(([o, n]) => [abs(o), abs(n)]));
const NEW2OLD = new Map([...OLD2NEW].map(([o, n]) => [n, o]));

const tracked = cp.execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
if (!SEC) {
  for (const [o, n] of OLD2NEW) {
    fs.mkdirSync(path.dirname(n), { recursive: true });
    cp.execFileSync('git', ['mv', o, n], { cwd: ROOT });
  }
}
// fichiers à parcourir (chemins APRÈS déplacement)
const after = tracked.map((f) => { const a = abs(f); return OLD2NEW.get(a) ?? a; });
const CODE = after.filter((f) => /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/.test(f) && !/\.d\.ts$/.test(f)
  && (/\/(src|scripts|server\/src|hotes|poc)\//.test(f.slice(ROOT.length) + '/') || !f.slice(ROOT.length + 1).includes('/')));
const EXTS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx'];
// existence AVANT déplacement : un fichier déplacé existe à son ancien chemin
const existedBefore = (p) => { if (OLD2NEW.has(p)) return true; if (NEW2OLD.has(p)) return false; return fs.existsSync(p) && fs.statSync(p).isFile(); };
function resolveOld(fromOldDir, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') base = path.resolve(fromOldDir, spec);
  else return null;
  for (const e of EXTS) { const p = base + e; if (existedBefore(p)) return { target: p, ext: e }; }
  return null;
}
function specFor(fromNewDir, targetNew, origSpec, ext) {
  if (origSpec.startsWith('@/')) {
    let r = path.relative(path.join(ROOT, 'src'), targetNew);
    r = stripExt(r, ext); return '@/' + r.split(path.sep).join('/');
  }
  let r = path.relative(fromNewDir, targetNew).split(path.sep).join('/');
  r = stripExt(r, ext);
  if (!r.startsWith('.')) r = './' + r;
  return r;
}
function stripExt(r, ext) {
  if (ext === '') return r; // l'original portait l'extension
  if (ext.startsWith('/index')) return r.slice(0, -ext.length);
  return r.slice(0, -ext.length);
}
const SPEC_CALLS = new Set(['mock', 'doMock', 'importActual', 'importMock', 'unmock', 'doUnmock']);
const counts = { specs: 0, files: 0, paths: 0, pathFiles: 0 };
for (const f of CODE) {
  if (!fs.existsSync(f)) continue;
  const oldPath = NEW2OLD.get(f) ?? f; const moved = NEW2OLD.has(f);
  const txt = fs.readFileSync(f, 'utf8');
  const kind = /x$/.test(f) ? ts.ScriptKind.TSX : (/\.(m|c)?js$/.test(f) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const sf = ts.createSourceFile(f, txt, ts.ScriptTarget.Latest, true, kind);
  const edits = [];
  const consider = (lit) => {
    if (!lit || !ts.isStringLiteralLike(lit)) return;
    const spec = lit.text; const r = resolveOld(path.dirname(oldPath), spec);
    if (!r) return;
    const targetNew = OLD2NEW.get(r.target) ?? r.target;
    if (!moved && targetNew === r.target) return;
    const ns = specFor(path.dirname(f), targetNew, spec, r.ext);
    if (ns !== spec) edits.push({ s: lit.getStart() + 1, e: lit.getEnd() - 1, t: ns });
  };
  const visit = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) consider(n.moduleSpecifier);
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) consider(n.argument.literal);
    else if (ts.isCallExpression(n) && n.arguments.length) {
      const c = n.expression;
      if (c.kind === ts.SyntaxKind.ImportKeyword) consider(n.arguments[0]);
      else if (ts.isIdentifier(c) && c.text === 'require') consider(n.arguments[0]);
      else if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && (c.expression.text === 'vi' || c.expression.text === 'vitest') && SPEC_CALLS.has(c.name.text)) consider(n.arguments[0]);
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) consider(n.moduleReference.expression);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b.s - a.s);
  let out = txt; for (const e of edits) out = out.slice(0, e.s) + e.t + out.slice(e.e);
  fs.writeFileSync(f, out); counts.specs += edits.length; counts.files++;
}
// 3. chemins littéraux
const HISTORIQUE = ['/docs/plans/', '/docs/superpowers/', '/docs/retours/', '/.claude/soldes/'];
const TEXT = after.filter((f) => !HISTORIQUE.some((h) => f.includes(h)) && !/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|pdf|zip|glb|gltf|mp3|ogg|wav|svgz)$/i.test(f) && fs.existsSync(f));
const pairs = [...OLD2NEW].map(([o, n]) => {
  const ro = path.relative(ROOT, o).split(path.sep).join('/'); const rn = path.relative(ROOT, n).split(path.sep).join('/');
  const so = ro.replace(/\.(ts|tsx)$/, ''); const sn = rn.replace(/\.(ts|tsx)$/, '');
  return { re: new RegExp('(?<![A-Za-z0-9_-])' + so.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(\\.tsx?)?(?![A-Za-z0-9_-])', 'g'), sn };
});
for (const f of TEXT) {
  let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (txt.includes('\u0000')) continue;
  let n = 0; let out = txt;
  for (const p of pairs) out = out.replace(p.re, (_m, ext) => { n++; return p.sn + (ext ?? ''); });
  if (n) { fs.writeFileSync(f, out); counts.paths += n; counts.pathFiles++; }
}
console.log(JSON.stringify(counts));
