import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * RAW LDB 17 l.68 — « Je ne faillirai pas ! » : « au lieu de lancer les dés pour un Test, vous
 * CHOISISSEZ LE RÉSULTAT ». L'exemple (l.70) : Salundra rate, dépense 1 Résilience, et « choisit
 * également le résultat du dé, 11, ce qui donne un Coup Critique ». Donc sur une attaque forcée,
 * le joueur peut CHOISIR la valeur du dé (un double ≤ cible → Critique ; 01 → DR max ; le chiffre
 * des unités nourrit Percutante/Dévastatrice et la localisation inversée).
 */
const C = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'X', name: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  })) as unknown as Combatant;

function setupForcedAttack() {
  seedBattleRng(7);
  const attacker = C({ id: 'A', label: 'Att', resilience: 2 });
  const target = C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } });
  banc.setState({
    battle: { combatants: [attacker, target], log: [] } as never,
    pendingAttack: {
      attackerId: 'A', targetId: 'B', location: null,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: 'defender',
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      } as never,
    },
  });
  banc.getState().attackForceSuccess();
}

beforeEach(() => {
  banc.setState({ pendingAttack: null, battle: null });
});

describe('attackSetForcedRoll — choisir la valeur du dé d’un succès forcé (RAW LDB 17 l.68)', () => {
  it('choisir un double ≤ cible (44) → Coup Critique (l’exemple Salundra)', () => {
    setupForcedAttack();
    banc.getState().attackSetForcedRoll(44);
    const res = banc.getState().pendingAttack!.result!;
    expect(res.hit).toBe(true);
    expect(res.attackerRoll).toBe(44);
    expect(res.critical).toBe(true);
  });

  it('choisir 01 → réussite simple au DR maximal, pas de Critique', () => {
    setupForcedAttack();
    banc.getState().attackSetForcedRoll(1);
    const res = banc.getState().pendingAttack!.result!;
    expect(res.hit).toBe(true);
    expect(res.attackerRoll).toBe(1);
    expect(res.critical).toBe(false);
    expect(res.attackerDetail!.sl).toBe(4); // dizaine(45) − dizaine(01)
  });

  it('valeur > cible refusée (le choix doit rester une réussite)', () => {
    setupForcedAttack();
    const avant = banc.getState().pendingAttack!.result!.attackerRoll; // dé PAR DÉFAUT (#941 : le MEILLEUR)
    banc.getState().attackSetForcedRoll(77);
    expect(banc.getState().pendingAttack!.result!.attackerRoll).toBe(avant); // inchangé
  });

  it('ne dépense PAS de Résilience supplémentaire (même Test)', () => {
    setupForcedAttack();
    const before = banc.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience;
    banc.getState().attackSetForcedRoll(44);
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience).toBe(before);
  });

  // Sans Résilience en cours, le MÊME verbe sert l'autre provenance du dé (option « Dés fixés », #939) :
  // il applique bien la valeur, mais ÉVALUÉE — aucune réussite forcée, aucun `forced` posé. (L'affordance,
  // elle, reste gatée par l'option + le contrôle du siège : `fixed-die.test.ts`.)
  it('attaque non forcée → le dé s’applique au NATUREL, sans rien forcer', () => {
    seedBattleRng(7);
    banc.setState({
      battle: { combatants: [C({ id: 'A', resilience: 2 }), C({ id: 'B', kind: 'enemy' })], log: [] } as never,
      pendingAttack: {
        attackerId: 'A', targetId: 'B', location: null,
        result: { hit: true, attackerRoll: 22, netSL: 2, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: '', attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 22, success: true, sl: 2 } } as never,
      },
    });
    banc.getState().attackSetForcedRoll(44);
    const res = banc.getState().pendingAttack!.result!;
    expect(res.attackerRoll).toBe(44);
    expect(res.attackerDetail!.success).toBe(true); // 44 ≤ 45 : réussite RÉELLE du dé, pas forcée
    expect(res.attackerDetail!.sl).toBe(0); // dizaine(45) − dizaine(44) : aucun plancher de Résilience
    expect(banc.getState().pendingAttack!.forced).toBeFalsy();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience).toBe(2);
  });
});

describe('castSetForcedRoll — même choix sur une INCANTATION forcée (parité des modales)', () => {
  function setupForcedCast() {
    seedBattleRng(7);
    const caster = C({ id: 'A', label: 'Mage', resilience: 2 });
    const target = C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } });
    banc.setState({
      battle: { combatants: [caster, target], log: [] } as never,
      pendingCast: {
        casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false,
        result: { cast: false, roll: 88, target: 45, sl: -4, isCritical: false, isFumble: false, log: 'raté' },
      } as never,
    });
    banc.getState().castForceSuccess();
  }

  it('11 (le plus bas double réussi) → Incantation Critique', () => {
    setupForcedCast();
    expect(banc.getState().pendingCast!.forced).toBe(true);
    banc.getState().castSetForcedRoll(11);
    const res = banc.getState().pendingCast!.result!;
    expect(res.roll).toBe(11);
    expect(res.cast).toBe(true);
    expect(res.isCritical).toBe(true);
  });

  it('01 → DR maximal (Surincantation), pas de Critique ; valeur > cible refusée', () => {
    setupForcedCast();
    banc.getState().castSetForcedRoll(1);
    const res = banc.getState().pendingCast!.result!;
    expect(res.roll).toBe(1);
    expect(res.isCritical).toBe(false);
    expect(res.sl).toBe(4); // dizaine(45) − dizaine(01)
    banc.getState().castSetForcedRoll(77);
    expect(banc.getState().pendingCast!.result!.roll).toBe(1); // inchangé
  });
});

describe('defenseSetForcedRoll — même choix sur une DÉFENSE forcée', () => {
  function setupForcedDefense() {
    seedBattleRng(7);
    const attacker = C({ id: 'E', label: 'Orque', kind: 'enemy' });
    const defender = C({ id: 'H', label: 'Héros', resilience: 2, pos: { x: 1, y: 0 } });
    const atk = { roll: 30, target: 40, success: true, sl: 1, isDouble: false };
    banc.setState({
      battle: { combatants: [attacker, defender], log: [] } as never,
      pendingDefense: {
        attackerId: 'E', defenderId: 'H', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
        location: null, atk, mode: 'esquive',
        def: { roll: 95, target: 50, success: false, sl: -4, isDouble: false },
        result: {
          hit: true, attackerRoll: 30, netSL: 5, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
          attackerDetail: { label: 'Corps à corps', base: 40, modifier: 0, target: 40, roll: 30, success: true, sl: 1 },
          defenderDetail: { label: 'Esquive', base: 50, modifier: 0, target: 50, roll: 95, success: false, sl: -4 },
        },
        suite: { mode: 'machine', coup: {} },
      } as never,
    });
    banc.getState().defenseForceSuccess();
  }

  it('le force pose `forced`, puis le défenseur choisit son dé (11 = double)', () => {
    setupForcedDefense();
    const pd = banc.getState().pendingDefense!;
    expect(pd.forced).toBe(true);
    expect(pd.result!.hit).toBe(false); // « vous l'emportez avec au moins DR +1 »
    banc.getState().defenseSetForcedRoll(11);
    const after = banc.getState().pendingDefense!;
    expect(after.def!.roll).toBe(11);
    expect(after.def!.isDouble).toBe(true);
    expect(after.result!.hit).toBe(false); // l'emporte toujours
    banc.getState().defenseSetForcedRoll(88); // > cible (50) : refusé
    expect(banc.getState().pendingDefense!.def!.roll).toBe(11);
  });
});
