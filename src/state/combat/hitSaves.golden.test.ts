import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from '../store';
import { applyAttackResult } from '../combatFlow';
import { seedBattleRng, battleRng } from '../battleRng';
import { draineEtLit } from '../cascadeTestKit';
import type { Combatant, Weapon } from '../../engine/types';
import type { AttackResult } from '../../engine/combat';
import { emptyScene } from '../scene';

/**
 * GOLDEN des SAUVEGARDES POST-TOUCHE (filet anti-régression Phase 2) : `applyAttackResult` applique,
 * après une touche, une SUITE de sauvegardes synchrones (Démoniaque/Protection `wardSaves` → Bouclier
 * anti-flèches → Dôme → Martyr → Perturbante). On fige, pour deux cas À RNG (Démoniaque et Dôme),
 * l'état observable de la cible (PB perdus / journal) + une sonde RNG post-résolution.
 *
 * RECAPTURÉ à #1508 T3b, et la raison de changer est DITE : le 1d10 « ≥ Indice » ne se roule plus dans
 * le registre, il naît en ÉTAPE de dé à la porte — `applyAttackResult` rend donc `true` (SUSPENDU, aucune
 * mutation), le dé tombe quand la fenêtre est jouée (ici le drainage), et la ligne du dé est la
 * CONSÉQUENCE de l'étape, plus une ligne du journal de bataille. La sonde RNG se décale d'autant : le dé
 * quitte le flux d'aléa de la bataille au point où il était tiré pour être tiré par le pilote de la porte.
 * L'ÉTAT OBSERVABLE, lui, ne bouge pas — c'est ce que ce golden garde.
 */

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h1', label: 'Hardi', kind: 'hero', characteristics: CHARS,
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

const enemy = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'e1', label: 'Démon', kind: 'enemy', characteristics: CHARS,
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 1, y: 0 }, size: 'moyenne',
    weapons: [{ label: 'Griffes', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as Weapon], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): BattleState {
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
  return battle;
}

/** Aura de Bouclier anti-flèches portée par un allié, rayon 4 m. */
const arrowWard = (): Combatant['activeEffects'] =>
  ([{ label: 'Bouclier', bonus: 0, arrowWard: { radiusMeters: 4 } }] as unknown as Combatant['activeEffects']);

const meleeHit = (): AttackResult => ({
  hit: true, attackerRoll: 30, netSL: 3, location: 'corps', damage: 6, woundsLost: 4,
  critical: false, advantageTo: null, defenderDefeated: false, log: 'Hardi touche le Démon.',
});

