import { describe, it, expect, afterEach } from 'vitest';
import { endState } from './conditions';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    name: 'C',
    kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, // BE=3
    wounds: blessuresDeBase(12, 10),
    conditions: [],
    skills: [],
    ...over,
  })) as unknown as Combatant;

describe('endState — état de fin lisible (#237)', () => {
  it('null quand le combattant est en état de se battre', () => {
    expect(endState(mk())).toBe(null);
  });
  it("héros à 0 PB CONSCIENT = null (À Terre, PAS un état de fin)", () => {
    expect(endState(mk({ wounds: blessuresDeBase(12, 0) }))).toBe(null);
  });
  it('mort = « mort » (prioritaire sur tout le reste)', () => {
    expect(endState(mk({ dead: true }))).toBe('mort');
    expect(endState(mk({ dead: true, outOfRencontre: true, exitReason: 'reddition' }))).toBe('mort');
  });
  it('Inconscient (condition) = « inconscient »', () => {
    expect(endState(mk({ conditions: [{ id: 'inconscient', value: 1 }] as Combatant['conditions'] }))).toBe('inconscient');
  });
  it('reddition (#215) = « rendu »', () => {
    expect(endState(mk({ outOfRencontre: true, exitReason: 'reddition' }))).toBe('rendu');
  });
  it('coque PRISE (pavillon amené) = « rendu »', () => {
    expect(endState(mk({ bodyShape: 'vehicule', outOfRencontre: true, exitReason: 'prise' } as Partial<Combatant>))).toBe('rendu');
  });
  it('Destin (Meurs un autre jour) = « hors-combat » (éjecté vivant, MÊME s\'il est aussi Inconscient)', () => {
    expect(endState(mk({ outOfRencontre: true, exitReason: 'destin', conditions: [{ id: 'inconscient', value: 1 }] as Combatant['conditions'] }))).toBe('hors-combat');
  });
  it('naufrage (par-dessus bord) = « hors-combat »', () => {
    expect(endState(mk({ outOfRencontre: true, exitReason: 'naufrage' }))).toBe('hors-combat');
  });
  it('sortie générique (sans motif) = « hors-combat »', () => {
    expect(endState(mk({ outOfRencontre: true }))).toBe('hors-combat');
  });
  describe('figurant tombé à 0 PB', () => {
    afterEach(() => resetRule('combat-aa-blessures'));
    it("'aa' : Mort Subite à 0 Blessure (AA 07 l.65) = « hors-combat »", () => {
      setRule('combat-aa-blessures', 'aa');
      expect(endState(mk({ kind: 'enemy', wounds: blessuresDeBase(12, 0) }))).toBe('hors-combat');
    });
    it("'ldb' : à 0 exact, pas de dépassement (LDB 18 l.46) = null", () => {
      expect(endState(mk({ kind: 'enemy', wounds: blessuresDeBase(12, 0) }))).toBe(null);
    });
  });
  it('coque coulée (État naufrage, MDG 13 l.674) = « hors-combat » ; coque à 0 PB = null (MDG 13 l.656)', () => {
    expect(endState(mk({ bodyShape: 'vehicule', wounds: { current: 0, max: 40 }, conditions: [{ id: 'naufrage', value: 1 }] } as Partial<Combatant>))).toBe('hors-combat');
    expect(endState(mk({ bodyShape: 'vehicule', wounds: { current: 0, max: 40 } } as Partial<Combatant>))).toBe(null);
    expect(endState(mk({ bodyShape: 'vehicule', wounds: { current: 40, max: 40 } } as Partial<Combatant>))).toBe(null);
  });
  it('objet INERTE (affût servi) = null (0 PB permanent, jamais une fin)', () => {
    expect(endState(mk({ inert: true, wounds: { current: 0, max: 0 } } as Partial<Combatant>))).toBe(null);
  });

  it('les 4 états produisent 4 catégories DISTINCTES', () => {
    const states = [
      endState(mk({ dead: true })),
      endState(mk({ conditions: [{ id: 'inconscient', value: 1 }] as Combatant['conditions'] })),
      endState(mk({ outOfRencontre: true, exitReason: 'reddition' })),
      endState(mk({ outOfRencontre: true, exitReason: 'destin' })),
    ];
    expect(new Set(states).size).toBe(4);
    expect(states).toEqual(['mort', 'inconscient', 'rendu', 'hors-combat']);
  });
});
