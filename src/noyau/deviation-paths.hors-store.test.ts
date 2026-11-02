/**
 * Déviation Critique RAW-complète sur les TROIS chemins de Blessure Critique (LDB 63 l.30 + LDB 18 l.53) :
 * mêlée (`applyAttackResult`), Test opposé (`applyOpposedCritical`) et Projectile magique (`appliquerTouchePourCible`
 * dans `applyCast`). Vérifie la mutualisation : l'ENNEMI dévie AUTO (rule-gated), le HÉROS blindé CHOISIT
 * (étape Dévier/Subir), l'overkill (dépassement) est couvert sur la mêlée ET la magie (RAW complet,
 * LDB 63 l.30 : toute Blessure Critique en zone blindée est déviable), et la déviabilité d'un Projectile se
 * lit sur la pièce, comme en mêlée (LDB 63 l.13 ; #1595 c.6232294713).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import type { CombatEventCtx } from './combatEvents';
import { hasCondition, COND } from '../engine/conditions';
import { applyAttackResult, applyOpposedCritical, applyCast, resolveDeviation } from './combatFlow';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import { critWoundLocation, critTableRows, critTableKeyFor, critImmediateSummary } from '../engine/critical';
import { resetRule, setRule } from '../engine/policy';
import { locationLabel, type Combatant, type HitLocation, type Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { emptyScene } from './monde/scene';
import { stepInteraction } from './cascade';
import { OPS_DIFFEREES } from './combatEffects';
import { draineCascade } from './cascade.testkit';
import { t as tr } from '../i18n';
import { avecLesTables } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import { LOCALISATIONS_DE_COUP } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, kind, important: true /* LDB 18 l.44 : hors Mort subite */, characteristics: { ...CHARS },
    wounds: blessuresDeBase(30), advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant);

const uniformArmour = (pa: number) => ({ tete: pa, brasG: pa, brasD: pa, corps: pa, jambeG: pa, jambeD: pa });
const armourSum = (c: Combatant) => Object.values(c.armour as Record<string, number>).reduce((a, b) => a + b, 0);

// Mage avec Diction instinctive → un double d'Incantation ne déclenche pas d'Imparfaite Mineure parasite
// (on isole l'étape de Déviation dans la cascade).
const mage = (kind: Combatant['kind'], id: string): Combatant =>
  mk(kind, id, { wounds: blessuresDeBase(12), talents: [{ talentId: 'diction-instinctive', times: 1 }] as never });

