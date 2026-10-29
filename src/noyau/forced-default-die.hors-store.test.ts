import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { bestForcedRoll, evaluateTest } from '../engine/tests';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #941 — DÉ PAR DÉFAUT d'une réussite forcée par la Résilience.
 *
 * LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat » — le joueur
 * choisit LE MEILLEUR (l'exemple l.70 choisit 11 pour son Coup Critique). Le dé par défaut proposé
 * par le moteur doit donc être `bestForcedRoll(cible)` (policy-aware : 01 en DR standard, le plus haut
 * valide en DR rapide), JAMAIS le dé raté que le joueur venait d'obtenir.
 *
 * Les cinq flux sans lentille (attaque/défense/incantation/coup dans le dos/piétinement) CONSERVAIENT
 * ce dé raté et se contentaient de plancher le DR — deux défauts en un : un DR très inférieur au
 * possible, et un `isDouble` hérité d'un dé que personne n'a choisi (un 88 forcé réussi fabriquait
 * un Coup Critique). Le plancher des Tests opposés (« vous l'emportez avec au moins DR +1 ») reste dû.
 */
const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

beforeEach(() => {
  banc.setState({ pendingAttack: null, pendingDefense: null, pendingCast: null, battle: null });
});

/** Attaque ratée sur un DOUBLE malheureux (88 vs 45) — le pire cas mesuré. */
function setupAttack() {
  seedBattleRng(7);
  banc.setState({
    battle: { combatants: [C({ id: 'A', label: 'Att', resilience: 2 }), C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } })], log: [] } as never,
    pendingAttack: {
      attackerId: 'A', targetId: 'B', location: null,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: null,
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      } as never,
    },
  });
}

describe('attaque — le dé par défaut est le MEILLEUR, pas le dé raté', () => {
  it('un 88 raté ne survit PAS à la Résilience : dé = bestForcedRoll(45), DR maximal', () => {
    setupAttack();
    banc.getState().attackForceSuccess();
    const res = banc.getState().pendingAttack!.result!;
    const die = bestForcedRoll(45);
    expect(res.attackerRoll).toBe(die);
    expect(res.attackerDetail!.sl).toBe(Math.max(evaluateTest(die, 45).sl, 1));
    expect(res.hit).toBe(true);
  });

  it('aucun Coup Critique FABRIQUÉ par le double du dé raté (88 → isDouble hérité)', () => {
    setupAttack();
    banc.getState().attackForceSuccess();
    const res = banc.getState().pendingAttack!.result!;
    expect(res.attackerRoll).not.toBe(88);
    expect(res.critical).toBe(false); // 01 n'est pas un double — le Critique reste un CHOIX (dé 11)
  });
});

describe('défense — même dé par défaut, plancher opposé conservé (LDB 17 l.68)', () => {
  it('le défenseur forcé l’emporte avec au moins DR +1, sur le MEILLEUR dé', () => {
    seedBattleRng(7);
    const atk = { roll: 30, target: 40, success: true, sl: 1, isDouble: false };
    banc.setState({
      battle: { combatants: [C({ id: 'E', label: 'Orque', kind: 'enemy' }), C({ id: 'H', label: 'Héros', resilience: 2, pos: { x: 1, y: 0 } })], log: [] } as never,
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
    const pd = banc.getState().pendingDefense!;
    const die = bestForcedRoll(50);
    expect(pd.def!.roll).toBe(die);
    expect(pd.def!.sl).toBe(Math.max(evaluateTest(die, 50).sl, atk.sl + 1, 1));
    expect(pd.result!.hit).toBe(false); // l'emporte
  });
});

describe('incantation — le dé par défaut ne gonfle pas le DR (sonde `cast` promue)', () => {
  function setupCast() {
    seedBattleRng(7);
    banc.setState({
      battle: { combatants: [C({ id: 'A', label: 'Mage', resilience: 2 }), C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } })], log: [] } as never,
      pendingCast: {
        casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false,
        result: { cast: false, roll: 88, target: 45, sl: -4, isCritical: false, isFumble: false, log: 'raté' },
      } as never,
    });
  }

  it('le dé PAR DÉFAUT donne EXACTEMENT le même DR que le même dé choisi à la main', () => {
    setupCast();
    banc.getState().castForceSuccess();
    const parDefaut = banc.getState().pendingCast!.result!;
    setupCast();
    banc.getState().castForceSuccess();
    banc.getState().castSetForcedRoll(bestForcedRoll(45));
    const choisi = banc.getState().pendingCast!.result!;
    expect(parDefaut.roll).toBe(choisi.roll);
    // Un +1 DR fantôme au-dessus du maximum nourrirait la Surincantation sans rien dans la source.
    expect(parDefaut.sl).toBe(choisi.sl);
  });
});

describe('plancher de NI — la Résilience fait PARTIR le sort (sonde S3 promue)', () => {
  function setupSpell(spellId: string) {
    seedBattleRng(7);
    banc.setState({
      battle: { combatants: [C({ id: 'A', label: 'Mage', resilience: 2 }), C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } })], log: [] } as never,
      pendingCast: {
        casterId: 'A', targetId: 'A', spellId, missile: false, focused: false,
        result: { cast: false, roll: 88, target: 45, sl: -4, isCritical: false, isFumble: false, log: 'raté' },
      } as never,
    });
  }

  it('un sort à NI élevé PART quand même (LDB 17 l.75 : « réaliser à la perfection un Sort »)', () => {
    setupSpell('maitre-de-la-bete'); // NI 10
    banc.getState().castForceSuccess();
    const r = banc.getState().pendingCast!.result!;
    expect(r.cast).toBe(true);
    expect(r.sl).toBeGreaterThanOrEqual(10); // le DR atteint le NI : le plancher est SERVI
  });

  it('à NI 0, aucun +1 fantôme : le DR est EXACTEMENT celui du meilleur dé', () => {
    setupSpell('drain'); // NI 0
    banc.getState().castForceSuccess();
    const r = banc.getState().pendingCast!.result!;
    expect(r.sl).toBe(evaluateTest(bestForcedRoll(45), 45).sl);
  });
});
