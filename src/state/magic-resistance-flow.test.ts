/**
 * Résistance à la Magie (#1007) au chemin de résolution (`applyCast`) : « tous les Sorts l'affectant »
 * (`LDB 85 l.302` / `LDB 10 l.1026`) — pas seulement le Projectile.
 *  - Projectile : les Dégâts suivent le DR réduit, et le Martyr (`LDB 43 l.107`) encaisse ces Dégâts-là ;
 *  - Sort à État/durée : `ctx.sl` réduit → magnitude moindre ;
 *  - ZONE : le plus haut score du TALENT parmi les CIBLES du lancement vaut pour tout le lancement —
 *    un porteur présent sur le terrain mais non ciblé ne compte pas (combatFlow.ts:4356) ;
 *  - NI par cible (sous-point #1007) : DR réduit sous le NI → le Sort n'affecte plus cette cible ;
 *  - DIFFÉRENTIEL : une cible sans résistance PROPRE ne bouge sur aucun de ces chemins, SAUF si un
 *    porteur du Talent figure parmi les cibles du lancement (clause de zone).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { applyCast } from '../noyau/combatFlow';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene } from '../noyau/monde/scene';
/** Pions de l'État `id` portés par `c` (0 si absent) — lecture directe de l'instance. */
const pions = (c: Combatant, id: string): number => c.conditions.find((x) => x.id === id)?.value ?? 0;
import type { Combatant } from '../engine/types';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

/** Résistance à la Magie 2 (trait de créature) / N (talent) — la DONNÉE porte l'op `incomingSpellDRMod`. */
const RM_TRAIT = [{ id: 'resistance-a-la-magie', value: 2 }] as never;
const rmTalent = (times: number) => [{ talentId: 'resistance-a-la-magie', times }] as never;

/** Projectile arcane MINIMAL (non curé → aucun Flow) : Dégâts 8 + DR + BFM 3. */
const missileSpell = (): never =>
  ({ id: 'dard-test', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8 }) as never;

/** Sort de SOUTIEN curé : État Aveugle dont la magnitude s'échelonne sur le DR (1 pion / 2 DR). */
const stateSpell = (): never =>
  ({
    id: 'ombre-test', label: 'Ombre', type: 'Magie des Arcanes', subType: null, domainId: null, family: 'arcane',
    cn: 0, range: { kind: 'distance', value: 20, unit: 'm' }, target: { kind: 'count', n: 1 },
    duration: { kind: 'rounds', value: 3 }, desc: '', curated: true,
    effects: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'aveugle', value: 1, valuePerSL: { every: 2, amount: 1 } }] } }] },
  }) as never;

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const cr = (sl: number, niRequired?: number): CastResult =>
  ({ cast: true, roll: 44, target: 60, sl, isCritical: false, isFumble: false, log: '', ...(niRequired != null ? { niRequired } : {}) });

/** Feed de combat concaténé — les lignes `cf.resistMagic*` du lancement. */
const feed = (): string => useGame.getState().battle!.log.map((e) => e.text).join('\n');

/** Lance le Projectile par le VRAI chemin (`applyCast`) ; `ni` = NI requis figé au jet (gate par cible). */
function castMissile(caster: Combatant, target: Combatant, sl: number, extraTargets: Combatant[] = [], ni?: number): void {
  const spell = missileSpell();
  const mres = evaluateMissile(caster, target, spell, cr(sl, ni));
  applyCast(useGame.getState, useGame.setState, caster, target, spell, mres, true, false, undefined, extraTargets.length ? { extraTargets } : undefined);
}

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null });
});

describe('#1007 DIVERGENCE 3 (périmètre) — Projectile : les Blessures suivent le DR réduit (LDB 85 l.302)', () => {
  it('DIFFÉRENTIEL : sans résistance, 8 + DR 4 + BFM 3 − BE 3 = 12 Blessures', () => {
    const w = mk('hero', 'mage');
    const t = mk('enemy', 'orc');
    setBattle([w, t]);
    castMissile(w, t, 4);
    expect(t.wounds.current).toBe(30 - 12);
  });

  it('avec Résistance 2 : 8 + (4−2) + 3 − 3 = 10 Blessures (le DR, pas les Blessures)', () => {
    const w = mk('hero', 'mage');
    const t = mk('enemy', 'orc', { traits: RM_TRAIT });
    setBattle([w, t]);
    castMissile(w, t, 4);
    expect(t.wounds.current).toBe(30 - 10);
  });
});

describe('#1007 DIVERGENCE 4 — Martyr (LDB 43 l.107) : la Résistance de la cible d’origine s’applique AVANT le transfert', () => {
  const setup = (targetOver: Partial<Combatant>) => {
    const w = mk('hero', 'mage');
    const priest = mk('hero', 'pretre');
    const t = mk('enemy', 'orc', { ...targetOver, activeEffects: [{ label: 'Martyr', bonus: 0, duration: { rounds: 3 }, martyrGuard: 'pretre' }] as never });
    setBattle([w, priest, t]);
    castMissile(w, t, 4);
    return { priest, t };
  };

  it('DIFFÉRENTIEL : cible sans résistance → le prêtre encaisse 15 − (2×BE 3) = 9', () => {
    const { priest, t } = setup({});
    expect(t.wounds.current).toBe(30); // la cible ne perd rien : le prêtre a tout pris
    expect(priest.wounds.current).toBe(30 - 9);
  });

  it('cible Résistance 2 → Dégâts 13, le prêtre encaisse 13 − 6 = 7 (la Résistance ne disparaît plus)', () => {
    const { priest } = setup({ traits: RM_TRAIT });
    expect(priest.wounds.current).toBe(30 - 7);
  });
});

