/**
 * Effets onHit AUTHORÉS des MANŒUVRES (`TraitData.maneuver.effects`, donnée éditable) — migrés des
 * handlers en dur de `applyFreeAttackEffects`. Appliqués SCOPED à la manœuvre (via `maneuverEffectsOf`
 * + `applyTriggeredEffects`). Preuve : Attaque caudale → À Terre si la cible est plus petite ;
 * Tentacules → Empêtré.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyFreeAttackEffects, applyWail } from './combatFlow';
import { applyTriggeredEffects, maneuverEffectsOf } from './triggeredEffects';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';

import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { resetCadence } from '../engine/cadence';

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', label: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
  wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

const get = (() => ({ log: () => {}, battle: undefined })) as never;
const hit: AttackResult = { hit: true, woundsLost: 3 } as AttackResult;
const empetre = (c: Combatant) => c.conditions.find((x) => x.id === 'empetre');
const aTerre = (c: Combatant) => c.conditions.find((x) => x.id === 'a-terre');

describe('effets onHit de manœuvre (data) appliqués par applyFreeAttackEffects', () => {
  it('Attaque caudale : cible PLUS PETITE → À Terre (compare Taille acteur-vs-acteur)', () => {
    const dragon = mk({ id: 'd', traits: [{ id: 'attaque-caudale', value: 9 }], size: 'enorme' });
    const prey = mk({ id: 'p', size: 'moyenne' });
    applyFreeAttackEffects(get, dragon, prey, 'caudale', hit);
    expect(aTerre(prey)?.value).toBe(1);
  });

  it('Attaque caudale : cible AUSSI GRANDE ou plus → PAS d’À Terre', () => {
    const dragon = mk({ id: 'd', traits: [{ id: 'attaque-caudale', value: 9 }], size: 'moyenne' });
    const peer = mk({ id: 'p', size: 'grande' });
    applyFreeAttackEffects(get, dragon, peer, 'caudale', hit);
    expect(aTerre(peer)).toBeUndefined();
  });

  it('Tentacules : à la touche causant des Dégâts → Empêtré (Force d’évasion = Force de l’attaquant)', () => {
    const kraken = mk({ id: 'k', traits: [{ id: 'tentacules', value: 6 }] });
    const foe = mk({ id: 'f' });
    applyFreeAttackEffects(get, kraken, foe, 'tentacules', hit);
    expect(empetre(foe)?.value).toBe(1);
    expect(empetre(foe)?.escapeStrength).toBe(kraken.characteristics.force);
  });

  it('sans Dégâts (woundsLost 0) : pas d’effet de manœuvre', () => {
    const dragon = mk({ traits: [{ id: 'attaque-caudale', value: 9 }], size: 'enorme' });
    const prey = mk({ size: 'petite' });
    applyFreeAttackEffects(get, dragon, prey, 'caudale', { hit: true, woundsLost: 0 } as AttackResult);
    expect(aTerre(prey)).toBeUndefined();
  });
});

describe('effets onHit des manœuvres de zone/action (data) — appliqués par leur résolution moteur', () => {
  // Manœuvres SANS nœud `test` dans leur Flow → résolues inline par `applyTriggeredEffects` (string[]).
  const fire = (kind: string, attacker: Combatant, victim: Combatant, margin?: number) =>
    applyTriggeredEffects((() => ({ battle: undefined })) as never, attacker, maneuverEffectsOf(attacker, kind), 'onHit', { victim, margin, rng: makeRNG(2) });

  it('Langue préhensile → Empêtré (Force d’évasion = Force de l’attaquant)', () => {
    const jab = mk({ traits: [{ id: 'langue-prehensile', value: 6 }] }); const foe = mk({ id: 'f' });
    fire('langue', jab, foe);
    expect(empetre(foe)?.value).toBe(1);
    expect(empetre(foe)?.escapeStrength).toBe(jab.characteristics.force);
  });

  it('Regard pétrifiant → Sonné échelonné sur la marge (1 par 2 DR, via valuePerSL ← ctx.sl)', () => {
    const basilic = mk({ traits: [{ id: 'regard-petrifiant', value: 0 }] }); const foe = mk({ id: 'f' });
    fire('regard', basilic, foe, 4); // marge 4 → floor(4/2) = 2 Sonné
    expect(foe.conditions.find((c) => c.id === 'sonne')?.value).toBe(2);
  });
});

/**
 * Hurlement fantomatique porte désormais un nœud Flow `test` (Lot 4a) enfoui dans son Flow
 * `seq[ do(1d10) , test{Résistance → Brisé} , do(3 Assourdi) ]`. Routé via le store (un `test` non routé
 * LÈVE). La manœuvre cible `allFoes` → un banshee ENNEMI hurle sur le HÉROS : héros MANUEL → le Test
 * suspend en ÉTAPE de cascade `triggeredTest` INFLUENÇABLE (avec `meta.after` = le `do(3 Assourdi)`) ; le
 * `do(1d10)` AVANT s'applique tout de suite ; après `cascadeRoll`+`cascadeNext`, la branche PUIS la
 * continuation `after` (3 Assourdi) s'appliquent — preuve que l'ordre du Flow `seq` est préservé.
 */
