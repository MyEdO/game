/**
 * Immunité (Type) : « Tous les Dégâts de ce *Type*, y compris les Dégâts Critiques, sont ignorés. » — LDB 85
 * l.174. Le Type se lit à la source : Type de Souffle (porte `has … what:'immunity'`), `typeDeDegats` d'un
 * État (`degatsDeLEtatIgnores`). Immunité (Magie flamboyante) : Domaine du Feu, `immuneToSpellDomain`, lu
 * aussi par les zones persistantes (`zoneSansEffetSur`). ZI 08 l.28 ; VDM 10 l.153 ; VDM 13 l.24.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runCombatHooks, type CombatHookCtx } from './combatHooks';
import { applyCast } from './combatFlow';
import { applyZoneCrossings } from './combatPlacement';
import { crossZones, zonesRoundTick, type BattleZone } from './monde/zones';
import type { Pt } from './monde/path';
import { draineEtLit } from './cascade.testkit';
import { ev } from './combatLog';
import { creatureToCombatant } from './monde/spawn';
import { createHero } from '../engine/character';
import { addCondition, hasCondition, COND } from '../engine/conditions';
import { findCreatureById, findSpellById } from '../data';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { spellOps } from '../engine/flowCore';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Les Immunités que la créature `id` porte une fois apparue (`creatureToCombatant`). */
const immunitesDe = (id: string) => creatureToCombatant(findCreatureById(id)!, id, { x: 0, y: 0 }).traits!.filter((t) => t.id === 'immunite');

function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 11, y: 10 };
  E.wounds = blessuresDeBase(40, 40, E);
  E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
  E.characteristics.agilite = 1;
  E.skills = E.skills.filter((s) => s.id !== 'esquive');
  const turn = b.order.indexOf(H.id);
  banc.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
  return { H, E };
}

const vivant = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;

/** Le héros souffle sur `E` comme à la hotbar : arme l'attaque, clique, lance, applique. */
function souffler(H: Combatant, E: Combatant, type: string) {
  H.traits = [{ id: 'souffle', value: 10, arg: type }];
  H.characteristics['capacite-de-tir'] = 90;
  H.advantage = 3;
  banc.getState().armerLAttaque('souffle');
  cliquerSurLeCombattant(banc.getState, E.id);
  banc.getState().jetLancer('manoeuvre');
  banc.getState().jetValider('manoeuvre');
}

function finDeRound() {
  const battle = banc.getState().battle!;
  const sink = (line: string, c?: Combatant) => battle.log.push(ev('information', line, c?.id));
  const ctx: CombatHookCtx = { get: banc.getState, set: banc.setState, battle, sink };
  runCombatHooks('onRoundEnd', ctx);
}

const lance: CastResult = { cast: true, roll: 21, target: 70, sl: 2, isCritical: false, isFumble: false, log: 'lancé' };

/** Le Projectile `spell` par le chemin du jeu (`applyCast` en Projectile), ses étapes de dé jouées. */
function projeter(H: Combatant, E: Combatant, spell: NonNullable<ReturnType<typeof findSpellById>>): string[] {
  applyCast(banc.getState, banc.setState, H, E, spell, evaluateMissile(H, E, spell, lance), true, false);
  return draineEtLit(banc.getState);
}

describe('Immunité (Type) — Dégâts typés ignorés (LDB 85 l.174)', () => {
  it('Souffle (Poison) sur le basilic, Immunité (Poison) : ni Dégâts ni Empoisonné', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    E.traits = immunitesDe('basilic');
    const avant = E.wounds.current;
    souffler(H, E, 'poison');
    expect(vivant(E.id).wounds.current).toBe(avant);
    expect(hasCondition(vivant(E.id), COND.empoisonne)).toBe(false);
  });

  it('Souffle (Poison) sur Caledair, Immunité (Feu) : Dégâts et Empoisonné', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    E.traits = immunitesDe('caledair-la-faux-de-feu');
    const avant = E.wounds.current;
    souffler(H, E, 'poison');
    expect(vivant(E.id).wounds.current).toBeLessThan(avant);
    expect(hasCondition(vivant(E.id), COND.empoisonne)).toBe(true);
  });

  it('En flammes sur Caledair, Immunité (Feu) : aucune Blessure en fin de Round (VDM 10 l.153)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { E } = setup();
    E.traits = immunitesDe('caledair-la-faux-de-feu');
    addCondition(E, 'en-flammes', 2);
    const avant = E.wounds.current;
    finDeRound();
    expect(vivant(E.id).wounds.current).toBe(avant);
  });

  it('En flammes sans Immunité (Feu) : les Blessures de fin de Round tombent', () => {
    banc.getState().ensemencerLeTirage(2);
    const { E } = setup();
    E.traits = immunitesDe('basilic');
    addCondition(E, 'en-flammes', 2);
    const avant = E.wounds.current;
    finDeRound();
    expect(vivant(E.id).wounds.current).toBeLessThan(avant);
  });
});

