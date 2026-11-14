/**
 * Les Bandages dans le soin (#3059 I3) : le Test déclaré (Guérison / Dextérité), les Bandages engagés, et l'issue que
 * l'annonce dit = celle que `jetValider('soins')` applique. LDB 74 l.41 ; LDB 09 l.260-261 ; LDB 16 l.107 ; LDB 18 l.308-311 ;
 * LDB 10 l.19, l.897-899 ; LDB 23 l.209. Valeurs de lacune (orchestrateur, 2026-11-03) : une unité s'use, la Dextérité
 * retire 1 État, Intermédiaire (+0).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { FLOWS } from './rollFlowSpecs';
import { describeHeal } from './flowOutcomes';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { applyOps } from '../engine/ops';
import { makeRNG } from '../engine/dice';
import { itemFromTrappingById, unarmedWeapon } from '../engine/items';
import { evaluateTest } from '../engine/tests';
import { seedBattleRng } from './battleRng';
import { garanti } from '../lib/garanti';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { Combatant, ItemInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const bandage = (uid: string): ItemInstance => ({ ...garanti(itemFromTrappingById('bandages', idsDeTest), 'bandages', 'Bandages'), uid });
const GUERISON = [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] as never;

function hero(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 35, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4, traumas: [],
    weapons: [unarmedWeapon()], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, items: [], pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

/** Un combat en cours : un adversaire loin tient la rencontre ouverte (sa fin purge `woundDressed`, `combatFlow`). */
function combat(allies: Combatant[]) {
  const combatants = [...allies, hero({ id: 'gob', label: 'Gob', kind: 'ennemi', pos: { x: 9, y: 9 } })];
  const order = combatants.map((c) => c.id);
  banc.setState({
    mode: 'battle', pendingHeal: null,
    battle: { combatants, order, baseOrder: order, turn: 0, round: 1, action: 'soins', selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false, log: [], over: null } as never,
  });
}
const enCombat = (id: string) => garanti(banc.getState().battle?.combatants.find((c) => c.id === id), id, 'combattant');
const hemorragie = (id: string) => enCombat(id).conditions.find((c) => c.id === 'hemorragique')?.value ?? 0;
/** Le jet posé par le résolveur, figé au dé `roll` réussi de DR `sl`. */
function jete(roll: number, success: boolean, sl: number) {
  banc.getState().jetLancer('soins');
  const ph = garanti(banc.getState().pendingHeal, 'heal', 'soin');
  banc.setState({ pendingHeal: { ...ph, roll, success, sl } });
}

