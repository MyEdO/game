// Réexportations de src/state (non-test) par l'AST : `export … from`, et `export { x }` d'un nom importé.
const ts = require('/opt/node-tools/node_modules/typescript');
const { execSync } = require('child_process');
const files = execSync("git -C /home/user/game ls-files 'src/state/*.ts' 'src/state/**/*.ts' 'src/state/*.tsx' 'src/state/**/*.tsx'").toString().trim().split('\n').filter(f => !/\.test\.|testkit/i.test(f));
const out = []; const fichiers = new Set();
for (const f of files) {
  const src = require('fs').readFileSync('/home/user/game/' + f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
  const imported = new Set();
  for (const st of sf.statements) if (ts.isImportDeclaration(st) && st.importClause) {
    const c = st.importClause; if (c.name) imported.add(c.name.text);
    const nb = c.namedBindings; if (nb) { if (ts.isNamespaceImport(nb)) imported.add(nb.name.text); else for (const e of nb.elements) imported.add(e.name.text); }
  }
  for (const st of sf.statements) if (ts.isExportDeclaration(st)) {
    const line = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
    if (st.moduleSpecifier) { out.push(`${f}:${line} from ${st.moduleSpecifier.text}`); fichiers.add(f); }
    else if (st.exportClause && ts.isNamedExports(st.exportClause)) {
      const re = st.exportClause.elements.filter(e => imported.has((e.propertyName ?? e.name).text)).map(e => e.name.text);
      if (re.length) { out.push(`${f}:${line} import-puis-export {${re.join(',')}}`); fichiers.add(f); }
    }
  }
}
console.log(out.join('\n')); console.log('TOTAL', out.length, 'fichiers', fichiers.size);
