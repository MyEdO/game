// Verrou de SUITE à l'échelle de la machine (#1679 L1c-M7, #2187) : deux suites COMPLÈTES concurrentes se
// volent cœurs et mémoire. Preneurs : `scripts/test/run.mjs` (`npm test`) et `scripts/gates/toutes.mjs`,
// qui le prend pour chaque gate lançant ce lanceur, hors du chronomètre de la gate.
import os from 'node:os'
import path from 'node:path'
import { prendreVerrou } from './verrou.mjs'

/** Opt-out EXPLICITE : `WFRP_SUITE_LOCK=0` (bancs `run-capture.test.mjs` ; enfant d'une gate qui tient le verrou). */
export const OPT_OUT_SUITE = 'WFRP_SUITE_LOCK'

/** Chemin, libellé et attente du verrou de suite : la seule définition, partagée par ses preneurs. */
export const VERROU_SUITE = Object.freeze({
  chemin: path.join(os.tmpdir(), 'wfrp-suite.lock'),
  libelle:
    'une suite complète tourne déjà sur cette machine (deux suites concurrentes se volent cœurs et mémoire) ' +
    `— opt-out explicite : ${OPT_OUT_SUITE}=0`,
  attente: Object.freeze({ pasMs: 15_000, echeanceMs: 20 * 60 * 1000 }),
})

/** Ce qu'annonce un preneur à chaque pas de son attente. */
export const attenteDeSuite = (tenant) =>
  `suite d'un autre arbre en cours (PID ${tenant?.pid ?? '?'}, ${tenant?.cwd ?? 'arbre inconnu'}) : ` +
  `attente ${VERROU_SUITE.attente.pasMs / 1000} s, échéance ${VERROU_SUITE.attente.echeanceMs / 60000} min`

/**
 * Le verrou de suite est-il REQUIS pour ce run ? Un positionnel qui désigne un DOSSIER est une suite
 * (`npm test src` énumère 1 580 fichiers) : seul un run dont CHAQUE filtre nomme un FICHIER s'en passe.
 * `estFichier` est injecté pour la mesure ; le lanceur y met un `statSync().isFile()`.
 */
export function verrouRequis(filtres, estFichier) {
  return filtres.length === 0 || !filtres.every((f) => estFichier(f))
}

/**
 * PREND le verrou de suite sous son attente (`VERROU_SUITE`), `annoncer(tenant)` à chaque pas. REND la
 * forme de `prendreVerrou`, ou `{ etat: 'ignore', avertissement? }` : run non `requis`, ou opt-out.
 * `prendre` vaut `prendreVerrou` (bloquant) ou `prendreVerrouAsync` ; `verrou` et `injections`
 * (`fs`, `estVivant`, `dormir`, `horloge`…) s'injectent pour la mesure.
 */
export function prendreVerrouDeSuite({
  requis = true,
  env = process.env,
  commande,
  cwd,
  annoncer,
  prendre = prendreVerrou,
  verrou = VERROU_SUITE,
  ...injections
}) {
  if (!requis) return { etat: 'ignore' }
  if (env[OPT_OUT_SUITE] === '0') {
    return {
      etat: 'ignore',
      avertissement:
        `[verrou] ce lanceur ne prend pas le verrou de suite (${OPT_OUT_SUITE}=0) : seul l'appelant qui a ` +
        "posé l'opt-out sait s'il le tient.",
    }
  }
  return prendre({ chemin: verrou.chemin, libelle: verrou.libelle, commande, cwd, attente: { ...verrou.attente, annoncer }, ...injections })
}
