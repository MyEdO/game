/**
 * GARDE DES PIEDS AU SOL (#2972) : à chaque (clip, t), le sommet le plus bas du corps n'est pas sous `-SOL_TOLERANCE_M` ;
 * pour un clip déclaré au sol, pas non plus au-dessus de `+SOL_TOLERANCE_M`. Seuil :
 * `scripts/personnage-3d/animation.py:33`.
 */
import type { Ecart } from '../ecart.ts';

export const SOL_TOLERANCE_M = 0.005;

/** La hauteur du sommet le plus bas du corps à un instant d'un clip. */
export interface NiveauDuCorps {
  readonly clip: string;
  readonly t: number;
  readonly plusBas: number;
}

/** La hauteur (Y monde) du sommet le plus bas de `positions` pour les meshes `corps`. */
export function plusBas(positions: ReadonlyMap<string, Float32Array>, corps: readonly string[]): number {
  let min = Infinity;
  for (const nom of corps) {
    const p = positions.get(nom);
    for (let i = 1; p && i < p.length; i += 3) min = Math.min(min, p[i]);
  }
  return min;
}

export function gardePiedsAuSol(niveaux: readonly NiveauDuCorps[], clipsAuSol: ReadonlySet<string> = new Set()): Ecart[] {
  const parClip = new Map<string, NiveauDuCorps[]>();
  for (const n of niveaux) {
    const liste = parClip.get(n.clip);
    if (liste) liste.push(n);
    else parClip.set(n.clip, [n]);
  }
  return [...parClip].flatMap(([clip, liste]) => {
    const ecarts: Ecart[] = [];
    const sous = liste.filter((n) => n.plusBas < -SOL_TOLERANCE_M);
    if (sous.length) {
      const pire = sous.reduce((a, b) => (b.plusBas < a.plusBas ? b : a));
      ecarts.push({ garde: 'piedsAuSol', code: 'sous-le-sol', clip, t: pire.t, valeur: pire.plusBas, seuil: -SOL_TOLERANCE_M, detail: `${sous.length}/${liste.length} instant(s) sous le sol` });
    }
    const dessus = clipsAuSol.has(clip) ? liste.filter((n) => n.plusBas > SOL_TOLERANCE_M) : [];
    if (dessus.length) {
      const pire = dessus.reduce((a, b) => (b.plusBas > a.plusBas ? b : a));
      ecarts.push({ garde: 'piedsAuSol', code: 'au-dessus-du-sol', clip, t: pire.t, valeur: pire.plusBas, seuil: SOL_TOLERANCE_M, detail: `${dessus.length}/${liste.length} instant(s) décollé(s) d’un clip au sol` });
    }
    return ecarts;
  });
}
