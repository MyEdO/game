/** Paliers de `dayPhase` (`findTierEntry`, `src/engine/clock.ts`). */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import calendarPhasesJson from '../../calendarPhases.json';

type Phase = { id: string; seuil: number; [k: string]: unknown };
const reel = (): Phase[] => structuredClone(calendarPhasesJson) as unknown as Phase[];

describe('calendarPhases — seuils distincts', () => {
  it('la donnée réelle passe', () => {
    expect(validateDataset('calendarPhases.json', reel())).toBeNull();
  });
  it('un clone au seuil répété est refusé, les deux phases nommées', () => {
    const doc = reel();
    const dernier = doc[doc.length - 1];
    const clone = { ...structuredClone(dernier), id: 'nuit-bis' };
    expect(validateDataset('calendarPhases.json', [...doc, clone])).toContain(`« ${dernier.id} » et « nuit-bis » portent le même seuil ${dernier.seuil}`);
  });
});
