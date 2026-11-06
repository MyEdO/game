// scripts/gen-verbes.mjs — LES VERBES DE LA PARTIE et leurs paramètres (#2898 lot C), dérivés du TYPE que
// `Partie.envoyer` accepte (`partieLue`), et la forme de la valeur de chaque réglage de jet (`REGLAGES`) et de chaque
// choix de fenêtre (`CHOIX`) : une cible de CODE de `GENERATORS` (scripts/docs/build-all.mjs),
// `src/hote/verbes.generated.ts`, jamais commitée. Les hôtes du noyau y lisent les paramètres qu'ils contrôlent
// (`argumentsDuVerbe`, src/hote/geste.ts) ; le doc `docs/hote-texte.md` écrit sa table par la même lecture.
//
//   node scripts/gen-verbes.mjs            écrit la cible
//   node scripts/gen-verbes.mjs --check    compare sans écrire
import { SORTIE_VERBES as SORTIE } from './docs/lib/cibles-registres.mjs'
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs'
import { partieLue } from './docs/lib/verbesDeLaPartie.mjs'

/** Les axes d'une table, une clé par ligne : la forme de la valeur de chacun de ses axes. */
const lignesDesAxes = (table) => Object.entries(table).map(([cle, formes]) => `  ${JSON.stringify(cle)}: ${JSON.stringify(formes)},\n`).join('')

/** Le texte de la cible : un verbe par ligne, ses paramètres en JSON ; un flux de jet par ligne, la forme de la valeur
 *  de chacun de ses réglages ; une fenêtre par ligne, la forme de la valeur de chacun de ses choix. */
const texteDeSortie = ({ verbes, reglages, choix }) =>
  `// GÉNÉRÉ par scripts/gen-verbes.mjs (#2898) — jamais édité, jamais commité.\n`
  + `import type { Forme, ParametreDeVerbe } from './formes';\n\n`
  + `/** Les paramètres de chaque verbe de la partie, lus du type de \`ActionsDuNoyau\`. */\n`
  + `export const VERBES: Readonly<Record<string, readonly ParametreDeVerbe[]>> = {\n`
  + Object.entries(verbes).map(([verbe, parametres]) => `  ${JSON.stringify(verbe)}: ${JSON.stringify(parametres)},\n`).join('')
  + `};\n\n`
  + `/** La forme de la valeur de chaque réglage de chaque flux de jet, lue du type de \`ReglagesDuJet\`. */\n`
  + `export const REGLAGES: Readonly<Record<string, Readonly<Record<string, Forme>>>> = {\n`
  + lignesDesAxes(reglages)
  + `};\n\n`
  + `/** La forme de la valeur de chaque choix de chaque fenêtre, lue du type de \`ChoixDesFenetres\`. */\n`
  + `export const CHOIX: Readonly<Record<string, Readonly<Record<string, Forme>>>> = {\n`
  + lignesDesAxes(choix)
  + `};\n`

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map([[SORTIE, texteDeSortie(partieLue())]])
}

if (import.meta.main) {
  const partie = partieLue()
  console.log(`gen-verbes — ${Object.keys(partie.verbes).length} verbes`)
  ecrireOuVerifier({
    out: texteDeSortie(partie),
    path: SORTIE,
    check: process.argv.includes('--check'),
    staleMsg: `gen-verbes — ${SORTIE} est PÉRIMÉ (diverge du type des verbes).`,
    rerunMsg: '  → relancer `npm run gen`.',
  })
}
