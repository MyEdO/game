import type { FacadeFeature } from '../../../noyau/monde/scene';
import { structureAppearance, type StructureAppearanceDef } from '../structures';
import type { FacadeAppearanceDef, FacadeFeatureViz } from '../types';
import { facade as aubergeRelaisImperiale } from './defs/auberge-relais-imperiale';
import { facade as forge } from './defs/forge';
import { facade as chapelle } from './defs/chapelle';

const DEFINITIONS: readonly FacadeAppearanceDef[] = [aubergeRelaisImperiale, forge, chapelle];
const BY_ID: ReadonlyMap<string, FacadeAppearanceDef> = new Map(
  DEFINITIONS.map((definition) => [definition.id, definition]),
);

/** ids posables au clic (picker de `FacadeSection.appearance`, éditeur — #841 FU-C) : pas de `label`
 *  propre à ce catalogue (id technique de préset), affiché tel quel. */
export const FACADE_APPEARANCE_IDS: readonly string[] = DEFINITIONS.map((definition) => definition.id);

export function facadeAppearance(id?: string): FacadeAppearanceDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function facadeStructureAppearance(id?: string): StructureAppearanceDef {
  const definition = facadeAppearance(id);
  if (!definition) return structureAppearance(id);
  return { ...structureAppearance(definition.wallAppearance), id: definition.id };
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
