/**
 * Les triangles du volume du monde (`volumeDuMonde`) tels qu'un hôte les lit, morceau par morceau, et ceux que le masque
 * d'un retrait (`retraitDuMonde`) laisse montrés.
 */
import type { MorceauDuMonde, RetraitDuMonde, VolumeDuMonde } from './volume';
import { depuisBase64 } from '../../../lib/base64';

type Geometrie = Pick<MorceauDuMonde, 'positions' | 'normales' | 'couleurs' | 'cases' | 'surfaces'>;

/** Les triangles d'une géométrie du monde : les hauteurs, les abscisses et les profondeurs (Z, au sud) de ses sommets, la
 *  normale et la couleur de son premier sommet, sa case, et la surface qui le porte. */
export function triangles(g: Geometrie) {
  return Array.from({ length: g.positions.length / 9 }, (_, t) => {
    const surface = g.surfaces.find((m) => m.debut <= t * 3 && t * 3 < m.fin)!;
    return {
      ys: [1, 4, 7].map((k) => g.positions[t * 9 + k]),
      xs: [0, 3, 6].map((k) => g.positions[t * 9 + k]),
      zs: [2, 5, 8].map((k) => g.positions[t * 9 + k]),
      normale: g.normales.slice(t * 9, t * 9 + 3),
      couleur: g.couleurs.slice(t * 12, t * 12 + 4),
      case: g.cases.slice(t * 3, t * 3 + 3),
      matiere: surface.matiere,
      surface,
    };
  });
}

/** Les triangles de tous les morceaux du volume `v`, chacun avec son morceau. */
export const trianglesDuVolume = (v: VolumeDuMonde) => v.morceaux.flatMap((m) => triangles(m).map((t) => ({ ...t, morceau: m })));

/** Les triangles du volume `v` que le masque `r` laisse montrés : l'octet de leur case, au plan de leur morceau, vaut 0. */
export function trianglesMontres(v: VolumeDuMonde, r: RetraitDuMonde) {
  const octets = depuisBase64(r.masque);
  return trianglesDuVolume(v).filter((t) => octets[(t.morceau.rangee + t.case[1]) * r.largeur + t.case[0]] === 0);
}

/** Les cases `x,y,z` des triangles du volume `v` que le masque `r` laisse montrés. */
export const casesMontrees = (v: VolumeDuMonde, r: RetraitDuMonde): Set<string> => new Set(trianglesMontres(v, r).map((t) => t.case.join(',')));
