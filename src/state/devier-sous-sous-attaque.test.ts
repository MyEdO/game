import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { battleRng, seedBattleRng } from '../noyau/battleRng';
import { applyHullCriticalToTarget, jouerLesTirsDeBordee } from './combatFlow';
import { draineCascade } from './cascadeTestKit';
import { spawnEnemy } from './spawn';
import { emptyScene } from '../noyau/monde/scene';
import { toucheAuJetPose, type AttackResult, type RollBreakdown } from '../engine/combat';
import { damageArmour } from '../engine/items';
import { addCondition, hasCondition, COND } from '../engine/conditions';
import type { Combatant, Weapon, ItemInstance, HitLocation } from '../engine/types';
import type { CoupDeTouche } from '../noyau/pendings';
import { evaluateMissile } from '../engine/magic';
import { findSpell } from '../data';
import { makeRNG } from '../engine/dice';

/**
 * Un porteur TENU est consulté quand le Critique naît d'une sous-attaque (LDB 63 l.30) ; Surpris est
 * conservé (LDB 16 l.139). Producteur témoin : la bordée (MDG 14 l.128). Le marin d'un Critique de
 * coque à l'Équipage (MDG 13 l.584) suspend et reprend son seul coup.
 */
const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const SANS_PA = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
const PA3 = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 };
const mk = (kind: Combatant['kind'], id: string, p: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, label: id, kind, important: true, characteristics: { ...CHARS },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 0, activeEffects: [], liveTraits: [],
    armour: { ...SANS_PA }, ...p,
  } as unknown as Combatant);
