// scripts/gen-verbes.mjs — LES VERBES DE LA PARTIE et leurs paramètres (#2898 lot C), dérivés du TYPE que
// `Partie.envoyer` accepte (`verbesDeLaPartie`) : une cible de CODE de `GENERATORS` (scripts/docs/build-all.mjs),
// `src/hoteTexte/verbes.generated.ts`, jamais commitée. L'hôte texte y lit les paramètres que `jouer` contrôle ; le doc
// `docs/hote-texte.md` écrit sa table par la même lecture.
//
//   node scripts/gen-verbes.mjs            écrit la cible
//   node scripts/gen-verbes.mjs --check    compare sans écrire
import { SORTIE_VERBES as SORTIE } from './docs/lib/cibles-registres.mjs'
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs'
import { verbesDeLaPartie } from './docs/lib/verbesDeLaPartie.mjs'

/** Le texte de la cible : un verbe par ligne, ses paramètres en JSON. */
const texteDeSortie = (verbes) =>
  `// GÉNÉRÉ par scripts/gen-verbes.mjs (#2898) — jamais édité, jamais commité.\n`
  + `import type { ParametreDeVerbe } from './formes';\n\n`
  + `/** Les paramètres de chaque verbe de la partie, lus du type de \`ActionsDuNoyau\`. */\n`
  + `export const VERBES: Readonly<Record<string, readonly ParametreDeVerbe[]>> = {\n`
  + Object.entries(verbes).map(([verbe, parametres]) => `  ${JSON.stringify(verbe)}: ${JSON.stringify(parametres)},\n`).join('')
  + `};\n`

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map([[SORTIE, texteDeSortie(verbesDeLaPartie())]])
}

if (import.meta.main) {
  const verbes = verbesDeLaPartie()
  console.log(`gen-verbes — ${Object.keys(verbes).length} verbes`)
  ecrireOuVerifier({
    out: texteDeSortie(verbes),
    path: SORTIE,
    check: process.argv.includes('--check'),
    staleMsg: `gen-verbes — ${SORTIE} est PÉRIMÉ (diverge du type des verbes).`,
    rerunMsg: '  → relancer `npm run gen`.',
  })
}
