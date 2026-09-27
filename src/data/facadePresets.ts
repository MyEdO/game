/**
 * PRÉSETS DE FAÇADE — les seuls ids que porte `FacadeSection.appearance` (un autre id est une erreur
 * nommée de `validateScene`). Donnée d'application, lue par la résolution
 * d'apparence d'arête (`state/formeArete.ts`, `apparenceDeLArete`) et par le rendu
 * (`gameIso/catalog/facades`).
 */
import type { z } from 'zod';
import type { facadeFeatureKindSchema } from './schemas/defs-scenes/scene';

type FacadeFeatureKind = z.infer<typeof facadeFeatureKindSchema>;

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
  wallFeatures: Partial<Record<FacadeFeatureKind, string>>;
  features: Partial<Record<FacadeFeatureKind, FacadeFeatureViz>>;
}

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

/** Apparence de MUR d'une façade : celle de son préset ; `undefined` = l'id n'est pas un préset. */
export function murDeFacade(id: string): string | undefined {
  return facadePreset(id)?.wallAppearance;
}
