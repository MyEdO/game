import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { applyAttackResult, jouerLesTirsDeBordee } from './combatFlow';
import { OPS_DIFFEREES } from './combatEffects';
import { draineCascade } from './cascade.testkit';
import { resolveVolley } from '../engine/volley';
import { rederivePassiveAttack } from '../engine/combat';
import { createHero } from '../engine/character';
import { woundsFromHit } from '../engine/woundsCalc';
import { testScene } from '../scenes/test-fixture';
import type { Scene } from './monde/scene';
import type { Combatant, ShipPoste, Weapon, ArmourPoints } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import { deFixe } from '../engine/dice.testkit';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Le Critique ne dépend pas de la perte de Blessures : LDB 13 l.183, LDB 13 l.161 (dépassement) ; AA 07 l.25, MDG 13 l.656,
 * MDG 12 l.232, AA 10 l.114. Un aiguillage par type de cible (Structure, coque, personnage), comme
 * `applyCriticalToTarget`.
 */

const SANS_PA: ArmourPoints = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
const chars = (end: number) => ({ 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: end, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

// ── Coque : la bordée (MDG 14 l.128) ─────────────────────────────────────────────────────────────
const gunnerPJ = (): Combatant => combattantDeTest({ id: 'gunner', label: 'Artilleur', kind: 'hero', characteristics: chars(30), wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 2, resilience: 1,
  skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 30 }], talents: [], weapons: [],
  armour: { ...SANS_PA }, movement: 4, pos: { x: 5, y: 5 } });
const battPoste = (): ShipPoste => ({ side: 'tribord', item: { uid: 'canon', label: 'Canon moyen', kind: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] }, crewIds: ['gunner'] }) as unknown as ShipPoste;
const firingShip = (): Combatant => combattantDeTest({ id: 'ship', label: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['gunner'], postes: [battPoste()], pos: { x: 5, y: 5 }, wounds: blessuresDeBase(60), conditions: [], weapons: [] });
const coque = (end: number, blindage = 0): Combatant => combattantDeTest({ id: 'target', label: 'Caraque', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'knarr', pos: { x: 9, y: 5 },
  characteristics: chars(end), wounds: blessuresDeBase(90), advantage: 0, conditions: [], weapons: [], armour: { ...SANS_PA, corps: blindage }, skills: [], talents: [], crewIds: [] });
const mer = () => ({ id: 's', name: 's', dimensions: { w: 20, h: 20 }, ambiance: 'jour', metresPerTile: 10, layers: [{ z: 0, tiles: new Array(400).fill('eau') }], entities: [], dialogues: [], triggers: [], encounters: [] });
/** Le d100 du canonnier : 44, un double réussi. */
const fixe = deFixe;

function bordeeSur(cible: Combatant, graine: number) {
  seedBattleRng(graine);
  const ship = firingShip();
  banc.setState({ battle: { combatants: [ship, gunnerPJ(), cible], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
    party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, pendingCascade: null, suspendedCascades: [], scene: mer() as never });
  const tirs = resolveVolley(ship, ship.postes!, 1, true, [gunnerPJ()], fixe(44));
  jouerLesTirsDeBordee(banc.getState, banc.setState, { targetId: 'target', actedAvant: false, tirs: tirs.map((s) => ({ tireurId: s.tireur.id, weapon: s.weapon, jet: s.jet })) });
  return { apres: banc.getState().battle!.combatants.find((c) => c.id === 'target')! };
}

describe('Critique d’une coque, à 0 Blessure comme blindée', () => {

  it('RICOCHE : double réussi sur une coque BE 20, 0 Blessure → le Critique de navire est subi (MDG 13 l.656)', () => {
    const { apres } = bordeeSur(coque(200), 7);
    expect(apres.wounds.current).toBe(90);
    expect(apres.criticalWounds).toBe(1);
  });

  it('coque blindée : le Blindage n’est jamais sacrifié et le Critique est subi, sur chaque graine (MDG 12 l.232)', () => {
    for (let graine = 1; graine <= 12; graine++) {
      const { apres } = bordeeSur(coque(40, 2), graine);
      expect(apres.armour?.corps, `graine ${graine} : Blindage sacrifié`).toBe(2);
      expect(apres.criticalWounds, `graine ${graine} : Critique perdu`).toBe(1);
    }
  });
});

// ── Personnage et créature ─────────────────────────────────────────────────────────────────────
/** Arme Inoffensive (LDB 62 l.327) : aucune Blessure minimale, le BE absorbe tout. */
const gourdin: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'inoffensive' }] };
/** Double réussi, par la couture du jeu (`rederivePassiveAttack` → `applyHit`). */
const doubleAbsorbe = (attaquant: Combatant, cible: Combatant): AttackResult =>
  rederivePassiveAttack(attaquant, cible, gourdin, { roll: 44, target: 90, success: true, sl: 2, isDouble: true } as never, 'melee', { rng: makeRNG(1595) }, 'corps');

