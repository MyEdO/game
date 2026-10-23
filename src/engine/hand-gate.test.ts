/**
 * Main ensanglantée (Aux Armes bras 46-50, l.2569) — marqueur PAR-MAIN (op `handGate`), gate
 * `attackHandGate` (Test de Dextérité +20 par Action) et sa LEVÉE quand l'Hémorragique tombe à 0.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { applyOps } from './ops';
import { attackHandGate } from './combat';
import { addCondition, removeCondition } from './conditions';
import { makeRNG } from './dice';
import { idNeufDeBanc } from '../lib/entityId.testkit';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    loadouts: [{ id: 'lo', main: 'w1', off: 'w2' }], activeLoadoutId: 'lo',
    ...p,
  } as Combatant;
}

describe("op:'handGate' — marqueur PAR-MAIN keyé par la Localisation du coup (convention DROITIER)", () => {
  it('brasD → main, brasG → off (comme `disarm`)', () => {
    const cd = hero();
    applyOps(cd, [{ op: 'handGate' }], { idNeuf: idNeufDeBanc, rng: makeRNG(1), location: 'brasD' });
    expect(cd.handGates).toEqual(['main']);
    const cg = hero();
    applyOps(cg, [{ op: 'handGate' }], { idNeuf: idNeufDeBanc, rng: makeRNG(1), location: 'brasG' });
    expect(cg.handGates).toEqual(['off']);
  });

  it('idempotent : un 2ᵉ Critique sur la MÊME main ne duplique pas le marqueur', () => {
    const c = hero();
    applyOps(c, [{ op: 'handGate' }], { idNeuf: idNeufDeBanc, rng: makeRNG(1), location: 'brasD' });
    applyOps(c, [{ op: 'handGate' }], { idNeuf: idNeufDeBanc, rng: makeRNG(1), location: 'brasD' });
    expect(c.handGates).toEqual(['main']);
  });

  it('les deux mains peuvent être gatées (deux Critiques distincts)', () => {
    const c = hero();
    applyOps(c, [{ op: 'handGate' }], { idNeuf: idNeufDeBanc, rng: makeRNG(1), location: 'brasD' });
    applyOps(c, [{ op: 'handGate' }], { idNeuf: idNeufDeBanc, rng: makeRNG(1), location: 'brasG' });
    expect(new Set(c.handGates)).toEqual(new Set(['main', 'off']));
  });
});

describe('attackHandGate — gate actif = marqueur présent (durée purgée par removeCondition), main depuis l\'arme', () => {
  const gated = (hands: ('main' | 'off')[] = ['main']) => hero({ handGates: hands, conditions: [{ id: 'hemorragique', value: 2 }] });

  it('arme de la main gatée → cette main ; arme de l\'autre main → null', () => {
    const c = gated(['main']);
    expect(attackHandGate(c, 'w1')).toBe('main'); // w1 = loadout.main
    expect(attackHandGate(c, 'w2')).toBeNull(); // w2 = off, non gatée
  });

  it('uid absent (auto-choix / IA) → main directrice par défaut', () => {
    expect(attackHandGate(gated(['main']))).toBe('main');
    expect(attackHandGate(gated(['off']))).toBeNull(); // le défaut ne teste que la main directrice
  });

  it('arme NATURELLE hors loadout (morsure) → null (jamais « tenue en main »)', () => {
    expect(attackHandGate(gated(['main']), 'bite-uid')).toBeNull();
  });

  it('aucun marqueur → jamais gaté', () => {
    const c = hero({ conditions: [{ id: 'hemorragique', value: 3 }] });
    expect(attackHandGate(c, 'w1')).toBeNull();
  });
});

describe('removeCondition — l\'Hémorragique tombé à 0 PURGE les marqueurs de main (le gate suit l\'État)', () => {
  it('tant qu\'il reste des pions Hémorragique, le marqueur tient ; à 0, il est purgé', () => {
    const c = hero({ handGates: ['main', 'off'] });
    addCondition(c, 'hemorragique', 2);
    removeCondition(c, 'hemorragique', 1); // reste 1 pion
    expect(c.handGates).toEqual(['main', 'off']);
    removeCondition(c, 'hemorragique', 1); // 0 → purge
    expect(c.handGates).toBeUndefined();
  });
});
