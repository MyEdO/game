// Bornage d'un dossier de CACHE écrit un fichier par run ou par mesure (captures de suite, sorties de
// gate, logs tournés du train, verdicts gardés par la vigie, logs du consommateur du post-merge) : sans
// borne, il grossit indéfiniment. Source UNIQUE du geste, appelée avec leur dossier, leur motif et leur âge
// par `scripts/test/run.mjs`, `scripts/gates/toutes.mjs`, `scripts/ops/publier.mjs`
// (`node_modules/.cache/publication`), `scripts/ops/vigie.mjs` (`<arbre principal>/.git/vigie`) et
// `scripts/ops/synchroniser.mjs` (`<git-common-dir>/synchro-consommateurs`).
//
// Un effacement refusé ne change AUCUN verdict : sous Windows un fichier encore tenu par un enfant
// fraîchement tué refuse `rmSync`, et le run suivant réessaiera. Le dossier absent est un no-op —
// le premier run d'un arbre neuf n'a rien à purger.

import { rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { listerDossier } from './lister.mjs'

/**
 * Efface les fichiers de `dossier` dont le nom matche `motif` et dont la mtime est plus vieille que
 * `ageMs`.
 * @param {{ dossier: string, motif: RegExp, ageMs: number }} params
 * @returns {number} nombre de fichiers effacés (0 quand le dossier est absent).
 */
export function purgerPerimes({ dossier, motif, ageMs }) {
  const limite = Date.now() - ageMs
  let efface = 0
  for (const nom of listerDossier(dossier, { absent: 'vide' })) {
    if (!motif.test(nom)) continue
    const cible = join(dossier, nom)
    try {
      if (statSync(cible).mtimeMs < limite) {
        rmSync(cible, { force: true })
        efface += 1
      }
    } catch {
      /* fichier concurrent ou tenu : le bornage réessaiera au run suivant */
    }
  }
  return efface
}

/** Âge au-delà duquel une sortie de run part : 7 jours. Une session en cours garde la sienne. */
export const PEREMPTION_MS = 7 * 24 * 60 * 60 * 1000