function combat(seed = 7) {
  banc.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed });
  banc.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [] });
  banc.getState().startScene(structuredClone(testScene()));
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  for (const c of [H, E]) { c.items = (c.items ?? []).filter((i) => i.kind !== 'armor'); c.armour = { ...SANS_PA }; c.characteristics = { ...c.characteristics, endurance: 60 }; }
  return { H, E };
}

describe('Critique d’un personnage ou d’une créature dont le coup est absorbé', () => {

  it('créature, arme Inoffensive, double absorbé : le Critique est appliqué (LDB 13 l.183)', () => {
    const { H, E } = combat();
    E.important = true; // LDB 18 l.44 : hors Mort subite
    const res = doubleAbsorbe(H, E);
    expect(res).toMatchObject({ hit: true, critical: true, woundsLost: 0 });
    applyAttackResult(banc.getState, banc.setState, H, E, gourdin, res, { sousAttaque: true });
    draineCascade(banc.getState);
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.criticalWounds).toBe(1);
  });

  it('personnage, double à 0 Blessure : la fenêtre de Blessure critique s’ouvre, le Critique est appliqué', () => {
    const { H, E } = combat();
    const res = doubleAbsorbe(E, H);
    expect(res).toMatchObject({ hit: true, critical: true, woundsLost: 0 });
    expect(applyAttackResult(banc.getState, banc.setState, E, H, gourdin, res)).toBe(OPS_DIFFEREES);
    const etape = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!;
    expect(etape.table).toBeDefined();
    banc.getState().cascadeTableRoll(etape.id);
    draineCascade(banc.getState);
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.criticalWounds).toBe(1);
  });

  it('créature Démoniaque, double à 0 Blessure : le dé de sauvegarde s’ouvre contre le Critique (LDB 85 l.98)', () => {
    const { H, E } = combat();
    E.traits = [{ id: 'demoniaque', value: 9 }] as never;
    const res = doubleAbsorbe(H, E);
    expect(res).toMatchObject({ hit: true, critical: true, woundsLost: 0 });
    applyAttackResult(banc.getState, banc.setState, H, E, gourdin, res, { sousAttaque: true });
    expect(banc.getState().pendingCascade?.participants.some((s) => s.kind === 'sauvegarde')).toBe(true);
  });
});

// ── Structure : AA 10 l.114 ────────────────────────────────────────────────────────────────────
const fleche: Weapon = { label: 'Flèche', type: 'ranged', damage: { plusBF: false, flat: 0 }, qualities: [] };
function mur(structure = 'mur-en-pierre', graine = 1): { S: Combatant; H: Combatant } {
  banc.getState().seedRng(graine);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  const s: Scene = structuredClone(testScene());
  s.walls = [{ x: 2, y: 2, side: 'E', structure }];
  banc.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [] });
  banc.getState().startScene(s);
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
  return { S: b.combatants.find((c) => c.bodyShape === 'structure')!, H: b.combatants.find((c) => c.kind === 'hero')! };
}

describe('Critique d’une Structure (AA 10 l.114)', () => {

  it('double sur un Mur en pierre (Impénétrable), 0 Blessure : aucune levée humanoïde, le mur reste intact', () => {
    const { S, H } = mur();
    const woundsLost = woundsFromHit(fleche, S, 'corps', 30, 0, 1, undefined);
    expect(woundsLost).toBe(0);
    const res: AttackResult = { hit: true, attackerRoll: 44, netSL: 2, damage: 30, woundsLost, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche' };
    expect(() => applyAttackResult(banc.getState, banc.setState, H, S, fleche, res)).not.toThrow();
    const apres = banc.getState().battle!.combatants.find((c) => c.id === S.id)!;
    expect(apres.wounds.current).toBe(40);
  });

  it('double sur un Mur en pierres sèches : Critique de Structure SSI la touche retire au moins 25 % des Blessures restantes', () => {
    const issue = (blessures: number) => {
      const { S, H } = mur('mur-en-pierres-seches', 2);
      const damage = Array.from({ length: 200 }, (_, d) => d).find((d) => woundsFromHit(fleche, S, 'corps', d, 0, 1, H.size) === blessures)!;
      const res: AttackResult = { hit: true, attackerRoll: 44, netSL: 2, damage, woundsLost: blessures, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche' };
      applyAttackResult(banc.getState, banc.setState, H, S, fleche, res);
      draineCascade(banc.getState);
      return banc.getState().battle!.combatants.find((c) => c.id === S.id)!;
    };
    const sous = issue(4);
    expect(sous.wounds.current, '4 Blessures sur 20 : sous le quart').toBe(16);
    expect(sous.criticalWounds ?? 0).toBe(0);
    expect(issue(5).criticalWounds, '5 Blessures sur 20 : le quart').toBe(1);
  });
});
