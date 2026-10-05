import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { tenuParUnHumain } from './netOwnership';
import { applyAttackResult, resolveDeviation } from './combatFlow';
import { seedBattleRng, battleRng } from './battleRng';
import { resetRule } from '../engine/policy';
import { deviatableArmourAt } from '../engine/items';
import { nonDeviatableMutationAP } from '../engine/corruption';
import { mutationById } from '../data/mutations';
import type { Combatant, Weapon, ItemInstance } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { emptyScene } from './scene';
import { draineCascade } from './cascadeTestKit';
import { stepInteraction } from './cascade';
import { objetDeTest } from '../engine/objetDeTest.testkit';

// « Écailles épineuses » (EDO App.2 l.196 : « Ce PA ne peut pas être utilisé pour la Déviation Critique »)
// — la DONNÉE réelle de mutations.json, pour que ce test casse si le drapeau `noDeviation` disparaît.
const ecailles = mutationById('ecailles-epineuses')!;

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h1', name: 'Hardi', kind: 'hero', characteristics: CHARS,
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

const enemy = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'e1', name: 'Brute', kind: 'enemy', characteristics: CHARS,
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 1, y: 0 }, size: 'moyenne',
    weapons: [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as Weapon], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): BattleState {
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  // Siège MJ REMIS À ZÉRO à chaque mise en place : la TENUE décide qui tranche la Déviation (#1426), un
  // test qui pose `gmSeat` ne doit pas la léguer au suivant.
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  return battle;
}

const critWeapon: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
// `critLocation: 'corps'` FIGE la localisation re-tirée du Coup Critique (LDB 18 l.55, #80) sur la zone
// armurée du fixture → la Déviation (#43.2) y sacrifie le PA de façon déterministe.
const critRes = (): AttackResult => ({
  hit: true, attackerRoll: 12, netSL: 4, location: 'corps', critLocation: 'corps', damage: 8, woundsLost: 3,
  critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
});

// Une pièce d'armure PORTÉE (héros) — `wornArmourPoints` la lit (equipped + kind:'armor' + pa + locs).
const wornPiece = (pa: number): ItemInstance =>
  objetDeTest({ uid: 'arm1', trappingId: 'plastron', kind: 'armor', equipped: true, pa, locs: ['corps'], qualities: [] });

// ── PA déviatable (LDB 63 l.30) : pur, sans flux ──────────────────────────────
describe('deviatableArmourAt / nonDeviatableMutationAP — PA sacrifiable (LDB 63 l.30 + EDO App.2 l.196)', () => {
  it('Écailles épineuses (EDO App.2 l.196) : son PA est marqué hors-Déviation', () => {
    const c = hero({ mutations: [ecailles] });
    expect(nonDeviatableMutationAP(c, 'corps')).toBe(1);
  });

  it('sans mutation : aucun PA hors-Déviation', () => {
    expect(nonDeviatableMutationAP(hero({}), 'corps')).toBe(0);
  });

  it('armure portée seule → PA entièrement déviatable', () => {
    const c = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    expect(deviatableArmourAt(c, 'corps')).toBe(3);
  });

  it('Trait créature Armure (PA de statbloc, LDB 85) → reste DÉVIATABLE (non barré)', () => {
    // PA de profil créature, sans pièce portée ni mutation marquée : aucune exclusion (LDB 85 l.37-39).
    const c = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    expect(nonDeviatableMutationAP(c, 'corps')).toBe(0);
    expect(deviatableArmourAt(c, 'corps')).toBe(3);
  });

  it('Écailles seule (PA = 1, noDeviation) → PA déviatable NUL (EDO App.2 l.196)', () => {
    const c = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 1, jambeG: 0, jambeD: 0 }, mutations: [ecailles] });
    expect(deviatableArmourAt(c, 'corps')).toBe(0);
  });

  it('armure portée (3) + Écailles (1) → seul le PA porté (3) est déviatable', () => {
    const c = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 }, mutations: [ecailles] });
    expect(deviatableArmourAt(c, 'corps')).toBe(3);
  });
});