describe('#1007 DIVERGENCE 3 (périmètre) — Sort NON-Projectile : `ctx.sl` réduit → magnitude moindre', () => {
  /** `bystanders` = présents dans la bataille mais HORS des cibles du lancement (clause de zone). */
  const cast = (t: Combatant, sl: number, extraTargets: Combatant[] = [], bystanders: Combatant[] = [], ni?: number) => {
    const w = mk('hero', 'mage');
    setBattle([w, t, ...extraTargets, ...bystanders]);
    applyCast(useGame.getState, useGame.setState, w, t, stateSpell(), cr(sl, ni), false, false, undefined, extraTargets.length ? { extraTargets } : undefined);
  };

  it('DIFFÉRENTIEL : sans résistance, DR 6 → 1 + 3 = 4 pions d’Aveugle', () => {
    const t = mk('enemy', 'orc');
    cast(t, 6);
    expect(pions(t, 'aveugle')).toBe(4);
  });

  it('avec Résistance 2 : DR 4 → 1 + 2 = 3 pions', () => {
    const t = mk('enemy', 'orc', { traits: RM_TRAIT });
    cast(t, 6);
    expect(pions(t, 'aveugle')).toBe(3);
  });

  it('ZONE (LDB 10 l.1026) : le plus haut score du TALENT vaut pour la cible qui ne le porte PAS', () => {
    const sansTalent = mk('enemy', 'orc');
    const porteur = mk('enemy', 'gobelin', { talents: rmTalent(2) }); // −4 DR
    cast(sansTalent, 6, [porteur]);
    expect(pions(sansTalent, 'aveugle')).toBe(2); // DR 6 − 4 = 2 → 1 + 1 pion
    expect(pions(porteur, 'aveugle')).toBe(2);    // le porteur n'applique pas non plus deux fois
  });

  it('ZONE — « la zone de sa cible » LUE comme les CIBLES : un porteur NON ciblé ne confère rien', () => {
    const sansTalent = mk('enemy', 'orc');
    const porteur = mk('enemy', 'gobelin', { talents: rmTalent(2) }); // −4 DR, mais hors des cibles
    cast(sansTalent, 6, [], [porteur]);
    expect(pions(sansTalent, 'aveugle')).toBe(4); // DR 6 plein → 1 + 3 pions
    expect(pions(porteur, 'aveugle')).toBe(0);    // jamais touché : il n'est pas ciblé
  });
});

describe('#1007 sous-point NI (arbitrage utilisateur 2026-07-31) — DR réduit sous le NI : le Sort n’affecte plus la cible', () => {
  /** Sort à État lancé sur `t`, NI requis figé — `extraTargets` étend le MÊME lancement. */
  const castState = (t: Combatant, sl: number, ni: number, extraTargets: Combatant[] = []) => {
    const w = mk('hero', 'mage');
    setBattle([w, t, ...extraTargets]);
    applyCast(useGame.getState, useGame.setState, w, t, stateSpell(), cr(sl, ni), false, false, undefined, extraTargets.length ? { extraTargets } : undefined);
  };

  it('chemin Projectile : DR 4 − 2 = 2 < NI 4 → aucune Blessure, et le feed porte les deux lignes', () => {
    const w = mk('hero', 'mage');
    const t = mk('enemy', 'orc', { traits: RM_TRAIT });
    setBattle([w, t]);
    castMissile(w, t, 4, [], 4);
    expect(t.wounds.current).toBe(30);
    expect(feed()).toMatch(/résiste à la magie \(−2 DR de Sort\)/);
    expect(feed()).toMatch(/n’atteint plus le NI sur orc : DR 2 < NI 4/);
  });

  it('DIFFÉRENTIEL Projectile : la MÊME cible sans NI requis encaisse ses 10 Blessures', () => {
    const w = mk('hero', 'mage');
    const t = mk('enemy', 'orc', { traits: RM_TRAIT });
    setBattle([w, t]);
    castMissile(w, t, 4);
    expect(t.wounds.current).toBe(30 - 10);
  });

  it('chemin Flow : DR 4 − 2 = 2 < NI 4 → 0 pion (témoin sans résistance : 3 pions)', () => {
    const resistant = mk('enemy', 'orc', { traits: RM_TRAIT });
    castState(resistant, 4, 4);
    expect(pions(resistant, 'aveugle')).toBe(0);
    expect(feed()).toMatch(/n’atteint plus le NI sur orc : DR 2 < NI 4/);
    const temoin = mk('enemy', 'gobelin');
    castState(temoin, 4, 4);
    expect(pions(temoin, 'aveugle')).toBe(3); // DR 4 → 1 + 2 pions
  });

  it('MIXTE — un même lancement : la cible résistante est regatée, l’autre reçoit tout', () => {
    const resistant = mk('enemy', 'orc', { traits: RM_TRAIT });
    const nu = mk('enemy', 'gobelin');
    castState(resistant, 4, 4, [nu]);
    expect(pions(resistant, 'aveugle')).toBe(0);
    expect(pions(nu, 'aveugle')).toBe(3);
  });
});
