// LES PLANCHES ET LEURS ÉTALONS (#3935). Une planche est un état de partie enregistré (`Planche`, `recettes/ecran.ts`),
// que le jeu montre à l'adresse `?planche=<nom>` (`projet/scripts/pont_de_planche.gd`) ; son étalon est la capture de
// son écran que le banc compare (`etalons.mjs`). Sous `etalons/` : `planches/<nom>.json` et le monde de chaque scénario
// sous `planches/mondes/<scenario>.json`, servis tels quels sous `planches/` (`servir.mjs`, `deposerLesPlanches`), puis
// `<nom>.png`, l'étalon de la planche, et `valides.json`, par nom de planche la date et l'empreinte SHA-256 de l'étalon
// que l'utilisateur a validé.
import { cpSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DOSSIER_DES_ETALONS = fileURLToPath(new URL('./etalons', import.meta.url))
export const DOSSIER_DES_PLANCHES = join(DOSSIER_DES_ETALONS, 'planches')
export const MONDES = 'mondes'
export const VALIDES = join(DOSSIER_DES_ETALONS, 'valides.json')

/** Les noms des planches enregistrées, dans l'ordre. */
export const nomsDesPlanches = () => readdirSync(DOSSIER_DES_PLANCHES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)).sort()

/** Les planches copiées sous `planches/` de `sortie` : ce que `servir.mjs` sert sous `planches/`, en fichiers statiques. */
export function deposerLesPlanches(sortie) {
  cpSync(DOSSIER_DES_PLANCHES, join(sortie, 'planches'), { recursive: true })
}
