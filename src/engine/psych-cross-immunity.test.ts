import { describe, it, expect } from 'vitest';
import { fearSourceFor, psychImmuneToFrom, suppressSupersededPsych } from './psychology';
import type { Combatant } from './types';

const C = (o: Partial<Combatant>): Combatant => o as unknown as Combatant;

/** Immunités psychologiques croisées (LDB 21), pilotées par psychology.json (`immuneToFromTarget`,
 *  `endedByOtherPsych`) — aucune entité nommée dans le moteur. */
describe('Immunités psychologiques croisées (LDB 21) — data-driven', () => {
  it('Haine immunise à la PEUR du groupe haï (mais PAS la Terreur)', () => {
    const hater = C({ psychState: [{ type: 'haine', cible: 'elfe', active: true } as never] });
    expect(psychImmuneToFrom(hater, C({ groups: ['elfe'] }), 'peur')).toBe(true);
    expect(fearSourceFor(hater, C({ groups: ['elfe'], causesPeur: 2 }))).toBeNull(); // Peur annulée
    expect(fearSourceFor(hater, C({ groups: ['elfe'], causesTerreur: 2 }))).toEqual({ kind: 'terreur', indice: 2 }); // Terreur passe
  });

  it('Haine n’immunise PAS contre un autre groupe', () => {
    const hater = C({ psychState: [{ type: 'haine', cible: 'elfe', active: true } as never] });
    expect(psychImmuneToFrom(hater, C({ groups: ['orque'] }), 'peur')).toBe(false);
    expect(fearSourceFor(hater, C({ groups: ['orque'], causesPeur: 2 }))).toEqual({ kind: 'peur', indice: 2 });
  });

  it('Haine INACTIVE (Test réussi) n’immunise pas', () => {
    const hater = C({ psychState: [{ type: 'haine', cible: 'elfe', active: false } as never] });
    expect(psychImmuneToFrom(hater, C({ groups: ['elfe'] }), 'peur')).toBe(false);
  });

  it('Animosité est annulée par un effet psy DOMINANT actif (Peur)', () => {
    const c = C({ psychState: [
      { type: 'animosite', cible: 'Nains', active: true } as never,
      { type: 'peur', sourceId: 'x', indice: 2, calmeDR: 0 } as never, // active : DR cumulé < Indice
    ] });
    expect(suppressSupersededPsych(c)).toEqual(['animosite']);
    expect(c.psychState!.find((p) => p.type === 'animosite')!.active).toBe(false);
  });

  it('Animosité SEULE (aucun effet dominant) n’est pas annulée', () => {
    const c = C({ psychState: [{ type: 'animosite', cible: 'Nains', active: true } as never] });
    expect(suppressSupersededPsych(c)).toEqual([]);
    expect(c.psychState![0].active).toBe(true);
  });

  it('deux Traits ciblés annulables ne se neutralisent PAS entre eux (aucun n’est dominant)', () => {
    const c = C({ psychState: [
      { type: 'animosite', cible: 'Nains', active: true } as never,
      { type: 'prejuge', cible: 'Elfes', active: true } as never,
    ] });
    expect(suppressSupersededPsych(c)).toEqual([]);
  });

  it('une Peur SURMONTÉE n’annule pas l’Animosité, quel que soit son cumul (LDB 21 l.25)', () => {
    const c = C({ psychState: [
      { type: 'animosite', cible: 'Nains', active: true } as never,
      { type: 'peur', sourceId: 'x', indice: 2, calmeDR: 0, surmontee: true } as never,
    ] });
    expect(suppressSupersededPsych(c)).toEqual([]);
  });

  it('une Peur 0 non encore testée est un effet dominant : on y est sujet jusqu’au Test (LDB 21 l.25)', () => {
    const c = C({ psychState: [
      { type: 'animosite', cible: 'Nains', active: true } as never,
      { type: 'peur', sourceId: 'x', indice: 0, calmeDR: 0 } as never,
    ] });
    expect(suppressSupersededPsych(c)).toEqual(['animosite']);
  });
});
