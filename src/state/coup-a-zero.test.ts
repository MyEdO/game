import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { TestResult } from '../engine/tests';
import { useGame } from './store';
import { spawnEnemy } from './spawn';
import { seedBattleRng } from './battleRng';
import { applyAttackResult } from './combatFlow';
import { emptyScene } from './scene';
import { createHero } from '../engine/character';
import { recomputeLoadout } from '../engine/items';
import { rederivePassiveAttack } from '../engine/combat';
import { isOutOfAction, hasCondition } from '../engine/conditions';
import { critiquesDuCoup, relanceLaLocalisation } from '../engine/critical';
import { setRule, resetRule } from '../engine/policy';
import { t } from '../i18n';

/**
 * Coup qui touche une cible à 0 Blessure, ou qui l'y amène : navire (MDG 13 l.656, l.674), bateau fluvial
 * (MSRC 07 l.46, l.74), véhicule routier (EDOC 07 l.334), Personnage selon `combat-aa-blessures`
 * (LDB 18 l.17, l.46 ; AA 07 l.36, l.65).
 */
const canon: Weapon = { label: 'Canon', type: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [] } as unknown as Weapon;
const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] } as unknown as Weapon;
const sansDouble: TestResult = { roll: 6, target: 70, success: true, sl: 5, isDouble: false } as TestResult;

const coque = (ref: string, id: string, current: number): Combatant => {
  const c = spawnEnemy({ ref }, id, { x: 9, y: 5 });
  c.wounds = { ...c.wounds, current };
  return c;
};
const tireur = (): Combatant => {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Tireur', seed: 1 });
  h.pos = { x: 5, y: 5 };
  return h;
};
const touche = (woundsLost: number, over: Partial<AttackResult> = {}): AttackResult => ({
  hit: true, attackerRoll: 41, netSL: 2, location: 'corps', damage: woundsLost, woundsLost,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'touche', ...over,
}) as AttackResult;

const poser = (combatants: Combatant[]): void => {
  useGame.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: combatants.filter((c) => c.kind === 'hero'), scene: emptyScene(20, 20), travelPlan: null, facing: {}, vessel: null,
    journal: [], pendingCascade: null, suspendedCascades: [],
  } as never);
};
/** Résout la fenêtre de Blessure critique empilée par le coup (dé de sévérité, Mort subite). */
const vider = (): void => {
  if (!useGame.getState().pendingCascade) return;
  useGame.getState().cascadeResolveAll();
  useGame.getState().cascadeFinish();
};
const enJeu = (id: string): Combatant | undefined => useGame.getState().battle?.combatants.find((c) => c.id === id);
const journal = (): string => (useGame.getState().battle?.log ?? []).map((e) => (typeof e === 'string' ? e : (e as { text?: string }).text ?? '')).join('\n')
  + '\n' + JSON.stringify(useGame.getState().pendingCascade ?? null);