describe('Immunité (Magie flamboyante) — Domaine du Feu (ZI 08 l.28)', () => {
  const projectileDuFeu = findSpellById('tete-enflammee')!;

  it('le Projectile du Domaine du Feu n’inflige rien au grand taurus', () => {
    const { H, E } = setup();
    E.traits = immunitesDe('grand-taurus');
    const avant = E.wounds.current;
    projeter(H, E, projectileDuFeu);
    expect(vivant(E.id).wounds.current).toBe(avant);
    expect(hasCondition(vivant(E.id), COND.enFlammes)).toBe(false);
  });

  it('Immunité (Feu) seule ne couvre pas le Domaine du Feu : Caledair subit le Projectile', () => {
    const { H, E } = setup();
    E.traits = immunitesDe('caledair-la-faux-de-feu');
    const avant = E.wounds.current;
    projeter(H, E, projectileDuFeu);
    expect(vivant(E.id).wounds.current).toBeLessThan(avant);
  });
});

/** La zone que pose le Sort `spellId` (son op `zone`, lanceur, copiée comme `placeZoneFromOp`), sur `tiles`,
 *  sourcée comme `placeSpellZone` la source. */
function zoneDuSort(spellId: string, tiles: Pt[]): BattleZone {
  const s = findSpellById(spellId)!;
  const op = structuredClone(spellOps(s.effects, 'caster').find((o) => o.op === 'zone')); // #2097
  if (op?.op !== 'zone') throw new Error(`${spellId} : pas d'op zone`);
  return { label: s.label, tiles, rounds: 3, onCross: op.onCross, perRound: op.perRound, source: { kind: 'sort', id: s.id } };
}

/** La créature `id` apparue sur `pos`. */
const creature = (id: string, pos: Pt): Combatant => creatureToCombatant(findCreatureById(id)!, id, pos);

describe('Immunité (Magie flamboyante) — zones persistantes du Domaine du Feu (ZI 08 l.28)', () => {
  const lanceur = () => { const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'L', seed: 1 }); h.characteristics['force-mentale'] = 90; return h; };

  it('Mur de feu traversé : le grand taurus ne subit rien, le basilic brûle', () => {
    const mur = [zoneDuSort('mur-de-feu', [{ x: 1, y: 0 }])];
    const taurus = creature('grand-taurus', { x: 0, y: 0 });
    const basilic = creature('basilic', { x: 0, y: 0 });
    const avant = { taurus: taurus.wounds.current, basilic: basilic.wounds.current };
    crossZones(mur, taurus, [{ x: 1, y: 0 }], lanceur, makeRNG(1), idsDeTest);
    crossZones(mur, basilic, [{ x: 1, y: 0 }], lanceur, makeRNG(1), idsDeTest);
    expect(taurus.wounds.current).toBe(avant.taurus);
    expect(hasCondition(taurus, COND.enFlammes)).toBe(false);
    expect(basilic.wounds.current).toBeLessThan(avant.basilic);
    expect(hasCondition(basilic, COND.enFlammes)).toBe(true);
  });

  it('Grands feux d’U’Zhul, occupants au Round : le grand taurus ne subit rien, le basilic brûle', () => {
    const feux = [zoneDuSort('grands-feux-d-u-zhul', [{ x: 1, y: 0 }, { x: 2, y: 0 }])];
    const taurus = creature('grand-taurus', { x: 1, y: 0 });
    const basilic = creature('basilic', { x: 2, y: 0 });
    const avant = { taurus: taurus.wounds.current, basilic: basilic.wounds.current };
    const lignes = zonesRoundTick(feux, [taurus, basilic], makeRNG(1), idsDeTest);
    expect(lignes.filter((l) => l.combatant === taurus)).toEqual([]);
    expect(taurus.wounds.current).toBe(avant.taurus);
    expect(hasCondition(taurus, COND.enFlammes)).toBe(false);
    expect(basilic.wounds.current).toBeLessThan(avant.basilic);
    expect(hasCondition(basilic, COND.enFlammes)).toBe(true);
  });

  it('zone à Test de traversée posée par un Sort du Feu : le grand taurus ne la teste pas et ne subit rien', () => {
    const { E } = setup();
    E.traits = immunitesDe('grand-taurus');
    const case_ = { x: 12, y: 10 };
    banc.getState().battle!.zones = [{ ...zoneDuSort('mur-de-feu', [case_]), crossTest: { characteristic: 'agilite', difficulty: 'difficile', label: 'Mur de feu' } }];
    const avant = E.wounds.current;
    applyZoneCrossings(banc.getState, banc.setState, vivant(E.id), [case_]);
    draineEtLit(banc.getState);
    expect(vivant(E.id).wounds.current).toBe(avant);
    expect(hasCondition(vivant(E.id), COND.enFlammes)).toBe(false);
  });

  it('témoin du Test de traversée : sans l’Immunité, l’échec au Test applique la traversée', () => {
    const { E } = setup();
    E.traits = immunitesDe('basilic');
    const case_ = { x: 12, y: 10 };
    banc.getState().battle!.zones = [{ ...zoneDuSort('mur-de-feu', [case_]), crossTest: { characteristic: 'agilite', difficulty: 'difficile', label: 'Mur de feu' } }];
    applyZoneCrossings(banc.getState, banc.setState, vivant(E.id), [case_]);
    draineEtLit(banc.getState);
    expect(hasCondition(vivant(E.id), COND.enFlammes)).toBe(true);
  });
});
