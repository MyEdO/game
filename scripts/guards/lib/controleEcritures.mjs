import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { photoArbre } from './photoArbre.mjs'
import { listerDossier } from './lister.mjs'

const INTERCEPTEUR = new URL('./intercepterEcritures.mjs', import.meta.url).href

export function ouvrirControleEcritures(racine, env = process.env) {
  const avant = photoArbre(racine)
  if (avant.erreur) throw new Error(`photo impossible : ${avant.erreur}`)
  const dossier = mkdtempSync(join(tmpdir(), 'tests-sans-ecriture-'))
  let ferme = false
  return {
    env: { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import=${INTERCEPTEUR}`.trim(),
      WFRP_TESTS_RACINE: racine, WFRP_TESTS_REFUS: join(dossier, 'refus') },
    fermer() {
      if (ferme) return []
      ferme = true
      try {
        const apres = photoArbre(racine)
        const refus = listerDossier(dossier).flatMap((f) => readFileSync(join(dossier, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
        if (apres.erreur || apres.texte !== avant.texte) refus.push(`[tests] REFUS arbre modifié ou photo impossible : ${apres.erreur ?? apres.texte}`)
        return refus
      } finally { rmSync(dossier, { recursive: true, force: true }) }
    },
  }
}
