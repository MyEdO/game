// Outillage LOCAL d'un arbre de travail (#1679 L1c) : vitest/tsc doivent être installés DANS l'arbre
// qui lance le runner. Sans `node_modules` propre, la résolution ascendante de Node remonte
// SILENCIEUSEMENT vers l'arbre principal et le runner joue l'outillage d'un AUTRE arbre — mesuré par
// `scripts/ops/sondes/audit-2026-09-01/probe-resolve.mjs`. Le refus se prononce ICI, en NOMMANT
// l'arbre et la cause, plutôt que par un `Cannot find module` non attribué.
// PORTÉE : TOUT script npm qui joue un outil (vite, tsc, tsx, vitest, eslint) passe par
// `scripts/lancer-local.mjs` (13 scripts), plus `scripts/test/run.mjs`, `scripts/typecheck-fast.mjs`
// et `scripts/docs/build-all.mjs` (le tsx des générateurs de docs) ; un outil chargé DANS le processus
// (l'eslint du pre-commit, `scripts/guards/lib/lintStage.mjs`) passe par `moduleLocal`.
// Restent NON COUVERTES deux classes, mesurées :
//  · un `npx <outil>` tapé à la main hors des scripts npm (session, en-têtes « Lancer : npx tsx … »
//    des scripts de QC/galeries) — la remontée de Node y sert encore l'arbre parent ;
//  · un fichier lancé DIRECTEMENT par son shebang `#!/usr/bin/env -S npx tsx` : `scripts/map/check.mts`
//    et les trois générateurs de campagne (`scripts/{arene,barge-du-sel,loup-et-saumure}/generate.mjs`).
// Zéro script `.mjs`/`.mts` ne spawne un outil PAR SON NOM (`spawn('tsx'…)`, `execFileSync('vitest'…)`).
import { existsSync } from 'node:fs'

/**
 * REND `null` si `entree` (le fichier que l'appelant va JOUER) existe, sinon le message de refus qui
 * nomme l'arbre, l'outil et la cause. `existe` est injecté pour la mesure ; par défaut, le disque.
 */
export function refusOutillageLocal(racine, outil, entree, existe = existsSync) {
  if (existe(entree)) return null
  return [
    `[outillage] ${outil} n'est pas installé dans cet arbre : ${racine}`,
    `[outillage] attendu : ${entree}`,
    `[outillage] la remontée de Node servirait celui d'un AUTRE arbre (l'arbre principal) — refus.`,
    `[outillage] lancer \`npm ci\` (ou \`npm install\`) à la racine de cet arbre.`,
  ].join('\n')
}
