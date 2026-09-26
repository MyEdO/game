import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { fireTriggers } from '../triggeredEffects';
import '../combatFlow'; // effet de bord : routeur de Test + applier triggeredTest + hook onHit
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { testScene } from '../../scenes/test-fixture';
import { resetCadence } from '../../engine/cadence';
import { hasCondition } from '../../engine/conditions';
import { REPLIS_DEUX_CIBLES, evaluateTest, resolveOpposed, bumpSL, type TestResult } from '../../engine/tests';
import { testValue, skillBaseValue } from '../../engine/skills';
import { frozenOpposedBatchStep, rollFrozenOpposedAttacker, simpleTriggeredTestStep, simpleBatchTestStep, withDerivedStake } from './triggeredTest';
import { resolveRecoverTest } from './recover';
import { rollBatchParticipant } from '../cascade';
import { EMPTY_FLOW, type FlowTest } from '../flow';
import type { Combatant, Weapon } from '../../engine/types';

/**
 * DÉPARTAGE À DR ÉGAL du canal `triggeredTest` (#1153 L3) — `LDB 12 l.160` : « Si les deux participants
 * obtiennent le même DR, c'est le groupe avec la Compétence ou la Caractéristique la plus élevée qui
 * l'emporte. » La grandeur comparée est donc la valeur NUE, et elle l'est POUR LES DEUX CAMPS : opposer
 * la nue de l'un à la cible de l'autre comparerait deux grandeurs différentes.
 *
 * Ce que ces gardes mesurent sur le chemin RÉEL (pas sur un `TestResult` forgé) :
 *  - le vainqueur suit la NUE là où les CIBLES donneraient l'inverse ;
 *  - la sonde `REPLIS_DEUX_CIBLES` ne bouge pas — aucun de ces chemins ne retombe sur les cibles ;
 *  - un jet d'attaquant fourni de l'EXTÉRIEUR sans nue fait retomber les DEUX camps (fail-closed).
 */

const assommante = (): Weapon => ({ label: 'Marteau de guerre', type: 'melee', damage: { plusBF: true, flat: 6 }, qualities: [{ id: 'assommante' }] } as Weapon);

const FT_OPP: FlowTest = { skill: { id: 'resistance' }, label: 'Résister', opposed: { attacker: 'force' } };
const BRANCHES = { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW };

function combatant(p: Partial<Combatant> & { id: string }): Combatant {
  return {
    label: p.id, kind: 'hero',
    characteristics: {
      'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 50, endurance: 40, initiative: 30,
      agilite: 30, dexterite: 32, intelligence: 40, 'force-mentale': 35, sociabilite: 30,
    },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'resistance', advances: 20, characteristic: 'endurance' }],
    talents: [], fortune: 0, resilience: 0, pos: { x: 1, y: 1 }, ...p,
  } as unknown as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle', party: combatants.filter((c) => c.kind === 'hero'),
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    },
    pendingCascade: null, pendingStateRecovery: null, pendingLogQueue: [],
  } as never);
}