/** Une pièce PORTÉE sur toutes les Localisations — la Déviation d'un héros la sacrifie (LDB 63 l.30). */
const piece = (): ItemInstance =>
  ({ uid: 'arm1', name: 'Maille', kind: 'armor', equipped: true, pa: 3, locs: ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'], qualities: [] } as unknown as ItemInstance);

function poser(combatants: Combatant[], gmSeat?: number): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: emptyScene(20, 20), party: combatants.filter((c) => c.kind === 'hero'), facing: {}, vessel: null,
    journal: [], pendingCascade: null, suspendedCascades: [], pendingFateSave: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat },
  } as never);
}
const enJeu = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
const etapes = () => (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');
const choix = (cle: 'devier' | 'subir') => () => cle;

// ── Bordée (MDG 14 l.128) ────────────────────────────────────────────────────────────────────────
const canon: Weapon = { label: 'Canon', type: 'ranged', damage: { plusBF: false, flat: 8 }, qualities: [] } as unknown as Weapon;
const jetDeBordee = (roll: number, sl: number): RollBreakdown => ({ label: 'Tir de batterie', base: 0, modifier: 0, target: 0, roll, success: true, sl });
/** Double réussi : Coup Critique (LDB 13 l.183). */
const coupCritique = (): RollBreakdown => jetDeBordee(55, 4);
const coupSimple = (): RollBreakdown => jetDeBordee(74, 2);
const totalPA = (c: Combatant): number => Object.values(c.armour).reduce((n, pa) => n + (pa ?? 0), 0);
/** Une bordée sur `cible` : un tir par jet. */
const bordee = (cible: Combatant, tirs: RollBreakdown[], gmSeat?: number): boolean => {
  seedBattleRng(424242);
  poser([mk('hero', 'tireur', { pos: { x: 5, y: 0 } }), cible], gmSeat);
  return jouerLesTirsDeBordee(useGame.getState, useGame.setState, { targetId: cible.id, actedAvant: false, tirs: tirs.map((jet) => ({ tireurId: 'tireur', weapon: canon, jet })) });
};
const brute = (p: Partial<Combatant> = {}): Combatant => mk('enemy', 'brute', { armour: { ...PA3 }, ...p });
/** PB de la brute après une bordée drainée par `cle`. */
const pbApres = (tirs: RollBreakdown[], cle: 'devier' | 'subir'): number => {
  bordee(brute(), tirs, 0);
  draineCascade(useGame.getState, 200, undefined, choix(cle));
  return enJeu('brute').wounds.current;
};

describe('Bordée sur un porteur tenu : la fenêtre de Déviation s’ouvre (LDB 63 l.30)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ennemi sous siège MJ, PA déviable : étape ouverte, rien d’appliqué, le tir 2 attend la décision', () => {
    expect(bordee(brute(), [coupCritique(), coupSimple()], 0), 'la bordée tient la main').toBe(true);
    expect(etapes()).toHaveLength(1);
    const b = enJeu('brute');
    expect(b.wounds.current, 'ni le tir 1 ni le tir 2 n’ont porté avant la décision').toBe(20);
    expect(b.criticalWounds ?? 0).toBe(0);
  });

  it('Dévier : PA −1, aucun Critique, Blessures recomptées, et le tir 2 part une fois', () => {
    const tir2 = 20 - pbApres([coupSimple()], 'subir');
    expect(tir2).toBeGreaterThan(0);
    seedBattleRng(424242);
    const coup = toucheAuJetPose(mk('hero', 'tireur'), brute(), canon, coupCritique(), 4, { rng: battleRng() });
    expect(coup.woundsLost, '8 + DR 4 − BE 4 − PA 3').toBe(5);
    const recompte = coup.woundsLost! + 1;
    const devie = pbApres([coupCritique(), coupSimple()], 'devier');
    const b = enJeu('brute');
    expect(b.armour, 'PA −1 à la Localisation du Critique').toEqual({ ...PA3, [coup.critLocation!]: 2 });
    expect(b.criticalWounds ?? 0, 'Critique ignoré').toBe(0);
    expect(devie, 'Blessures recomptées à PA −1, puis le tir 2 une seule fois').toBe(20 - recompte - tir2);
  });

  it('Subir : Critique appliqué, PA intacts, et le tir 2 part une fois', () => {
    const tir2 = 20 - pbApres([coupSimple()], 'subir');
    const seul = pbApres([coupCritique()], 'subir');
    const deux = pbApres([coupCritique(), coupSimple()], 'subir');
    const b = enJeu('brute');
    expect(b.criticalWounds ?? 0).toBe(1);
    expect(totalPA(b)).toBe(totalPA(brute()));
    expect(deux).toBe(seul - tir2);
  });

  it('Surpris est conservé, après Dévier comme après Subir (LDB 16 l.139)', () => {
    for (const cle of ['devier', 'subir'] as const) {
      const b = brute();
      addCondition(b, COND.surpris);
      bordee(b, [coupCritique()], 0);
      draineCascade(useGame.getState, 200, undefined, choix(cle));
      expect(hasCondition(enJeu('brute'), COND.surpris), cle).toBe(true);
    }
  });

  it('contrôle : PNJ non tenu, non déviable → aucune étape, Critique subi', () => {
    expect(bordee(brute({ armour: { ...SANS_PA } }), [coupCritique()]), 'aucune fenêtre').toBe(false);
    expect(etapes()).toHaveLength(0);
    expect(enJeu('brute').criticalWounds ?? 0).toBe(1);
  });

  it('héros tenu NON déviable : étape de sévérité sans voies, puis la suite joue une fois', () => {
    const cible = (): Combatant => mk('hero', 'h1', { pos: { x: 1, y: 0 } });
    expect(bordee(cible(), [coupSimple()])).toBe(false);
    const tir2 = 20 - enJeu('h1').wounds.current;
    expect(bordee(cible(), [coupCritique()])).toBe(true);
    draineCascade(useGame.getState);
    const seul = enJeu('h1').wounds.current;
    expect(bordee(cible(), [coupCritique(), coupSimple()])).toBe(true);
    const [etape] = etapes();
    expect(etape.table, 'le d100 de sévérité se tire dans l’étape').toBeTruthy();
    expect(etape.options, 'rien à sacrifier → aucune voie').toBeUndefined();
    draineCascade(useGame.getState);
    expect(enJeu('h1').criticalWounds).toBe(1);
    expect(enJeu('h1').wounds.current).toBe(seul - tir2);
  });
});

