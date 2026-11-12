// LA VALIDATION D'UN ÉLÉMENT SCHÉMA 3 CONTRE SA BASE (#2972), OU SEUL S'IL EST SANS BASE (#2987) : `validerModele`
// (`modeles.ts`), la composition de l'import.
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
if (positionals.length !== 2 && positionals.length !== 3) {
  console.error('usage : npm run godot:valider -- <element.json> [<base.json>] <element.glb> [--glb-base <base.glb>] (sans base : décor, véhicule, Amélioration)')
  process.exit(2)
}

try {
  const [cheminElement, cheminBase, cheminGlb] = positionals.length === 3 ? positionals : [positionals[0], null, positionals[1]]
  const element = JSON.parse(readFileSync(cheminElement, 'utf8'))
  const octets = readFileSync(cheminGlb)
  const bases = new Map()
  if (cheminBase !== null) {
    const base = JSON.parse(readFileSync(cheminBase, 'utf8'))
    const cheminGlbBase = values['glb-base'] ?? cheminBase.replace(/(?:\.manifeste)?\.json$/, '.glb')
    if (!existsSync(cheminGlbBase)) {
      console.log(JSON.stringify({ ok: false, refus: [`[glb-de-base-absent] ${cheminGlbBase}`] }, null, 2))
      process.exit(1)
    }
    bases.set(base?.base, { brut: base, octets: readFileSync(cheminGlbBase) })
  }
  const { validerModele } = await chargerAssets(["export { validerModele } from '/hotes/godot/asset/modeles.ts';"])
  const verdict = validerModele(element, octets, bases)
  console.log(JSON.stringify(verdict, null, 2))
  process.exitCode = verdict.ok ? 0 : 1
} catch (erreur) {
  console.error(JSON.stringify({ ok: false, code: 'lecture-ou-validation', detail: erreur instanceof Error ? erreur.message : String(erreur) }))
  process.exitCode = 1
}
