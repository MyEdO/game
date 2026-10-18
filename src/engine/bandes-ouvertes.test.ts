import { describe, it, expect } from 'vitest';
import { findTableEntry } from './tables';
import { makeRNG } from './dice';
import { moraleBand } from './crewMorale';
import { progressionMovement } from './shipNavigation';
import { orientationOutcome, overspeedRow, pursuitDistanceGain } from './seaNavigation';
import { evenementsDeBord, resolveFastVoyage } from './seaVoyage';
import { findEffectTableById } from '../data/effectTables';

/**
 * Bandes OUVERTES de la donnée (`null`, `tableOuverte`, `src/engine/tables.ts`) : une valeur au-delà de
 * toute borne écrite tombe dans la bande extrême, par la couture que le jeu appelle — jamais par le
 * repli de `findTableEntry` sur la dernière rangée.
 */
describe('bandes ouvertes — la valeur extrême tombe dans la bande extrême', () => {
  it('Moral d’équipage (MDG 14 l.188, l.199) : 150 → « Mené de main de maître ! », −1000 → « Des canailles… »', () => {
    expect(moraleBand(150).label).toBe('Mené de main de maître !');
    expect(moraleBand(-1000).id).toBe('canailles');
  });

  it('Progression de navire (MDG 13 l.71, l.75) : DR −12 → moitié de M, DR 10 → M+2', () => {
    expect(progressionMovement(9, -12)).toBe(4);
    expect(progressionMovement(9, 10)).toBe(11);
  });

  it('Navigation (MDG 13) : Repères, Poursuite et Vitesse maximum ouvertes aux deux bouts écrits', () => {
    expect(orientationOutcome(-1000, false).outcome).toBe('drift-major');
    expect(orientationOutcome(1000, false).outcome).toBe('exact');
    expect(pursuitDistanceGain(0, -1000)).toBe(pursuitDistanceGain(0, -4));
    expect(pursuitDistanceGain(0, 1000)).toBe(pursuitDistanceGain(0, 4));
    expect(overspeedRow(0, 1000)?.difficulty).toBe(overspeedRow(0, 9)?.difficulty);
  });

  it('Événements de bord et Voyage rapide (MDG 15) : « –65 ou moins », « 150 ou plus », « 0 ou moins », « 10 ou plus »', () => {
    expect(findTableEntry(evenementsDeBord(), -1000).id).toBe('triton');
    expect(findTableEntry(evenementsDeBord(), 1000).id).toBe('manne-de-manann');
    expect(resolveFastVoyage(-1000, 0, 0, makeRNG(1)).palier.id).toBe('desastreux');
    expect(resolveFastVoyage(1000, 0, 0, makeRNG(1)).palier.id).toBe('parfait');
  });

  it('Table d’effets (VDM 12 l.435, « 11+ ») : 50 → « Grosse explosion ! »', () => {
    expect(findTableEntry(findEffectTableById('vdm-catastrophes-de-brassage').rows, 50).label).toBe('Grosse explosion !');
  });
});
