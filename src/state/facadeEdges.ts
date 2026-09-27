/**
 * Panneaux de FAÇADE authorés (`Scene.architecture[].facades`), indexés par ARÊTE — lus par la
 * résolution d'apparence d'arête (`state/formeArete.ts`, que `validateScene` consulte) et par le rendu
 * (`gameIso/builders/walls.ts`, `roofs.ts`).
 */
import type { FacadeFeature, Scene, WallSeg } from './scene';
import { memoByRef } from './sceneMemo';

/** Clé d'ARÊTE (`x,y,side,z`) — SOURCE UNIQUE de l'indexation des murs et des façades authorées. */
export const edgeKey = (edge: Pick<WallSeg, 'x' | 'y' | 'side'> & { z?: number }): string =>
  `${edge.x},${edge.y},${edge.side},${edge.z ?? 0}`;

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
        const key = edgeKey({ ...edge, z: edge.z ?? section.z });
        if (indexed.has(key)) continue;
        indexed.set(key, {
          bodyId: body.id,
          sectionId: section.id,
          appearance: section.appearance,
          ...(section.roomZoneIds ? { roomZoneIds: [...section.roomZoneIds] } : {}),
          features: (section.features ?? []).filter((feature) =>
            edgeKey({ ...feature.edge, z: feature.edge.z ?? section.z }) === key),
        });
      }
  return indexed;
});