// ── Flux de Déviation Critique (intégration légère) ───────────────────────────
/** Dés consommés au flux de bataille pendant `acte` — la grandeur qui dit si un tirage a été fait
 *  puis JETÉ. Le générateur est scellé : on compte ses tirages. */
function comptesDes(acte: () => void): number {
  const rng = battleRng();
  const brut = rng.int.bind(rng);
  let n = 0;
  (rng as { int: typeof brut }).int = (a: number, b: number) => { n++; return brut(a, b); };
  try { acte(); } finally { (rng as { int: typeof brut }).int = brut; }
  return n;
}

/** LANCE le d100 de sévérité DANS la fenêtre ouverte, comme le joueur : l'étape unique se présente en
 *  `'table'` tant que le dé n'est pas tombé, puis en `'choix'` (Dévier/Subir) sur la MÊME étape. Rend
 *  l'étape RELUE — c'est le PLI post-dé qui y pose le Critique. */
function tireLaSeverite() {
  const avant = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
  expect(avant, 'une seule étape porte le tirage ET la décision').toHaveLength(1);
  expect(stepInteraction(avant[0])).toBe('table');
  useGame.getState().cascadeTableRoll(avant[0].id);
  const apres = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!;
  expect(stepInteraction(apres), 'le dé tombé, la MÊME étape offre ses voies').toBe('choix');
  expect(apres.deviation?.crit, 'le pli post-dé n’a pas posé le Critique').toBeTruthy();
  return apres;
}

