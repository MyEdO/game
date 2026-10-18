import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { seedBattleRng } from './battleRng';
import { applyHullCriticalToTarget, jouerLesTirsDeBordee } from './combatFlow';
import { draineCascade } from './cascadeTestKit';
import { spawnEnemy } from './spawn';
import { emptyScene } from './scene';
import { toucheAuJetPose, type AttackResult } from '../engine/combat';
import { damageArmour } from '../engine/items';
import { addCondition, hasCondition, COND } from '../engine/conditions';
import type { Combatant, Weapon, ItemInstance, HitLocation } from '../engine/types';
import type { CoupDeTouche } from './pendings';
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
const coupCritique = (): AttackResult => ({
  hit: true, attackerRoll: 11, netSL: 4, location: 'corps', critLocation: 'corps', damage: 8, woundsLost: 1,
  critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
} as AttackResult);
const coupSimple = (): AttackResult => ({
  hit: true, attackerRoll: 30, netSL: 2, location: 'corps', damage: 9, woundsLost: 2,
  critical: false, advantageTo: null, defenderDefeated: false, log: 'touche (corps)',
} as AttackResult);
/** Une bordée sur `cible` : un tir par résultat. */
const bordee = (cible: Combatant, tirs: AttackResult[], gmSeat?: number): boolean => {
  seedBattleRng(424242);
  poser([mk('hero', 'tireur', { pos: { x: 5, y: 0 } }), cible], gmSeat);
  return jouerLesTirsDeBordee(useGame.getState, useGame.setState, { targetId: cible.id, actedAvant: false, tirs: tirs.map((res) => ({ tireurId: 'tireur', weapon: canon, res })) });
};
const brute = (p: Partial<Combatant> = {}): Combatant => mk('enemy', 'brute', { armour: { ...PA3 }, ...p });
/** PB de la brute après une bordée drainée par `cle`. */
const pbApres = (tirs: AttackResult[], cle: 'devier' | 'subir'): number => {
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
    const recompte = (coupCritique().woundsLost ?? 0) + 1;
    const devie = pbApres([coupCritique(), coupSimple()], 'devier');
    const b = enJeu('brute');
    expect(b.armour.corps, 'PA −1').toBe(2);
    expect(b.criticalWounds ?? 0, 'Critique ignoré').toBe(0);
    expect(devie, 'Blessures recomptées à PA −1, puis le tir 2 une seule fois').toBe(20 - recompte - tir2);
  });

  it('Subir : Critique appliqué, PA intacts, et le tir 2 part une fois', () => {
    const tir2 = 20 - pbApres([coupSimple()], 'subir');
    const seul = pbApres([coupCritique()], 'subir');
    const deux = pbApres([coupCritique(), coupSimple()], 'subir');
    const b = enJeu('brute');
    expect(b.criticalWounds ?? 0).toBe(1);
    expect(b.armour.corps).toBe(3);
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
