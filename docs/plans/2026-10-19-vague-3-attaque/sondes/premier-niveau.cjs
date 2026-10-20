// Inventaire du PREMIER NIVEAU d'un module : chaque instruction, sa ligne, sa nature, ses identifiants déclarés.
// usage : node premier-niveau.cjs <fichier>
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs');
const f = process.argv[2]; const txt = fs.readFileSync(f, 'utf8');
const sf = ts.createSourceFile(f, txt, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
const E = (n) => sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
for (const s of sf.statements) {
  if (ts.isImportDeclaration(s)) continue;
  let k = ts.SyntaxKind[s.kind]; let names = '';
  if (ts.isVariableStatement(s)) names = s.declarationList.declarations.map((d) => d.name.getText()).join(',');
  else if (s.name) names = s.name.getText();
  else if (ts.isExpressionStatement(s)) names = s.expression.getText().slice(0, 70).replace(/\s+/g, ' ');
  else if (ts.isExportDeclaration(s)) names = s.getText().slice(0, 70).replace(/\s+/g, ' ');
  const exp = s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? 'export ' : '';
  console.log(`${L(s)}-${E(s)}\t${exp}${k}\t${names}`);
}