describe('Déviation Critique — flux (LDB 63 l.30-32 + EDO App.2 l.196)', () => {
  beforeEach(() => { seedBattleRng(424242); });
  afterEach(() => resetRule('combat-critical-deflect'));

  it('héros SANS armure à la localisation → l’étape ne porte QUE le tirage de sévérité (aucune voie), et le Critique est subi', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    // La sévérité se tire DANS la fenêtre pour TOUT porteur — la déviation, elle, n'a rien à sacrifier :
    // l'étape existe, sans voies. Une étape et une seule (jamais une 2ᵉ fenêtre pour le même coup).
    expect(suspended).toBe(true);
    const etapes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(etapes).toHaveLength(1);
    expect(etapes[0].table, 'la table de sévérité n’est pas déclarée sur l’étape').toBeTruthy();
    expect(etapes[0].options, 'rien à sacrifier → aucune voie de Déviation').toBeUndefined();
    expect(stepInteraction(etapes[0])).toBe('table');
    draineCascade(useGame.getState);
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.criticalWounds ?? 0).toBe(1); // Critique subi
  });

  it('ATTAQUE STANDARD (aucune option) → la fenêtre offre ses voies ; SOUS-ATTAQUE → aucune fenêtre de Déviation', () => {
    const mont = () => {
      seedBattleRng(424242);
      const e = enemy({});
      const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, items: [wornPiece(3)], criticalWounds: 0 });
      setBattle([e, h]);
      return { e, h };
    };
    const voies = () => (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');
    const std = mont();
    expect(applyAttackResult(useGame.getState, useGame.setState, std.e, std.h, critWeapon, critRes()), 'standard : suspendu').toBe(true);
    expect(tireLaSeverite().options?.map((o) => o.key), 'standard : Dévier / Subir offerts').toEqual(['devier', 'subir']);

    useGame.setState({ pendingCascade: null });
    const sous = mont();
    applyAttackResult(useGame.getState, useGame.setState, sous.e, sous.h, critWeapon, critRes(), { sousAttaque: true });
    expect(voies(), 'sous-attaque : pas de fenêtre de Déviation imbriquée').toEqual([]);
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.items!.find((i) => i.uid === 'arm1')!.damageTaken ?? 0, 'la pièce n’est pas sacrifiée').toBe(0);
  });

  it('héros avec une PIÈCE portée → Déviation offerte ; sur « Dévier », la pièce perd 1 PA, Critique ignoré', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, items: [wornPiece(3)], criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    expect(suspended).toBe(true);
    resolveDeviation(useGame.getState, useGame.setState, tireLaSeverite().deviation!, true); // « Dévier »
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.items!.find((i) => i.uid === 'arm1')!.damageTaken).toBe(1); // pièce endommagée (−1 PA)
    expect(hh.armour.corps).toBe(2);                                       // PA re-dérivée
    expect(hh.criticalWounds ?? 0).toBe(0);                               // Critique ignoré
  });

  it('porteur blindé qu’AUCUN siège humain ne tient (solo sans MJ) → l’AUTOMATE dévie, aucune étape, AUCUN dé gaspillé', () => {
    const h = hero({});
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([h, e]);
    expect(tenuParUnHumain(useGame.getState(), 'e1'), 'sans siège MJ, personne ne tient cet ennemi').toBe(false);
    // Sa décision se prend AVANT toute poussée d'étape : un dé tiré ici serait tiré puis JETÉ
    // (`applyCritAndFinalize` est sauté quand la déviation a eu lieu).
    const des = comptesDes(() => applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes()));
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps).toBe(2);        // l'automate dévie : −1 PA de statbloc
    expect(ee.criticalWounds ?? 0).toBe(0); // Critique ignoré
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'deviation') ?? false,
      'aucune étape de Blessure critique : l’automate a tranché avant').toBe(false);
    expect(des, 'un dé de sévérité a été consommé pour rien').toBe(0);
  });

  it('MÊME ennemi blindé, TENU par un siège MJ → l’étape Dévier/Subir s’ouvre comme pour un héros (LDB 63 l.30)', () => {
    const h = hero({});
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([h, e]);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    expect(tenuParUnHumain(useGame.getState(), 'e1'), 'un siège MJ tient les ennemis').toBe(true);
    // La décision appartient à la VICTIME : le MJ la tient, donc c'est LUI qui tranche — pas l'automate.
    const suspended = applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes());
    expect(suspended, 'la fenêtre doit s’ouvrir pour le porteur tenu').toBe(true);
    const etapes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(etapes, 'une seule fenêtre pour la Blessure critique').toHaveLength(1);
    expect(etapes[0].options?.map((o) => o.key), 'les voies Dévier/Subir doivent être offertes').toEqual(['devier', 'subir']);
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps, 'aucun PA sacrifié avant la décision du MJ').toBe(3);
    expect(ee.criticalWounds ?? 0).toBe(0);
  });

  it('ennemi TENU par le MJ qui choisit « Subir » → le Critique s’applique, le PA reste intact (l’automate ne décide plus à sa place)', () => {
    const h = hero({});
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([h, e]);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes());
    resolveDeviation(useGame.getState, useGame.setState, tireLaSeverite().deviation!, false); // « Subir »
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps, 'aucun PA sacrifié : le MJ a refusé la Déviation').toBe(3);
    expect(ee.criticalWounds ?? 0, 'le Critique refusé doit s’appliquer').toBe(1);
  });

  it('PA uniquement issu d’Écailles (noDeviation) → PAS de Déviation, le Critique s’applique (EDO App.2 l.196)', () => {
    const h = hero({});
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 1, jambeG: 0, jambeD: 0 }, mutations: [ecailles], criticalWounds: 0 });
    setBattle([h, e]);
    applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes());
    // Aucun siège humain ne tient l'ennemi : le socle résout sa table D'OFFICE au rang du curseur et
    // l'étape se franchit (`cascade.poserLeCurseur`) — même code que pour un porteur tenu.
    draineCascade(useGame.getState);
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps).toBe(1);        // PA d'Écailles INTACT (non sacrifiable)
    expect(ee.criticalWounds ?? 0).toBe(1); // Critique subi
  });

  it('héros : armure portée + Écailles → « Dévier » sacrifie la PIÈCE, le PA d’Écailles reste intact', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 }, items: [wornPiece(3)], mutations: [ecailles], criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    expect(suspended).toBe(true);
    resolveDeviation(useGame.getState, useGame.setState, tireLaSeverite().deviation!, true);
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.items!.find((i) => i.uid === 'arm1')!.damageTaken).toBe(1); // pièce portée endommagée
    expect(hh.armour.corps).toBe(3);                                      // (3−1) porté + 1 Écailles
    expect(hh.criticalWounds ?? 0).toBe(0);
  });
});
