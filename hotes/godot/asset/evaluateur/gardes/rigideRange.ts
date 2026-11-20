/**
 * GARDE DU RIGIDE RANGÉ (#4351) : un objet rangé, posé où le jeu le range (`rangerLesRigides`, `../rangement.ts`), ne
 * s'enfonce pas dans ce qui est porté. À un échantillon, une arête du rigide qui traverse un mesh skinné montré, le
 * corps ou un vêtement par son endroit (`endroitDe`, `pile.ts`), a un bout derrière lui (`croiserLaCouverture`) :
 * l'objet est dans ce mesh si ce bout est à plus de `ECART_DE_SUIVI_M` derrière. Les meshes de l'élément qui offre son
 * emplacement n'y entrent pas : le jeu pose l'objet dans sa case, entre ses parois (`MontageDeComposition._appuyer`).
 * `objet-dans-un-vetement` : un écart par (rigide, mesh, clip), le repos à part, à son pire instant, de valeur la plus
 * grande profondeur derrière.
 */
import type { Mesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import type { Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { positionsDe } from './traversee.ts';
import { couvertureDe, croiserLaCouverture } from '../../pile.ts';

const GARDE = 'rigideRange';

/** Un mesh rigide rangé, ses arêtes (`aretesDe`), et ce qui est porté contre quoi il se mesure : chaque mesh skinné
 *  montré hors de l'élément qui offre son emplacement, et ses triangles, par trois indices. */
export interface RigideRange {
  readonly rigide: Mesh;
  readonly aretes: Uint32Array;
  readonly portes: readonly { readonly mesh: Mesh; readonly indices: ArrayLike<number> }[];
}

/** La profondeur à laquelle `rigide` s'enfonce dans `porte` à un échantillon, `clip` et `t` absents au repos. */
export interface RigideDUnEchantillon {
  readonly rigide: Mesh;
  readonly porte: Mesh;
  readonly clip?: string;
  readonly t?: number;
  readonly profondeur: number;
}

const AXES = [0, 1, 2];

/** Les triangles de `indices` dont la boîte touche celle de `bornes` (min puis max, par axe), sur les positions `p`. */
function trianglesVoisins(p: Float32Array, indices: ArrayLike<number>, bornes: readonly number[]): number[] {
  const voisins: number[] = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const coins = [indices[t], indices[t + 1], indices[t + 2]];
    if (AXES.every((axe) => Math.max(...coins.map((s) => p[s * 3 + axe])) >= bornes[axe] && Math.min(...coins.map((s) => p[s * 3 + axe])) <= bornes[3 + axe])) voisins.push(...coins);
  }
  return voisins;
}

/** Pour chaque rigide de `ranges` et chaque mesh porté qu'une de ses arêtes traverse dans `pose`, la plus grande
 *  profondeur d'un bout d'arête derrière ce mesh. */
export function mesurerLesRigidesRanges(ranges: readonly RigideRange[], pose: Pick<Pose, 'positions'> & { readonly clip?: string; readonly t?: number }): RigideDUnEchantillon[] {
  const mesures: RigideDUnEchantillon[] = [];
  for (const { rigide, aretes, portes } of ranges) {
    const r = positionsDe(pose, rigide);
    const bornes = [...AXES.map(() => Infinity), ...AXES.map(() => -Infinity)];
    for (let i = 0; i < r.length; i++) {
      bornes[i % 3] = Math.min(bornes[i % 3], r[i]);
      bornes[3 + (i % 3)] = Math.max(bornes[3 + (i % 3)], r[i]);
    }
    for (const { mesh, indices } of portes) {
      const p = positionsDe(pose, mesh);
      const voisins = trianglesVoisins(p, indices, bornes);
      if (!voisins.length) continue;
      const couverture = couvertureDe(p, voisins);
      let profondeur = 0;
      for (let k = 0; k + 1 < aretes.length; k += 2) {
        const [a, b] = [aretes[k] * 3, aretes[k + 1] * 3];
        croiserLaCouverture(r[a], r[a + 1], r[a + 2], r[b], r[b + 1], r[b + 2], couverture, (part, ea) => {
          profondeur = Math.max(profondeur, ea > 0 ? ea : ea * (1 - 1 / part));
        });
      }
      if (profondeur > 0) mesures.push({ rigide, porte: mesh, ...(pose.clip === undefined ? {} : { clip: pose.clip, t: pose.t }), profondeur });
    }
  }
  return mesures;
}

/** `objet-dans-un-vetement` : par (rigide, mesh porté, clip) de `mesures`, le repos à part, son pire échantillon si sa
 *  profondeur dépasse `ECART_DE_SUIVI_M`. */
export function gardeRigideRange(mesures: readonly RigideDUnEchantillon[], libelle: LibelleDeMesh): Ecart[] {
  const pires = new Map<string, RigideDUnEchantillon>();
  for (const m of mesures) {
    const cle = [libelle(m.rigide), libelle(m.porte), m.clip ?? ''].join('\u0000');
    if (m.profondeur > (pires.get(cle)?.profondeur ?? ECART_DE_SUIVI_M)) pires.set(cle, m);
  }
  return [...pires.values()].map((m): Ecart => ({
    garde: GARDE,
    code: 'objet-dans-un-vetement',
    mesh: libelle(m.rigide),
    ...(m.clip === undefined ? {} : { clip: m.clip, t: m.t }),
    valeur: m.profondeur,
    seuil: ECART_DE_SUIVI_M,
    detail: `objet rangé à ${(m.profondeur * 1000).toFixed(1)} mm dans ${libelle(m.porte)}${m.clip === undefined ? ', au repos' : ''}`,
  }));
}
