/**
 * GARDE DES SEGMENTS DU GABARIT (#3097) : au repos, chaque os de `echellesDesOs` (`poseDuGabarit`) se mesure par
 * l'étendue, sur chacun de ses axes locaux, des sommets du corps qu'il mène seul, rapportée à la même étendue au repos
 * sans gabarit. Chaque rapport suit la composante de S_b de son axe à `TOLERANCE_ECHELLE` près, en écart relatif, que
 * l'os ait un os enfant ou non (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base »).
 */
import { Vector3, type SkinnedMesh } from 'three';
import type { Ecart } from '../ecart.ts';
import type { Pose } from '../echantillonnage.ts';
import type { PoseDuGabarit } from '../../gabarit.ts';
import { TOLERANCE_ECHELLE } from './pistesDEchelle.ts';
import { POIDS_NEGLIGEABLE } from './poids.ts';

const GARDE = 'segments';
const AXES = ['x', 'y', 'z'] as const;

type Triplet<T> = readonly [T, T, T];
const parAxe = <T>(f: (a: 0 | 1 | 2) => T): Triplet<T> => [f(0), f(1), f(2)];

export interface MesureDeSegment {
  readonly os: string;
  /** S_b de l'os, `echellesDesOs[os]`. */
  readonly attendu: Triplet<number>;
  /** Par axe local, l'étendue au gabarit rapportée à l'étendue sans gabarit ; `null` sans étendue sur cet axe. */
  readonly rapport: Triplet<number | null>;
}

export interface MesuresDesSegments {
  readonly segments: readonly MesureDeSegment[];
  /** Le plus grand |rapport − attendu| / attendu des axes mesurés. */
  readonly ecartALEchelle: number;
}

/** Par os de `noms`, l'étendue sur chacun de ses axes locaux, dans `pose`, des sommets de `corps` qu'il mène seul. */
export function etenduesDesSegments(pose: Pose, corps: readonly SkinnedMesh[], noms: readonly string[]): Map<string, Triplet<number>> {
  const parOs = new Map(noms.map((nom) => {
    const matrice = pose.os.get(nom);
    if (!matrice) throw new Error(`segments : os absent ${nom}`);
    return [nom, { inverse: matrice.clone().invert(), min: [Infinity, Infinity, Infinity] as number[], max: [-Infinity, -Infinity, -Infinity] as number[] }] as const;
  }));
  const sommet = new Vector3();
  for (const m of corps) {
    const positions = pose.positions.get(m);
    if (!positions) throw new Error(`segments : mesh absent ${m.name}`);
    const indices = m.geometry.attributes.skinIndex;
    const poids = m.geometry.attributes.skinWeight;
    for (let i = 0; i < indices.count; i++) {
      let j = -1, w = 0;
      for (let k = 0; k < indices.itemSize; k++) if (poids.getComponent(i, k) > w) { w = poids.getComponent(i, k); j = indices.getComponent(i, k); }
      const segment = w >= 1 - POIDS_NEGLIGEABLE ? parOs.get(m.skeleton.bones[j]?.name ?? '') : undefined;
      if (!segment) continue;
      sommet.fromArray(positions, i * 3).applyMatrix4(segment.inverse).toArray().forEach((c, a) => {
        segment.min[a] = Math.min(segment.min[a], c);
        segment.max[a] = Math.max(segment.max[a], c);
      });
    }
  }
  return new Map([...parOs].map(([nom, { min, max }]) => [nom, parAxe((a) => Math.max(0, max[a] - min[a]))]));
}

export function gardeSegments(
  sansGabarit: ReadonlyMap<string, Triplet<number>>, auGabarit: ReadonlyMap<string, Triplet<number>>, pose: Pick<PoseDuGabarit, 'echellesDesOs'>,
): { mesures: MesuresDesSegments; ecarts: Ecart[] } {
  const ecarts: Ecart[] = [];
  let ecartALEchelle = 0;
  const segments = Object.entries(pose.echellesDesOs).map(([os, attendu]): MesureDeSegment => {
    const avant = sansGabarit.get(os), apres = auGabarit.get(os);
    const rapport = parAxe((a) => (avant && apres && avant[a] > 0 ? apres[a] / avant[a] : null));
    rapport.forEach((r, a) => {
      if (r === null) {
        ecarts.push({ garde: GARDE, code: 'segment-indetectable', valeur: `${os}.${AXES[a]}`, seuil: null, detail: `aucune étendue sur l’axe ${AXES[a]} des sommets menés par ${os} seul` });
        return;
      }
      const ecart = Math.abs(r - attendu[a]) / attendu[a];
      ecartALEchelle = Math.max(ecartALEchelle, ecart);
      if (ecart > TOLERANCE_ECHELLE) ecarts.push({ garde: GARDE, code: 'segment-hors-echelle', valeur: ecart, seuil: TOLERANCE_ECHELLE, detail: `${os}.${AXES[a]} : écart relatif à S_b ${attendu[a]} ; étendue à ${r} fois celle sans gabarit` });
    });
    return { os, attendu, rapport };
  });
  return { mesures: { segments, ecartALEchelle }, ecarts };
}
