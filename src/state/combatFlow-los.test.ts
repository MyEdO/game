import { describe, it, expect } from 'vitest';
import { resolveAttack, strayShotVictim } from '../noyau/combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { makeRNG } from '../engine/dice';
import { Scene } from '../noyau/monde/scene';
import { Combatant } from '../engine/types';
import type { ModLine, RollBreakdown } from '../engine/combat';
import type { GameState } from './store';
import { ligneDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';
import { RULE_REF } from '../engine/ruleRefs';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { initialNet } from '../noyau/etat'; // `resolveAttack` lit `net` (surfaçage de la défense, #989) — l'état forgé le porte

const shooter = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'A',
    name: 'Tireur',
    kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 55, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    advantage: 0,
    conditions: [],
    weapons: [{ name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    pos: { x: 0, y: 0 },
    ...over,
  })) as unknown as Combatant;

const target = (over: Partial<Combatant> = {}): Combatant =>
  ({ ...shooter({ id: 'B', label: 'Cible', kind: 'enemy', weapons: [], pos: { x: 5, y: 0 } }), ...over }) as Combatant;

function scene(w: number, tiles?: Record<string, string>): Scene {
  const grid = new Array(w).fill('herbe');
  if (tiles) for (const [k, v] of Object.entries(tiles)) grid[Number(k.split(',')[0])] = v;
  return { id: 's', name: 's', dimensions: { w, h: 1 }, ambiance: 'jour', layers: [{ z: 0, tiles: grid }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
}

const mkGet = (sc: Scene, combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants }, facing: {}, net: initialNet(), log: () => {} })) as unknown as () => GameState;

/** TOUT ce que la ligne du jet NOMME : les chips (modificateurs du jeteur) ET la composition de sa
 *  Difficulté (les circonstances de la table, `LDB 14 l.91-96`, que porte le palier — #1153). Un test
 *  qui ne lirait que `mods` ne verrait pas une circonstance portée par la Difficulté. */
const nomme = (d: RollBreakdown): ModLine[] => [...(d.mods ?? []), ...(d.difficultyParts ?? [])];
const TIR_EN_BOUGEANT = refDeRegle('tir-en-mouvement');

describe('resolveAttack — gate Ligne de Vue + Couvert (LDB 13 l.114 / 14)', () => {
  it('mur intercalé à distance de la cible → pas de Ligne de Vue → null (pas de tir)', () => {
    seedBattleRng(1);
    const s = scene(7, { '3,0': 'mur' });
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    expect(resolveAttack(mkGet(s, [a, b]), a, b)).toBeNull();
  });

  it('ligne dégagée → tir résolu (résultat non nul)', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    expect(resolveAttack(mkGet(s, [a, b]), a, b)).not.toBeNull();
  });

  it('sous-bois sur la ligne → ligne « Couvert » dans le détail du jet', () => {
    seedBattleRng(1);
    const s = scene(7, { '3,0': 'bois' });
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const r = resolveAttack(mkGet(s, [a, b]), a, b);
    expect(ligneDe(nomme(r!.res.attackerDetail!), RULE_REF['cible-sous-couverture'])).toBeDefined();
  });

  it('tir en bougeant (Mouvement dépensé ce tour) → -10 (LDB 14 l.70)', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const get = (() => ({ scene: s, battle: { combatants: [a, b], movementUsed: 99 }, net: initialNet(), log: () => {} })) as unknown as () => GameState;
    const r = resolveAttack(get, a, b);
    expect(ligneDe(nomme(r!.res.attackerDetail!), TIR_EN_BOUGEANT)?.value).toBe(-10);
  });

  it('héros qui garde sa mobilité (n’a pas tiré « immobile ») → -10 même sans avoir encore bougé', () => {
    // Mouvement décomposable : on peut bouger APRÈS le tir → un tir mobile coûte -10 par défaut (LDB 14 l.70).
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const r = resolveAttack(mkGet(s, [a, b]), a, b); // pas d'immobilisation → tir mobile
    expect(ligneDe(nomme(r!.res.attackerDetail!), TIR_EN_BOUGEANT)?.value).toBe(-10);
  });

  it('héros qui tire IMMOBILE (heldGround) → pas de pénalité « Tir en bougeant »', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const r = resolveAttack(mkGet(s, [a, b]), a, b, undefined, undefined, undefined, true); // heldGround = true
    expect(ligneDe(nomme(r!.res.attackerDetail!), TIR_EN_BOUGEANT)).toBeUndefined();
  });

  it('héros qui NE PEUT PAS bouger (Empêtré, Mouvement 0) → pas de -10 même sans s’immobiliser', () => {
    // S'il ne peut pas se déplacer (effectiveMovement 0), il tire forcément immobile → pas de pénalité.
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter({ conditions: [{ id: 'empetre', value: 1 }] });
    const b = target({ pos: { x: 6, y: 0 } });
    const r = resolveAttack(mkGet(s, [a, b]), a, b); // pas de heldGround, mais Mouvement nul
    expect(ligneDe(nomme(r!.res.attackerDetail!), TIR_EN_BOUGEANT)).toBeUndefined();
  });
});

