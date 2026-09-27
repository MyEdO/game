import type { RaceDef } from './types';
import type { PaletteDeclaree } from '../palette';
import { raceAppearance, type RaceAppearanceData } from '../../../data';
import { feat } from '../parts/elements';
import { memoByRef } from '../../../state/sceneMemo';
import speciesRaceJson from '../../../data/speciesRace.json';

/**
 * Apparence d'espèce = DONNÉE app-owned éditable (`src/data/raceAppearance.json`, lu live via la
 * façade) résolue ICI en `RaceDef` : `featureKeys` → `feat()` (overlays du catalogue), le reste en
 * passe-plat. Plus de race-defs code : éditer une espèce dans le Compendium se reflète en jeu.
 */
const resolve = memoByRef((rec: RaceAppearanceData): RaceDef => {
  const { featureKeys, ...rest } = rec;
  return { ...rest, ...(featureKeys?.length ? { features: feat(...featureKeys) } : {}) };
});

export type { RaceDef, RaceFeature } from './types';
/** Toutes les races résolues, par id (instantané — relu à chaque accès pour suivre les éditions live). */
export const RACES: Record<string, RaceDef> = new Proxy({} as Record<string, RaceDef>, {
  get: (_t, id: string) => { const r = raceAppearance.find((x) => x.id === id); return r ? resolve(r) : undefined; },
  ownKeys: () => raceAppearance.map((r) => r.id),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
/** Race par DÉFAUT — DÉCLARÉE en donnée (`speciesRace.json`, même source que `baseSpeciesOf`), jamais
 *  re-tapée en code. */
export const DEFAULT_RACE_ID: string = (speciesRaceJson as { default: string }).default;
/** Race par id canonique (sortie de baseSpeciesOf) ; sans id (aucune espèce résolue) → défaut déclaré.
 *  Un id FOURNI mais absent de `raceAppearance.json` est une donnée à corriger : bruyant en dev. */
export function raceById(id: string | undefined): RaceDef {
  const rec = id ? raceAppearance.find((r) => r.id === id) : undefined;
  if (id && !rec && import.meta.env?.DEV) console.error(`[races] race « ${id} » absente de raceAppearance.json — donnée à corriger.`);
  return resolve(rec ?? raceAppearance.find((r) => r.id === DEFAULT_RACE_ID)!);
}
/** Palette de peau/cheveux d'une race pour un sexe (variante F si définie, sinon la palette commune). */
export function racePalette(id: string, sex: 'M' | 'F'): PaletteDeclaree {
  const r = raceById(id);
  return sex === 'F' && r.paletteF ? r.paletteF : (r.palette ?? {});
}
