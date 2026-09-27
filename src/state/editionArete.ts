/**
 * PATCHS d'ÉDITEUR d'une arête de mur (#1883) : faire passer une arête à un autre type, ou lui poser une
 * Structure, en restant COHÉRENTE avec les formes qu'elle prend (`state/formeArete.ts`) et l'admission
 * de son apparence (`data/formesDArete.ts`). Lus par l'Inspecteur (`ui/editor/Inspector.tsx`).
 */
import type { Scene, WallSeg } from './scene';
import { findStructureById, premierOffert, structures } from '../data';
import { isDoorEdgeStructure, structureEdgeKind } from '../engine/structures';
import { apparenceDeLArete, apparenceParId, formesHorsCompatibilite, natureDuType, type TypeDArete } from './formeArete';

/** Retire l'apparence DÉCLARÉE en override si elle n'habille plus les formes de l'arête patchée. */
function avecApparenceCompatible(seg: WallSeg, patch: Partial<WallSeg>): Partial<WallSeg> {
  const app = seg.appearance ? apparenceParId(seg.appearance) : undefined;
  const garderApparence = !app || formesHorsCompatibilite({ ...seg, ...patch }, app).length === 0;
  return { ...patch, appearance: garderApparence ? seg.appearance : undefined };
}

/**
 * Patch qui fait passer l'arête au type `type` en restant COHÉRENTE : `door`/`closed` n'existent que sur
 * une porte ouvrable, `window` que sur une cloison ; la Structure est gardée si sa nature convient, sinon
 * retirée — sauf la fermeture fixe, qui EXIGE une Structure de nature `porte` et prend la première du
 * catalogue (`premierOffert`) ; l'apparence déclarée est retirée si elle n'habille plus les formes de
 * l'arête.
 */
export function patchVersType(seg: WallSeg, type: TypeDArete): Partial<WallSeg> {
  const nature = natureDuType(type);
  const s = seg.structure ? findStructureById(seg.structure) : undefined;
  const garde = s && structureEdgeKind(s) === nature ? seg.structure : undefined;
  const structure = garde ?? (type === 'fermeture-fixe'
    ? premierOffert(structures.filter(isDoorEdgeStructure), 'Fermeture fixe')
    : undefined);
  return avecApparenceCompatible(seg, {
    door: type === 'porte' ? true : undefined,
    closed: type === 'porte' ? seg.closed : undefined,
    window: type === 'cloison' ? seg.window : undefined,
    structure,
  });
}

/** Patch qui pose la Structure `structure` sur l'arête en restant COHÉRENTE : la fenêtre part si la
 *  nouvelle apparence ne l'habille pas, l'override d'apparence part s'il n'habille plus l'arête. */
export function patchVersStructure(scene: Pick<Scene, 'architecture'>, seg: WallSeg, structure: string | undefined): Partial<WallSeg> {
  const id = apparenceDeLArete(scene, { ...seg, structure });
  const app = id === undefined ? undefined : apparenceParId(id);
  const window = seg.window && app && !formesHorsCompatibilite({ ...seg, structure, window: true }, app).length ? true : undefined;
  return avecApparenceCompatible(seg, { structure, window });
}
