import { describe, it, expect, afterEach } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { resolveCritique } from '../engine/critical';
import { inDeathCondition } from '../engine/conditions';
import { setRule, resetRule } from '../engine/policy';
import { cannotWieldTwoHanded } from '../engine/trauma';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import { recomputeLoadout } from '../engine/items';
import type { RNG } from '../engine/dice';

/**
 * #38 — BRANCHEMENTS runtime du système ALTERNATIF de Blessures d'Aux Armes (`combat-aa-blessures=aa`).
 * Prouve que le toggle change le comportement de bout en bout au SITE DE RÉSOLUTION (`applyCriticalToTarget`)
 * et à la CONDITION DE MORT (`inDeathCondition`) :
 *  - un Critique TRIVIAL (« T », AA 07 l.77-79) n'incrémente PAS `criticalWounds` (pas compté pour la mort) ;
 *  - un Coup Critique sur DOUBLE s'applique même s'il RESTE des Blessures (AA 07 l.29 ≡ LDB 13 l.183) ;
 *  - la mort par accumulation (AA 07 l.73) route par `aaDeathByCriticalCount` en mode AA.
 */
const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 't', name: 'Cible', kind: 'enemy', characteristics: CHARS, wounds: { current: 10, max: 10 }, conditions: [], skills: [], bodyShape: 'humanoide', size: 'moyenne', weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

const noop = () => {};
/** Lecture d'état minimale : hors bataille, horloge à 0 (les tests qui la sollicitent fournissent la leur). */
const getStub = (() => ({ battle: undefined, party: [], gameTime: 0 })) as never;

