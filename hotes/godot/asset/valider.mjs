// LA VALIDATION D'UN ÉLÉMENT SCHÉMA 3 CONTRE SA BASE (#2972) : `validerModele` (`modeles.ts`), la composition de l'import.
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
    console.log(JSON.stringify({ ok: false, refus: [`[glb-de-base-absent] ${cheminGlbBase}`] }, null, 2))
    process.exit(1)
  }
  const { validerModele } = await chargerAssets(["export { validerModele } from '/hotes/godot/asset/modeles.ts';"])
  const verdict = validerModele(element, octets, new Map([[base?.base, { brut: base, octets: readFileSync(cheminGlbBase) }]]))
  console.log(JSON.stringify(verdict, null, 2))
  process.exitCode = verdict.ok ? 0 : 1
} catch (erreur) {
  console.error(JSON.stringify({ ok: false, code: 'lecture-ou-validation', detail: erreur instanceof Error ? erreur.message : String(erreur) }))
  process.exitCode = 1
}
