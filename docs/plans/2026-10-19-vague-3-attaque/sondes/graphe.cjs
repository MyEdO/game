// Graphe d'import de FICHIERS de src/ (valeur / type), lecture seule.
// usage : node graphe.cjs <racine-du-depot> > graphe.json
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2] || '/home/user/game');
const SRC = path.join(ROOT, 'src');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(ts|tsx|mts)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(p); } })(SRC);
const exts = ['', '.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const e of exts) { const p = base + e; if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; }
  if (/\.(json|css|svg|png)$/.test(spec)) return base;
  return null;
}
const out = {};
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, txt, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const arcs = [];
  const add = (spec, typeSeul, names, node) => { const r = resolve(f, spec); if (!r) return; arcs.push({ to: path.relative(SRC, r), type: typeSeul, names, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 }); };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause; let typeSeul = false; let names = [];
      if (c) {
        if (c.isTypeOnly) typeSeul = true;
        const nb = c.namedBindings;
        if (nb && ts.isNamedImports(nb)) { names = nb.elements.map((e) => (e.isTypeOnly ? 'type ' : '') + (e.propertyName ?? e.name).text); if (!c.name && nb.elements.length && nb.elements.every((e) => e.isTypeOnly)) typeSeul = true; }
        if (nb && ts.isNamespaceImport(nb)) names.push('*');
        if (c.name) names.push('default');
      }
      add(n.moduleSpecifier.text, typeSeul, names, n);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      let typeSeul = n.isTypeOnly; let names = ['*export'];
      if (n.exportClause && ts.isNamedExports(n.exportClause)) { names = n.exportClause.elements.map((e) => (e.isTypeOnly ? 'type ' : '') + (e.propertyName ?? e.name).text); if (n.exportClause.elements.length && n.exportClause.elements.every((e) => e.isTypeOnly)) typeSeul = true; }
      add(n.moduleSpecifier.text, typeSeul, names, n);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
      add(n.arguments[0].text, false, ['import()'], n);
    } else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal)) {
      add(n.argument.literal.text, true, ['import-type'], n);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  out[path.relative(SRC, f)] = { lines: txt.split('\n').length, arcs };
}
process.stdout.write(JSON.stringify(out));
