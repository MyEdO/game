import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant, ItemInstance } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function item(over: Partial<ItemInstance>): ItemInstance {
  return { uid: 'i1', label: 'X', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over } as ItemInstance;
}

function hero(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Blessé', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 6), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, items: [], pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

// Consommables du CATALOGUE : leur Flow se lit par `trappingId` (`consommableDe`).
const BANDAGE = item({ uid: 'b1', label: 'Bandages', trappingId: 'bandages' });
const POTION = item({ uid: 'p1', label: 'Potion de guérison', trappingId: 'potion-de-guerison' });

describe('utiliserLObjet — consommables de la fiche', () => {
  // LDB 18 l.311 ; LDB 16 l.107 ; décision de l'orchestrateur (2026-11-03, #3059) : le Bandage seul est une Aide Médicale.
  it('bandage seul : Aide Médicale (séquelle en attente levée), Hémorragique sans verrou inchangé, aucune prévention d’Infection, une unité consommée', () => {
    const h = hero({ conditions: [{ id: 'hemorragique', value: 3 }], traumas: [{ traumaId: 'z', awaitingMedicalAid: true }] as never, items: [BANDAGE, { ...BANDAGE, uid: 'b2' }] });
    banc.setState({ party: [h] });
    banc.getState().utiliserLObjet('b1');
    const p = banc.getState().party.find((c) => c.id === 'h1')!;
    expect(p.traumas![0].awaitingMedicalAid).toBe(false);
    expect(p.conditions.find((c) => c.id === 'hemorragique')?.value).toBe(3);
    expect(p.woundDressed).toBeUndefined();
    expect(p.items!.map((i) => i.uid)).toEqual(['b2']);
  });

  it('bandage seul sur un Hémorragique verrouillé « par Aide Médicale » : l’État est retiré', () => {
    const h = hero({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'medicalAid' }], items: [BANDAGE] });
    banc.setState({ party: [h] });
    banc.getState().utiliserLObjet('b1');
    const p = banc.getState().party.find((c) => c.id === 'h1')!;
    expect(p.conditions.find((c) => c.id === 'hemorragique')).toBeUndefined();
  });

  it('bandage seul sans Aide Médicale attendue : refusé et dit, l’unité est gardée', () => {
    const h = hero({ conditions: [{ id: 'hemorragique', value: 3 }], items: [BANDAGE] });
    banc.setState({ party: [h] });
    banc.getState().utiliserLObjet('b1');
    const p = banc.getState().party.find((c) => c.id === 'h1')!;
    expect(banc.getState().journal[banc.getState().journal.length - 1]).toBe('Blessé n’attend aucune Aide Médicale. Bandages ne lui apporterait rien : l’objet est gardé.');
    expect(p.items!.map((i) => i.uid)).toEqual(['b1']);
  });

  it('potion de guérison : soigne du Bonus d’Endurance et se consomme', () => {
    const h = hero({ wounds: blessuresDeBase(12, 6), items: [POTION] });
    banc.setState({ party: [h] });
    banc.getState().utiliserLObjet('p1');
    const p = banc.getState().party.find((c) => c.id === 'h1')!;
    expect(p.wounds.current).toBe(6 + 3); // BE(35) = 3
    expect(p.items!.length).toBe(0);
  });

  it('en combat, hors du tour du porteur : utiliserLObjet ne fait rien', () => {
    const h = hero({ conditions: [{ id: 'hemorragique', value: 3 }], items: [BANDAGE] });
    const e = hero({ id: 'e1', kind: 'ennemi' });
    banc.setState({ party: [h], battle: { combatants: [h, e], order: ['e1', 'h1'], turn: 0, round: 1, acted: false, log: [], over: null } as never });
    banc.getState().utiliserLObjet('b1');
    const c = banc.getState().battle!.combatants.find((x) => x.id === 'h1')!;
    expect(c.conditions.find((x) => x.id === 'hemorragique')?.value).toBe(3); // inchangé
    expect(c.items!.length).toBe(1); // non consommé
  });
});
