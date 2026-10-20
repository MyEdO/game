// Juge v6 : la classe « réexportation » sur TOUT src (non-test, hors testkits), lue à cf4f18bcf par git show.
const ts = require('/opt/node-tools/node_modules/typescript');
const { execSync } = require('child_process');
const REV = 'cf4f18bcf';
const files = execSync(`git -C /home/user/game ls-tree -r --name-only ${REV} -- src`).toString().trim().split('\n')
  .filter(f => /\.tsx?$/.test(f) && !/\.test\.|testkit|\.d\.ts$/i.test(f));
const parDossier = {}; let total = 0;
for (const f of files) {
  const src = execSync(`git -C /home/user/game show ${REV}:${f}`, { maxBuffer: 64e6 }).toString();
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
  const imported = new Set();
  for (const st of sf.statements) if (ts.isImportDeclaration(st) && st.importClause) {
    const c = st.importClause; if (c.name) imported.add(c.name.text);
    const nb = c.namedBindings; if (nb) { if (ts.isNamespaceImport(nb)) imported.add(nb.name.text); else for (const e of nb.elements) imported.add(e.name.text); }
  }
  let n = 0;
  for (const st of sf.statements) if (ts.isExportDeclaration(st)) {
    if (st.moduleSpecifier) n++;
    else if (st.exportClause && ts.isNamedExports(st.exportClause) && st.exportClause.elements.some(e => imported.has((e.propertyName ?? e.name).text))) n++;
  }
  if (n) { const d = f.split('/').slice(0, 2).join('/'); parDossier[d] ??= { n: 0, f: 0 }; parDossier[d].n += n; parDossier[d].f++; total += n; }
}
console.log(JSON.stringify(parDossier)); console.log('TOTAL src', total);
