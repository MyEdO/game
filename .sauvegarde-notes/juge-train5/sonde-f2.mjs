import ts from '/home/user/game/.wt-1806-L2/node_modules/typescript/lib/typescript.js'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { parsedProgram, virtualProgram, VIRTUAL_ROOT } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/tsProgram.mjs'
const rel = 'src/data/schemas/grammaire/mecanique.ts'
const text = readFileSync('/home/user/game/.wt-1806-L2/' + rel, 'utf8')
function suivre(prog, sf) {
  const ch = prog.getTypeChecker()
  let acces; const f = (n) => { if (!acces && ts.isVariableDeclaration(n) && n.name.getText(sf) === 'effectOpSchema') acces = n.initializer; ts.forEachChild(n, f) }; f(sf)
  const sym = ch.getSymbolAtLocation(acces.name)
  const decl = sym?.valueDeclaration
  return { acces: acces.getText(sf), symbole: sym?.name ?? null, decl: decl ? `${ts.SyntaxKind[decl.kind]} l.${sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1}` : null }
}
const sfP = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true)
console.log('parsedProgram', JSON.stringify(suivre(parsedProgram(sfP), sfP)))
const vp = virtualProgram({ [rel]: text })
console.log('virtualProgram', JSON.stringify(suivre(vp, vp.getSourceFile(path.resolve(VIRTUAL_ROOT, rel)))))
// identité des nœuds : virtualProgram reparse, un nœud de l'arbre de l'appelant n'y a pas de symbole
const racine = ts.createSourceFile('x.tsx', 'const a = 1; const b = a;', ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
let id; const g = (n) => { if (ts.isIdentifier(n) && n.text === 'a' && n.parent && ts.isVariableDeclaration(n.parent) && n.parent.name !== n) id = n; ts.forEachChild(n, g) }; g(racine)
console.log('parsed sym(a)', parsedProgram(racine).getTypeChecker().getSymbolAtLocation(id)?.name ?? null)
const v2 = virtualProgram({ 'x.tsx': racine.text })
console.log('virtual sym(a) sur noeud etranger', v2.getTypeChecker().getSymbolAtLocation(id)?.name ?? null)
