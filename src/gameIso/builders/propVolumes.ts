/**
 * COMPILATION VOLUMIQUE d'un décor — la recette locale d'un `PropData` (`volume.primitives`) devient
 * des `Face[]` du pivot, en espace MONDE. PUR au sens le plus strict du builder : ni scène, ni caméra,
 * ni React, ni store, ni `three` ne sont importés ici — l'appelant apporte le type de décor et son
 * ANCRAGE (point monde, cap, altitude du pied), d'où qu'il vienne.
 *
 * REPÈRE ET UNITÉS : la recette est authorée dans le repère LOCAL du type, en MÈTRES sur les trois axes
 * (origine à l'ancre, `hM` au-dessus du pied, cf. la RÈGLE D'UNITÉ de `data/props.types.ts`). Le monde,
 * lui, est en CASES : ce builder est la PREMIÈRE des deux coutures qui traduisent, par DIVISION du plan
 * par le `metresPerTile` de la scène (`mpt`) — la seconde est la résolution d'assise
 * (`noyau/monde/seating.ts`). La hauteur, elle, est métrique des deux côtés : rien à diviser.
 * Le cap (défaut `S` chez l'appelant) fait tourner la recette UNE fois autour de l'origine locale ;
 * `baseHeightM` s'ajoute UNE fois à chaque hauteur.
 *
 * GÉOMÉTRIE : les polygones locaux d'une primitive viennent de `polygonesDePrimitive`
 * (`data/props.types.ts`), leur SEULE définition — celle même que `validatePropCatalog` vérifie en
 * coquille close. Ce module n'y ajoute qu'une transformation rigide : rotation au cap, translation à
 * l'ancre, montée au pied.
 *
 * ORIENTATION : chaque polygone sort tourné vers le DEHORS de la primitive qui le porte, dans la
 * convention du rendu (`(x, y, h) → three (X, Y, Z) = (x, h, y)`, `backends/webgl/worldTris:gpToWorld`),
 * et le DÉCLARE par `Face.oriented` — la cuisson (`backends/webgl/sceneMeshes`) propage ce sens tel quel
 * pour la carte d'ombre au lieu de le re-dériver du centre de la carte.
 */
import { polygonesDePrimitive, rotatePropLocal, type PropData } from '../../data/props.types';
import type { Dir4 } from '../../geometry/dir8';
import type { Face, GP } from './types';

/** ANCRAGE d'une recette dans le monde : le point (fractionnaire, en cases) où son origine locale se
 *  pose, le cap qui la tourne, l'altitude métrique de son pied, et l'entité qui la porte quand il y en
 *  a une — une feature de façade ou un ornement de bâtiment n'en a aucune (`entId` absent : rien à
 *  désigner au pointeur). */
export interface AncrageVolume {
  ancre: { x: number; y: number };
  /** Cap CARDINAL du décor — le type refuse la diagonale (cf. `Dir4`, #1680 ligne 3). */
  facing: Dir4;
  /** Altitude métrique du PIED de la recette (surface de la case + surélévation déclarée). */
  baseHeightM: number;
  entId?: string;
}

/**
 * Les faces MONDE d'un décor volumique : recette locale × cap × ancre, posées sur `baseHeightM`.
 * L'ancre est un point MONDE quelconque — le centre d'une case pour un prop d'entité, un point
 * fractionnaire d'arête pour une feature de façade, le milieu d'une empreinte pour un ornement de
 * faîte : la recette y subit la MÊME translation rigide. Chaque face porte le matériau de sa primitive
 * (`domain: 'prop'`) et, s'il y en a un, l'id de l'ENTITÉ sur lequel le picking la résout une fois
 * fondue dans la géométrie commune.
 * `mpt` est un paramètre DISTINCT de l'ancrage : une ancre est un point, un cap et un pied — l'échelle
 * de la scène n'en fait pas partie.
 */
export function buildPropVolumes(prop: PropData, ancrage: AncrageVolume, mpt: number): Face[] {
  const { ancre, facing, baseHeightM, entId } = ancrage;
  const out: Face[] = [];
  for (const primitive of prop.volume?.primitives ?? []) {
    const material = { domain: 'prop' as const, id: primitive.material };
    for (const poly of polygonesDePrimitive(primitive)) {
      const monde: GP[] = poly.map((p) => {
        const [rx, ry] = rotatePropLocal(p.xM / mpt, p.yM / mpt, facing);
        return { x: ancre.x + rx, y: ancre.y + ry, h: baseHeightM + p.hM };
      });
      out.push({ poly: monde, material, oriented: true, ...(entId ? { entId } : {}) });
    }
  }
  return out;
}
