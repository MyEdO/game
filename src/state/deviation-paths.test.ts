/**
 * Déviation Critique RAW-complète sur les TROIS chemins de Blessure Critique (LDB 63 l.30 + LDB 18 l.53) :
 * mêlée (`applyAttackResult`), Test opposé (`applyOpposedCritical`) et Projectile magique (`appliquerTouchePourCible`
 * dans `applyCast`). Vérifie la mutualisation : l'ENNEMI dévie AUTO (rule-gated), le HÉROS blindé CHOISIT
 * (étape `self` Dévier/Subir), l'overkill (dépassement) est couvert sur la mêlée ET la magie (RAW complet,
 * LDB 63 l.30 : toute Blessure Critique en zone blindée est déviable), et l'éligibilité magique respecte
 * le bypass de Domaine (Ombres/Métal/Cieux) + les sorts `ignorePA`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult, applyOpposedCritical, applyCast, resolveDeviation } from './combatFlow';
import { evaluateMissile, magicDeviationEligible, type CastResult } from '../engine/magic';
import { seedBattleRng } from './battleRng';
import { resetRule, setRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { emptyScene } from './scene';
import { stepInteraction } from './cascade';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

const uniformArmour = (pa: number) => ({ tete: pa, brasG: pa, brasD: pa, corps: pa, jambeG: pa, jambeD: pa });
const armourSum = (c: Combatant) => Object.values(c.armour as Record<string, number>).reduce((a, b) => a + b, 0);

// Mage avec Diction instinctive → un double d'Incantation ne déclenche pas d'Imparfaite Mineure parasite
// (on isole l'étape de Déviation dans la cascade).
const mage = (kind: Combatant['kind'], id: string): Combatant =>
  mk(kind, id, { wounds: { current: 12, max: 12 } as never, talents: [{ talentId: 'diction-instinctive', times: 1 }] as never });

// Sort Projectile arcane MINIMAL (curé=non → pas de Flow d'effet) ; `damage` ADDITIF (+ DR + BFM).
const missileSpell = (over: Record<string, unknown> = {}): never =>
  ({ id: 'dard-test', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8, ...over }) as never;

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const devSteps = () => (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');
const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

// Applique un Projectile magique déjà résolu (incantation figée) via le vrai chemin `applyCast`.
function castMissile(caster: Combatant, target: Combatant, spell: never, opts: { critical: boolean; sl?: number; extraTargets?: Combatant[] }): void {
  const cr: CastResult = { cast: true, roll: 44, target: 60, sl: opts.sl ?? 2, isCritical: opts.critical, isFumble: false, log: '' };
  const mres = evaluateMissile(caster, target, spell, cr);
  applyCast(useGame.getState, useGame.setState, caster, target, spell, mres, true, false, opts.critical ? 'critique' : undefined, opts.extraTargets ? { extraTargets: opts.extraTargets } : undefined);
}

// ── Unités : éligibilité magique + recalcul à PA−1 ────────────────────────────
describe('magicDeviationEligible — éligibilité d\'un Projectile (LDB 63 l.30)', () => {
  const caster = mage('enemy', 'C');
  const cr: CastResult = { cast: true, roll: 44, target: 60, sl: 2, isCritical: true, isFumble: false, log: '' };

  it('sort sans Domaine, armure mitigante → éligible (+ extraWounds ≥ 1 au recalcul PA−1)', () => {
    const t = mk('hero', 'T', { armour: uniformArmour(4) });
    const r = magicDeviationEligible(caster, t, 'corps', missileSpell(), cr, 6, 0);
    expect(r.eligible).toBe(true);
    expect(r.extraWounds).toBeGreaterThanOrEqual(1);
  });

  it('sort `ignorePA` (ex. Drain) → NON éligible (l\'armure n\'absorbe rien)', () => {
    const t = mk('hero', 'T', { armour: uniformArmour(4) });
    expect(magicDeviationEligible(caster, t, 'corps', missileSpell({ ignorePA: true }), cr, 6, 0).eligible).toBe(false);
  });

  it('Domaine Ombres (ignore tout PA non magique) → bypass TOTAL → NON éligible', () => {
    const t = mk('hero', 'T', { armour: uniformArmour(4) }); // armure de statbloc = non magique
    expect(magicDeviationEligible(caster, t, 'corps', missileSpell({ domainId: 'ombres' }), cr, 6, 0).eligible).toBe(false);
  });

  it('Domaine Métal vs armure NON métallique (statbloc) → ne bypass pas → éligible', () => {
    const t = mk('hero', 'T', { armour: uniformArmour(4) });
    expect(magicDeviationEligible(caster, t, 'corps', missileSpell({ domainId: 'metal' }), cr, 6, 0).eligible).toBe(true);
  });

  it('Domaine Métal vs cotte de MAILLES portée → bypass TOTAL → NON éligible', () => {
    const t = mk('hero', 'T', {
      armour: uniformArmour(4),
      items: [{ uid: 'mail', name: 'Cotte de mailles', kind: 'armor', equipped: true, pa: 4, locs: ['corps'], subType: 'mailles', qualities: [] } as never],
    });
    expect(magicDeviationEligible(caster, t, 'corps', missileSpell({ domainId: 'metal' }), cr, 6, 0).eligible).toBe(false);
  });

  it('evaluateMissile(apReduction:1) → exactement 1 Blessure de plus quand la PA mitige (recalcul Déviation)', () => {
    const t = mk('hero', 'T', { armour: uniformArmour(4) });
    const a0 = evaluateMissile(caster, t, missileSpell(), cr, 'corps', 0).woundsLost ?? 0;
    const a1 = evaluateMissile(caster, t, missileSpell(), cr, 'corps', 1).woundsLost ?? 0;
    expect(a1 - a0).toBe(1);
  });

  // Régression : `magicDeviationEligible` doit recalculer PA−1 avec le MÊME `overcastDamageSteps`
  // que celui déjà reflété dans `woundsAtFullPA` par l'appelant (`combatFlow.ts` appliquerTouchePourCible) —
  // sinon le pas de Dégâts alloué (Surincantation VDM, `VDM 02 l.198`) annule à tort l'écart PA−1.
  it('avec des pas de Dégâts alloués (Surincantation VDM) → même extraWounds qu\'à 0 pas', () => {
    setRule('magic-vdm-incantation', true);
    try {
      const t = mk('hero', 'T', { armour: uniformArmour(4) });
      const woundsNoSteps = evaluateMissile(caster, t, missileSpell(), cr, 'corps', 0, 0).woundsLost ?? 0;
      const woundsWithSteps = evaluateMissile(caster, t, missileSpell(), cr, 'corps', 0, 3).woundsLost ?? 0;
      const r0 = magicDeviationEligible(caster, t, 'corps', missileSpell(), cr, woundsNoSteps, 0);
      const r3 = magicDeviationEligible(caster, t, 'corps', missileSpell(), cr, woundsWithSteps, 3);
      expect(r0.eligible).toBe(true);
      expect(r3.eligible).toBe(true);
      expect(r3.extraWounds).toBe(r0.extraWounds);
      expect(r3.extraWounds).toBeGreaterThanOrEqual(1);
    } finally {
      resetRule('magic-vdm-incantation');
    }
  });
});

// ── Chemin opposé : HÉROS blindé → étape `self` (Dévier/Subir) ─────────────────
describe('Test opposé — HÉROS blindé : étape de déviation `self` (LDB 14 l.3 + 63 l.30)', () => {
  beforeEach(() => seedBattleRng(7));
  afterEach(() => resetRule('combat-critical-deflect'));

  it('héros victime AVEC armure → pousse une étape `self` (Critique « sec », overkill 0)', () => {
    const v = mk('hero', 'V', { armour: uniformArmour(3) });
    setBattle([v]);
    applyOpposedCritical(useGame.getState, useGame.setState, v, 11, {}, []);
    const dev = devSteps()[0]?.deviation;
    expect(dev?.mode).toBe('self');
    if (dev?.mode === 'self') {
      expect(dev.isCoupCritique).toBe(true);
      expect(dev.overkill).toBe(0);
      expect(dev.deflectExtraWounds).toBe(0);
    }
    expect(live('V').criticalWounds ?? 0).toBe(0); // suspendu : application différée à ce stade
  });

  it('« Dévier » → −1 PA, Critique ignoré (criticalWounds inchangé)', () => {
    const v = mk('hero', 'V', { armour: uniformArmour(3) });
    setBattle([v]);
    applyOpposedCritical(useGame.getState, useGame.setState, v, 11, {}, []);
    resolveDeviation(useGame.getState, useGame.setState, devSteps()[0].deviation!, true);
    expect(armourSum(live('V'))).toBe(17); // 18 − 1
    expect(live('V').criticalWounds ?? 0).toBe(0);
  });

  it('« Subir » → Critique appliqué (criticalWounds +1, PA intacte)', () => {
    const v = mk('hero', 'V', { armour: uniformArmour(3) });
    setBattle([v]);
    applyOpposedCritical(useGame.getState, useGame.setState, v, 11, {}, []);
    resolveDeviation(useGame.getState, useGame.setState, devSteps()[0].deviation!, false);
    expect(armourSum(live('V'))).toBe(18); // PA intacte
    expect(live('V').criticalWounds ?? 0).toBe(1);
  });
});

// ── Chemin magie : HÉROS blindé (Dévier/Subir) + ENNEMI auto + multi-cibles ───
describe('Projectile magique — Déviation Critique (LDB 46 l.30 + 63 l.30)', () => {
  beforeEach(() => seedBattleRng(99));
  afterEach(() => resetRule('combat-critical-deflect'));

  it('HÉROS blindé : Incantation Critique → étape `self` (deflectExtraWounds + woundsBefore figés)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    const dev = devSteps()[0]?.deviation;
    expect(dev?.mode).toBe('self');
    if (dev?.mode === 'self') {
      expect(dev.deflectExtraWounds).toBe(1);   // recalcul PA−1 = +1 Blessure
      expect(dev.woundsBefore).toBe(30);        // PB AVANT le coup (restauration Destin correcte)
      expect(dev.overkill).toBe(0);             // magie : Critique « sec » sur Subir
    }
    expect(live('h-cible').wounds.current).toBe(24); // Dégâts de base déjà appliqués (6)
    expect(live('h-cible').criticalWounds ?? 0).toBe(0);
  });

  it('HÉROS « Dévier » → −1 PA + Blessures recalculées, Critique ignoré', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    resolveDeviation(useGame.getState, useGame.setState, devSteps()[0].deviation!, true);
    const h = live('h-cible');
    expect(armourSum(h)).toBe(23);          // 24 − 1 PA sacrifié
    expect(h.wounds.current).toBe(23);      // 24 (base) − 1 (extra du recalcul PA−1)
    expect(h.criticalWounds ?? 0).toBe(0);  // Critique dévié
  });

  it('HÉROS « Subir » → Critique appliqué (criticalWounds +1)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    resolveDeviation(useGame.getState, useGame.setState, devSteps()[0].deviation!, false);
    expect(live('h-cible').criticalWounds ?? 0).toBe(1);
  });

  it('ENNEMI blindé : Incantation Critique → dévie AUTO (−1 PA, Critique ignoré, AUCUNE étape)', () => {
    const caster = mage('hero', 'h-mage');
    const t = mk('enemy', 'e-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    expect(devSteps().length).toBe(0);          // pas de choix : auto
    expect(armourSum(live('e-cible'))).toBe(23); // 24 − 1
    expect(live('e-cible').criticalWounds ?? 0).toBe(0);
  });

  it('ENNEMI : règle OFF → ne dévie PLUS, subit le Critique (criticalWounds +1, PA intacte)', () => {
    setRule('combat-critical-deflect', false);
    const caster = mage('hero', 'h-mage');
    const t = mk('enemy', 'e-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    expect(armourSum(live('e-cible'))).toBe(24); // PA intacte
    expect(live('e-cible').criticalWounds ?? 0).toBe(1);
  });

  it('multi-cibles (Surincantation) : 2 héros blindés → 2 étapes `self` INDÉPENDANTES', () => {
    const caster = mage('enemy', 'e-mage');
    const t1 = mk('hero', 'h1', { armour: uniformArmour(4) });
    const t2 = mk('hero', 'h2', { armour: uniformArmour(4) });
    setBattle([caster, t1, t2]);
    castMissile(caster, t1, missileSpell(), { critical: true, extraTargets: [t2] });
    const steps = devSteps();
    expect(steps.length).toBe(2);
    expect(steps.every((s) => s.deviation?.mode === 'self')).toBe(true);
    expect(new Set(steps.map((s) => s.deviation!.targetId))).toEqual(new Set(['h1', 'h2']));
  });

  it('OVERKILL (dépassement) héros blindé, sans double → étape `self` (isCoupCritique:false, overkill>0)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4), wounds: { current: 5, max: 30 } as never });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false }); // non-double → dépassement seul (5 PB < 6 dégâts)
    const dev = devSteps()[0]?.deviation;
    expect(dev?.mode).toBe('self');
    if (dev?.mode === 'self') {
      expect(dev.isCoupCritique).toBe(false);    // dépassement, PAS un double
      expect(dev.overkill).toBeGreaterThan(0);   // le Critique d'overkill garde sa sévérité
    }
    expect(live('h-cible').criticalWounds ?? 0).toBe(0); // suspendu
  });

  it('OVERKILL héros « Subir » → Blessure Critique de dépassement appliquée (criticalWounds +1)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4), wounds: { current: 5, max: 30 } as never });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false });
    resolveDeviation(useGame.getState, useGame.setState, devSteps()[0].deviation!, false);
    expect(live('h-cible').criticalWounds ?? 0).toBe(1);
  });

  it('OVERKILL héros « Dévier » → −1 PA, Critique de dépassement ignoré', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4), wounds: { current: 5, max: 30 } as never });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false });
    resolveDeviation(useGame.getState, useGame.setState, devSteps()[0].deviation!, true);
    expect(armourSum(live('h-cible'))).toBe(23); // 24 − 1
    expect(live('h-cible').criticalWounds ?? 0).toBe(0);
  });

  it('OVERKILL ennemi blindé, sans double → dévie AUTO (−1 PA, Critique ignoré, AUCUNE étape)', () => {
    const caster = mage('hero', 'h-mage');
    const t = mk('enemy', 'e-cible', { armour: uniformArmour(4), wounds: { current: 5, max: 30 } as never });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false });
    expect(devSteps().length).toBe(0);
    expect(armourSum(live('e-cible'))).toBe(23);
    expect(live('e-cible').criticalWounds ?? 0).toBe(0);
  });

  it('HÉROS blindé, règle `combat-critical-deflect` OFF → AUCUN step (Critique subi direct)', () => {
    setRule('combat-critical-deflect', false);
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    expect(devSteps().length).toBe(0);
    expect(live('h-cible').criticalWounds ?? 0).toBe(1);
  });
});

/** LANCE le d100 de sévérité DANS la fenêtre ouverte (chemin MÊLÉE, où la table LDB est déclarée) : la
 *  MÊME étape passe de `'table'` à `'choix'`, et le PLI post-dé y pose le Critique. */
