// INVENTAIRE des consommateurs Node de PROSE — invariant « hors Vite = forme disque » (#1389 Lot A).
//
// Le plugin `wfrp:prose-source` ne matérialise `desc` que pour les modules servis par Vite. Un script
// Node qui lit un `src/data/*.json` (ou la façade `src/data/index.ts` sous tsx) voit la FORME DISQUE :
// une entrée ADRESSÉE n'y a pas de `desc`. Chacun de ces sites doit passer par `resoudreProse` ou
// `materialiser` (`scripts/source/resoudre.mjs`) AU MOMENT où la famille qu'il lit est migrée.
//
// Ce scanner NOMME les sites ; il ne juge pas et ne modifie rien. Deux conditions par fichier :
//   1. il atteint la donnée — un chemin `src/data` (import, `join`, glob) apparaît dans le fichier ;
//   2. il lit une prose — une occurrence de `.desc` hors commentaire.
// Angle mort DÉCLARÉ : un script qui reçoit la donnée d'un autre module (paramètre, façade
// intermédiaire) sans nommer `src/data` lui-même n'apparaît pas ; les lectures dynamiques
// (`e['desc']`) non plus.
//
// Usage : `node scripts/source/inventaire-consommateurs-prose.mjs`
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXTENSIONS = /\.(mjs|mts)$/
const ATTEINT_LA_DONNEE = /src[\\/]data\b/
/** La FAÇADE (`src/data/index.ts`, sous `tsx`) : la donnée y arrive déjà assemblée. */
const PAR_LA_FACADE = /from '[^']*src[\\/]data'/
const LIT_UNE_PROSE = /\.desc\b/

/** Tous les scripts du dépôt, récursivement (hors `node_modules`). */
function scripts(dossier) {
  const out = []
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules') continue
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) out.push(...scripts(chemin))
    else if (EXTENSIONS.test(nom)) out.push(chemin)
  }
  return out
}

/** Lignes qui lisent une prose, hors ligne de commentaire. */
function lecturesDeProse(texte) {
  return texte.split('\n').flatMap((ligne, i) => {
    const nu = ligne.trim()
    if (nu.startsWith('//') || nu.startsWith('*') || nu.startsWith('/*')) return []
    return LIT_UNE_PROSE.test(ligne) ? [{ ligne: i + 1, texte: nu }] : []
  })
}

export function inventaire(racine = RACINE) {
  const out = []
  for (const chemin of scripts(join(racine, 'scripts'))) {
    const texte = readFileSync(chemin, 'utf8')
    if (!ATTEINT_LA_DONNEE.test(texte)) continue
    const sites = lecturesDeProse(texte)
    if (!sites.length) continue
    const voie = PAR_LA_FACADE.test(texte) ? 'facade' : 'json'
    out.push({ fichier: relative(racine, chemin).split('\\').join('/'), voie, sites })
  }
  return out.sort((a, b) => a.fichier.localeCompare(b.fichier))
}

if (import.meta.main) {
  const trouves = inventaire()
  for (const { fichier, voie, sites } of trouves) {
    for (const s of sites) console.log(`[${voie}] ${fichier}:${s.ligne}  ${s.texte.slice(0, 120)}`)
  }
  console.log(`\n${trouves.length} fichier(s), ${trouves.reduce((n, f) => n + f.sites.length, 0)} lecture(s) de prose.`)
}
