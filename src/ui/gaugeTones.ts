import type { GaugeTone } from './NotchGauge';

/** Blessures : fraction restante → ton (mêmes seuils que la jauge de portrait `hpColor`,
 *  `gameIso/teamColors.ts` — même langage de sévérité, exprimé pour `LifeBar`). SOURCE UNIQUE
 *  (`CharacterSheet.tsx`, `PossessionsRegistry.tsx`). */
export const woundsTone = (cur: number, max: number): GaugeTone => {
  const frac = max > 0 ? cur / max : 0;
  return frac <= 0.34 ? 'danger' : frac <= 0.67 ? 'warn' : 'ok';
};

/** Encombrement : `neutre` sous ~75 % de la capacité, `warn` proche du max, `danger` au-delà — le
 *  dépassement (`value > max`) reste porté par l'état DÉPASSEMENT générique de `LifeBar` (toujours
 *  `danger`, quel que soit ce ton). SOURCE UNIQUE (`CharacterSheet.tsx`, `PossessionsRegistry.tsx`). */
export const encumbranceTone = (cur: number, max: number): GaugeTone => {
  const frac = max > 0 ? cur / max : 0;
  return frac >= 1 ? 'danger' : frac >= 0.75 ? 'warn' : 'neutre';
};
