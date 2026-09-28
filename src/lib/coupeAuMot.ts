/** COUPE AU MOT (`docs/plans/2026-08-16-spec-hud-combat.md`, R-M2) : le texte entier s'il tient en `n`
 *  caractères ; sinon le plus long préfixe de mots coupé à une espace, suivi de « … ». Une espace
 *  insécable ne coupe pas. Un premier mot plus long que `n` se rend entier. SEULE coupe d'un texte
 *  suivie d'une ellipse sous `src/` (garde `src/coupe-au-caractere-guard.test.ts`). */
const ESPACE_SECABLE = /[^\S\u00A0\u202F]/;
export function coupeAuMot(s: string, n: number): string {
  if (s.length <= n) return s;
  let coupe = n;
  while (coupe > 0 && !ESPACE_SECABLE.test(s[coupe])) coupe--;
  if (coupe === 0) {
    const fin = s.search(ESPACE_SECABLE);
    coupe = fin < 0 ? s.length : fin;
  }
  const prefixe = s.slice(0, coupe).trimEnd();
  return prefixe.length === s.trimEnd().length ? prefixe : `${prefixe}…`;
}