function tireLaSeverite() {
  const st = devSteps();
  expect(st, 'une seule étape porte le tirage ET la décision').toHaveLength(1);
  useGame.getState().cascadeTableRoll(st[0].id);
  const apres = devSteps()[0];
  expect(stepInteraction(apres)).toBe('choix');
  expect(apres.deviation?.crit, 'le pli post-dé n’a pas posé le Critique').toBeTruthy();
  return apres;
}

// ── Mêlée : overkill (dépassement) couvert par la Déviation ───────────────────
describe('Mêlée — Déviation sur dépassement (overkill, LDB 18 l.53 + 63 l.30)', () => {
  beforeEach(() => seedBattleRng(31));
  afterEach(() => resetRule('combat-critical-deflect'));

  const weapon: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
  // Dépassement (≠ double) : woundsLost > PB courants, `critical:false`.
  const overkillRes = (): AttackResult =>
    ({ hit: true, attackerRoll: 30, netSL: 2, location: 'corps', damage: 12, woundsLost: 8, critical: false, advantageTo: null, defenderDefeated: false, log: 'dépassement (corps)' });

  it('héros blindé subissant un dépassement → SUSPEND (étape `melee`)', () => {
    const e = mk('enemy', 'e1', { weapons: [weapon], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { armour: { ...uniformArmour(0), corps: 3 }, wounds: { current: 3, max: 15 } as never });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, weapon, overkillRes());
    expect(suspended).toBe(true);
    // UNE étape porte le tirage de sévérité ET les voies — jamais deux fenêtres pour le même coup.
    expect(devSteps()).toHaveLength(1);
    expect(devSteps()[0].table, 'la sévérité se tire DANS cette fenêtre').toBeTruthy();
    expect(stepInteraction(devSteps()[0])).toBe('table');
    expect(devSteps()[0].options?.map((o) => o.key)).toEqual(['devier', 'subir']);
    expect(tireLaSeverite().deviation!.mode).toBe('melee');
  });

  it('« Dévier » sur dépassement → −1 PA, pas de Blessure Critique (À Terre à 0 PB quand même)', () => {
    const e = mk('enemy', 'e1', { weapons: [weapon], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { armour: { ...uniformArmour(0), corps: 3 }, wounds: { current: 3, max: 15 } as never });
    setBattle([e, h]);
    applyAttackResult(useGame.getState, useGame.setState, e, h, weapon, overkillRes());
    resolveDeviation(useGame.getState, useGame.setState, tireLaSeverite().deviation!, true);
    const hh = live('h1');
    expect(hh.armour.corps).toBe(2);          // 1 PA sacrifié
    expect(hh.criticalWounds ?? 0).toBe(0);   // Blessure Critique de dépassement ignorée
  });

  it('« Subir » sur dépassement → Blessure Critique appliquée (criticalWounds +1)', () => {
    const e = mk('enemy', 'e1', { weapons: [weapon], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { armour: { ...uniformArmour(0), corps: 3 }, wounds: { current: 3, max: 15 } as never });
    setBattle([e, h]);
    applyAttackResult(useGame.getState, useGame.setState, e, h, weapon, overkillRes());
    resolveDeviation(useGame.getState, useGame.setState, tireLaSeverite().deviation!, false);
    expect(live('h1').criticalWounds ?? 0).toBe(1);
  });
});
