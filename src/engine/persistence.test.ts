import { describe, it, expect } from 'vitest';
import { isPersistentCondition, carryOverState, entreeEnRencontre } from './persistence';
import { releaseConditionLocks } from './conditions';
import type { Condition } from './flowCore';
import { etats, findConditionById } from '../data';
import { traumaById, dechirureFractureFicheId, avecSequelles } from './trauma';
import type { HitLocation } from './types';
const tk = (k: 'dechirure' | 'fracture', s: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, s, loc), opts, loc);
import type { Combatant } from './types';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

function baseCombatant(over: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Test', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    advantage: 3, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  }) as Combatant;
}

describe('persistence — classement RAW des États', () => {
  it('classe les États persistants (LDB 16-États ; Munition logée LDB 62 l.250)', () => {
    for (const id of ['hemorragique', 'empoisonne', 'en-flammes', 'extenue', 'brise', 'inconscient', 'munition-logee']) {
      expect(isPersistentCondition(id), id).toBe(true);
    }
  });
  it('exclut les États transitoires', () => {
    for (const n of ['surpris', 'a-terre', 'sonne', 'aveugle', 'assourdi', 'empetre']) {
      expect(isPersistentCondition(n), n).toBe(false);
    }
  });
  it('un marqueur SANS entrée au catalogue est transitoire (aucun repli implicite)', () => {
    expect(findConditionById('petrifie')).toBeUndefined();
    expect(isPersistentCondition('petrifie')).toBe(false);
  });
  it('PARITÉ : les 7 États déclarés persistants dans `etats.json` sont EXACTEMENT ceux du classement RAW', () => {
    // Le classement ne vit QUE sur les entrées : si une 8ᵉ entrée porte le drapeau (ou si l'une des 7 le
    // perd), c'est ici que ça se voit — le moteur, lui, ne connaît plus aucun id.
    const declares = etats.filter((e) => e.persistsAfterCombat).map((e) => e.id).sort();
    expect(declares).toEqual(['brise', 'empoisonne', 'en-flammes', 'extenue', 'hemorragique', 'inconscient', 'munition-logee']);
  });
});

describe('persistence — carryOverState', () => {
  it('conserve Blessures, critiques, mort et les États persistants ; jette le transitoire', () => {
    const c = baseCombatant({
      wounds: blessuresDeBase(12, 4),
      conditions: [{ id: 'hemorragique', value: 2 }, { id: 'surpris', value: 1 }, { id: 'extenue', value: 1 }],
      criticalWounds: 1, roundsAtZero: 0, dead: false, outOfRencontre: false,
    });
    const s = carryOverState(c, { lignes: [], faits: [] });
    expect(s.wounds!.current).toBe(4);
    expect(s.criticalWounds).toBe(1);
    expect(s.conditions!.find((x) => x.id === 'hemorragique')?.value).toBe(2);
    expect(s.conditions!.some((x) => x.id === 'extenue')).toBe(true);
    expect(s.conditions!.some((x) => x.id === 'surpris')).toBe(false);
  });
  it('reporte la mort ; l’éjection de la RENCONTRE n’en fait pas partie (LDB 17 l.31/l.35)', () => {
    expect(carryOverState(baseCombatant({ dead: true }), { lignes: [], faits: [] }).dead).toBe(true);
    expect('outOfRencontre' in carryOverState(baseCombatant({ outOfRencontre: true }), { lignes: [], faits: [] })).toBe(false);
  });
  it('ne partage pas les références de conditions (copie défensive)', () => {
    const c = baseCombatant({ conditions: [{ id: 'hemorragique', value: 1 }] });
    const s = carryOverState(c, { lignes: [], faits: [] });
    s.conditions![0].value = 99;
    expect(c.conditions[0].value).toBe(1);
  });
  it('reporte soinRencontreUtilise (limite 1 soin/rencontre survit au combat)', () => {
    expect(carryOverState(baseCombatant({ soinRencontreUtilise: true }), { lignes: [], faits: [] }).soinRencontreUtilise).toBe(true);
    expect(carryOverState(baseCombatant({}), { lignes: [], faits: [] }).soinRencontreUtilise).toBeUndefined();
  });
  it('persiste la munition Empaleuse logée combat → hors-combat (LDB 62 l.250, #473)', () => {
    const c = baseCombatant({
      conditions: [{ id: 'munition-logee', value: 2 }, { id: 'surpris', value: 1 }],
    });
    const s = carryOverState(c, { lignes: [], faits: [] });
    expect(s.conditions!.find((x) => x.id === 'munition-logee')?.value).toBe(2);
  });
  it('persiste les traumatismes', () => {
    const c = baseCombatant({ traumas: avecSequelles([], [tk('fracture', 'mineur', 'jambeG')]) });
    const s = carryOverState(c, { lignes: [], faits: [] });
    expect(s.traumas!.length).toBe(1);
    expect(s.traumas![0].ops?.some((o) => o.op === 'moveScale')).toBe(true);
  });
});

