/**
 * APPLICATION de la politique de visibilité (`state/visibility.ts`) en facteur multiplicatif de
 * couleur. La loi (qui est vu) est ailleurs et partagée ; ici ne vivent que le mappage état → teinte,
 * pris au catalogue d'ambiance (`AMBIANCE.fogTint`, donnée éditable), et son ÉCHANTILLONNAGE.
 *
 * CHAMP CONTINU (#1176, C6) : la politique est par CASE, le RENDU ne l'est pas. `visibilityField`
 * rend un échantillonneur (`TintAt`) qui interpole bilinéairement les quatre centres de case
 * entourant une position de grille CONTINUE — un sommet de face tombe où il tombe, un mur d'arête est
 * à cheval sur deux cases, et la frontière du brouillard se fond entre les centres au lieu de suivre
 * le quadrillage. Un appelant qui n'a qu'une case à donner (un corps posé sur la sienne) passe des
 * coordonnées ENTIÈRES et retrouve exactement la valeur discrète. Hors carte, l'échantillon se rabat
 * sur le bord du champ : le pourtour de la carte ne s'assombrit pas d'un dehors inconnu.
 */
import { visibilityOf } from '../../../state/visibility';
import type { Visibility } from '../../../data/ambiance.types';
import { AMBIANCE } from '../../catalog/ambiance';
import type { TintAt } from './sceneMeshes';

/** Teinte d'un état de visibilité (1 = pleine). */
export function tintOf(state: Visibility): number {
  return AMBIANCE.fogTint[state];
}

/** Facteur de teinte d'une case (`"x,y,z"`) selon les ensembles vu / exploré. */
export function tintFor(key: string, visible: ReadonlySet<string>, explored: ReadonlySet<string>): number {
  return tintOf(visibilityOf(key, visible, explored));
}

/** Échantillonneur du CHAMP de teinte d'une carte de dimensions `dims`, en coordonnées de GRILLE
 *  continues. Le champ par case est tabulé PAR ÉTAGE à la première demande (une carte = quelques
 *  milliers de cases), puis relu sans allocation : la passe de teinte y descend par SOMMET. */
export function visibilityField(
  visible: ReadonlySet<string>,
  explored: ReadonlySet<string>,
  dims: { w: number; h: number },
): TintAt {
  const maxX = Math.max(0, dims.w - 1);
  const maxY = Math.max(0, dims.h - 1);
  const pas = maxX + 1;
  // DOUBLE précision : aux coordonnées entières le champ doit rendre la valeur discrète de la case
  // À L'IDENTIQUE (un corps posé sur sa case y lit sa teinte) — un tampon 32 bits l'aurait arrondie.
  const étages = new Map<number, Float64Array>();
  const étage = (z: number): Float64Array => {
    let g = étages.get(z);
    if (!g) {
      g = new Float64Array(pas * (maxY + 1));
      for (let y = 0; y <= maxY; y++)
        for (let x = 0; x <= maxX; x++) g[y * pas + x] = tintFor(`${x},${y},${z}`, visible, explored);
      étages.set(z, g);
    }
    return g;
  };
  return (x, y, z) => {
    const g = étage(z);
    const cx = Math.min(maxX, Math.max(0, x));
    const cy = Math.min(maxY, Math.max(0, y));
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(x0 + 1, maxX);
    const y1 = Math.min(y0 + 1, maxY);
    const fx = cx - x0;
    const fy = cy - y0;
    const haut = g[y0 * pas + x0] + (g[y0 * pas + x1] - g[y0 * pas + x0]) * fx;
    const bas = g[y1 * pas + x0] + (g[y1 * pas + x1] - g[y1 * pas + x0]) * fx;
    return haut + (bas - haut) * fy;
  };
}
