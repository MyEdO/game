/**
 * Panneaux de FAÇADE authorés (`Scene.architecture[].facades`), indexés par ARÊTE (`cleArete`) — lus par la
 * résolution d'apparence d'arête (`state/formeArete.ts`, que `validateScene` consulte) et par le rendu
 * (`gameIso/builders/walls.ts`, `roofs.ts`).
 */
import type { FacadeFeature, Scene, WallSide } from './scene';
import { cleArete } from '../geometry/arete';
import { memoByRef } from './sceneMemo';

export interface FacadeEdge {
  bodyId: string;
  sectionId: string;
  appearance: string;
  roomZoneIds?: string[];
  features: FacadeFeature[];
}

/** Panneaux de FAÇADE authorés, indexés par arête. Mémoïsé PAR SCÈNE : `wallGeometry`, les joints de
 *  nappes et les fermetures de comble le lisent tous, une seule dérivation. */
export const facadeEdges = memoByRef((scene: Pick<Scene, 'architecture'>): ReadonlyMap<string, FacadeEdge> => {
  const indexed = new Map<string, FacadeEdge>();
  for (const body of scene.architecture ?? [])
    for (const section of body.facades)
      for (const edge of section.edges) {
        const key = cleArete(edge.x, edge.y, edge.side, edge.z ?? section.z);
        if (indexed.has(key)) continue;
        indexed.set(key, {
          bodyId: body.id,
          sectionId: section.id,
          appearance: section.appearance,
          ...(section.roomZoneIds ? { roomZoneIds: [...section.roomZoneIds] } : {}),
          features: (section.features ?? []).filter((feature) =>
            cleArete(feature.edge.x, feature.edge.y, feature.edge.side, feature.edge.z ?? section.z) === key),
        });
      }
  return indexed;
});

/** Panneau de façade authoré sur l'arête `arete` (`z` absent = 0), s'il y en a un. */
export function facadeDeLArete(
  scene: Pick<Scene, 'architecture'>,
  arete: { x: number; y: number; side: WallSide; z?: number },
): FacadeEdge | undefined {
  return facadeEdges(scene).get(cleArete(arete.x, arete.y, arete.side, arete.z ?? 0));
}