// Sort Projectile arcane MINIMAL (curé=non → pas de Flow d'effet) ; `damage` ADDITIF (+ DR + BFM).
const missileSpell = (over: Record<string, unknown> = {}): never =>
  ({ id: 'dard-test', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8, ...over }) as never;

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const devSteps = () => (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');
const live = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

// Applique un Projectile magique déjà résolu (incantation figée) via le vrai chemin `applyCast`.
function castMissile(caster: Combatant, target: Combatant, spell: never, opts: { critical: boolean; sl?: number; extraTargets?: Combatant[] }): void {
  const cr: CastResult = { cast: true, roll: 44, target: 60, sl: opts.sl ?? 2, isCritical: opts.critical, isFumble: false, log: '' };
  const mres = evaluateMissile(caster, target, spell, cr);
  applyCast(banc.getState, banc.setState, caster, target, spell, mres, true, false, opts.critical ? 'critique' : undefined, opts.extraTargets ? { extraTargets: opts.extraTargets } : undefined);
}

// ── Projectile : la Déviation se lit sur la pièce, comme en mêlée ─────────────
// LDB 63 l.13, l.30, l.32 ; LDB 48 l.399 ; #1595 c.6232294713.
describe('Projectile magique — Déviation lue sur la pièce (LDB 63 l.13, l.30, l.32 ; #1595 c.6232294713)', () => {
  beforeEach(() => seedBattleRng(99));
  const cr: CastResult = { cast: true, roll: 44, target: 60, sl: 2, isCritical: true, isFumble: false, log: '' };
  const mailles = (): Partial<Combatant> => ({
    armour: uniformArmour(4),
    items: [{ uid: 'mail', name: 'Cotte de mailles', kind: 'armor', equipped: true, pa: 4, locs: [...LOCALISATIONS_DE_COUP], subType: 'mailles', qualities: [] } as never],
  });
  /** Les voies de la fenêtre ouverte par l'Incantation critique du Projectile `spell` sur le héros `t`. */
  const voies = (t: Combatant, spell: never) => {
    setBattle([mage('enemy', 'e-mage'), t]);
    castMissile(live('e-mage'), t, spell, { critical: true });
    return devSteps()[0]?.options?.map((o) => o.key);
  };
  /** Les PB du héros `t` après « Dévier », et les Blessures du coup à PA pleins. */
  const devie = (t: Combatant, spell: never) => {
    const caster = mage('enemy', 'e-mage');
    const aPleinesPA = evaluateMissile(caster, t, spell, cr).woundsLost ?? 0;
    setBattle([caster, t]);
    castMissile(caster, t, spell, { critical: true });
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, true);
    return { aPleinesPA, cible: live(t.id) };
  };

  it('D1 sort `ignorePA`, pièce sacrifiable : la fenêtre offre la Déviation', () => {
    expect(voies(mk('hero', 'T', { armour: uniformArmour(4) }), missileSpell({ ignorePA: true }))).toEqual(['devier', 'subir']);
  });

  it('D2 Domaine des Ombres, pièce non magique : la fenêtre offre la Déviation', () => {
    expect(voies(mk('hero', 'T', { armour: uniformArmour(4) }), missileSpell({ domainId: 'ombres' }))).toEqual(['devier', 'subir']);
  });

  it('D3 aucune pièce à la Localisation : la fenêtre ne porte que le dé', () => {
    expect(voies(mk('hero', 'T'), missileSpell())).toBeUndefined();
  });

  it('F5 sort `ignorePA` dévié : la pièce perd 1 PA, Blessure supplémentaire 0', () => {
    const { aPleinesPA, cible } = devie(mk('hero', 'T', { armour: uniformArmour(4) }), missileSpell({ ignorePA: true }));
    expect(aPleinesPA).toBeGreaterThan(0);
    expect(armourSum(cible)).toBe(23);
    expect(cible.wounds.current).toBe(30 - aPleinesPA);
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  it("F5' Métal contre mailles, dévié : les Blessures du coup restent celles de la frappe (LDB 48 l.399)", () => {
    const caster = mage('enemy', 'e-mage');
    const sansDomaine = evaluateMissile(caster, mk('hero', 'T', mailles()), missileSpell(), cr).woundsLost ?? 0;
    const { aPleinesPA, cible } = devie(mk('hero', 'T', mailles()), missileSpell({ domainId: 'metal' }));
    expect(aPleinesPA, 'le Métal ignore les mailles et ajoute leurs PA').toBeGreaterThan(sansDomaine);
    expect(cible.wounds.current).toBe(30 - aPleinesPA);
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  // LDB 63 l.30, l.32 ; LDB 18 l.53 ; #1595 c.6240485441 Q1.
  it('F6 Critique dévié : la ligne de table ne retire aucun PB, seules les Blessures du coup tombent', () => {
    const spell = missileSpell({ ignorePA: true });
    const tranche = (devier: boolean) => {
      const caster = mage('enemy', 'e-mage');
      const t = mk('hero', 'T', { armour: uniformArmour(4) });
      const aPleinesPA = evaluateMissile(caster, t, spell, cr).woundsLost ?? 0;
      setBattle([caster, t]);
      castMissile(caster, t, spell, { critical: true });
      const [etape] = devSteps();
      const ligne = critTableRows('ldb', critTableKeyFor(etape.critSeverity!.location))
        .filter((e) => !e.lethal)
        .reduce((a, e) => (critImmediateSummary(e.ops ?? []).woundsLost > critImmediateSummary(a.ops ?? []).woundsLost ? e : a));
      banc.getState().cascadeTableSetForcedRoll(etape.id, ligne.max - (etape.table?.mod ?? 0));
      const dev = devSteps()[0].deviation!;
      expect(dev.crit.entryId, 'le dé posé atteint la ligne choisie').toBe(ligne.id);
      resolveDeviation(banc.getState, banc.setState, dev, devier);
      return { aPleinesPA, perte: critImmediateSummary(ligne.ops ?? []).woundsLost, cible: live('T') };
    };
    const subi = tranche(false);
    expect(subi.perte, 'la ligne retire des PB').toBeGreaterThan(0);
    expect(subi.cible.wounds.current).toBe(30 - subi.aPleinesPA - subi.perte);
    const devie = tranche(true);
    expect(armourSum(devie.cible)).toBe(23);
    expect(devie.cible.wounds.current).toBe(30 - devie.aPleinesPA);
    expect(devie.cible.criticalWounds ?? 0).toBe(0);
  });
});

// ── Recompte à PA−n : les pas de Dégâts ne changent pas l'écart ────────────────
describe('Projectile magique — recompte à PA−n (LDB 63 l.32 ; VDM 02 l.198)', () => {
  const caster = mage('enemy', 'C');
  const cr: CastResult = { cast: true, roll: 44, target: 60, sl: 2, isCritical: true, isFumble: false, log: '' };

  // Les Blessures d'une touche Déviée se relisent à PA−n avec les MÊMES pas de Dégâts (`VDM 02 l.198`) :
  // l'écart PA−1 ne dépend pas des pas alloués.
  it('avec des pas de Dégâts alloués (Surincantation VDM) → même écart PA−1 qu\'à 0 pas', () => {
    setRule('magic-vdm-incantation', true);
    const ecart = (pas: number) => (evaluateMissile(caster, mk('hero', 'T', { armour: uniformArmour(3) }), missileSpell(), cr, 'corps', pas).woundsLost ?? 0)
      - (evaluateMissile(caster, mk('hero', 'T', { armour: uniformArmour(4) }), missileSpell(), cr, 'corps', pas).woundsLost ?? 0);
    expect(ecart(3)).toBe(ecart(0));
    expect(ecart(3)).toBe(1);
  });
});

// ── Chemin opposé : HÉROS blindé → étape `self` (Dévier/Subir) ─────────────────
describe('Test opposé — HÉROS blindé : étape de déviation `self` (LDB 14 l.3 + 63 l.30)', () => {
  beforeEach(() => seedBattleRng(7));

  it('héros victime AVEC armure → pousse une étape `self` (Critique « sec », overkill 0)', () => {
    const v = mk('hero', 'V', { armour: uniformArmour(3) });
    setBattle([v]);
    applyOpposedCritical(banc.getState, banc.setState, v, 11, {}, []);
    const dev = devSteps()[0]?.deviation;
    expect(dev?.mode).toBe('self');
    if (dev?.mode === 'self') {
      expect(dev.origine).toBe('coup-critique');
      expect(dev.overkill).toBe(0);
    }
    expect(live('V').criticalWounds ?? 0).toBe(0); // suspendu : application différée à ce stade
  });

  it('« Dévier » → −1 PA, Critique ignoré (criticalWounds inchangé)', () => {
    const v = mk('hero', 'V', { armour: uniformArmour(3) });
    setBattle([v]);
    applyOpposedCritical(banc.getState, banc.setState, v, 11, {}, []);
    resolveDeviation(banc.getState, banc.setState, devSteps()[0].deviation!, true);
    expect(armourSum(live('V'))).toBe(17); // 18 − 1
    expect(live('V').criticalWounds ?? 0).toBe(0);
  });

  it('« Subir » → Critique appliqué (criticalWounds +1, PA intacte)', () => {
    const v = mk('hero', 'V', { armour: uniformArmour(3) });
    setBattle([v]);
    applyOpposedCritical(banc.getState, banc.setState, v, 11, {}, []);
    resolveDeviation(banc.getState, banc.setState, devSteps()[0].deviation!, false);
    expect(armourSum(live('V'))).toBe(18); // PA intacte
    expect(live('V').criticalWounds ?? 0).toBe(1);
  });
});

// ── Chemin magie : HÉROS blindé (Dévier/Subir) + ENNEMI auto + multi-cibles ───
// Le Projectile passe par le plan PARTAGÉ avec le coup d'arme (#1595 corrb-3b C1) : sa fenêtre est celle de
// la mêlée — la sévérité se tire DANS l'étape, et rien n'est muté avant la dernière décision.
describe('Projectile magique — Déviation Critique (LDB 46 l.30 + 63 l.30)', () => {
  beforeEach(() => seedBattleRng(99));

  it('HÉROS blindé : Incantation Critique → UNE fenêtre (sévérité + Dévier/Subir), aucune mutation avant la décision', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    expect(devSteps()).toHaveLength(1);
    expect(devSteps()[0].critSeverity?.mode).toBe('projectile');
    expect(devSteps()[0].critSeverity?.origine).toBe('coup-critique');
    expect(devSteps()[0].options?.map((o) => o.key)).toEqual(['devier', 'subir']);
    const dev = tireLaSeverite().deviation!;
    expect(dev.mode).toBe('projectile');
    expect(dev.reveal.title, 'l’Incantation critique est un Coup Critique').toBe(tr('step.coupCritique'));
    expect(live('h-cible').wounds.current).toBe(30);
    expect(live('h-cible').criticalWounds ?? 0).toBe(0);
  });

  it('HÉROS « Dévier » → −1 PA + Blessures recalculées, Critique ignoré', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, true);
    const h = live('h-cible');
    expect(armourSum(h)).toBe(23);          // 24 − 1 PA sacrifié
    expect(h.wounds.current).toBe(23);      // 30 − 6 (base) − 1 (recalcul PA−1)
    expect(h.criticalWounds ?? 0).toBe(0);  // Critique dévié
  });

  it('HÉROS « Subir » → Critique appliqué (criticalWounds +1)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, false);
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
    expect(devSteps()[0]?.options, 'la fenêtre ne porte que le dé').toBeUndefined();
    draineCascade(banc.getState);
    expect(armourSum(live('e-cible'))).toBe(24); // PA intacte
    expect(live('e-cible').criticalWounds ?? 0).toBe(1);
  });

  it('multi-cibles (Surincantation) : 2 héros blindés → 2 fenêtres INDÉPENDANTES', () => {
    const caster = mage('enemy', 'e-mage');
    const t1 = mk('hero', 'h1', { armour: uniformArmour(4) });
    const t2 = mk('hero', 'h2', { armour: uniformArmour(4) });
    setBattle([caster, t1, t2]);
    castMissile(caster, t1, missileSpell(), { critical: true, extraTargets: [t2] });
    const steps = devSteps();
    expect(steps.length).toBe(2);
    expect(steps.every((s) => s.critSeverity?.mode === 'projectile')).toBe(true);
    expect(new Set(steps.map((s) => s.critSeverity!.targetId))).toEqual(new Set(['h1', 'h2']));
  });

  it('OVERKILL (dépassement) héros blindé, sans double → fenêtre (origine dépassement, overkill>0)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4), wounds: blessuresDeBase(30, 5) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false }); // non-double → dépassement seul (5 PB < 6 dégâts)
    const sev = devSteps()[0]?.critSeverity;
    expect(sev?.mode).toBe('projectile');
    expect(sev?.origine).toBe('depassement');
    expect(sev?.overkill).toBeGreaterThan(0);   // le Critique d'overkill garde sa sévérité
    expect(tireLaSeverite().deviation!.reveal.title, 'le dépassement n’est pas un Coup Critique').toBe(tr('step.blessureCritique'));
    expect(live('h-cible').criticalWounds ?? 0).toBe(0); // suspendu
  });

  it('OVERKILL héros « Subir » → Blessure Critique de dépassement appliquée (criticalWounds +1)', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4), wounds: blessuresDeBase(30, 5) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false });
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, false);
    expect(live('h-cible').criticalWounds ?? 0).toBe(1);
  });

  it('OVERKILL héros « Dévier » → −1 PA, Critique de dépassement ignoré', () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4), wounds: blessuresDeBase(30, 5) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false });
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, true);
    expect(armourSum(live('h-cible'))).toBe(23); // 24 − 1
    expect(live('h-cible').criticalWounds ?? 0).toBe(0);
  });

  it('OVERKILL ennemi blindé, sans double → dévie AUTO (−1 PA, Critique ignoré, AUCUNE étape)', () => {
    const caster = mage('hero', 'h-mage');
    const t = mk('enemy', 'e-cible', { armour: uniformArmour(4), wounds: blessuresDeBase(30, 5) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: false });
    expect(devSteps().length).toBe(0);
    expect(armourSum(live('e-cible'))).toBe(23);
    expect(live('e-cible').criticalWounds ?? 0).toBe(0);
  });

  it("'ldb' : Incantation critique qui DÉPASSE → deux Blessures critiques, à la même Localisation (LDB 46 l.30 ; LDB 18 l.17, l.53)", () => {
    const caster = mage('hero', 'h-mage');
    const t = mk('enemy', 'e-cible', { wounds: blessuresDeBase(30, 5) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    const fenetres = new Set<string>();
    draineCascade(banc.getState, 200, (etape) => { if (etape.critSeverity) fenetres.add(etape.critSeverity.location); return 1; });
    expect(live('e-cible').criticalWounds).toBe(2);
    expect(fenetres.size, 'les deux Critiques à la Localisation unique').toBe(1);
  });

  it('HÉROS blindé, règle `combat-critical-deflect` OFF → la fenêtre ne porte que le dé, Critique subi', () => {
    setRule('combat-critical-deflect', false);
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    expect(devSteps()[0]?.options).toBeUndefined();
    draineCascade(banc.getState);
    expect(live('h-cible').criticalWounds ?? 0).toBe(1);
  });
});

