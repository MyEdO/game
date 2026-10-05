/**
 * CONTRAT du harnais de mesure de volume (`scripts/qc/mesure-volume.mts`), en module PUR.
 * Réf #635 (contrat écart∧part-claire) + #638 volet B (clause quasi-blanc).
 */

export type Verdict = 'NON MESURABLE' | 'ECHEC' | 'NON-REFUTE';

/** Seuils du CONTRAT — trou empirique mesuré [8,4 ; 12,0] sur 163 vues à écart ≥ 30, sweep
 *  2026-07-20 (#635) ; ≥ 10 subsume l'ancrage P90=base (P90 sur la base ⇒ < 10 % des pixels
 *  au-dessus du seuil clair). */
export const CONTRAT_ECART_MIN = 30;
export const CONTRAT_CLAIR_MIN = 10;
/** #638 volet B, arbitrage user 2026-07-20 : une matière à base ≥ ce seuil est QUASI-BLANCHE —
 *  au-delà, ≤ 18 points de marge vers le blanc pur, aucune surface ne peut être « plus claire »
 *  que sa base. Le volume s'y valide par la PROFONDEUR D'OMBRE (miroir de la part claire vers le
 *  bas), jamais par la part claire. */
export const CONTRAT_QUASI_BLANC_BASE_MIN = 82;

/** Le CONTRAT, en code — le harnais RÉFUTE, il ne certifie JAMAIS (cf. commentaire d'en-tête de
 *  `mesure-volume.mts`). Palette INVERSÉE à part (défaut de DONNÉE, pas de rendu). Régime NORMAL
 *  (base < seuil quasi-blanc) : écart ∧ part claire ∧ NON p90SurBase. Régime QUASI-BLANC (base ≥
 *  seuil) : écart ∧ part SOMBRE (miroir) ∧ NON p10SurBase (le p10 doit quitter la base — sinon
 *  aucune ombre, blanc plat). */
export function computeVerdict(v: {
  pixels: number;
  matiere: string | null;
  lBase: number | null;
  lLumiere: number | null;
  ecart: number;
  partClaire: number | null;
  partSombre: number | null;
  p90SurBase: boolean;
  p10SurBase: boolean;
  slotHasTenueArt: boolean;
}): { verdict: Verdict; raisons: string[] } {
  if (v.matiere === null || v.pixels === 0) {
    return v.slotHasTenueArt
      ? { verdict: 'ECHEC', raisons: ['couverture'] }
      : { verdict: 'NON MESURABLE', raisons: ["légitime: pas d'art de tenue au slot"] };
  }
  if (v.lLumiere !== null && v.lBase !== null && v.lLumiere <= v.lBase) {
    return { verdict: 'ECHEC', raisons: ['palette inversée'] };
  }
  const raisons: string[] = [];
  const nearWhite = v.lBase !== null && v.lBase >= CONTRAT_QUASI_BLANC_BASE_MIN;
  if (v.ecart < CONTRAT_ECART_MIN) raisons.push('écart');
  if (nearWhite) {
    if (v.partSombre !== null && v.partSombre < CONTRAT_CLAIR_MIN) raisons.push('part sombre');
    if (v.p10SurBase) raisons.push('ancrage');
  } else {
    if (v.partClaire !== null && v.partClaire < CONTRAT_CLAIR_MIN) raisons.push('part claire');
    if (v.p90SurBase) raisons.push('ancrage');
  }
  return raisons.length ? { verdict: 'ECHEC', raisons } : { verdict: 'NON-REFUTE', raisons: [] };
}
