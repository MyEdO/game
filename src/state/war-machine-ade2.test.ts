import { describe, it, expect } from 'vitest';
import { firedAttackBlock } from '../noyau/combatFlow';
import { resolveWeaponArea, areaTargets, type AreaHit } from '../noyau/combatArea';
import { fireTriggers } from '../noyau/triggeredEffects';
import { itemFromTrappingById, mannedPosteWeapon } from '../engine/items';
import { useGame } from './store';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import type { Combatant, Weapon } from '../engine/types';
import type { GameState } from './store';
import type { BattleState } from '../noyau/etat';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * Machines de guerre ADE II (ch.08 folio 88, l.243/251/253) :
 *  1. Canon à flammes nain — « 2 + DR États En flammes à chaque cible affectée » (onHitEffects en DONNÉE,
 *     dispatchés par fireTriggers sur la cible primaire ET la zone d'Explosion, même sans Blessure) ;
 *  2. Trébuchet/mortier — pas de tir sous la Portée Courte (minRangeBand « moyenne ») ;
 *  3. Armes de siège à distance — pas de tir à Bout Portant (minRangeBand « courte »).
 * Le REFUS (`firedAttackBlock`) passe par le MÊME canal que Recharge/munition/arc → l'UI affiche la raison.
 */

// ── firedAttackBlock : REFUS de portée minimale ─────────────────────────────────────────────────────────
const rangedMachine = (minRangeBand: 'courte' | 'moyenne'): Weapon =>
  // Arme à distance NUE (pas de Recharge ni famille de munition ni arc) → isole le seul gate de portée.
  ({ name: 'Pièce', type: 'ranged', range: 120, damage: { plusBF: false, flat: 10 }, qualities: [], minRangeBand, uid: 'piece' }) as unknown as Weapon;

const gunner = (w: Weapon): Combatant =>
  ({ id: 'gunner', name: 'Servant', kind: 'hero', pos: { x: 0, y: 0 }, conditions: [], weapons: [w], loaded: true,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } }) as unknown as Combatant;
const enemyAt = (x: number): Combatant => ({ id: `e${x}`, name: 'cible', kind: 'enemy', pos: { x, y: 0 }, conditions: [], weapons: [] }) as unknown as Combatant;

const battle = (combatants: Combatant[]): BattleState =>
  ({ combatants, order: combatants.map((c) => c.id), turn: 0, movementUsed: 0, action: null, acted: false, over: null }) as unknown as BattleState;
const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ battle: battle(combatants), facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;

describe('firedAttackBlock — PORTÉE MINIMALE (machines de siège ADE II 08 l.251/253)', () => {
  it('minimale « courte » : tir REFUSÉ à Bout Portant (raison « portee-min »), AUTORISÉ à Moyenne', () => {
    const g = gunner(rangedMachine('courte'));
    // Portée 120 m : Bout Portant ≤ 12 m (≤6 cases), Courte ≤ 60 m, Moyenne ≤ 120 m.
    const near = enemyAt(2); // 4 m → Bout Portant
    const far = enemyAt(40); // 80 m → Moyenne
    expect(firedAttackBlock(mkGet([g, near, far]), g, near, 'piece')).toMatchObject({ reason: 'portee-min' });
    expect(firedAttackBlock(mkGet([g, near, far]), g, far, 'piece')).toBeNull();
  });

  it('minimale « moyenne » (trébuchet/mortier) : REFUSÉ jusqu’à Courte incluse, AUTORISÉ à Moyenne', () => {
    const g = gunner(rangedMachine('moyenne'));
    const courte = enemyAt(20); // 40 m → Courte
    const moyenne = enemyAt(40); // 80 m → Moyenne
    expect(firedAttackBlock(mkGet([g, courte, moyenne]), g, courte, 'piece')).toMatchObject({ reason: 'portee-min' });
    expect(firedAttackBlock(mkGet([g, courte, moyenne]), g, moyenne, 'piece')).toBeNull();
  });
});

// ── Canon à flammes nain : 2 + DR En flammes à la touche, ZONE incluse (l.243) ──────────────────────────
const foe = (id: string, x: number): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y: 0 }, wounds: { current: 20, max: 20 }, advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, conditions: [], traits: [], talents: [], skills: [], weapons: [] }) as unknown as Combatant;

const miniScene = () =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, metresPerTile: 2, ambiance: 'jour',
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] });
function mountBattle(combatants: Combatant[]) {
  seedBattleRng(7);
  useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never,
    scene: miniScene() as never, party: [], facing: {}, pendingShipBattery: null });
  const get = () => useGame.getState();
  const set: Parameters<typeof resolveWeaponArea>[1] = (p) => useGame.setState(p as never);
  return { get, set };
}

/** L'arme RÉELLE du catalogue, construite par le chemin de production (trapping → item → arme servie). */
const flameCannon = (): Weapon => {
  const item = itemFromTrappingById('canon-a-flammes-nain-ade2', idNeufDeBanc);
  expect(item).not.toBeNull();
  const carrier = { id: 'crew', name: 'Servant', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } } as unknown as Combatant;
  const w = mannedPosteWeapon(carrier, { item: item as never, side: 'proue', crewIds: ['crew'] } as never);
  expect(w).toBeDefined();
  return w!;
};

const enFlammes = (c: Combatant) => (c.conditions ?? []).find((x) => x.id === 'en-flammes')?.value;

describe('Canon à flammes nain — 2 + DR En flammes (ADE II 8 l.243)', () => {
  it('porte bien ses onHitEffects issus de la DONNÉE + Dégâts « Spéciaux » (0 Blessure)', () => {
    const w = flameCannon();
    expect(w.onHitEffects?.length).toBeGreaterThan(0);
    expect(w.damage).toEqual({ literal: 'Spéciaux' }); // « Spéciaux » (RAW) → aucune Blessure de base
  });

  it('cible PRIMAIRE : DR 3 → 2 + 3 = 5 États En flammes (valuePerSL = +1/DR)', () => {
    const atk = foe('tireur', 0); (atk as { kind: string }).kind = 'hero';
    const tgt = foe('cible', 5);
    mountBattle([atk, tgt]);
    fireTriggers(() => useGame.getState(), atk, 'onHit', { victim: tgt, weapon: flameCannon(), woundsDealt: 0, margin: 3, rng: battleRng() } as never);
    expect(enFlammes(tgt)).toBe(5);
  });

  it('ZONE (Explosion) : chaque cible affectée reçoit 2 + DR En flammes, MÊME à 0 Blessure', () => {
    const atk = foe('tireur', 0); (atk as { kind: string }).kind = 'hero';
    const tgt = foe('cible', 4);
    const near = foe('near', 5); // 1 case = 2 m ≤ Explosion 5 → dans la gerbe
    const { get, set } = mountBattle([atk, tgt, near]);
    const w = flameCannon();
    // damage = 0 (Spéciaux) : le gate historique « wl>0 » aurait supprimé l'État de zone — on vérifie qu'il tombe.
    const hit: AreaHit = { attacker: atk, primaryTarget: tgt, weapon: w, damage: 0, location: 'corps', distanceTiles: 4, margin: 2 };
    resolveWeaponArea(get, set, hit, areaTargets([atk, tgt, near], 2), battleRng());
    expect(near.conditions.length).toBeGreaterThan(0);
    expect(enFlammes(near)).toBe(4); // 2 + DR(2), appliqué sans Blessure
  });
});
