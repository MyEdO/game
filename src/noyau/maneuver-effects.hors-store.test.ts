/**
 * Effets onHit AUTHORÉS des MANŒUVRES (`src/data/maneuvers.json` `effects`, donnée éditable), appliqués
 * SCOPED à la manœuvre (via `maneuverEffectsOf` + `applyTriggeredEffects`), chacun sous sa propre
 * Condition. LDB 85 l.47 ; LDB 85 l.405 ; LDB 85 l.213
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { applyFreeAttackEffects, applyWail } from './combatFlow';
import { applyTriggeredEffects, maneuverEffectsOf } from './triggeredEffects';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';

import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const mk = (over: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'c', label: 'C', kind: 'ennemi',
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
  wounds: blessuresDeBase(15), advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
}) as Combatant);

const get = (() => ({ ecrireAuJournal: () => {}, battle: undefined })) as never;
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

  // LDB 85 l.47
  it('Attaque caudale : touche sans Blessure perdue (woundsLost 0) sur une cible plus petite → PAS d’À Terre', () => {
    const dragon = mk({ traits: [{ id: 'attaque-caudale', value: 9 }], size: 'enorme' });
    const prey = mk({ size: 'petite' });
    applyFreeAttackEffects(get, dragon, prey, 'caudale', { hit: true, woundsLost: 0 } as AttackResult);
    expect(aTerre(prey)).toBeUndefined();
  });

  // LDB 85 l.405 ; lecture : `docs/raw/4e/combat.md` § Tentacules (#3075)
  it('Tentacules : touche sans Blessure perdue (woundsLost 0) → PAS d’Empêtré', () => {
    const kraken = mk({ id: 'k', traits: [{ id: 'tentacules', value: 6 }] });
    const foe = mk({ id: 'f' });
    applyFreeAttackEffects(get, kraken, foe, 'tentacules', { hit: true, woundsLost: 0 } as AttackResult);
    expect(empetre(foe)).toBeUndefined();
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
 * Hurlement fantomatique porte un nœud Flow `test` enfoui dans son Flow
 * `seq[ do(1d10) , test{Résistance → Brisé} , do(3 Assourdi) ]`. Routé par les actions du noyau (un `test` non routé
 * LÈVE). La manœuvre cible `adversairesAutour` → un banshee ENNEMI hurle sur le HÉROS : héros MANUEL → le Test
 * suspend en ÉTAPE de cascade `testDeclenche` INFLUENÇABLE (avec `meta.after` = le `do(3 Assourdi)`) ; le
 * `do(1d10)` AVANT s'applique tout de suite ; après `jetLancer('cascade', id)`+`jetValider('cascade')`, la branche PUIS la
 * continuation `after` (3 Assourdi) s'appliquent — preuve que l'ordre du Flow `seq` est préservé.
 */
