/**
 * PRÉSETS DE FAÇADE — les ids que porte `FacadeSection.appearance` quand il nomme un préset plutôt
 * qu'une apparence de mur (`structureAppearance.json`). Donnée d'application, lue par la résolution
 * d'apparence d'arête (`state/formeArete.ts`, `apparenceDeLArete`) et par le rendu
 * (`gameIso/catalog/facades`).
 */
import type { FacadeAppearanceDef } from '../gameIso/catalog/types';

export const FACADE_PRESETS: readonly FacadeAppearanceDef[] = [
  {
    id: 'auberge-relais-imperiale',
    wallAppearance: 'mur-a-ossature-en-bois',
    wallFeatures: {
      'window-band': 'mur-a-ossature-en-bois',
      'stone-entry': 'mur-en-pierre',
      gable: 'mur-a-ossature-en-bois',
    },
    features: {
      chimney: { prop: 'cheminee', base: 'toit', liftM: -0.3 },
      sign: { prop: 'enseigne', liftM: 2.2 },
    },
  },
  {
    id: 'forge',
    wallAppearance: 'mur-en-bois',
    wallFeatures: {},
    features: {
      chimney: { prop: 'cheminee', base: 'toit', liftM: -0.3 },
    },
  },
  {
    id: 'chapelle',
    wallAppearance: 'mur-en-bois',
    wallFeatures: {},
    features: {
      belfry: { prop: 'clocheton', base: 'toit', liftM: -0.15 },
    },
  },
];

const PAR_ID: ReadonlyMap<string, FacadeAppearanceDef> = new Map(FACADE_PRESETS.map((p) => [p.id, p]));

export function facadePreset(id?: string): FacadeAppearanceDef | undefined {
  return id ? PAR_ID.get(id) : undefined;
}

/** Apparence de MUR d'une façade : celle de son préset, sinon l'id lui-même (une apparence de mur). */
export function murDeFacade(id: string): string {
  return facadePreset(id)?.wallAppearance ?? id;
}
