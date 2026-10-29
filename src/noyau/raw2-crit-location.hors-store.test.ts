import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { locationLabel, type Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { resetRule, setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

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
    applyCriticalToTarget(mk(), 'tete', 0, log, () => {}, { get: banc.getState });
    expect(log.some((l) => l.includes('(Tête)'))).toBe(true); // localisation affichée en FR via locationLabel(loc, shape)
  });

  it('un Critique est bien appliqué à la localisation donnée', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'corps', 0, log, () => {}, { get: banc.getState });
    expect(log.some((l) => l.includes('Blessure critique'))).toBe(true);
  });
});

describe('applyCriticalToTarget — libellé de localisation adapté à la forme du corps (créatures)', () => {
  it('critique sur quadrupède → localisation « (Membre antérieur droit) », jamais « (Bras droit) » humanoïde', () => {
    seedBattleRng(1);
    const log: string[] = [];
    const t = mk();
    t.bodyShape = 'quadrupede';
    applyCriticalToTarget(t, 'brasD', 0, log, () => {}, { get: banc.getState }); // localisation fournie pour le déterminisme
    expect(log.some((l) => l.includes('(Membre antérieur droit)'))).toBe(true);
    expect(log.some((l) => l.includes('(Bras droit)'))).toBe(false);
  });
});
describe("attackSetCritLocation — « Je ne faillirai pas ! » sous (B) (LDB 17 l.68 ; #1595 c.6226467544, c.6228496170 R1)", () => {
  beforeEach(() => {
    setRule('combat-aa-blessures', 'aa');
    banc.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    resetRule('combat-aa-blessures');
  });

  /** Le héros attaque une cible à `current` Blessures, `paBrasG` PA au Bras gauche et `autresPA` ailleurs, `chanceux` ou sous Mort subite ; la graine fait rater son jet. */
  function attaqueRatee(current: number, paBrasG = 0, autresPA = 0, chanceux = true) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    H.resilience = 1;
    E.pos = { x: 11, y: 10 };
    E.wounds = { current, max: 30 } as never;
    E.armour = { tete: autresPA, brasG: paBrasG, brasD: autresPA, corps: autresPA, jambeG: autresPA, jambeD: autresPA };
    E.talents = chanceux ? [{ talentId: 'chanceux', times: 1 }] as never : []; // AA 07 l.67
    banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, movedPreAction: false, acted: false } });
    banc.getState().battleClickEntity(E.id, { confirm: true });
    seedBattleRng(3);
    banc.getState().attackRoll();
    expect(banc.getState().pendingAttack!.result!.hit, 'la graine fait rater le jet').toBe(false);
  }
  /** « Je ne faillirai pas ! » : le résultat choisi réussit sans double. */
  function forcer(valeur = 21) {
    banc.getState().attackForceSuccess();
    banc.getState().attackSetForcedRoll(valeur);
    const res = banc.getState().pendingAttack!.result!;
    expect(res.hit).toBe(true);
    expect(res.critical, 'aucun double : pas de Coup Critique au jet').toBe(false);
  }

  it("'aa', cible déjà à 0 (branche 1) : le choix est accepté et le Critique tombe à la Localisation choisie", () => {
    attaqueRatee(0);
    forcer();
    banc.getState().attackSetCritLocation('jambeG');
    const res = banc.getState().pendingAttack!.result!;
    expect(res.critLocation).toBe('jambeG');
    banc.getState().attackConfirm();
    expect(res.location).toBe('jambeG');
  });

  it("'aa', passage à 0 (branche 2), résultat choisi 32 : le Critique tombe au Bras gauche, à ses PA, sans d100 choisi (R1 ; LDB 13 l.133)", () => {
    /** Le coup forcé à 32, `pa` PA au Bras gauche et 9 ailleurs, et la cible après le coup. */
    const coup = (pa: number) => {
      attaqueRatee(2, pa, 9);
      forcer(32);
      const E = banc.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
      const res = banc.getState().pendingAttack!.result!;
      expect(res.location, 'le jet inversé, 23, est le Bras gauche').toBe('brasG');
      banc.getState().attackSetCritLocation('jambeG');
      expect(res.critLocation, 'aucun d100 de Localisation à choisir').toBeUndefined();
      banc.getState().attackConfirm();
      const critiques = (banc.getState().battle?.log ?? []).map((l) => l.text).filter((t) => t.startsWith('Blessure critique'));
      return { res, cible: E, critiques };
    };
    const nu = coup(0);
    expect(nu.res.woundsLost!, 'le coup suffit à passer à 0').toBeGreaterThanOrEqual(2);
    expect(nu.cible.wounds.current, 'la cible est tombée à 0').toBe(0);
    expect(nu.cible.criticalWounds, 'une seule Blessure critique (AA 07 l.42)').toBe(1);
    expect(nu.critiques).toHaveLength(1);
    expect(nu.critiques[0], 'le Critique tombe au Bras gauche').toContain(`(${locationLabel('brasG', nu.cible.bodyShape)})`);
    const arme = coup(3);
    expect(arme.res.woundsLost!, 'les PA lues sont celles du Bras gauche').toBeLessThan(nu.res.woundsLost!);
  });

  it('sans Résilience dépensée : aucun choix', () => {
    attaqueRatee(0);
    banc.getState().attackSetCritLocation('jambeG');
    expect(banc.getState().pendingAttack!.result!.critLocation).toBeUndefined();
  });

  it('cible sous Mort subite, double forcé : aucun choix (LDB 18 l.44 ; AA 07 l.65 ; #1595 c.6219992594)', () => {
    attaqueRatee(20, 0, 0, false);
    banc.getState().attackForceSuccess();
    banc.getState().attackSetForcedRoll(11);
    expect(banc.getState().pendingAttack!.result!.critical, 'précondition : le double fait le Coup Critique au jet').toBe(true);
    banc.getState().attackSetCritLocation('tete');
    expect(banc.getState().pendingAttack!.result!.critLocation).toBeUndefined();
  });
});
