import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chargerAssets } from './charger.mjs'

let positionals, values
try {
  ;({ positionals, values } = parseArgs({ allowPositionals: true, options: { 'glb-base': { type: 'string' } } }))
} catch (erreur) {
  console.error(erreur.message)
  process.exit(2)
}
if (positionals.length !== 3) {
  console.error('usage : npm run godot:valider -- <element.json> <base.json> <element.glb> [--glb-base <base.glb>]')
  process.exit(2)
}

try {
  const [cheminElement, cheminBase, cheminGlb] = positionals
  const element = JSON.parse(readFileSync(cheminElement, 'utf8'))
  const base = JSON.parse(readFileSync(cheminBase, 'utf8'))
  const octets = readFileSync(cheminGlb)
  const cheminGlbBase = values['glb-base'] ?? cheminBase.replace(/(?:\.manifeste)?\.json$/, '.glb')
  if (!existsSync(cheminGlbBase)) {
    console.log(JSON.stringify({ ok: false, ecarts: [{ code: 'glb-de-base-absent', ou: cheminGlbBase, detail: 'GLB de base attendu' }] }, null, 2))
    process.exit(1)
  }
  const { validerElement, validerManifesteDeBase } = await chargerAssets([
    "export { validerElement } from '/hotes/godot/asset/element.ts';",
    "export { validerManifesteDeBase } from '/hotes/godot/asset/manifesteDeBase.ts';",
  ])
  const verdictDeBase = validerManifesteDeBase(base, readFileSync(cheminGlbBase))
  const verdict = verdictDeBase.ok ? validerElement(element, verdictDeBase.manifeste, octets) : verdictDeBase
  console.log(JSON.stringify(verdict, null, 2))
  process.exitCode = verdict.ok ? 0 : 1
} catch (erreur) {
  console.error(JSON.stringify({ ok: false, code: 'lecture-ou-validation', detail: erreur instanceof Error ? erreur.message : String(erreur) }))
  process.exitCode = 1
}