describe('resolveAttack — Allonge en mêlée (RAW-3, LDB 62 l.163/164)', () => {
  const lance = { name: 'Pique', type: 'melee', damage: { plusBF: true, flat: 2 }, reach: 'Très longue', qualities: [] };
  const dague = { name: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [] };

  it('arme « Très longue » engage et touche à 2 cases', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter({ weapons: [lance] as never, pos: { x: 0, y: 0 } });
    const b = target({ pos: { x: 2, y: 0 } });
    expect(resolveAttack(mkGet(s, [a, b]), a, b)).not.toBeNull(); // 2 cases ≤ Allonge 2
  });

  it('arme de contact (Très courte) ne touche PAS à 2 cases', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter({ weapons: [dague] as never, pos: { x: 0, y: 0 } });
    const b = target({ pos: { x: 2, y: 0 } });
    expect(resolveAttack(mkGet(s, [a, b]), a, b)).toBeNull(); // hors de portée de mêlée
  });
});

describe('strayShotVictim — tir dévié vers un allié (LDB 14 l.116)', () => {
  const att = shooter();
  const ally = { id: 'ALLY', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [] } as unknown as Combatant;
  const tgt = target({ pos: { x: 6, y: 0 }, engagedWith: ['ALLY'] });
  const battle = { combatants: [att, tgt, ally] } as any;
  const miss = (roll: number, t: number) => ({ hit: false, attackerRoll: roll, attackerDetail: { target: t } }) as any;

  it('le -20 a fait rater (jet ≤ cible+20) + allié Engagé → redirige vers l’allié', () => {
    expect(strayShotVictim(miss(40, 30), att, tgt, battle, makeRNG(1))?.id).toBe('ALLY'); // 40 ≤ 30+20
  });
  it('trois alliés Engagés : la victime est tirée au hasard, deux graines, deux victimes', () => {
    const allie = (id: string) => ({ id, kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [] }) as unknown as Combatant;
    const trois = [allie('A1'), allie('A2'), allie('A3')];
    const cible = target({ pos: { x: 6, y: 0 }, engagedWith: ['A1', 'A2', 'A3'] });
    const b = { combatants: [att, cible, ...trois] } as any;
    const victimes = [1, 2, 3, 4, 5, 6].map((graine) => strayShotVictim(miss(40, 30), att, cible, b, makeRNG(graine))?.id);
    expect(victimes.every((id) => ['A1', 'A2', 'A3'].includes(id!))).toBe(true);
    expect(new Set(victimes).size).toBeGreaterThan(1);
  });
  it('jet > cible+20 (aurait raté de toute façon) → pas de redirection', () => {
    expect(strayShotVictim(miss(60, 30), att, tgt, battle, makeRNG(1))).toBeNull();
  });
  it('le tir a touché → pas de redirection', () => {
    expect(strayShotVictim({ hit: true } as any, att, tgt, battle, makeRNG(1))).toBeNull();
  });
  it('cible non engagée avec un allié → pas de redirection', () => {
    expect(strayShotVictim(miss(40, 30), att, target({ pos: { x: 6, y: 0 } }), battle, makeRNG(1))).toBeNull();
  });
});