describe('#38 — branchements AA au site de résolution (applyCriticalToTarget)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('Critique TRIVIAL (« T », l.79) : n’incrémente PAS criticalWounds', () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk();
    // brasD d100 5 → « Choc au poignet » (01-10) = trivial « T ».
    const crit = resolveCritique('aa', target, 'brasD', seq(5), { overkill: 0 });
    expect(crit.roll).toBe(5);
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit, get: getStub });
    expect(target.criticalWounds ?? 0).toBe(0); // trivial → non compté pour la mort
  });

  it('Critique NON trivial : incrémente criticalWounds', () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk();
    // brasD d100 25 → « Coupure mineure » (21-25) = 1 Blessure (pas trivial).
    const crit = resolveCritique('aa', target, 'brasD', seq(25), { overkill: 0 });
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit, get: getStub });
    expect(target.criticalWounds ?? 0).toBe(1);
  });

  it('Coup Critique sur DOUBLE même avec PB restants (l.29) : crit appliqué, il reste des Blessures', () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk({ wounds: { current: 10, max: 10 } });
    // Coup Critique (double) sans overkill : la cible a 10 PB → le Critique s'applique quand même.
    const crit = resolveCritique('aa', target, 'brasD', seq(25), { overkill: 0 }); // 1 Blessure supplémentaire
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit, get: getStub });
    expect(target.criticalWounds ?? 0).toBe(1);          // Critique bien infligé
    expect(target.wounds.current).toBeGreaterThan(0);    // … alors qu’il RESTE des Blessures (PB > 0)
  });

  it("#125 — « Choc au bras » (l.113) appliqué de bout en bout : main inutilisable N Rounds → cannotWieldTwoHanded VRAI, PAS permanent", () => {
    seedBattleRng(3);
    setRule('combat-aa-blessures', 'aa');
    const target = mk();
    const crit = resolveCritique('aa', target, 'brasG', seq(15), { overkill: 0 }); // 11-20 → Choc au bras
    expect(target.activeEffects ?? []).toHaveLength(0); // rien avant application (l'ops n'est encore que DONNÉE)
    applyCriticalToTarget(target, 'brasG', true, 0, [], noop, { prerolled: crit, get: getStub });
    expect(cannotWieldTwoHanded(target)).toBe(true); // effet RÉEL, pas du texte arbitré
    const eff = target.activeEffects?.find((e) => e.passive?.some((op) => op.op === 'maxWeaponHands'));
    expect(eff?.duration.scale).toBe('rounds'); // TEMPORAIRE (≠ séquelle permanente 'permanent')
    if (eff?.duration.scale === 'rounds') expect(eff.duration.left).toBeGreaterThanOrEqual(1);
  });

  it('mode LDB (défaut) : un Critique trivial de la table AA n’existe pas → tout Critique compte', () => {
    seedBattleRng(1);
    // En LDB, aucune notion de trivial : le décompte incrémente toujours.
    const target = mk();
    const crit = resolveCritique('aa', target, 'brasD', seq(5), { overkill: 0 }); // table AA, mais rule=ldb → pas d’exclusion
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit, get: getStub });
    expect(target.criticalWounds ?? 0).toBe(1); // compté (le garde-fou trivial ne s’active qu’en mode AA)
  });

  // #153 — `applyCriticalToTarget` passe désormais `now: get().gameTime` à `applyOps` : sans ce fil, un
  // effet d'HORLOGE (durationHours, ex. « Exténué 1d10 jours ») calculait son échéance depuis 0 → expirait
  // IMMÉDIATEMENT dès que `purgeClockEffects` comparait à la VRAIE horloge (non nulle en cours de partie).
  it("#153 — Critique posant un effet d'HORLOGE (« Commotion cérébrale », Exténué 1d10 jours) : l'échéance est calculée depuis la VRAIE horloge de jeu, pas 0", () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk();
    const crit = resolveCritique('aa', target, 'tete', seq(78), { overkill: 0 }); // 76-80 → Commotion cérébrale
    expect(crit.label).toBe('Commotion cérébrale');
    const NOW = 5000; // horloge de jeu à un instant NON NUL (mid-partie) — le bug : ctx.now absent → 0
    const get = (() => ({ gameTime: NOW })) as never;
    applyCriticalToTarget(target, 'tete', true, 0, [], noop, { prerolled: crit, get });
    const extenue = target.conditions.find((c) => c.id === 'extenue');
    expect(extenue).toBeTruthy();
    // Durée = 1d10 jours (24-240h) → échéance toujours strictement postérieure à l'instant de pose,
    // JAMAIS antérieure à NOW (ce que produirait `ctx.now` resté à 0/undefined).
    expect(extenue!.untilTime).toBeGreaterThan(NOW);
  });

  // #153 — `applyCriticalToTarget` passe désormais `location: loc` à `applyOps` : l'op `disarm` (« Vous
  // lâchez ce que vous teniez dans cette main ») résout la MAIN affectée depuis cette localisation
  // (convention DROITIER partagée avec `handAmputated` : brasD → main, brasG → off).
  it("#153 — Critique bras (« Choc au poignet », op disarm) : la main affectée est résolue depuis la Localisation RÉELLE du coup, pas au hasard", () => {
    seedBattleRng(1);
    setRule('combat-aa-blessures', 'aa');
    const target = mk({
      items: [{ uid: 'w1', name: 'Épée', kind: 'melee', equipped: true, qualities: [], enc: 1 } as never],
      loadouts: [{ id: 'l1', main: 'w1' }] as never,
      activeLoadoutId: 'l1',
    });
    recomputeLoadout(target);
    const crit = resolveCritique('aa', target, 'brasD', seq(5), { overkill: 0 }); // 01-10 → Choc au poignet (trivial, op disarm)
    applyCriticalToTarget(target, 'brasD', true, 0, [], noop, { prerolled: crit, get: getStub });
    expect(target.loadouts![0].main).toBeUndefined(); // brasD → main → l'Épée est lâchée
  });
});

describe('#38 — mort par accumulation de Blessures Critiques (inDeathCondition, l.73)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  const dying = (cw: number): Combatant =>
    mk({ wounds: { current: 0, max: 10 }, conditions: [{ id: 'inconscient', value: 1 }] as never, criticalWounds: cw });

  it('mode AA : Inconscient + 0 PB + Blessures Critiques > BE → mort (route par aaDeathByCriticalCount)', () => {
    setRule('combat-aa-blessures', 'aa');
    expect(inDeathCondition(dying(4))).toBe(true);   // 4 > BE 3
    expect(inDeathCondition(dying(3))).toBe(false);  // 3 n’est pas > 3
    expect(inDeathCondition(mk({ wounds: { current: 5, max: 10 }, conditions: [{ id: 'inconscient', value: 1 }] as never, criticalWounds: 4 }))).toBe(false); // PB > 0
  });

  it('même formule qu’en LDB (l.34 ≡ l.73) : comportement identique', () => {
    resetRule('combat-aa-blessures');
    expect(inDeathCondition(dying(4))).toBe(true);
    expect(inDeathCondition(dying(3))).toBe(false);
  });
});