describe('coup sur une coque à 0 Blessure', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(7); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('un navire à 0 reste en jeu et ciblable ; tout coup qui le touche est un Critique (MDG 13 l.656)', () => {
    const h = tireur();
    const nav = coque('cogue', 'nav', 0);
    poser([h, nav]);
    expect(isOutOfAction(nav)).toBe(false);
    const res = rederivePassiveAttack(h, nav, canon, sansDouble, 'ranged');
    expect(res.hit).toBe(true);
    expect(res.critical, 'le Coup Critique seul').toBe(false);
    const avant = nav.criticalWounds ?? 0;
    applyAttackResult(useGame.getState, useGame.setState, h, nav, canon, res);
    expect(enJeu('nav'), 'la coque à 0 reste au combat').toBeTruthy();
    expect(enJeu('nav')!.criticalWounds ?? 0, 'le Critique de navire est appliqué à la coque').toBe(avant + 1);
    expect(journal()).not.toContain(t('cf.coqueSansCritique', { name: nav.label }));
  });

  it('contrôle : un navire au-dessus de 0, coup sans double → pas de Critique', () => {
    const h = tireur();
    const nav = coque('cogue', 'nav', 20);
    poser([h, nav]);
    expect(rederivePassiveAttack(h, nav, canon, sansDouble, 'ranged').critical).toBe(false);
  });

  it('un chariot à 0 ne prend pas de Critique (EDOC 07 l.334), même sur un double', () => {
    const h = tireur();
    const dil = coque('diligence', 'dil', 0);
    poser([h, dil]);
    const aZero = (c: Combatant) => critiquesDuCoup(c, { coupCritique: null, prise: true, current: 0, touche: true, relance: relanceLaLocalisation(c, { coupCritique: null, prise: true, current: 0 }), blessures: 0 }).critiques.length;
    expect(aZero(dil)).toBe(0);
    expect(aZero(coque('cogue', 'nav', 0)), 'contrôle : le navire à 0').toBe(1);
    expect(rederivePassiveAttack(h, dil, canon, sansDouble, 'ranged').critical).toBe(false);
    const avant = dil.criticalWounds;
    applyAttackResult(useGame.getState, useGame.setState, h, dil, canon, touche(3, { critical: true, attackerRoll: 22 }));
    const apres = enJeu('dil')!;
    expect(apres.criticalWounds).toBe(avant);
    expect(journal()).toContain(t('cf.coqueSansCritique', { name: dil.label }));
  });

  it('verrou MSRC 07 l.46, l.74 : barge à 5/60, coup sans double qui en retire 56 → aucun Critique ; le suivant, si', () => {
    const h = tireur();
    const barge = coque('barge-fluviale', 'barge', 5);
    poser([h, barge]);
    expect(barge.wounds.max).toBe(60);
    applyAttackResult(useGame.getState, useGame.setState, h, barge, canon, touche(56));
    const apres = enJeu('barge')!;
    expect(apres.wounds.current).toBe(0);
    expect(apres.criticalWounds ?? 0).toBe(0);
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(isOutOfAction(apres)).toBe(false);
    expect(critiquesDuCoup(apres, { coupCritique: null, prise: true, current: 0, touche: true, relance: relanceLaLocalisation(apres, { coupCritique: null, prise: true, current: 0 }), blessures: 0 }).critiques.map((c) => c.origine), 'à 0 : chaque nouveau coup est Critique').toEqual(['a-zero']);
  });
});

describe('Personnage : Critique par les Blessures et Mort subite selon combat-aa-blessures', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(7); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  const figurant = (current: number): Combatant => {
    const f = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Figurant', seed: 2 });
    f.id = 'fig'; f.kind = 'enemy'; f.important = false; f.pos = { x: 6, y: 5 };
    f.items = []; f.loadouts = undefined; f.activeLoadoutId = undefined; recomputeLoadout(f); // sans armure : aucune Déviation (LDB 63 l.30)
    f.wounds = { ...f.wounds, current };
    return f;
  };

  it("'aa' : un coup qui amène à 0 exact met le figurant hors de combat par la Mort subite, sans Critique (AA 07 l.65)", () => {
    setRule('combat-aa-blessures', 'aa');
    const h = tireur(); const f = figurant(5);
    poser([h, f]);
    applyAttackResult(useGame.getState, useGame.setState, h, f, hache, touche(5));
    vider();
    const apres = enJeu('fig')!;
    expect(apres.wounds.current).toBe(0);
    expect(apres.criticalWounds ?? 0).toBe(0);
    expect(isOutOfAction(apres)).toBe(true);
  });

  it("'ldb' : à 0 exact, pas de dépassement (LDB 18 l.17, l.46) → À Terre, en jeu", () => {
    const h = tireur(); const f = figurant(5);
    poser([h, f]);
    applyAttackResult(useGame.getState, useGame.setState, h, f, hache, touche(5));
    vider();
    const apres = enJeu('fig')!;
    expect(apres.wounds.current).toBe(0);
    expect(hasCondition(apres, 'inconscient')).toBe(false);
    expect(isOutOfAction(apres)).toBe(false);
  });

  it("'ldb' : le dépassement ouvre la Mort subite du figurant (contrôle)", () => {
    const h = tireur(); const f = figurant(5);
    poser([h, f]);
    applyAttackResult(useGame.getState, useGame.setState, h, f, hache, touche(6));
    vider();
    expect(isOutOfAction(enJeu('fig')!)).toBe(true);
  });
});
