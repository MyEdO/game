/**
 * SET STRICT (#1348) — l'attaque passe par les armes du SET ACTIF, le joueur commute lui-même.
 * Contrats : (a) set de tir pur → aucune Mains nues dans `c.weapons`, et le tir REFUSÉ en étant *Engagé*
 * (`LDB 14 l.41`) avec sa raison au journal, sans `pendingAttack` ; (b) après commutation vers le set de
 * mêlée, l'attaque part ; (c) l'Atout Pistolet (`LDB 62 l.284-285`) tire Engagé sans commuter ; (d) set
 * SANS arme = combattant désarmé → Mains nues et frappe ; (e) statbloc sans loadout : arsenal intact.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { itemFromTrappingById, recomputeLoadout, loadWeapon } from '../engine/items';
import { firedAttackBlock, attackWeaponOf, runEnemyAI, aiTurnLog, clearAiTurnLog } from './combatFlow';
import type { Combatant, ItemInstance } from '../engine/types';

const emptyScene = (w = 16, h = 12) =>
  ({ id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
     entities: [], dialogues: [], triggers: [], encounters: [] }) as never;

const take = (id: string, over: Partial<ItemInstance> = {}): ItemInstance => {
  const it = itemFromTrappingById(id);
  if (!it) throw new Error(`trapping introuvable : ${id}`);
  return { ...it, uid: id, equipped: true, ...over };
};

/** Héros RÉEL (pré-tiré) porteur d'une arme à distance (set 1) et d'une épée (set 2), arme de tir CHARGÉE. */
function shooter(rangedId: string) {
  const h = makePregens()[0];
  const ranged = take(rangedId);
  const epee = take('arme-simple');
  const ammo = take(rangedId === 'arbalete' ? 'carreau' : 'balle-et-poudre', { equipped: false });
  h.items = [ranged, epee, ammo];
  h.loadouts = [{ id: 'lo-tir', main: ranged.uid }, { id: 'lo-melee', main: epee.uid }];
  h.activeLoadoutId = 'lo-tir';
  h.pos = { x: 3, y: 3 };
  recomputeLoadout(h);
  loadWeapon(h, h.weapons.find((w) => w.type === 'ranged')); // cycle de charge RÉEL (Recharge 1)
  return h;
}

/** Combat à DEUX cases de distance : héros actif, un bandit adjacent. `engaged` pose le lien symétrique. */
function battleWith(h: Combatant, engaged: boolean) {
  const e = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 4, y: 3 });
  if (engaged) { h.engagedWith = [e.id]; e.engagedWith = [h.id]; }
  const battle = {
    combatants: [h, e], order: [h.id, e.id], baseOrder: [h.id, e.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as never;
  useGame.setState({ battle, scene: emptyScene(), party: [h], mode: 'battle' });
  return e;
}

const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
/** Arme que le moteur emploierait pour l'attaque PENDANTE — SOURCE UNIQUE (`attackWeaponOf`), jamais un champ deviné. */
const pendingWeaponLabel = (): string => {
  const pa = useGame.getState().pendingAttack!;
  const b = useGame.getState().battle!;
  return attackWeaponOf(b, live(pa.attackerId), live(pa.targetId), pa).label;
};

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingAttack: null });
  useGame.getState().seedRng(11);
});

