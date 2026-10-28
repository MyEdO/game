import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chargerAssets } from './charger.mjs'

let positionals
try {
  positionals = parseArgs({ allowPositionals: true }).positionals
} catch (erreur) {
  console.error(erreur.message)
  process.exit(2)
}
if (positionals.length !== 3) {
  console.error('usage : npm run godot:valider -- <element.json> <base.json> <element.glb>')
  process.exit(2)
}

try {
  const [cheminElement, cheminBase, cheminGlb] = positionals
  const element = JSON.parse(readFileSync(cheminElement, 'utf8'))
  const base = JSON.parse(readFileSync(cheminBase, 'utf8'))
  const octets = readFileSync(cheminGlb)
  const { validerElement } = await chargerAssets([
    "export { validerElement } from '/hotes/godot/asset/element.ts';",
  ])
  const verdict = validerElement(element, base, octets)
  console.log(JSON.stringify(verdict, null, 2))
  process.exitCode = verdict.ok ? 0 : 1
} catch (erreur) {
  console.error(JSON.stringify({ ok: false, code: 'lecture-ou-validation', detail: erreur instanceof Error ? erreur.message : String(erreur) }))
  process.exitCode = 1
}