beforeEach(() => { vi.useFakeTimers(); resetCadence(); seedBattleRng(1); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('TÉMOIN — la sonde `REPLIS_DEUX_CIBLES` est vivante dans ce runtime', () => {
  it('deux jets SANS nue la font compter (sans quoi les preuves ci-dessous ne vaudraient rien)', () => {
    const avant = REPLIS_DEUX_CIBLES.count;
    resolveOpposed(evaluateTest(30, 50), evaluateTest(40, 50));
    expect(REPLIS_DEUX_CIBLES.count).toBe(avant + 1);
  });
});

/** Défenseur dont la NUE est HAUTE et la valeur testée BASSE (2 Exténué, −20) : les deux grandeurs
 *  s'inversent face à un attaquant sain, et un départage sur les cibles donnerait l'autre vainqueur. */
function bandeInversee() {
  const def = combatant({ id: 'def', conditions: [{ id: 'extenue', value: 2 }] as never });
  const att = combatant({ id: 'att', kind: 'enemy', characteristics: { ...combatant({ id: 'x' }).characteristics, force: 45 } as never });
  setBattle([def, att], 'att');
  return { def, att };
}

describe('G4 — BANDE OPPOSÉE : le départage suit la NUE sur le résolveur de production', () => {
  it('nues inversées par rapport aux cibles : c’est la NUE qui désigne le vainqueur, sans repli', () => {
    const { def, att } = bandeInversee();
    const nueDef = skillBaseValue(def, 'resistance');
    const nueAtt = skillBaseValue(att, undefined, undefined, 'force');
    expect(nueDef, 'sonde inerte : sans nues distinctes, aucun départage ne se joue').toBeGreaterThan(nueAtt);
    expect(testValue(def, 'resistance'), 'les CIBLES doivent s’inverser, sinon le test ne discrimine rien')
      .toBeLessThan(testValue(att, undefined, 'force'));

    const avant = REPLIS_DEUX_CIBLES.count;
    let joue = false;
    for (let seed = 1; seed <= 300 && !joue; seed += 1) {
      seedBattleRng(seed);
      const aT = rollFrozenOpposedAttacker(att, FT_OPP.opposed!, 'intermediaire');
      const row = frozenOpposedBatchStep([def], FT_OPP, BRANCHES, EMPTY_FLOW, 'intermediaire', att, aT)!.participants![0];
      const roll = rollBatchParticipant(row, makeRNG(seed), { aT });
      const verdict = resolveOpposed(aT, { roll: roll.roll, target: roll.target, success: roll.success, sl: roll.sl, isDouble: false, base: row.base });
      if (verdict.decidedBy !== 'valeur') continue;
      joue = true;
      expect(verdict.winner, 'nue du défenseur > nue de l’attaquant').toBe('defender');
      expect(roll.success, 'le résolveur de production applique le MÊME verdict (le défenseur résiste)').toBe(true);
    }
    expect(joue, 'aucun DR égal en 300 germes : le départage n’a pas été atteint').toBe(true);
    expect(REPLIS_DEUX_CIBLES.count, 'un départage de la bande est retombé sur les cibles').toBe(avant);
  });

  it('un `aT` EXTERNE sans nue est fail-closed : les DEUX camps retombent sur leurs cibles, jamais un mixte', () => {
    const { def, att } = bandeInversee();
    const avant = REPLIS_DEUX_CIBLES.count;
    // Freeze fabriqué HORS `rollFrozenOpposedAttacker` (producteur tiers, sauvegarde d'une version
    // antérieure) : il ne porte aucune nue.
    const externe: TestResult = evaluateTest(41, testValue(att, undefined, 'force'));
    expect(externe.base).toBeUndefined();
    const row = frozenOpposedBatchStep([def], FT_OPP, BRANCHES, EMPTY_FLOW, 'intermediaire', att, externe)!.participants![0];
    const roll = rollBatchParticipant(row, makeRNG(9), { aT: externe });
    const verdict = resolveOpposed(externe, { roll: roll.roll, target: roll.target, success: roll.success, sl: roll.sl, isDouble: false, base: row.base });
    if (verdict.decidedBy === 'valeur') {
      // Le tout-ou-rien a bien joué : les grandeurs comparées sont les CIBLES des deux camps.
      expect(REPLIS_DEUX_CIBLES.count, 'le repli doit se JOURNALISER, jamais passer pour un verdict').toBeGreaterThan(avant);
    }
  });
});

describe('G4 — VOIE MONO : cascade opposée influençable et jet INLINE', () => {
  function scene() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const wielder = enemies[0];
    const prey = enemies[1];
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.wounds.max = 200; H.wounds.current = 200;
    prey.wounds.max = 200; prey.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, wielder, prey };
  }

  it('HÉROS MANUEL : nue haute + États lourds — le défenseur l’emporte au départage que ses CIBLES perdraient', () => {
    const { H, wielder } = scene();
    wielder.characteristics.force = 45;
    // Résistance NUE du héros portée au-dessus de la Force nue de l'attaquant, puis 2 Exténué (−20)
    // qui fondent sa valeur TESTÉE en dessous : les deux grandeurs s'inversent.
    H.characteristics.endurance += 55 - skillBaseValue(H, 'resistance');
    H.conditions.push({ id: 'extenue', value: 2 } as never);
    expect(skillBaseValue(H, 'resistance')).toBe(55);
    expect(testValue(H, 'resistance')).toBeLessThan(testValue(wielder, undefined, 'force'));

    const avant = REPLIS_DEUX_CIBLES.count;
    let joue = false;
    for (let seed = 1; seed <= 300 && !joue; seed += 1) {
      useGame.setState({ pendingCascade: null, pendingLogQueue: [] });
      seedBattleRng(seed);
      fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });
      const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
      const aT = step.meta!.opposed!.aT;
      expect(aT.base, 'le pré-jet de l’attaquant porte sa Force NUE').toBe(skillBaseValue(wielder, undefined, undefined, 'force'));
      expect(step.base, 'l’étape du défenseur porte sa Résistance NUE').toBe(55);
      useGame.getState().cascadeRoll(step.id);
      const r = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
      const verdict = resolveOpposed(aT, { roll: r.roll, target: r.target, success: r.success, sl: r.sl, isDouble: false, base: step.base });
      if (verdict.decidedBy !== 'valeur') continue;
      joue = true;
      expect(verdict.winner, 'nue 55 > nue de l’attaquant').toBe('defender');
      expect(r.success, 'l’étape conclut « résiste » — l’issue suit la NUE').toBe(true);
    }
    expect(joue, 'aucun DR égal en 300 germes : le départage n’a pas été atteint').toBe(true);
    expect(REPLIS_DEUX_CIBLES.count, 'un départage de la voie cascade est retombé sur les cibles').toBe(avant);
  });

  it('JET INLINE (victime ennemie) : le Test opposé se résout sans AUCUN repli deux-cibles', () => {
    const { wielder, prey } = scene();
    wielder.characteristics.force = 60;
    prey.characteristics.endurance = 30;
    const avant = REPLIS_DEUX_CIBLES.count;
    for (let seed = 1; seed <= 40; seed += 1) {
      seedBattleRng(seed);
      useGame.setState({ pendingLogQueue: [] });
      fireTriggers(useGame.getState, wielder, 'onHit', { victim: prey, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });
      const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
      live.conditions = live.conditions.filter((x) => x.id !== 'sonne');
      expect(hasCondition(live, 'sonne'), 'la conséquence est bien rejouable germe après germe').toBe(false);
    }
    expect(REPLIS_DEUX_CIBLES.count, 'la branche inline oppose deux jets dont l’un n’a pas de nue').toBe(avant);
  });
});

