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

describe('calendarPhases — un seuil est une minute du jour', () => {
  const nuitA = (seuil: number): Phase[] => {
    const doc = reel();
    const nuit = doc.find((p) => p.id === 'nuit');
    expect(nuit, 'la phase « nuit » manque à calendarPhases.json').toBeDefined();
    nuit!.seuil = seuil;
    return doc;
  };
  it('« nuit » à 1500 est refusée', () => {
    expect(validateDataset('calendarPhases.json', nuitA(1500))).toContain('« nuit » commence à la minute 1500, hors de la minute du jour (0-1439)');
  });
  it('« nuit » à −60 est refusée', () => {
    expect(validateDataset('calendarPhases.json', nuitA(-60))).toContain('« nuit » commence à la minute -60, hors de la minute du jour (0-1439)');
  });
  it('« nuit » à 300.5 est refusée', () => {
    expect(validateDataset('calendarPhases.json', nuitA(300.5))).toContain('élément « nuit » › Heure de début: Entrée invalide : entier attendu, nombre reçu');
  });
});