// ── Marin d'un Critique de coque à l'Équipage (MDG 13 l.584) ────────────────────────────────────
const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
/** CC réussi, DR 2, 44 en double : Coup Critique (LDB 13). */
const jet = { label: 'CC', base: 60, modifier: 0, target: 60, roll: 44, success: true, sl: 2 };
const marinHeros = (pb = 20): Combatant => mk('hero', 'marin', { pos: { x: 6, y: 5 }, armour: { ...PA3 }, items: [piece()], wounds: { current: pb, max: 20 } as Combatant['wounds'] });
const contre = (att: Combatant, marin: Combatant): AttackResult => toucheAuJetPose(att, structuredClone(marin), hache, jet, 2, { rng: makeRNG(1595) }, false);

/** Le Critique de coque à l'Équipage, porté par un coup de hache sur le navire du marin. */
function critiqueDEquipage(marin: Combatant): { att: Combatant; nav: Combatant } {
  const att = mk('enemy', 'att', { pos: { x: 8, y: 5 } });
  const nav = spawnEnemy({ ref: 'cogue' }, 'nav', { x: 9, y: 5 });
  nav.crewIds = [marin.id];
  poser([att, nav, marin]);
  seedBattleRng(1);
  const coup: CoupDeTouche = { mode: 'melee', weapon: hache, res: toucheAuJetPose(att, nav, hache, jet, 2, { rng: makeRNG(1595) }, false) };
  const log: string[] = [];
  applyHullCriticalToTarget(nav, 'voile', log, useGame.setState, {
    get: useGame.getState, forcedLocRoll: 5, suppressReveal: true,
    ctx: { attackerId: att.id, attackerKind: att.kind, weapon: hache.label, coup },
  });
  return { att, nav };
}

describe('Marin tenu d’un Critique d’Équipage : sa fenêtre suspend son seul coup (LDB 63 l.30 ; MDG 13 l.584)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Dévier : PA −1, aucun Critique, Blessures recomptées ; la coque ne prend rien de plus', () => {
    const marin = marinHeros();
    const { att } = critiqueDEquipage(marin);
    const critsCoque = enJeu('nav').criticalWounds ?? 0;
    expect(etapes(), 'la fenêtre du marin est ouverte').toHaveLength(1);
    expect(enJeu('marin').wounds.current, 'rien d’appliqué avant la décision').toBe(20);
    const touche = contre(att, marin);
    const lieu = touche.location as HitLocation;
    const abime = structuredClone(marin);
    damageArmour(abime, lieu);
    const recompte = toucheAuJetPose(att, abime, hache, jet, 2, { rng: makeRNG(1595) }, false).woundsLost ?? 0;
    expect(recompte).toBe((touche.woundsLost ?? 0) + 1);
    expect(draineCascade(useGame.getState, 200, undefined, choix('devier'))).toEqual(['deviation']);
    const m = enJeu('marin');
    expect(m.armour[lieu as keyof typeof m.armour]).toBe(2);
    expect(m.criticalWounds ?? 0).toBe(0);
    expect(m.wounds.current).toBe(20 - recompte);
    expect(enJeu('nav').criticalWounds ?? 0).toBe(critsCoque);
  });

  it('Subir : Critique appliqué au marin, PA intacts ; la coque ne prend rien de plus', () => {
    const marin = marinHeros();
    const { att } = critiqueDEquipage(marin);
    const critsCoque = enJeu('nav').criticalWounds ?? 0;
    draineCascade(useGame.getState, 200, undefined, choix('subir'));
    const m = enJeu('marin');
    expect(m.criticalWounds ?? 0).toBe(1);
    expect(m.critEntriesSuffered).toHaveLength(1);
    expect(useGame.getState().battle!.log.map((l) => l.text)).toContain(`marin subit ${contre(att, marin).woundsLost} Blessure(s).`);
    expect(m.items![0].damageTaken ?? 0).toBe(0);
    expect(enJeu('nav').criticalWounds ?? 0).toBe(critsCoque);
  });

  it('LDB 18 l.17 : double et dépassement → deux étapes successives, deux Déviations', () => {
    const marin = marinHeros(2);
    critiqueDEquipage(marin);
    const critsCoque = enJeu('nav').criticalWounds ?? 0;
    expect(draineCascade(useGame.getState, 200, undefined, choix('devier'))).toEqual(['deviation', 'deviation']);
    const m = enJeu('marin');
    expect(m.criticalWounds ?? 0).toBe(0);
    expect(m.items![0].damageTaken).toBe(2);
    expect(enJeu('nav').criticalWounds ?? 0).toBe(critsCoque);
  });
});

