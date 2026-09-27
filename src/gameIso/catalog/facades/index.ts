import type { FacadeFeature } from '../../../state/scene';
import { FACADE_PRESETS, facadePreset, murDeFacade } from '../../../data/facadePresets';
import { structureAppearance, type StructureAppearanceDef } from '../structures';
import type { FacadeFeatureViz } from '../types';

/** ids posables au clic (picker de `FacadeSection.appearance`, éditeur — #841 FU-C) : pas de `label`
 *  propre à ce catalogue (id technique de préset), affiché tel quel. */
export const FACADE_APPEARANCE_IDS: readonly string[] = FACADE_PRESETS.map((definition) => definition.id);

export function facadeStructureAppearance(id?: string): StructureAppearanceDef {
  if (!id || !facadePreset(id)) return structureAppearance(id);
  return { ...structureAppearance(murDeFacade(id)), id };
}

export function facadeFeatureViz(
  facadeId: string,
  kind: FacadeFeature['kind'],
): FacadeFeatureViz | undefined {
  return facadePreset(facadeId)?.features[kind];
}

export function facadeWallFeatureAppearance(
  facadeId: string,
  kind: FacadeFeature['kind'],
): string | undefined {
  return facadePreset(facadeId)?.wallFeatures[kind];
}