describe('Hurlement fantomatique — Test de trigger enfoui routé (cadence-aware)', () => {
  it('banshee ENNEMIE hurle sur le HÉROS → étape testDeclenche (after = 3 Assourdi), rejouée à la résolution', () => {
    seedBattleRng(5);
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.characteristics.endurance = 90; H.wounds = blessuresDeBase(100, 100, H); // Résistance réussie (pas de Brisé)
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const banshee = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    banshee.traits = [...(banshee.traits ?? []), { id: 'hurlement-fantomatique', value: 0 }];
    banshee.pos = { x: 10, y: 10 };
    H.pos = { x: 11, y: 10 };
    banshee.advantage = 3;
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    applyWail(banc.getState, banc.setState, banshee);

    // Le `do(1d10)` AVANT le test s'est appliqué tout de suite ; le test a suspendu en étape de cascade.
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();        // pas encore lancé → influençable
    expect(step.meta?.after).toBeTruthy();  // la continuation (3 Assourdi) voyage dans le meta (sérialisable)
    expect(banc.getState().pendingLogQueue.some((q) => /Blessure/.test(q.line))).toBe(true); // 1d10 déjà subi

    banc.getState().jetLancer('cascade', step.id);
    banc.getState().jetValider('cascade');

    const live = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(live.conditions.find((c) => c.id === 'assourdi')?.value).toBe(3); // continuation `after` rejouée
  });

  /**
   * #402 — le filtre `adversairesAutour` doit lire la CAPABILITY `undead` (portée par le TRAIT Mort-vivant),
   * PAS le Groupe bestiaire (déclaré par l'entrée, `CreatureData.grantGroups`).
   * Contre-preuve du juge de réfutation : une créature du Groupe « mort-vivant » SANS le
   * Trait (ex. RAW Goule de crypte, `creatures.json`) reste une cible VALIDE du Hurlement fantomatique
   * (LDB 85 l.170 : « créatures vivantes (ne possédant pas le trait Mort-vivant) »).
   */
  it('cible une créature de Groupe « mort-vivant » (Groupe déclaré seul, sans le Trait) — exclut le PORTEUR du Trait', () => {
    seedBattleRng(5);
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.dead = true; H.pos = undefined; // hors-cible : on isole le cas sur les 2 synthétiques ci-dessous
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const banshee = enemies[0];
    banshee.traits = [...(banshee.traits ?? []), { id: 'hurlement-fantomatique', value: 0 }];
    banshee.pos = { x: 10, y: 10 };
    banshee.advantage = 3;
    // Goule-de-crypte-like : folder « Les morts sans repos » → Groupe dérivé, mais AUCUN Trait Mort-vivant.
    const goule = enemies[1];
    goule.kind = 'heros'; goule.aiControlled = true; goule.dead = false;
    goule.traits = []; goule.groups = ['mort-vivant']; goule.pos = { x: 9, y: 10 };
    goule.wounds = blessuresDeBase(15, 15, goule);
    // Vrai Mort-vivant : PORTE le Trait (capability `undead`) → doit rester EXCLU.
    const trueUndead = enemies[2];
    trueUndead.kind = 'heros'; trueUndead.aiControlled = true; trueUndead.dead = false;
    trueUndead.traits = [{ id: 'mort-vivant' }]; trueUndead.groups = ['mort-vivant']; trueUndead.pos = { x: 11, y: 10 };
    trueUndead.wounds = blessuresDeBase(15);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    applyWail(banc.getState, banc.setState, banshee);

    const live = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(live(goule.id).wounds.current).toBeLessThan(15); // folder-only → CIBLÉE (RAW : « ne possédant pas le trait »)
    expect(live(trueUndead.id).wounds.current).toBe(15); // Trait Mort-vivant porté → EXCLUE
  });

  /**
   * #1231 — « Toutes les créatures vivantes (ne possédant pas le trait Mort-vivant) » (LDB 85 l.170) :
   * le Hurlement fantomatique ne connaît AUCUN camp (`ciblage:'toutAutour'`). Un allié de la banshee,
   * vivant et à portée, le prend comme les autres ; elle-même jamais.
   */
  it('un ALLIÉ vivant de la banshee, à portée, subit le hurlement (aucun camp) — l’émettrice non', () => {
    seedBattleRng(5);
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.dead = true; H.pos = undefined; // hors-cible : on isole le cas sur la paire d'ennemis ci-dessous
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const banshee = enemies[0];
    banshee.traits = [...(banshee.traits ?? []), { id: 'hurlement-fantomatique', value: 0 }];
    banshee.pos = { x: 10, y: 10 };
    banshee.advantage = 3;
    banshee.wounds = blessuresDeBase(15, 15, banshee);
    const allie = enemies[1]; // MÊME camp que la banshee, vivant, sans Trait Mort-vivant
    allie.traits = []; allie.groups = []; allie.pos = { x: 9, y: 10 };
    allie.wounds = blessuresDeBase(15, 15, allie);
    // « créatures VIVANTES » : un chariot (véhicule-coque) n'entend rien et n'est jamais « attaqué ».
    const chariot = enemies[2];
    chariot.traits = []; chariot.groups = []; chariot.pos = { x: 11, y: 10 };
    chariot.dead = false; chariot.bodyShape = 'vehicule'; chariot.wounds = blessuresDeBase(15);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    applyWail(banc.getState, banc.setState, banshee);

    const live = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(live(allie.id).wounds.current).toBeLessThan(15);
    expect(live(banshee.id).wounds.current).toBe(15);
    expect(live(chariot.id).wounds.current).toBe(15); // INANIMÉ : hors population
    expect(live(banshee.id).attackedThisRound ?? []).not.toContain(chariot.id); // ni marqué attaqué
    expect(live(banshee.id).attackedThisRound).toContain(allie.id); // la créature, elle, l'est
  });
});
