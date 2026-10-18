// Verrou MACHINE des gestes lourds (#2603, #2435, #2517) : une instance de `prendreVerrou` (`./verrou.mjs`),
// sous le `.git` commun (`npm ci` efface `node_modules/.cache`). Preneurs : `PRENEURS`, et `scripts/gates/toutes.mjs`.
import { join } from 'node:path'
import { depotDe, dossierGitCommun } from '../guards/lib/gitPorte.mjs'
import { IDENTITE_MESUREE } from './identiteMesuree.mjs'

/** Vrai si `argv` est un geste LOURD de `scripts/docs/build-all.mjs` (#2603) : tout mode, hors `--code` et `--check --only`. */
export const estGesteLourd = (argv) => !argv.includes('--code') && !(argv.includes('--check') && argv.includes('--only'))

/** Les points d'entrée qui prennent le verrou, et le juge de leurs arguments (#2603, #2586). */
const PRENEURS = new Map([
  ['scripts/test/run.mjs', () => true],
  ['scripts/test/node-tests.mjs', () => true],
  ['scripts/gates/testsSansEcriture.mjs', () => true],
  ['scripts/test/perimetre.mjs', () => true],
  ['scripts/docs/build-all.mjs', estGesteLourd],
])

/** Séparateurs de commandes d'un script `package.json`. */
const SEPARATEURS = new Set(['&&', '||', ';', '|'])

/**
 * Vrai si le script `package.json` `script` lance un preneur du verrou (`PRENEURS`) en geste lourd (#2586). PURE.
 * @param {string | undefined} script
 */
export function lanceUnGesteLourd(script) {
  const mots = String(script ?? '').split(/\s+/).filter(Boolean)
  return mots.some((mot, i) => {
    const juge = PRENEURS.get(mot.replace(/^\.\//, ''))
    if (!juge) return false
    const fin = mots.findIndex((m, j) => j > i && SEPARATEURS.has(m))
    return juge(mots.slice(i + 1, fin === -1 ? undefined : fin))
  })
}

/** L'attente d'un geste lourd : échéance par tenant (valeur maison), un pas de 10 s. */
export const ATTENTE_GESTES_LOURDS = Object.freeze({ echeanceMs: 30 * 60 * 1000, pasMs: 10_000, parTenant: true })

/**
 * Le verrou machine des gestes lourds du dépôt de `racine` : `{ chemin, libelle, attente, identite }`, à
 * passer à `prendreVerrou`. LÈVE si le `.git` commun est introuvable (`dossierGitCommun`).
 * @param {string} racine
 */
export function verrouGestesLourds(racine) {
  const commun = dossierGitCommun(depotDe(racine))
  if (!commun.disponible) throw new Error(commun.raison)
  return {
    chemin: join(commun.valeur, 'gestes-lourds.verrou'),
    libelle: 'un geste lourd tient la machine',
    attente: ATTENTE_GESTES_LOURDS,
    identite: { ...IDENTITE_MESUREE, pasMs: ATTENTE_GESTES_LOURDS.pasMs },
  }
}
