/**
 * LES FAÇADES AUTHORÉES : le catalogue des apparences de façade (`defs/`), l'index des arêtes qu'une section de façade
 * de la scène porte (`facadeEdges`), et l'apparence de structure (`structureAppearance.json`) de chaque arête de mur
 * qui s'en déduit (`apparenceDArete`), que lisent le rendu web et le kit des arêtes de l'hôte Godot.
 */
import type { FacadeFeature, Scene, WallSeg } from '../scene';
import { memoByRef } from '../sceneMemo';
import { props, structureAppearances } from '../../../data';
import { facade as aubergeRelaisImperiale } from './defs/auberge-relais-imperiale';
import { facade as forge } from './defs/forge';
import { facade as chapelle } from './defs/chapelle';

export interface FacadeFeatureViz {
  prop: string;
  /** SURFACE dont `liftM` compte le décalage. `'sol'` (défaut) = la surface de la case porteuse.
   *  `'toit'` = la COUVERTURE à l'aplomb de l'ancre, lue sur le champ des nappes
   *  (`resolveNappes`/`fieldHeightAt`, source unique des hauteurs de toit) : un `liftM` négatif
   *  ENCASTRE alors le décor dans la couverture qu'il perce. Aucune nappe ne couvre l'ancre ⇒ repli
   *  DÉCLARÉ sur le sol, sans décalage — un décalage relatif à une couverture ne se lit pas sans elle. */
  base?: 'sol' | 'toit';
  liftM?: number;
  scale?: number;
}

export interface FacadeAppearanceDef {
  id: string;
  wallAppearance: string;
  wallFeatures: Partial<Record<FacadeFeature['kind'], string>>;
  features: Partial<Record<FacadeFeature['kind'], FacadeFeatureViz>>;
}

const DEFINITIONS: readonly FacadeAppearanceDef[] = [aubergeRelaisImperiale, forge, chapelle];
const BY_ID: ReadonlyMap<string, FacadeAppearanceDef> = new Map(
  DEFINITIONS.map((definition) => [definition.id, definition]),
);

/** ids posables au clic (picker de `FacadeSection.appearance`, éditeur — #841 FU-C) : pas de `label`
 *  propre à ce catalogue (id technique de préset), affiché tel quel. */
export const FACADE_APPEARANCE_IDS: readonly string[] = DEFINITIONS.map((definition) => definition.id);

/**
 * Kinds de feature rendus en DÉCOR ANCRÉ au bâtiment (`builders/props` : recette volumique ou
 * billboard), et JAMAIS dans le plan du mur (`builders/walls`) — leur `appearance` authorable
 * (`data/schemas/defs-scenes/scene.ts`) nomme alors un DÉCOR, pas une apparence de mur. Le verrou est
 * par CONSTRUCTION : sans lui, une apparence posée par l'auteur ferait sortir la même feature
 * DEUX fois — sa géométrie de décor et un panneau plaqué sur la façade (#1624).
 */
export const KINDS_DE_DECOR: ReadonlySet<FacadeFeature['kind']> = new Set(['chimney', 'sign', 'belfry']);

/** Les apparences que l'`appearance` d'une ouverture de sorte `kind` nomme, chacune son id et son libellé : un décor
 *  du catalogue (`props`) pour un kind rendu en décor (`KINDS_DE_DECOR`), une apparence de structure
 *  (`structureAppearances`) sinon. */
export const apparencesDeLOuverture = (kind: FacadeFeature['kind']): readonly { id: string; label: string }[] =>
  KINDS_DE_DECOR.has(kind) ? props : structureAppearances;

export function facadeAppearance(id?: string): FacadeAppearanceDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function facadeFeatureViz(
  facadeId: string,
  kind: FacadeFeature['kind'],
): FacadeFeatureViz | undefined {
  return facadeAppearance(facadeId)?.features[kind];
}

export function facadeWallFeatureAppearance(
  facadeId: string,
  kind: FacadeFeature['kind'],
): string | undefined {
  return facadeAppearance(facadeId)?.wallFeatures[kind];
}

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

/** La façade authorée `facade` régit l'arête du segment `seg` tant que le segment ne pose ni structure ni apparence
 *  (#1180) : l'apparence est une DONNÉE de la carte, jamais une cote. */
export const facadeRegit = (facade: FacadeEdge | undefined, seg: WallSeg): facade is FacadeEdge =>
  facade !== undefined && !seg.structure && !seg.appearance;

/** L'apparence de structure du segment `seg` seul : la sienne, sinon celle de sa structure, sinon le mur nu. */
export const apparenceDuSegment = (seg: WallSeg): string => seg.appearance || seg.structure || 'plain';

/** L'apparence de structure de l'arête du segment `seg` de `scene` : celle du mur de la façade qui la régit
 *  (`facadeRegit`), sinon celle du segment (`apparenceDuSegment`). */
export function apparenceDArete(scene: Pick<Scene, 'architecture'>, seg: WallSeg): string {
  const facade = facadeEdges(scene).get(edgeKey(seg));
  return facadeRegit(facade, seg) ? facadeAppearance(facade.appearance)?.wallAppearance ?? facade.appearance : apparenceDuSegment(seg);
}
