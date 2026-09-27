/**
 * Table des PLANS de profondeur (z) du gabarit QUADRUPÈDE : un z par OS et par VUE, en données
 * nommées. SOURCE UNIQUE — consommée par le squelette (`buildQuadSkeleton` en profil,
 * `quadSkeletonForView` de face/dos) ET par le couple monté (`mountedRig` : le cavalier s'intercale
 * dans la MÊME échelle). Aucun littéral de z ne vit ailleurs (garde `quad-vues-ratchet.test.ts`).
 *
 * Échelle (croissant = plus près de l'œil). En PROFIL : pattes lointaines 1 · aile lointaine 2 ·
 * queue 3 · croupe 4 · tronc 5 · encolure et aile proche 6 · tête 7 · pattes proches 9.
 * De FACE/DOS le corps est vu de bout : l'encolure et la tête montent au-dessus du tronc, la paire
 * de pattes face à l'œil passe devant (4) et l'autre derrière (2), la queue passe derrière de face
 * et devant de dos.
 *
 * Ce module est une FEUILLE : il n'importe que des types (aucun cycle d'exécution avec
 * `quadSkeleton.ts`).
 */
import type { View } from '../facing';
import type { QuadBoneId } from './quadSkeleton';
import { parUnitesDeCode } from '../../../lib/ordre.mjs';

/** z d'un os pour chacune des 3 vues. Table TOTALE : tout `QuadBoneId` y figure. */
export type QuadZTable = Record<QuadBoneId, Record<View, number>>;

export const QUAD_Z: QuadZTable = {
  tronc: { profile: 5, front: 5, back: 5 },
  croupe: { profile: 4, front: 4, back: 4 },
  encolure: { profile: 6, front: 8, back: 8 },
  tete: { profile: 7, front: 9, back: 9 },
  // `nuque` = calque BAS de l'art de tête (scission `rigCutQuad*`, quadParts.ts) : il suit la tête
  // (même os porteur, même repère) mais porte son propre plan. De DOS il passe SOUS le tronc — le
  // raccord crinière→garrot se glisse entre les épaules, le crâne restant au-dessus (9).
  nuque: { profile: 6, front: 8, back: 4.5 },
  queue: { profile: 3, front: 2, back: 6 },
  // Ailes : en profil aileD = proche (par-dessus le flanc), aileG = lointaine (derrière le corps).
  // De FACE, l'aile pliée est sur les flancs, derrière le poitrail qui fait face à l'œil (2) ; de
  // DOS elle repose SUR le dos, donc au-dessus du tronc (6).
  aileD: { profile: 6, front: 2, back: 6 },
  aileG: { profile: 2, front: 2, back: 6 },
  // Membres : en profil, côté D = proche (9), côté G = lointain (1). De face/dos, c'est la PAIRE
  // face à l'œil qui est devant (antérieurs de face, postérieurs de dos) — le côté n'y joue pas.
  hautAvD: { profile: 9, front: 4, back: 2 },
  basAvD: { profile: 9, front: 4, back: 2 },
  piedAvD: { profile: 9, front: 4, back: 2 },
  hautAvG: { profile: 1, front: 4, back: 2 },
  basAvG: { profile: 1, front: 4, back: 2 },
  piedAvG: { profile: 1, front: 4, back: 2 },
  hautArD: { profile: 9, front: 2, back: 4 },
  basArD: { profile: 9, front: 2, back: 4 },
  piedArD: { profile: 9, front: 2, back: 4 },
  hautArG: { profile: 1, front: 2, back: 4 },
  basArG: { profile: 1, front: 2, back: 4 },
  piedArG: { profile: 1, front: 2, back: 4 },
};

/** Ordre PEINTRE des os pour une vue : z croissant, `QuadBoneId` en départage stable. */
export function quadZOrder(view: View): { id: QuadBoneId; z: number }[] {
  return (Object.entries(QUAD_Z) as [QuadBoneId, Record<View, number>][])
    .map(([id, byView]) => ({ id, z: byView[view] }))
    .sort((a, b) => a.z - b.z || parUnitesDeCode(a.id, b.id));
}

/**
 * Amplitude MAXIMALE du plan d'un fragment de décor, RELATIVE au plan de son os porteur
 * (`QuadDecoFragment.plan`) : un décor s'intercale autour de l'os qui le porte, il ne traverse
 * pas la pile. La valeur est STRICTEMENT inférieure à l'écart minimal entre deux plans d'os
 * voisins de la table (0,5 — de dos : croupe 4 · nuque 4,5 · tronc 5) : à la borne, le z d'un
 * fragment reste strictement entre le plan de son os et celui du voisin, jamais égal — le tri
 * peintre (`sortByZ`, comparaison de z seule) n'a donc aucune égalité à départager entre un
 * fragment et un os. Cliquets : `quad-vues-ratchet.test.ts` (borne authorée, séparation stricte).
 */
export const QUAD_DECO_PLAN_MAX = 0.25;

/** Plans du CAVALIER intercalés dans l'échelle de la monture, par vue (`mountedRig`). */
export interface QuadRiderZ { corps: number; jambeProche: number; jambeLointaine: number }

/**
 * Où s'intercale le cavalier, VUE PAR VUE — la position de l'œil autour de la monture décide.
 * PROFIL : la jambe lointaine passe sous le barillet, le corps au-dessus de l'encolure, la jambe
 * proche par-dessus la tête. DE FACE : le poitrail est la partie la plus proche de l'œil (les deux
 * jambes passent derrière lui) et la tête redressée est devant le cavalier. DE DOS : c'est la
 * croupe qui est au plus près (les jambes passent derrière elle) et la tête de la monture est à
 * l'autre bout de la bête — le cavalier la COUVRE.
 */
export const QUAD_RIDER_Z: Record<View, QuadRiderZ> = {
  profile: {
    corps: QUAD_Z.encolure.profile + 0.6,
    jambeProche: QUAD_Z.tete.profile + 1.2,
    jambeLointaine: QUAD_Z.tronc.profile - 0.5,
  },
  front: {
    corps: QUAD_Z.tete.front - 0.5,
    jambeProche: QUAD_Z.tronc.front - 0.5,
    jambeLointaine: QUAD_Z.tronc.front - 0.5,
  },
  back: {
    corps: QUAD_Z.tete.back + 0.6,
    jambeProche: QUAD_Z.tronc.back - 0.5,
    jambeLointaine: QUAD_Z.tronc.back - 0.5,
  },
};