describe('persistence — un État dont le verrou tient sort de la rencontre (LDB 18 l.15, l.53)', () => {
  const sansHemorragie: Condition = { kind: 'compare', subject: { who: 'target', condition: 'hemorragique' }, op: '==', value: 0 };
  const sortie = (c: Combatant) => carryOverState(c, { lignes: [], faits: [] }).conditions!.map((x) => x.id);
  const entree = (c: Combatant) => entreeEnRencontre(c, { lignes: [], faits: [] }).conditions.map((x) => x.id);
  const auxDeuxCoutures = (c: Combatant, id: string, garde: boolean) => {
    expect(sortie(c).includes(id), `retour : ${id}`).toBe(garde);
    expect(entree(c).includes(id), `entrée : ${id}`).toBe(garde);
  };

  it('À Terre à 0 Blessure tient (LDB 18 l.15)', () => {
    auxDeuxCoutures(baseCombatant({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'a-terre', value: 1 }] }), 'a-terre', true);
  });
  it('À Terre à 3 Blessures tombe (LDB 16 l.39)', () => {
    auxDeuxCoutures(baseCombatant({ wounds: blessuresDeBase(12, 3), conditions: [{ id: 'a-terre', value: 1 }] }), 'a-terre', false);
  });
  it('Sonné jusqu’à l’Aide médicale tient, puis tombe une fois l’Aide reçue (LDB 18 l.120)', () => {
    const c = baseCombatant({ conditions: [{ id: 'sonne', value: 1, unlockBy: 'medicalAid' }] });
    auxDeuxCoutures(c, 'sonne', true);
    releaseConditionLocks(c, 'medicalAid');
    auxDeuxCoutures(c, 'sonne', false);
  });
  it('Aveuglé jusqu’à l’Aide médicale tient (LDB 18 l.70)', () => {
    auxDeuxCoutures(baseCombatant({ conditions: [{ id: 'aveugle', value: 1, unlockBy: 'medicalAid' }] }), 'aveugle', true);
  });
  it('Aveuglé tant qu’un Hémorragique reste tient ; sans Hémorragique, il tombe (LDB 18 l.68)', () => {
    const aveugle = { id: 'aveugle', value: 1, lockedUntil: sansHemorragie };
    auxDeuxCoutures(baseCombatant({ conditions: [{ id: 'hemorragique', value: 2 }, { ...aveugle }] }), 'aveugle', true);
    auxDeuxCoutures(baseCombatant({ conditions: [{ ...aveugle }] }), 'aveugle', false);
  });
  it('Inconscient jusqu’à la fin de la rencontre tombe malgré son verrou d’acte (LDB 18 l.53)', () => {
    auxDeuxCoutures(baseCombatant({ conditions: [{ id: 'inconscient', value: 1, finDeRencontre: true }] }), 'inconscient', false);
  });
});