/** LANCE le d100 de sévérité DANS la fenêtre ouverte (chemin MÊLÉE, où la table LDB est déclarée) : la
 *  MÊME étape passe de `'table'` à `'choix'`, et le PLI post-dé y pose le Critique. */
function tireLaSeverite() {
  const st = devSteps();
  expect(st, 'une seule étape porte le tirage ET la décision').toHaveLength(1);
  banc.getState().cascadeTableRoll(st[0].id);
  const apres = devSteps()[0];
  expect(stepInteraction(apres)).toBe('choix');
  expect(apres.deviation?.crit, 'le pli post-dé n’a pas posé le Critique').toBeTruthy();
  return apres;
}

// ── Mêlée : overkill (dépassement) couvert par la Déviation ───────────────────
describe('Mêlée — Déviation sur dépassement (overkill, LDB 18 l.53 + 63 l.30)', () => {
  beforeEach(() => seedBattleRng(31));

  const weapon: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
  // Dépassement (≠ double) : woundsLost > PB courants, `critical:false`.
  const overkillRes = (): AttackResult =>
    ({ hit: true, attackerRoll: 30, netSL: 2, location: 'corps', damage: 12, woundsLost: 8, critical: false, advantageTo: null, defenderDefeated: false, log: 'dépassement (corps)' });

  it('héros blindé subissant un dépassement → SUSPEND (étape `melee`)', () => {
    const e = mk('enemy', 'e1', { weapons: [weapon], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { armour: { ...uniformArmour(0), corps: 3 }, wounds: blessuresDeBase(15, 3) });
    setBattle([e, h]);
    const suspended = applyAttackResult(banc.getState, banc.setState, e, h, weapon, overkillRes());
    expect(suspended).toBe(OPS_DIFFEREES);
    // UNE étape porte le tirage de sévérité ET les voies — jamais deux fenêtres pour le même coup.
    expect(devSteps()).toHaveLength(1);
    expect(devSteps()[0].table, 'la sévérité se tire DANS cette fenêtre').toBeTruthy();
    expect(stepInteraction(devSteps()[0])).toBe('table');
    expect(devSteps()[0].options?.map((o) => o.key)).toEqual(['devier', 'subir']);
    expect(tireLaSeverite().deviation!.mode).toBe('melee');
  });

  it('« Dévier » sur dépassement → −1 PA, pas de Blessure Critique (À Terre à 0 PB quand même)', () => {
    const e = mk('enemy', 'e1', { weapons: [weapon], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { armour: { ...uniformArmour(0), corps: 3 }, wounds: blessuresDeBase(15, 3) });
    setBattle([e, h]);
    applyAttackResult(banc.getState, banc.setState, e, h, weapon, overkillRes());
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, true);
    const hh = live('h1');
    expect(hh.armour.corps).toBe(2);          // 1 PA sacrifié
    expect(hh.criticalWounds ?? 0).toBe(0);   // Blessure Critique de dépassement ignorée
  });

  it('« Subir » sur dépassement → Blessure Critique appliquée (criticalWounds +1)', () => {
    const e = mk('enemy', 'e1', { weapons: [weapon], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { armour: { ...uniformArmour(0), corps: 3 }, wounds: blessuresDeBase(15, 3) });
    setBattle([e, h]);
    applyAttackResult(banc.getState, banc.setState, e, h, weapon, overkillRes());
    resolveDeviation(banc.getState, banc.setState, tireLaSeverite().deviation!, false);
    expect(live('h1').criticalWounds ?? 0).toBe(1);
  });
});

// ── Projectile : relance de la Localisation sous (B) ──────────────────────────
// LDB 18 l.53, l.55 ; LDB 46 l.30 ; AA 07 l.36 ; #1595 c.6226467544.
describe("Projectile — relance de la Localisation par le Coup Critique (LDB 18 l.53, l.55 ; #1595 c.6226467544)", () => {
  const GRAINE = 5;
  const jet: CastResult = { cast: true, roll: 44, target: 60, sl: 2, isCritical: false, isFumble: false, log: '' };
  beforeEach(() => { setRule('combat-aa-blessures', 'aa'); seedBattleRng(GRAINE); });

  /** Le Projectile sur une cible hors Mort subite (AA 07 l.67), un témoin garde le combat ouvert. */
  function projectile(over: Partial<Combatant>, critique: boolean): { touche: HitLocation; journal: string[] } {
    const caster = mage('hero', 'h-mage');
    const t = mk('enemy', 'e-cible', { talents: [{ talentId: 'chanceux', times: 1 }] as never, ...over });
    setBattle([caster, t, mk('enemy', 'e-temoin')]);
    const touche = evaluateMissile(caster, t, missileSpell(), jet).location!;
    castMissile(caster, t, missileSpell(), { critical: critique });
    draineCascade(banc.getState);
    return { touche, journal: banc.getState().battle!.log.map((l) => l.text) };
  }
  const critiqueA = (journal: string[], loc: HitLocation) => journal.some((l) => l.startsWith('Blessure critique') && l.includes(`(${locationLabel(loc, 'humanoide')})`));

  it("(a) 'aa', cible déjà à 0, sans Incantation critique : la Localisation est relancée (branche 1)", () => {
    const relancee = critWoundLocation(makeRNG(GRAINE), 'humanoide');
    const { touche, journal } = projectile({ wounds: blessuresDeBase(30, 0) }, false);
    expect(relancee, 'la graine sépare les deux Localisations').not.toBe(touche);
    expect(live('e-cible').criticalWounds).toBe(1);
    expect(critiqueA(journal, relancee), 'le Critique à la Localisation du d100 frais').toBe(true);
    expect(critiqueA(journal, touche)).toBe(false);
  });

  it("(b) 'aa', passage à 0, sans Incantation critique : la Localisation de touche est gardée (branche 2)", () => {
    const { touche, journal } = projectile({ wounds: blessuresDeBase(30, 2) }, false);
    expect(live('e-cible').criticalWounds).toBe(1);
    expect(critiqueA(journal, touche), 'le Critique à la Localisation de touche').toBe(true);
  });

  for (const jeu of ['ldb', 'aa'] as const) {
    it(`'${jeu}', Personnage debout, Incantation critique : le Critique tombe à la Localisation relancée (LDB 46 l.30 ; #1595 c.6229735418)`, () => {
      if (jeu === 'ldb') resetRule('combat-aa-blessures');
      const relancee = critWoundLocation(makeRNG(GRAINE), 'humanoide');
      const { touche, journal } = projectile({}, true);
      expect(relancee, 'la graine sépare les deux Localisations').not.toBe(touche);
      expect(live('e-cible').wounds.current, 'la cible reste debout').toBeGreaterThan(0);
      expect(live('e-cible').criticalWounds).toBe(1);
      expect(critiqueA(journal, relancee), 'le Critique à la Localisation du d100 frais').toBe(true);
      expect(critiqueA(journal, touche)).toBe(false);
    });
  }

  it('(c) Incantation critique sur une Structure : aucune relance, le seul d100 tiré est celui de la table', () => {
    projectile({ wounds: blessuresDeBase(30, 10), bodyShape: 'structure' }, true);
    expect(live('e-cible').criticalWounds).toBe(1);
    const temoin = makeRNG(GRAINE);
    temoin.int(1, 100);
    expect(battleRng().int(1, 1_000_000), 'même graine, un seul dé consommé').toBe(temoin.int(1, 1_000_000));
  });

  // LDB 18 l.53, l.55 ; LDB 63 l.30 ; #1595 c.6226467544.
  it('Déviation subie : la Localisation relancée est celle de la naissance, relue au recompte sans re-tirage', () => {
    resetRule('combat-aa-blessures');
    const graine = 4;
    seedBattleRng(graine);
    const des = makeRNG(graine);
    const relancee = critWoundLocation(des, 'humanoide');
    expect(critWoundLocation(des, 'humanoide'), 'un re-tirage changerait le lieu').not.toBe(relancee);
    const caster = mage('enemy', 'e-mage');
    const t = mk('hero', 'h-cible', { armour: uniformArmour(4) });
    setBattle([caster, t, mk('enemy', 'e-temoin')]);
    const touche = evaluateMissile(caster, t, missileSpell(), jet).location!;
    castMissile(caster, t, missileSpell(), { critical: true });
    expect(relancee, 'la graine sépare les deux Localisations').not.toBe(touche);
    expect(devSteps()[0].critSeverity?.location, 'la fenêtre au lieu né').toBe(relancee);
    const dev = tireLaSeverite().deviation!;
    expect(dev.mode === 'projectile' && dev.touche.critLocation, 'la décision voyage sur la touche').toBe(relancee);
    resolveDeviation(banc.getState, banc.setState, dev, false);
    draineCascade(banc.getState);
    const journal = banc.getState().battle!.log.map((l) => l.text);
    expect(live('h-cible').criticalWounds).toBe(1);
    expect(critiqueA(journal, relancee), 'le Critique au lieu né').toBe(true);
  });
});

// ── Après la Blessure critique infligée : une fabrique pour la mêlée, l'opposé, la reprise et le Projectile ──
// LDB 10 (Frappe blessante) ; LDB 18 l.15 ; #1595 c.6228496170 Q3, Q4b.
describe('Après la Blessure critique infligée (LDB 10 ; LDB 18 l.15 ; #1595 c.6228496170 Q3, Q4b)', () => {
  /** Les `onCrit` émis sur le bus (le hook machinerie reçoit le contexte entier de l'événement). */
  const onCrit: CombatEventCtx[] = [];
  beforeEach(() => { avecLesTables({ crochetsDeCombat: [...tablesDuJeu().crochetsDeCombat, { id: 'test-deviation-paths-oncrit', phase: 'onCrit', run: (ctx) => { onCrit.push(ctx as CombatEventCtx); } }] }); });
  beforeEach(() => { seedBattleRng(7); onCrit.length = 0; });

  /** Le Critique d'un Test opposé (LDB 14 l.3) d'un auteur à `fb` niveaux de Frappe blessante, sur une cible à `pb` PB. */
  const critiqueOppose = (fb: number, pb: number): Combatant => {
    seedBattleRng(7);
    const a = mk('enemy', 'a', { talents: fb ? [{ talentId: 'frappe-blessante', times: fb }] : [] } as never);
    const v = mk('enemy', 'v', { wounds: blessuresDeBase(30, pb) });
    setBattle([a, v]);
    applyOpposedCritical(banc.getState, banc.setState, v, 44, { attackerId: 'a' }, []);
    return live('v');
  };

  it('la Frappe blessante qui fait tomber à 0 pose À Terre', () => {
    const temoin = critiqueOppose(0, 30);
    expect(temoin.dead, 'la graine tire une Blessure critique non létale').toBeFalsy();
    const rangee = 30 - temoin.wounds.current;
    const sansFrappe = critiqueOppose(0, rangee + 2);
    expect(sansFrappe.wounds.current).toBe(2);
    expect(hasCondition(sansFrappe, COND.aTerre)).toBe(false);
    const frappe = critiqueOppose(2, rangee + 2);
    expect(frappe.wounds.current).toBe(0);
    expect(hasCondition(frappe, COND.aTerre)).toBe(true);
  });

  it("le Critique d'un Projectile émet `onCrit` pour le lanceur, sans `attackType`", () => {
    const caster = mage('enemy', 'e-mage');
    const t = mk('enemy', 'e-cible');
    setBattle([caster, t]);
    castMissile(caster, t, missileSpell(), { critical: true });
    draineCascade(banc.getState, 200, () => 1);
    expect(live('e-cible').criticalWounds).toBe(1);
    expect(onCrit).toHaveLength(1);
    expect(onCrit[0].self?.id).toBe('e-mage');
    expect(onCrit[0].triggerCtx?.victim?.id).toBe('e-cible');
    expect(onCrit[0].triggerCtx?.attackType).toBeUndefined();
  });

  it("l'automate qui dévie le Critique d'un héros sans siège le révèle, l'auteur fût-il un ennemi", () => {
    const gourdin: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
    const e = mk('enemy', 'e1', { weapons: [gourdin], pos: { x: 1, y: 0 } });
    const h = mk('hero', 'h1', { aiControlled: true, armour: uniformArmour(3) });
    setBattle([e, h]);
    applyAttackResult(banc.getState, banc.setState, e, h, gourdin,
      { hit: true, attackerRoll: 44, netSL: 2, location: 'corps', critLocation: 'corps', damage: 5, woundsLost: 1, critical: true, advantageTo: null, defenderDefeated: false, log: 'double' });
    expect(armourSum(live('h1')), 'l’automate a dévié').toBe(17);
    const reveles = (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.reveal?.title === tr('cf.critDeflectedTitle'));
    expect(reveles).toHaveLength(1);
  });
});