describe('Hurlement fantomatique — Test de trigger enfoui routé (cadence-aware)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('banshee ENNEMIE hurle sur le HÉROS → étape triggeredTest (after = 3 Assourdi), rejouée à la résolution', () => {
    seedBattleRng(5);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.characteristics.endurance = 90; H.wounds.max = 100; H.wounds.current = 100; // Résistance réussie (pas de Brisé)
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const banshee = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    banshee.traits = [...(banshee.traits ?? []), { id: 'hurlement-fantomatique', value: 0 }];
    banshee.pos = { x: 10, y: 10 };
    H.pos = { x: 11, y: 10 };
    banshee.advantage = 3;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    applyWail(useGame.getState, useGame.setState, banshee);

    // Le `do(1d10)` AVANT le test s'est appliqué tout de suite ; le test a suspendu en étape de cascade.
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();        // pas encore lancé → influençable
    expect(step.meta?.after).toBeTruthy();  // la continuation (3 Assourdi) voyage dans le meta (sérialisable)
    expect(useGame.getState().pendingLogQueue.some((q) => /Blessure/.test(q.line))).toBe(true); // 1d10 déjà subi

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();

    const live = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(live.conditions.find((c) => c.id === 'assourdi')?.value).toBe(3); // continuation `after` rejouée
  });

  /**
   * #402 — le filtre `allFoes` doit lire la CAPABILITY `undead` (portée par le TRAIT Mort-vivant),
   * PAS le Groupe bestiaire (déclaré par l'entrée, `CreatureData.grantGroups`).
   * Contre-preuve du juge de réfutation : une créature du Groupe « mort-vivant » SANS le
   * Trait (ex. RAW Goule de crypte, `creatures.json`) reste une cible VALIDE du Hurlement fantomatique
   * (LDB 85 l.170 : « créatures vivantes (ne possédant pas le trait Mort-vivant) »).
   */
  it('cible une créature de Groupe « mort-vivant » (Groupe déclaré seul, sans le Trait) — exclut le PORTEUR du Trait', () => {
    seedBattleRng(5);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.dead = true; H.pos = undefined; // hors-cible : on isole le cas sur les 2 synthétiques ci-dessous
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const banshee = enemies[0];
    banshee.traits = [...(banshee.traits ?? []), { id: 'hurlement-fantomatique', value: 0 }];
    banshee.pos = { x: 10, y: 10 };
    banshee.advantage = 3;
    // Goule-de-crypte-like : folder « Les morts sans repos » → Groupe dérivé, mais AUCUN Trait Mort-vivant.
    const goule = enemies[1];
    goule.kind = 'hero'; goule.aiControlled = true; goule.dead = false;
    goule.traits = []; goule.groups = ['mort-vivant']; goule.pos = { x: 9, y: 10 };
    goule.wounds = { current: 15, max: 15 };
    // Vrai Mort-vivant : PORTE le Trait (capability `undead`) → doit rester EXCLU.
    const trueUndead = enemies[2];
    trueUndead.kind = 'hero'; trueUndead.aiControlled = true; trueUndead.dead = false;
    trueUndead.traits = [{ id: 'mort-vivant' }]; trueUndead.groups = ['mort-vivant']; trueUndead.pos = { x: 11, y: 10 };
    trueUndead.wounds = { current: 15, max: 15 };
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    applyWail(useGame.getState, useGame.setState, banshee);

    const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(live(goule.id).wounds.current).toBeLessThan(15); // folder-only → CIBLÉE (RAW : « ne possédant pas le trait »)
    expect(live(trueUndead.id).wounds.current).toBe(15); // Trait Mort-vivant porté → EXCLUE
  });

  /**
   * #1231 — « Toutes les créatures vivantes (ne possédant pas le trait Mort-vivant) » (LDB 85 l.170) :
   * le Hurlement fantomatique ne connaît AUCUN camp (`targeting:'allAround'`). Un allié de la banshee,
   * vivant et à portée, le prend comme les autres ; elle-même jamais.
   */
  it('un ALLIÉ vivant de la banshee, à portée, subit le hurlement (aucun camp) — l’émettrice non', () => {
    seedBattleRng(5);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.dead = true; H.pos = undefined; // hors-cible : on isole le cas sur la paire d'ennemis ci-dessous
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const banshee = enemies[0];
    banshee.traits = [...(banshee.traits ?? []), { id: 'hurlement-fantomatique', value: 0 }];
    banshee.pos = { x: 10, y: 10 };
    banshee.advantage = 3;
    banshee.wounds = { current: 15, max: 15 };
    const allie = enemies[1]; // MÊME camp que la banshee, vivant, sans Trait Mort-vivant
    allie.traits = []; allie.groups = []; allie.pos = { x: 9, y: 10 };
    allie.wounds = { current: 15, max: 15 };
    // « créatures VIVANTES » : un chariot (véhicule-coque) n'entend rien et n'est jamais « attaqué ».
    const chariot = enemies[2];
    chariot.traits = []; chariot.groups = []; chariot.pos = { x: 11, y: 10 };
    chariot.dead = false; chariot.bodyShape = 'vehicule'; chariot.wounds = { current: 15, max: 15 };
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    applyWail(useGame.getState, useGame.setState, banshee);

    const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(live(allie.id).wounds.current).toBeLessThan(15);
    expect(live(banshee.id).wounds.current).toBe(15);
    expect(live(chariot.id).wounds.current).toBe(15); // INANIMÉ : hors population
    expect(live(banshee.id).attackedThisRound ?? []).not.toContain(chariot.id); // ni marqué attaqué
    expect(live(banshee.id).attackedThisRound).toContain(allie.id); // la créature, elle, l'est
  });
});