describe('G4 — producteurs de Tests SIMPLES : leur base est la NUE, aucun départage à alimenter', () => {
  it('mono et bande simples posent `skillBaseValue`, jamais une valeur fondue', () => {
    const c = combatant({ id: 'simple', conditions: [{ id: 'sonne', value: 1 }] as never });
    // L'enjeu vient du PORTEUR, comme en production (#1262 V2 L6d) : `MonoSpec.stake` est requis.
    const ft: FlowTest = withDerivedStake({ skill: { id: 'resistance' }, label: 'Résister' }, { kind: 'condition', id: 'empoisonne' });
    const nue = skillBaseValue(c, 'resistance');
    expect(nue, 'sonde inerte : sans État, nue et valeur testée se confondraient').not.toBe(testValue(c, 'resistance'));
    expect(simpleTriggeredTestStep(c, ft, BRANCHES, EMPTY_FLOW, 'intermediaire')!.base).toBe(nue);
    expect(simpleBatchTestStep([c], ft, BRANCHES, EMPTY_FLOW, 'intermediaire', 'bande')!.participants![0].base).toBe(nue);
  });
});

describe('ATTAQUE DU JUGE — le bonus de DR joue AVANT le départage, jamais à sa place', () => {
  it('la nue ne tranche que sur des DR STRICTEMENT égaux APRÈS bonus', () => {
    const aT: TestResult = { ...evaluateTest(45, 50, 50), sl: 1 };
    const def: TestResult = { ...evaluateTest(45, 50, 60), sl: 0 };
    // Sans bonus : les DR diffèrent → c'est le DR qui tranche, la nue ne sert pas.
    const sansBonus = resolveOpposed(aT, def);
    expect(sansBonus.decidedBy).toBe('dr');
    expect(sansBonus.winner).toBe('attacker');
    // +1 DR au défenseur (Piège-lame, LDB 62 l.280) : les DR s'égalisent → la nue tranche, et pour lui.
    const avecBonus = resolveOpposed(aT, bumpSL(def, 1));
    expect(avecBonus.decidedBy).toBe('valeur');
    expect(avecBonus.winner).toBe('defender');
  });
});

describe('G9 — « se libérer » d’Empêtré (`escapeStrength` FIGÉE) : nu des DEUX camps', () => {
  it('la résolution pose la nue de l’acteur ET celle de l’entrave figée', () => {
    const pris = combatant({ id: 'pris', conditions: [{ id: 'empetre', value: 1, escapeStrength: 55 }] as never });
    setBattle([pris], 'pris');
    const rt = resolveRecoverTest(pris, 'empetre', useGame.getState().battle!)!;
    expect(rt.opposition).toBeDefined();
    expect(rt.skillBase, 'Force NUE de l’acteur (LDB 09 l.17)').toBe(skillBaseValue(pris, undefined, undefined, 'force'));
    expect(rt.opposition?.base, 'l’entrave FIGÉE est sa propre nue — aucun porteur à décomposer').toBe(55);
    expect(rt.opposition?.value).toBe(55);
  });

  it('le flux joueur roule ce Test sans AUCUN repli deux-cibles', () => {
    const avant = REPLIS_DEUX_CIBLES.count;
    for (let seed = 1; seed <= 30; seed += 1) {
      seedBattleRng(seed);
      const pris = combatant({ id: 'pris', conditions: [{ id: 'empetre', value: 1, escapeStrength: 55 }] as never });
      setBattle([pris], 'pris');
      useGame.getState().battleRecoverState('empetre');
      useGame.getState().recoverRoll();
    }
    expect(REPLIS_DEUX_CIBLES.count).toBe(avant);
  });
});