describe('GOLDEN — sauvegardes post-touche (applyAttackResult)', () => {
  beforeEach(() => { useGame.setState({ battle: null }); });
  afterEach(() => { useGame.setState({ battle: null }); });

  it('Démoniaque (wardSaves) : 1d10 ≥ Indice ignore le coup — état + RNG figés', () => {
    seedBattleRng(2); // graine où le 1d10 de sauvegarde ≥ 8 (le coup est ignoré)
    const atk = hero({ id: 'h1', pos: { x: 0, y: 0 } });
    // Cible Démoniaque (Indice 8) : 1d10 ≥ 8 → coup ignoré, même Critique (LDB 85 l.98).
    const demon = enemy({ id: 'e1', pos: { x: 1, y: 0 }, traits: [{ id: 'demoniaque', value: 8 }], wounds: { current: 20, max: 20 } });
    setBattle([atk, demon]);
    const before = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!.wounds.current;
    const suspended = applyAttackResult(useGame.getState, useGame.setState, atk, demon, atk.weapons?.[0] ?? ({ label: 'Griffes', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as Weapon), meleeHit());
    const lues = draineEtLit(useGame.getState); // la fenêtre est jouée : c'est LÀ que le 1d10 tombe
    const after = useGame.getState().battle!;
    const e = after.combatants.find((c) => c.id === 'e1')!;
    const lines = after.log.map((l) => `${l.kind}:${l.text}`);
    const rngProbe = battleRng().int(1, 100);
    expect({ suspended, before, woundsAfter: e.wounds.current, lines, lues, rngProbe }).toMatchInlineSnapshot(`
      {
        "before": 20,
        "lines": [
          "info:Démon — Sauvegarde : dé 8 → 8.",
          "attack:Hardi touche le Démon.",
          "info:Démon ignore le coup — sauvegarde 1d10 : 8 ≥ Démoniaque (8+).",
        ],
        "lues": [
          "Démon — Sauvegarde : dé 8 → 8.",
          "Hardi touche le Démon.",
          "Démon ignore le coup — sauvegarde 1d10 : 8 ≥ Démoniaque (8+).",
        ],
        "rngProbe": 33,
        "suspended": true,
        "woundsAfter": 20,
      }
    `);
  });

  it('Dôme (domeWard) : tir de l’extérieur, 1d10 ≥ 6 dévie — état + RNG figés', () => {
    seedBattleRng(1); // graine où le 1d10 du Dôme ≥ 6 (le tir est dévié)
    // Porteur du Dôme (rayon 4 m → 2 cases) ; cible adjacente DEDANS ; tireur HORS de la zone.
    const warden = hero({ id: 'w', label: 'Mage', pos: { x: 5, y: 5 }, activeEffects: [{ domeWard: { radiusMeters: 4, ward: { id: 'protection', value: 6 } } }] as unknown as Combatant['activeEffects'] });
    const target = hero({ id: 'h1', label: 'Couvert', pos: { x: 6, y: 5 }, wounds: { current: 15, max: 15 } });
    const shooter = enemy({ id: 'e1', label: 'Tireur', pos: { x: 20, y: 5 } });
    const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] } as Weapon;
    setBattle([warden, target, shooter]);
    const before = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!.wounds.current;
    const suspended = applyAttackResult(useGame.getState, useGame.setState, shooter, target, bow, meleeHit());
    const lues = draineEtLit(useGame.getState); // la fenêtre est jouée : c'est LÀ que le 1d10 tombe
    const after = useGame.getState().battle!;
    const t = after.combatants.find((c) => c.id === 'h1')!;
    const lines = after.log.map((l) => `${l.kind}:${l.text}`);
    const rngProbe = battleRng().int(1, 100);
    expect({ suspended, before, woundsAfter: t.wounds.current, lines, lues, rngProbe }).toMatchInlineSnapshot(`
      {
        "before": 15,
        "lines": [
          "shoot:Hardi touche le Démon.",
          "info:Couvert ignore le coup — sauvegarde 1d10 : 7 ≥ Protection (6+) du Dôme.",
        ],
        "lues": [
          "Hardi touche le Démon.",
          "Couvert ignore le coup — sauvegarde 1d10 : 7 ≥ Protection (6+) du Dôme.",
        ],
        "rngProbe": 1,
        "suspended": true,
        "woundsAfter": 15,
      }
    `);
  });

  it('Bouclier anti-flèches : le projectile est détruit EN VOL — aucun dé de sauvegarde n’est jeté', () => {
    // Le projectile organique est détruit avant l'impact (LDB 47 l.358) : ce n'est donc pas un coup
    // reçu (LDB 85 l.98), et la sauvegarde de la cible n'a rien à sauver. Le nombre de dés
    // jetés se LIT sur l'avance du RNG : avec ou sans le Trait, le flux d'aléa doit être le MÊME.
    const tirer = (avecTrait: boolean): { pb: number; rng: number } => {
      seedBattleRng(3);
      const warden = hero({ id: 'w', label: 'Mage', pos: { x: 5, y: 5 }, activeEffects: arrowWard() });
      const target = hero({
        id: 'h1', label: 'Couvert', pos: { x: 6, y: 5 }, wounds: { current: 15, max: 15 },
        ...(avecTrait ? { traits: [{ id: 'protection', value: 1 }] } : {}),
      } as Partial<Combatant>);
      const shooter = enemy({ id: 'e1', label: 'Tireur', pos: { x: 20, y: 5 } });
      const arc: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [], organicProjectile: true } as unknown as Weapon;
      setBattle([warden, target, shooter]);
      applyAttackResult(useGame.getState, useGame.setState, shooter, target, arc, meleeHit());
      return { pb: useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!.wounds.current, rng: battleRng().int(1, 1_000_000) };
    };
    const sans = tirer(false);
    const avec = tirer(true);
    expect(sans.pb, 'le projectile organique est détruit : la cible est indemne').toBe(15);
    expect(avec.pb, 'idem avec le Trait — il n’a rien eu à sauver').toBe(15);
    expect(avec.rng, 'un Trait de sauvegarde qui roulerait quand même ferait avancer le RNG').toBe(sans.rng);
  });
});
