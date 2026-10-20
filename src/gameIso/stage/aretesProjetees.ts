/**
 * ARÊTES PROJETÉES — le pont entre le dériveur d'arêtes (`noyau/aretes.ts`, PUR et sans écran) et la
 * chaîne de picking (`stage/pickResolve.ts`, qui raisonne en pixels de stage).
 *
 * L'hôte de rendu (`stage/MondeDeCampagne.tsx`) FOURNIT les arêtes déjà filtrées par le contexte
 * (brouillard, contrôleur, couche active) — exactement comme il fournit `vise` au picking — et ce
 * module ne fait qu'une chose : les poser à l'écran par `tileEdge`, la MÊME géométrie que le peintre
 * (`stage/AreteOverlay.tsx`), au lift que le peintre reçoit.
 *
 * MÉMOÏSATION : la géométrie se rebâtit à chaque `pointermove` sans elle, et la chaîne la relit à
 * chaque pixel. `memoByRefDeps` la retient par identité de la LISTE d'arêtes plus les dépendances de
 * projection (`dims`, `lift`) — le patron de `pickResolve.sceneLifts`, jamais un cache à invalider.
 */
import { tileEdge, type Dims, type EdgeSide } from '../../geometry/iso';
import { memoByRefDeps } from '../../noyau/monde/sceneMemo';
import type { AreteUtilisable } from '../../noyau/aretes';
import type { WallSide } from '../../noyau/monde/scene';
import type { Pt } from '../../noyau/monde/path';

/** Point du repère de PROJECTION du stage (celui où `tileCenter`/`tileEdge` dessinent). */
export interface PointEcran {
  cx: number;
  cy: number;
}

/** Une arête utilisable ET le segment qu'elle occupe à l'écran — les deux bouts que `tileEdge` rend. */
export interface AreteProjetee {
  arete: AreteUtilisable;
  a: PointEcran;
  b: PointEcran;
}

const memo = memoByRefDeps<readonly AreteUtilisable[], readonly AreteProjetee[]>();

/** Une arête de GRILLE, seule forme que `tileEdge` sait poser : les côtés DIAGONAUX d'un mur
 *  (`WallSide` `\` et `/`) n'occupent aucun segment de grille. Aucun des quatre dériveurs n'en rend,
 *  et pas de la même façon : escalade, chute et structure filtrent `N`/`E` au site
 *  (`noyau/aretes.ts`), les PORTES le tiennent du TYPE — `RoomPortal.edge.side` vaut `'N' | 'E'`
 *  (`noyau/monde/roomPortals.ts:19`), une diagonale n'y compile pas. */
const estCardinale = (side: WallSide): side is EdgeSide & WallSide => side === 'N' || side === 'E';

/**
 * Les arêtes du contexte, posées à l'écran. `lift` est l'ÉLÉVATION d'affichage de la case d'où le
 * geste part — la fonction que l'hôte passe déjà au peintre (`SurcoucheIso.liftOf`), pas une seconde
 * hauteur bâtie ici. Pour une structure, cet ancrage est la case du MUR : la prise se pose au lift du
 * mur, là où le joueur le voit.
 */
export function projeterAretes(
  aretes: readonly AreteUtilisable[],
  dims: Dims,
  lift: (p: Pt) => number,
): readonly AreteProjetee[] {
  return memo(aretes, [dims, lift], () => aretes.flatMap((arete) => {
    // CE QUE CE REFUS COUVRE, et pourquoi il est muet : AUCUNE arête offerte aujourd'hui — les quatre
    // dériveurs ne rendent que des côtés cardinaux. Il garde la FORME du type (`WallSide` diagonal,
    // que `tileEdge` ne sait pas poser) contre une capacité N+1 qui l'oublierait, et c'est
    // `aretesProjetees.test.ts` qui mesure sa population : elle doit rester VIDE. Le jour où une
    // arête y tombe, c'est le banc qui rougit, pas un journal que nul ne lit.
    if (!estCardinale(arete.side)) return [];
    const [a, b] = tileEdge(arete.x, arete.y, arete.side, dims, lift(arete.ancrage));
    return [{ arete, a, b }];
  }));
}

/** Distance du point `p` au SEGMENT [a,b], en pixels de projection. */
export function distanceAuSegment(p: { x: number; y: number }, a: PointEcran, b: PointEcran): number {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len2 = dx * dx + dy * dy;
  const s = len2 ? Math.max(0, Math.min(1, ((p.x - a.cx) * dx + (p.y - a.cy) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.cx + s * dx), p.y - (a.cy + s * dy));
}
