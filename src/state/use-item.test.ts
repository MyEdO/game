import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant, ItemInstance } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';
import { type SurchargeDObjet } from '../engine/objetDeTest.testkit';

function item(over: SurchargeDObjet): ItemInstance {
  return objetDeTest({ uid: 'i1', trappingId: 'corde', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over });
}

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Blessé', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 6, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, items: [], pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

// Effets STRUCTURÉS (Flow, feuilles EffectOp) — comme le catalogue migré (#50).
const BANDAGE = item({ uid: 'b1', trappingId: 'bandages', consumable: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'removeCondition', id: 'hemorragique', value: 1 }, { op: 'preventInfection' }] } } });
const POTION = item({ uid: 'p1', trappingId: 'potion-de-guerison', consumable: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'heal', amount: { bonusOf: 'endurance' } }] } } });

describe('usePartyItem — consommables hors combat (fiche)', () => {
  beforeEach(() => {
    useGame.setState({ mode: 'exploration', battle: null, journal: [] });
  });

  it('bandages : retire 1 pion Hémorragique et consomme l’objet', () => {
    const h = hero({ conditions: [{ id: 'hemorragique', value: 3 }], items: [BANDAGE] });
    useGame.setState({ party: [h] });
    useGame.getState().usePartyItem('h1', 'b1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(p.conditions.find((c) => c.id === 'hemorragique')?.value).toBe(2); // 3 − 1
    expect(p.items!.find((i) => i.uid === 'b1')).toBeUndefined(); // consommé
  });

  it('potion de guérison : soigne du Bonus d’Endurance et se consomme', () => {
    const h = hero({ wounds: { current: 6, max: 12 }, items: [POTION] });
    useGame.setState({ party: [h] });
    useGame.getState().usePartyItem('h1', 'p1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(p.wounds.current).toBe(6 + 3); // BE(35) = 3
    expect(p.items!.length).toBe(0);
  });

  it('refus en combat : usePartyItem ne fait rien (passer par la barre d’action)', () => {
    const h = hero({ conditions: [{ id: 'hemorragique', value: 3 }], items: [BANDAGE] });
    useGame.setState({ party: [h], battle: { over: null } as never });
    useGame.getState().usePartyItem('h1', 'b1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(p.conditions.find((c) => c.id === 'hemorragique')?.value).toBe(3); // inchangé
    expect(p.items!.length).toBe(1); // non consommé
  });
});
