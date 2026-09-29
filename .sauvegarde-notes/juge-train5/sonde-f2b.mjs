import ts from '/home/user/game/.wt-1806-L2/node_modules/typescript/lib/typescript.js'
import { readFileSync } from 'node:fs'
import { parsedProgram, virtualProgram } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/tsProgram.mjs'
const rel = 'src/data/schemas/grammaire/mecanique.ts'
const base = readFileSync('/home/user/game/.wt-1806-L2/' + rel, 'utf8')
const RT = 'type ReturnType<T extends (...a: any) => any> = T extends (...a: any) => infer R ? R : any;\n'
for (const [nom, text] of [['sans ReturnType local', base], ['ReturnType local', RT + base]]) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true)
  const ch = parsedProgram(sf).getTypeChecker()
  let acces; const f = (n) => { if (!acces && ts.isVariableDeclaration(n) && n.name.getText(sf) === 'effectOpSchema') acces = n.initializer; ts.forEachChild(n, f) }; f(sf)
  console.log(nom, ch.getSymbolAtLocation(acces.name)?.name ?? null)
}
const small = 'const a = 1; export const b = a;'
let t = performance.now(); for (let i = 0; i < 20; i++) parsedProgram(ts.createSourceFile('x.ts', small, ts.ScriptTarget.ES2022, true)).getTypeChecker(); console.log('parsed x20 ms', Math.round(performance.now() - t))
t = performance.now(); for (let i = 0; i < 20; i++) virtualProgram({ 'x.ts': small }).getTypeChecker(); console.log('virtual x20 ms', Math.round(performance.now() - t))
