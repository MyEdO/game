import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { resetRule, setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';

/** LDB 17 l.68 ; LDB 18 l.53 ; #1595 c.6226467544. */
const mk = (): Combatant =>
  ({
    id: 'T', name: 'Cible', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
  }) as unknown as Combatant;

describe('applyCriticalToTarget — la Localisation fournie est utilisée verbatim (résolue en amont)', () => {
  it('localisation fournie → le Critique est résolu à cette localisation', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'tete', 0, log, () => {}, { get: useGame.getState });
    expect(log.some((l) => l.includes('(Tête)'))).toBe(true); // localisation affichée en FR via locationLabel(loc, shape)
  });

  it('un Critique est bien appliqué à la localisation donnée', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'corps', 0, log, () => {}, { get: useGame.getState });
    expect(log.some((l) => l.includes('Blessure critique'))).toBe(true);
  });
});

describe('applyCriticalToTarget — libellé de localisation adapté à la forme du corps (créatures)', () => {
  it('critique sur quadrupède → localisation « (Membre antérieur droit) », jamais « (Bras droit) » humanoïde', () => {
    seedBattleRng(1);
    const log: string[] = [];
    const t = mk();
    t.bodyShape = 'quadrupede';
    applyCriticalToTarget(t, 'brasD', 0, log, () => {}, { get: useGame.getState }); // localisation fournie pour le déterminisme
    expect(log.some((l) => l.includes('(Membre antérieur droit)'))).toBe(true);
    expect(log.some((l) => l.includes('(Bras droit)'))).toBe(false);
  });
});
describe("attackSetCritLocation — « Je ne faillirai pas ! » sous (B) (LDB 17 l.68 ; #1595 c.6226467544, c.6228496170 R1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    setRule('combat-aa-blessures', 'aa');
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    resetRule('combat-aa-blessures');
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Le héros attaque une cible à `current` Blessures, et la graine fait rater son jet. */
  function attaqueRatee(current: number) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    H.resilience = 1;
    E.pos = { x: 11, y: 10 };
    E.wounds = { current, max: 30 } as never;
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    E.talents = [{ talentId: 'chanceux', times: 1 }] as never; // AA 07 l.67
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    seedBattleRng(3);
    useGame.getState().attackRoll();
    expect(useGame.getState().pendingAttack!.result!.hit, 'la graine fait rater le jet').toBe(false);
  }
  /** « Je ne faillirai pas ! » : le résultat choisi, 21, réussit sans double. */
  function forcer() {
    useGame.getState().attackForceSuccess();
    useGame.getState().attackSetForcedRoll(21);
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.hit).toBe(true);
    expect(res.critical, 'aucun double : pas de Coup Critique au jet').toBe(false);
  }

  it("'aa', cible déjà à 0 (branche 1) : le choix est accepté et le Critique tombe à la Localisation choisie", () => {
    attaqueRatee(0);
    forcer();
    useGame.getState().attackSetCritLocation('jambeG');
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.critLocation).toBe('jambeG');
    useGame.getState().attackConfirm();
    expect(res.location).toBe('jambeG');
  });

  it("'aa', passage à 0 (branche 2) : aucun choix, la Localisation reste celle du résultat choisi (R1)", () => {
    attaqueRatee(2);
    forcer();
    const touche = useGame.getState().pendingAttack!.result!.location;
    useGame.getState().attackSetCritLocation(touche === 'jambeG' ? 'jambeD' : 'jambeG');
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.critLocation).toBeUndefined();
    expect(res.location).toBe(touche);
  });

  it('sans Résilience dépensée : aucun choix', () => {
    attaqueRatee(0);
    useGame.getState().attackSetCritLocation('jambeG');
    expect(useGame.getState().pendingAttack!.result!.critLocation).toBeUndefined();
  });
});
