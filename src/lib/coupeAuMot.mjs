// COUPE AU MOT (#1806, R-M2 de `docs/plans/2026-08-16-spec-hud-combat.md`) — module PUR sans import,
// composé par `src/` et par `scripts/` (patron de `src/lib/ordre.mjs` : un `.mjs` entre dans la
// clôture statique de `npm run gates`, qui ne porte aucun module TypeScript). SEULE coupe d'un texte
// suivie d'une ellipse (garde `src/coupe-au-caractere-guard.test.ts`).

/** Espace où un texte peut se couper : tout blanc, sauf les insécables (U+00A0, U+2007, U+202F). */
const ESPACE_SECABLE = /[^\S\u00A0\u2007\u202F]/

/** `n` borne le RENDU, ellipse comprise. Le texte entier s'il tient en `n` caractères ; sinon le plus
 *  long préfixe de mots d'au plus `n - 1` caractères, coupé à une espace sécable, suivi de « … » : au plus
 *  `n` caractères. Les blancs de tête ne sont pas un mot : la coupe se cherche après eux. Seule sortie
 *  au-delà de `n` : un premier mot plus long que `n - 1` se rend entier (suivi de « … » si du texte le
 *  suit).
 *  @type {(s: string, n: number) => string} */
export function coupeAuMot(s, n) {
  if (s.length <= n) return s
  const debut = Math.max(0, s.search(/\S/))
  let coupe = n - 1
  while (coupe > debut && !ESPACE_SECABLE.test(s[coupe])) coupe--
  if (coupe <= debut) {
    const fin = s.slice(debut).search(ESPACE_SECABLE)
    coupe = fin < 0 ? s.length : debut + fin
  }
  const prefixe = s.slice(0, coupe).trimEnd()
  return prefixe.length === s.trimEnd().length ? prefixe : `${prefixe}…`
}