describe('set de TIR pur : aucune arme de mêlée fabriquée (#1348)', () => {
  it('l’arbalétrier n’a PAS « Mains nues » dans ses armes tenues', () => {
    const h = shooter('arbalete');
    expect(h.weapons.map((w) => w.label)).toEqual(['Arbalète']);
  });

  it('Engagé : le clic-ennemi est REFUSÉ (refus DIT), aucun pendingAttack, aucune Action consommée', () => {
    const h = shooter('arbalete');
    const e = battleWith(h, true);
    useGame.getState().battleClickEntity(e.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(useGame.getState().battle!.acted).toBe(false);
    // Le refus se dit au canal VISIBLE du combat (`state.refus`), pas au journal (spec § 2026-08-19).
    expect(useGame.getState().refus?.texte ?? '').toMatch(/Engagé/);
  });

  it('après commutation vers le set de MÊLÉE (action gratuite), l’attaque PART', () => {
    const h = shooter('arbalete');
    const e = battleWith(h, true);
    useGame.getState().battleSwitchLoadout('lo-melee');
    expect(live(h.id).weapons.map((w) => w.label)).toEqual(['Arme simple']);
    useGame.getState().battleClickEntity(e.id, { confirm: true });
    expect(useGame.getState().pendingAttack).not.toBeNull();
    expect(pendingWeaponLabel()).toBe('Arme simple');
  });
});

describe('tir en étant Engagé — Atout Pistolet (LDB 14 l.41)', () => {
  it('Pistolet : le tir PART sans commuter de set', () => {
    const h = shooter('pistolet');
    const e = battleWith(h, true);
    expect(firedAttackBlock(useGame.getState, live(h.id), live(e.id))).toBeNull();
    useGame.getState().battleClickEntity(e.id, { confirm: true });
    expect(useGame.getState().pendingAttack).not.toBeNull();
    expect(pendingWeaponLabel()).toMatch(/Pistolet/);
  });

  it('Arbalète : le tir est refusé (raison `engaged`)', () => {
    const h = shooter('arbalete');
    const e = battleWith(h, true);
    expect(firedAttackBlock(useGame.getState, live(h.id), live(e.id))).toMatchObject({ reason: 'engaged' });
  });

  it('NON Engagé : la même arbalète tire sur la cible adjacente (bout portant reste légal)', () => {
    const h = shooter('arbalete');
    const e = battleWith(h, false);
    expect(firedAttackBlock(useGame.getState, live(h.id), live(e.id))).toBeNull();
  });
});

describe('set réellement DÉSARMÉ : les Mains nues reviennent', () => {
  it('set vide → « Mains nues » tenue, et la frappe part au contact', () => {
    const h = shooter('arbalete');
    h.loadouts = [...h.loadouts!, { id: 'lo-nu' }];
    h.activeLoadoutId = 'lo-nu';
    recomputeLoadout(h);
    expect(h.weapons.map((w) => w.label)).toEqual(['Mains nues']);
    const e = battleWith(h, true);
    useGame.getState().battleClickEntity(e.id, { confirm: true });
    expect(pendingWeaponLabel()).toBe('Mains nues');
  });
});

describe('invariant « jamais sans arme » + statbloc', () => {
  it('sans objet NI loadout : `recomputeLoadout` rend Mains nues (aucun combattant sans arme)', () => {
    const c = { id: 'x', label: 'X', kind: 'hero', items: [], characteristics: { force: 30, endurance: 30 } } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toEqual(['Mains nues']);
  });

  it('statbloc de créature : ses armes ne viennent PAS d’objets → aucun chemin runtime ne les re-dérive', () => {
    const e = spawnEnemy({ ref: 'brigand' }, 'e-nu', { x: 1, y: 1 });
    expect(e.weapons.length).toBeGreaterThan(0);
    expect(e.items ?? []).toHaveLength(0); // les appels de recompute sont gardés par `items?.length`
    expect(e.loadouts ?? []).toHaveLength(0);
  });
});

describe('IA : tir pur Engagé (LDB 14 l.41)', () => {
  it('un PNJ IA au set de tir pur, Engagé, ne TIRE pas (il se replace) — plus de coup de poing automatique', () => {
    const h = makePregens()[0];
    h.pos = { x: 3, y: 3 };
    const e = spawnEnemy({ ref: 'brigand' }, 'e-tir', { x: 4, y: 3 });
    e.items = [take('arbalete'), take('carreau', { equipped: false })];
    e.loadouts = [{ id: 'lo-tir', main: 'arbalete' }];
    e.activeLoadoutId = 'lo-tir';
    recomputeLoadout(e);
    loadWeapon(e, e.weapons.find((w) => w.type === 'ranged'));
    expect(e.weapons.map((w) => w.label)).toEqual(['Arbalète']); // pas de Mains nues fabriquées
    e.engagedWith = [h.id]; h.engagedWith = [e.id];
    (e as unknown as { aiDriven: boolean }).aiDriven = true;
    const battle = {
      combatants: [e, h], order: [e.id, h.id], baseOrder: [e.id, h.id],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, scene: emptyScene(), party: [h], mode: 'battle' });
    clearAiTurnLog();
    runEnemyAI(useGame.getState, useGame.setState, e.id);
    expect(aiTurnLog()[aiTurnLog().length - 1]?.action ?? '').not.toMatch(/^shoot/);
  });
});
