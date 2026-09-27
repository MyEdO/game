import type { FacadeFeature } from '../../../state/scene';
import { FACADE_PRESETS, facadePreset, type FacadeFeatureViz } from '../../../data/facadePresets';
import { structureAppearance, type StructureAppearanceDef } from '../structures';

/** ids posables au clic (picker de `FacadeSection.appearance`, éditeur — #841 FU-C) : pas de `label`
 *  propre à ce catalogue (id technique de préset), affiché tel quel. */
export const FACADE_APPEARANCE_IDS: readonly string[] = FACADE_PRESETS.map((definition) => definition.id);

export function facadeStructureAppearance(id?: string): StructureAppearanceDef {
  const preset = facadePreset(id);
  if (!preset) return structureAppearance(id);
  return { ...structureAppearance(preset.wallAppearance), id: preset.id };
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