describe('Hémorragie sous Bandages (LDB 09 l.261 ; LDB 74 l.41)', () => {
  it('Guérison réussie DR 1 sur 4 États : 1 restant avec Bandages, 2 sans ; l’annonce dit ce que l’application retire', () => {
    for (const [avec, annonce, reste] of [[true, "3 pion(s) d'Hémorragie stoppé(s) sur Al.", 1], [false, "2 pion(s) d'Hémorragie stoppé(s) sur Al.", 2]] as const) {
      combat([hero({ id: 'doc', skills: GUERISON, items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', conditions: [{ id: 'hemorragique', value: 4 }], pos: { x: 2, y: 1 } })]);
      banc.getState().ouvrirLaGuerison('al');
      banc.getState().jetRegler('soins', 'mode', 'hemorragie');
      if (avec) banc.getState().jetRegler('soins', 'bandages', 'doc');
      jete(10, true, 1);
      expect(describeHeal(banc.getState().pendingHeal!, enCombat('al'), 'Al')).toBe(annonce);
      banc.getState().jetValider('soins');
      expect(hemorragie('al')).toBe(reste);
      expect(enCombat('doc').items!.length).toBe(avec ? 0 : 1);
    }
  });

  it('l’annonce est plafonnée aux États portés (1 État, DR 3 : 1 annoncé, 1 retiré)', () => {
    combat([hero({ id: 'doc', skills: GUERISON }), hero({ id: 'al', label: 'Al', conditions: [{ id: 'hemorragique', value: 1 }], pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    jete(10, true, 3);
    expect(describeHeal(banc.getState().pendingHeal!, enCombat('al'), 'Al')).toBe("1 pion(s) d'Hémorragie stoppé(s) sur Al.");
  });

  it('Dextérité sous Bandages (soigneur sans Guérison) : Test de Dextérité, 1 État retiré quel que soit le DR', () => {
    combat([hero({ id: 'doc', items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', conditions: [{ id: 'hemorragique', value: 4 }], pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    const ph = banc.getState().pendingHeal!;
    expect([ph.test, ph.bandagesDe, ph.skillValue, ph.difficulty]).toEqual(['dexterite', 'doc', 35, 'intermediaire']);
    jete(10, true, 3);
    banc.getState().jetValider('soins');
    expect(hemorragie('al')).toBe(3);
  });

  it('Dextérité sans Bandages : non offerte (soin refusé)', () => {
    combat([hero({ id: 'doc' }), hero({ id: 'al', label: 'Al', conditions: [{ id: 'hemorragique', value: 4 }], pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    expect(banc.getState().pendingHeal).toBeNull();
  });

  it('en Dextérité : le soin de Blessures est refusé, et les Bandages ne se retirent pas', () => {
    combat([hero({ id: 'doc', items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    banc.getState().jetRegler('soins', 'mode', 'blessures');
    banc.getState().jetRegler('soins', 'bandages', null);
    expect([banc.getState().pendingHeal!.mode, banc.getState().pendingHeal!.bandagesDe]).toEqual(['hemorragie', 'doc']);
  });

  it('un porteur de Guérison choisit la Dextérité, seulement Bandages engagés (réglage `soins.test`)', () => {
    combat([hero({ id: 'doc', skills: GUERISON, items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    banc.getState().jetRegler('soins', 'test', 'dexterite');
    expect(banc.getState().pendingHeal!.test).toBe('guerison');
    banc.getState().jetRegler('soins', 'bandages', 'doc');
    banc.getState().jetRegler('soins', 'test', 'dexterite');
    expect([banc.getState().pendingHeal!.test, banc.getState().pendingHeal!.skillValue]).toEqual(['dexterite', 35]);
  });
});

describe('Blessures et Aide Médicale sous Bandages (LDB 09 l.260 ; LDB 18 l.311)', () => {
  it('soin de Blessures réussi : aucune Infection (`woundDressed`) seulement sous Bandages', () => {
    for (const avec of [true, false]) {
      combat([hero({ id: 'doc', skills: GUERISON, items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } })]);
      banc.getState().ouvrirLaGuerison('al');
      if (avec) banc.getState().jetRegler('soins', 'bandages', 'doc');
      jete(10, true, 1);
      banc.getState().jetValider('soins');
      expect(!!enCombat('al').woundDressed).toBe(avec);
    }
  });

  it('soin raté sous Bandages : l’unité s’use et l’Aide Médicale est reçue ; raté sans Bandages, rien', () => {
    for (const avec of [true, false]) {
      combat([hero({ id: 'doc', skills: GUERISON, items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3), traumas: [{ traumaId: 'z', awaitingMedicalAid: true }] as never, pos: { x: 2, y: 1 } })]);
      banc.getState().ouvrirLaGuerison('al');
      if (avec) banc.getState().jetRegler('soins', 'bandages', 'doc');
      jete(90, false, -5);
      banc.getState().jetValider('soins');
      expect(enCombat('al').traumas![0].awaitingMedicalAid).toBe(!avec);
      expect(enCombat('doc').items!.length).toBe(avec ? 0 : 1);
    }
  });
});

describe('+DR des Talents « Tests : » et inversion sur le soin (LDB 10 l.19, l.897-899 ; LDB 23 l.209)', () => {
  it('Pansement de fortune en Round de combat : la Guérison réussie gagne +1 DR au jet', () => {
    const doc = hero({ id: 'doc', skills: GUERISON, talents: [{ talentId: 'pansement-de-fortune', times: 1 }] as never });
    for (let seed = 1; seed < 40; seed++) {
      combat([doc, hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } })]);
      seedBattleRng(seed);
      banc.getState().ouvrirLaGuerison('al');
      banc.getState().jetLancer('soins');
      const ph = banc.getState().pendingHeal!;
      if (!ph.success) continue;
      expect(ph.sl).toBe(evaluateTest(ph.roll!, ph.target).sl + 1);
      return;
    }
    throw new Error('aucune graine ne réussit le Test');
  });

  it('le dé fixé du soin garde le +1 DR de Pansement de fortune en Round de combat (même issue que le jet)', () => {
    const doc = hero({ id: 'doc', skills: GUERISON, talents: [{ talentId: 'pansement-de-fortune', times: 1 }] as never });
    combat([doc, hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetLancer('soins');
    banc.getState().jetImposerLeResultat('soins', 5);
    const ph = garanti(banc.getState().pendingHeal, 'heal', 'soin');
    expect([ph.roll, ph.success, ph.sl]).toEqual([5, true, evaluateTest(5, ph.target).sl + 1]);
  });

  it('jeton « Pratiquer » Guérison : inverse le soin raté (82 → 28), +1 DR de Pansement de fortune en combat', () => {
    const doc = hero({ id: 'doc', skills: GUERISON, talents: [{ talentId: 'pansement-de-fortune', times: 1 }] as never });
    applyOps(doc, [{ op: 'grantReverseToken', skill: { id: 'guerison' } }], { idNeuf: idsDeTest, rng: makeRNG(1), label: 'Pratiquer' });
    combat([doc, hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } })]);
    banc.getState().ouvrirLaGuerison('al');
    const ph = banc.getState().pendingHeal!;
    banc.setState({ pendingHeal: { ...ph, roll: 82, target: 40, success: false, sl: -4 } });
    banc.getState().jetInverser('soins');
    const apres = banc.getState().pendingHeal!;
    expect([apres.roll, apres.success, apres.sl]).toEqual([28, true, 3]);
  });

  it('hors Round de combat : Chirurgie donne +1 DR, Pansement de fortune rien (LDB 10 l.182, l.897)', () => {
    for (const [talentId, sl] of [['chirurgie', 3], ['pansement-de-fortune', 2]] as const) {
      const doc = hero({ id: 'doc', skills: GUERISON, talents: [{ talentId, times: 1 }] as never });
      applyOps(doc, [{ op: 'grantReverseToken', skill: { id: 'guerison' } }], { idNeuf: idsDeTest, rng: makeRNG(1), label: 'Pratiquer' });
      const al = hero({ id: 'al', label: 'Al', wounds: blessuresDeBase(12, 3) });
      banc.setState({
        battle: null, party: [doc, al], medic: { patientId: 'al' },
        pendingHeal: { healerId: 'doc', healerName: fixtureText('Doc'), targetId: 'al', mode: 'blessures', intBonus: 4, test: 'guerison', bandagesDe: null, skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, target: 40, roll: 82, success: false, sl: -4 },
      });
      banc.getState().jetInverser('soins');
      expect([talentId, banc.getState().pendingHeal!.sl]).toEqual([talentId, sl]);
    }
  });

  it('Pansement de fortune (inversion) : offert sur une Guérison ratée sous Bandages, ni sans, ni en Dextérité', () => {
    const talents = [{ talentId: 'pansement-de-fortune', times: 1 }] as never;
    const cas = [
      { skills: GUERISON, bandages: true, test: 'guerison', offert: true },
      { skills: GUERISON, bandages: false, test: 'guerison', offert: false },
      { skills: [], bandages: true, test: 'dexterite', offert: false },
    ] as const;
    for (const c of cas) {
      combat([hero({ id: 'doc', skills: c.skills as never, talents, items: [bandage('b1')] }), hero({ id: 'al', label: 'Al', conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } })]);
      banc.getState().ouvrirLaGuerison('al');
      banc.getState().jetRegler('soins', 'mode', 'hemorragie');
      if (c.bandages) banc.getState().jetRegler('soins', 'bandages', 'doc');
      expect(banc.getState().pendingHeal!.test).toBe(c.test);
      banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, roll: 82, target: 40, success: false, sl: -4 } });
      expect(FLOWS.soins.reverseAvailable(banc.getState), JSON.stringify(c)).toBe(c.offert);
    }
  });
});

describe('Coop : seul le siège du porteur engage ses Bandages (`user-arbitrage-coop-inventaire-par-proprietaire-bg3`)', () => {
  const net = (ownership: Record<string, number>) => ({ ...initialNet(), mode: 'hote' as const, mySeat: 0, ownership, slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'A', 2: 'B' } });
  const ph = (healerId: string) => ({ healerId, healerName: fixtureText('S'), targetId: 'al', mode: 'hemorragie' as const, intBonus: 4, test: 'guerison' as const, bandagesDe: null, skillValue: 50, difficulty: 'intermediaire' as const, ligne: { base: 50, mods: [], target: 50, difficulty: 'intermediaire' as const }, target: 50, roll: null, success: false, sl: 0 });
  const paire = () => [intentAllowedFor(banc.getState(), 2, 'jetRegler', ['soins', 'bandages', 'al']), intentAllowedFor(banc.getState(), 1, 'jetRegler', ['soins', 'bandages', 'al'])];

  it('combat : les Bandages du patient (siège 2) — siège 2 accepté, siège du soigneur (1) refusé', () => {
    const doc = hero({ id: 'doc', skills: GUERISON });
    const al = hero({ id: 'al', label: 'Al', items: [bandage('b1')], conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    combat([doc, al]);
    banc.setState({ pendingHeal: ph('doc'), net: net({ doc: 1, al: 2 }) as never });
    expect(paire()).toEqual([true, false]);
  });

  it('infirmerie, soigneur héros : siège du patient (2) accepté, siège du soigneur (1) refusé', () => {
    const doc = hero({ id: 'doc', skills: GUERISON });
    const al = hero({ id: 'al', label: 'Al', items: [bandage('b1')], conditions: [{ id: 'hemorragique', value: 2 }] });
    banc.setState({ party: [doc, al], medic: { patientId: 'al' }, pendingHeal: ph('doc'), net: net({ doc: 1, al: 2 }) as never });
    expect(paire()).toEqual([true, false]);
  });

  it('infirmerie, soigneur PNJ : siège du patient (2) accepté, hôte (0) refusé', () => {
    const al = hero({ id: 'al', label: 'Al', items: [bandage('b1')], conditions: [{ id: 'hemorragique', value: 2 }] });
    banc.setState({
      party: [al], net: net({ al: 2 }) as never, pendingHeal: ph('pnj-soigneur'),
      medic: { patientId: 'al', npc: { id: 'medecin', label: 'Médecin', skill: { id: 'guerison', value: 50 }, intBonus: 4, acts: [{ act: 'hemorragie' }] } },
    });
    expect([intentAllowedFor(banc.getState(), 2, 'jetRegler', ['soins', 'bandages', 'al']), intentAllowedFor(banc.getState(), 0, 'jetRegler', ['soins', 'bandages', 'al'])]).toEqual([true, false]);
  });
});