// ── Projectile Coup Critique sur la coque : la Localisation du marin (LDB 18 l.53, l.55 ; MDG 13 l.584) ──
const LIEUX: readonly HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
/** Une pièce par Localisation : la Déviation n'entame que celle du lieu du Critique (LDB 63 l.30). */
const piecesParLieu = (): ItemInstance[] =>
  LIEUX.map((l) => ({ uid: `pa-${l}`, name: 'Maille', kind: 'armor', equipped: true, pa: 3, locs: [l], qualities: [] } as unknown as ItemInstance));
/** Graine du battleRng : le d100 de Localisation relancé contre le marin tombe sur la Jambe droite. */
const SEED_JAMBE_DROITE = 4;

/** Le Critique de coque à l'Équipage, porté par un Projectile magique Coup Critique (LDB 46 l.30) sur la coque. */
function critiqueDEquipageAuProjectile(marin: Combatant): { lieuDeTouche: HitLocation | undefined } {
  const mage = mk('enemy', 'mage', { pos: { x: 8, y: 5 } });
  const nav = spawnEnemy({ ref: 'cogue' }, 'nav', { x: 9, y: 5 });
  nav.crewIds = [marin.id];
  poser([mage, nav, marin]);
  const sort = findSpell('Carreau')!;
  const mres = evaluateMissile(mage, nav, sort, { cast: true, roll: 21, target: 90, sl: 4, isCritical: true, isFumble: false, log: 'jet' });
  seedBattleRng(SEED_JAMBE_DROITE);
  const coup: CoupDeTouche = { mode: 'projectile', touche: { casterId: mage.id, de: mage.id, targetId: nav.id, spell: sort, mres, zoneTalentMod: 0, critWound: true, overcastDamageSteps: 0, overcastDurationSteps: 0 } };
  applyHullCriticalToTarget(nav, 'voile', [], useGame.setState, {
    get: useGame.getState, forcedLocRoll: 5, suppressReveal: true,
    ctx: { attackerId: mage.id, attackerKind: mage.kind, weapon: sort.label, coup },
  });
  return { lieuDeTouche: mres.location };
}

describe('Projectile Coup Critique redirigé sur le marin : sa Localisation relancée, relue au recompte (LDB 18 l.53, l.55 ; MDG 13 l.584)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('la relance se décide contre le marin à la naissance du coup, et Dévier entame la pièce de CE lieu', () => {
    const { lieuDeTouche } = critiqueDEquipageAuProjectile(mk('hero', 'marin', { pos: { x: 6, y: 5 }, items: piecesParLieu(), armour: { ...PA3 } }));
    expect(lieuDeTouche, 'la touche sur la coque porte un autre lieu que la relance').toBe('brasG');
    expect(etapes().map((s) => s.label), 'la fenêtre du marin nomme le lieu relancé').toEqual(['Blessure critique (Jambe droite)']);
    expect(draineCascade(useGame.getState, 200, undefined, choix('devier'))).toEqual(['deviation']);
    const m = enJeu('marin');
    expect(m.criticalWounds ?? 0, 'Critique ignoré').toBe(0);
    expect(Object.fromEntries(m.items!.map((i) => [i.uid, i.damageTaken ?? 0])), 'le recompte relit le lieu né avec le coup')
      .toEqual({ 'pa-tete': 0, 'pa-brasG': 0, 'pa-brasD': 0, 'pa-corps': 0, 'pa-jambeG': 0, 'pa-jambeD': 1 });
  });
});
