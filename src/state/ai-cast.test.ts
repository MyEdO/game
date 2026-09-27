import { describe, it, expect, afterEach } from 'vitest';
import { aiOvercastPlan } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput, type CastableSpell } from './ai';
import { opValue, spellActionValue, type SpellPlacement } from './aiSpellValue';
import { creatureToCombatant } from './spawn';
import { emptyScene } from './scene';
import { chebyshev } from './path';
import { findCreatureById, findSpell, type SpellData } from '../data';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';

/**
 * IA — ÉVALUATEUR DE SORT op-driven (remplace `aiBestMissile`/`aiFocusPlan`/`aiAreaSpell`, supprimés).
 * Aucun planner par-catégorie : la valeur d'un sort = Σ valeur de ses `GameOp` (`opValue`/
 * `spellActionValue`, src/state/aiSpellValue.ts) × fiabilité × opposition. `chooseEnemyAction` reçoit
 * `spells: CastableSpell[]` et en dérive des décisions `cast`/`castArea`/`focus`. `aiOvercastPlan`
 * (Surincantation auto, LDB 47) reste inchangé.
 */
const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

/** Héros minimal posé en (x,y). */
function foeAt(id: string, x: number, y: number): Combatant {
  return {
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12, base: 12 },
    advantage: 0, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y },
  } as Combatant;
}

/** `SpellData` réduit aux champs lus par l'évaluateur (effects/missile/damage/opposed). */
function spellData(over: Partial<SpellData> = {}): SpellData {
  return { id: 'sp', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, ...over } as SpellData;
}
const doOps = (ops: unknown[], on: 'target' | 'caster' = 'target') => ({ kind: 'do', effect: { type: 'ops', on, ops } }) as unknown as SpellData['effects'];
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data = over.data ?? spellData({ id: over.id ?? 'sp', missile: true, damage: 8 });
  return { id: over.id ?? data.id, data, cn: over.cn ?? data.cn ?? 0, range: over.range ?? null, shape: over.shape ?? 'single', landProb: over.landProb ?? 1, focusState: over.focusState ?? 'none', active: over.active ?? false };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// opValue / spellActionValue — la valeur vient des GameOp, flag `missile` OU non
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('opValue / spellActionValue — un sort de dégâts vaut des Blessures, missile ou pas', () => {
  const caster = (): Combatant => ({
    id: 'e', label: 'e', kind: 'enemy', characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 60, 'force-mentale': 60, sociabilite: 40 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
  } as Combatant);
  const enemy = (): Combatant => foeAt('h', 3, 0);

  it('op `wounds` SANS missile → valeur > 0 (un dégât authoré en GameOp compte, jadis « invisible »)', () => {
    const v = opValue({ op: 'wounds', amount: 6 } as never, caster(), enemy(), { refEnemy: enemy(), horizon: 3 });
    expect(v).toBeGreaterThan(0);
  });

  it('sort de DÉGÂTS non-missile (effects op wounds) → spellActionValue > 0', () => {
    const sp = spellData({ effects: doOps([{ op: 'wounds', amount: 6 }]) });
    const placement: SpellPlacement = { kind: 'unit', subject: enemy() };
    expect(spellActionValue(caster(), sp, placement, { landProb: 1, refEnemy: enemy(), horizon: 3 })).toBeGreaterThan(0);
  });

  it('Projectile magique (flag missile) → spellActionValue > 0', () => {
    const sp = spellData({ missile: true, damage: 8 });
    const placement: SpellPlacement = { kind: 'unit', subject: enemy() };
    expect(spellActionValue(caster(), sp, placement, { landProb: 1, refEnemy: enemy(), horizon: 3 })).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// chooseEnemyAction — décisions de sort (cast / castArea / focus), via spells: CastableSpell[]
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('chooseEnemyAction — sorts (énumération op-driven)', () => {
  const scene = emptyScene(16, 16);
  function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
    return {
      id, label: id, kind, pos, wounds: { current: 10, max: 10 }, weapons: [MELEE],
      characteristics: {} as never, advantage: 0, conditions: [], armour: {} as never,
      skills: [], talents: [], movement: 4, ...opts,
    } as Combatant;
  }
  function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
    return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
  }

  it('missile FAISABLE (focusState none, en portée) → cast mono-cible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20 })] }))).toEqual({ kind: 'cast', targetId: 'h', spell: 'carreau' });
  });

  it('ZdE couvrant ≥2 héros groupés → castArea auto-posé', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'hero', { x: 5, y: 9 });
    const h2 = mk('h2', 'hero', { x: 6, y: 9 }); // collés (Chebyshev 1)
    const areaSp = castable({ id: 'vortex-d-ames', shape: { area: { radius: 1 } }, range: 20, data: spellData({ id: 'vortex-d-ames', effects: doOps([{ op: 'wounds', amount: 8 }]) }) });
    const a = chooseEnemyAction(input(e, [h1, h2], { spells: [areaSp] }));
    expect(a.kind).toBe('castArea');
    if (a.kind === 'castArea') {
      expect(a.spell).toBe('vortex-d-ames');
      const cov = [h1, h2].filter((h) => chebyshev(h.pos!, a.center) <= 1).length;
      expect(cov).toBe(2);
    }
  });

  it('sort FOCALISABLE (peu fiable d’un jet) hors contact → focus (au lieu de rater en boucle)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'vortex-d-ames', focusState: 'focusable' })] }))).toEqual({ kind: 'focus', spell: 'vortex-d-ames' });
  });

  it('un sort offensif lançable d’un JET existe → ne focalise PAS (focaliser ne produit rien ce tour)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    const immediate = castable({ id: 'carreau', range: 20, focusState: 'none' });        // offensif, d’un jet
    const big = castable({ id: 'vortex-d-ames', range: 20, focusState: 'focusable' });    // gros sort à focaliser
    const a = chooseEnemyAction(input(e, [h], { spells: [immediate, big] }));
    expect(a).toEqual({ kind: 'cast', targetId: 'h', spell: 'carreau' }); // frappe maintenant, jamais focus
  });

  it('sort déjà focalisé et PRÊT (focusState ready) → cast à NI 0', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20, focusState: 'ready' })] }))).toEqual({ kind: 'cast', targetId: 'h', spell: 'carreau' });
  });

  it('Unicité : un sort déjà ACTIF est EXCLU de l’énumération (seul sort + sans arme → end)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    const a = chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20, active: true })] }));
    expect(a.kind).toBe('end'); // sort actif ignoré + aucune arme → aucune action
  });

  // ── ZdE NET : anti tir-ami (indiscriminée, RAW) + buff/soin de zone ──────────────────────────────
  const areaDmg = (radius: number) => castable({ id: 'comete', shape: { area: { radius } }, range: 20, data: spellData({ id: 'comete', effects: doOps([{ op: 'wounds', amount: 8 }]) }) });

  it('AoE indiscriminée : un allié SEUL dans le rayon (1 ennemi touché ≈ 1 allié) → net ≤ 0 → ne se canarde PAS', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const foe = mk('h', 'hero', { x: 5, y: 9 });
    const ally = mk('a', 'enemy', { x: 4, y: 9 }, { weapons: [MELEE] }); // dans le rayon 1 de l'unique ennemi
    const a = chooseEnemyAction(input(e, [foe], { spells: [areaDmg(1)], squad: [ally] }));
    expect(a.kind).not.toBe('castArea'); // dégâts au seul ennemi − tir ami sur l'allié ⇒ net ≤ 0
  });

  it('AoE indiscriminée : alliés HORS du rayon → castArea (net positif, aucun tir ami)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'hero', { x: 5, y: 9 });
    const h2 = mk('h2', 'hero', { x: 6, y: 9 }); // 2 ennemis groupés
    const ally = mk('a', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] }); // loin, hors du rayon
    const a = chooseEnemyAction(input(e, [h1, h2], { spells: [areaDmg(1)], squad: [ally] }));
    expect(a.kind).toBe('castArea'); // dégâts à 2 ennemis − 0 tir ami > 0
  });

  it('buff de ZONE (bénéfique) → castArea sur les alliés (jadis ignoré : le bloc ZdE scorait sur les ennemis)', () => {
    const C = { 'capacite-de-combat': 45, 'capacite-de-tir': 40, force: 45, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 } as Combatant['characteristics'];
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [MELEE], characteristics: C });
    const foe = mk('h', 'hero', { x: 5, y: 14 }, { characteristics: C }); // ennemi très loin (rien à frapper/approcher d'utile)
    const ally = mk('a', 'enemy', { x: 5, y: 6 }, { weapons: [MELEE], characteristics: C }); // allié armé adjacent
    const buff = castable({ id: 'prouesses', shape: { area: { radius: 2 } }, range: null, data: spellData({ id: 'prouesses', effects: doOps([{ op: 'charMod', char: 'capacite-de-combat', mod: 20 }]) }) });
    const a = chooseEnemyAction(input(e, [foe], { spells: [buff], squad: [ally] }));
    expect(a.kind).toBe('castArea'); // le buff de zone couvre soi + l'allié armé → bénéfice marginal > 0
    if (a.kind === 'castArea') expect(a.spell).toBe('prouesses');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// aiOvercastPlan — Surincantation AUTOMATIQUE (LDB 47 l.28-31 : +1 Cible par +2 DR) — INCHANGÉ
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('aiOvercastPlan — Surincantation automatique de l’IA (LDB 47 l.28-31)', () => {
  const eusapia = () => creatureToCombatant(findCreatureById('eusapia-balacanon')!, 'e1', { x: 0, y: 0 });
  const carreau = findSpell('Carreau')!; // NI 4, Portée (Force Mentale) mètres → FM 53 → 26 cases

  it('surplus de 4 DR au-dessus du NI → 2 cibles supplémentaires, les plus proches À PORTÉE', () => {
    const c = eusapia();
    const foes = [foeAt('h1', 1, 0), foeAt('h2', 3, 0), foeAt('h3', 5, 0), foeAt('h4', 90, 0)]; // h4 hors portée
    const plan = aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 8 }, foes, false, undefined, true); // 8 − NI 4 = +4 DR
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 2, damage: 0 });
    expect(plan.extraTargetIds).toEqual(['h2', 'h3']); // h1 = cible principale, exclue ; h4 trop loin
  });

  it('DR juste au NI (pas de surplus) ou sort raté → aucun plan', () => {
    const c = eusapia();
    const foes = [foeAt('h1', 1, 0), foeAt('h2', 3, 0)];
    expect(aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 5 }, foes, false, undefined, true)).toEqual({}); // surplus 1 < 2
    expect(aiOvercastPlan(c, 'h1', carreau, { cast: false, sl: 9 }, foes, false, undefined, true)).toEqual({});
  });

  it('budget plafonné par les adversaires disponibles', () => {
    const c = eusapia();
    const plan = aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 12 }, [foeAt('h1', 1, 0), foeAt('h2', 2, 0)], false, undefined, true);
    expect(plan.extraTargetIds).toEqual(['h2']); // budget 4 mais une seule cible en plus
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// aiOvercastPlan — axe Dégâts VDM (#885 : le nerf du Projectile sans jamais sa contrepartie)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('aiOvercastPlan — axe Dégâts (VDM 02 l.198, option `magic-vdm-incantation`)', () => {
  afterEach(() => resetRule('magic-vdm-incantation'));
  const eusapia = () => creatureToCombatant(findCreatureById('eusapia-balacanon')!, 'e1', { x: 0, y: 0 });
  const carreau = findSpell('Carreau')!; // NI 4, Projectile magique

  it('option ON, aucune cible neuve à portée → le reliquat ENTIER rejoint l’axe Dégâts (jamais gaspillé)', () => {
    setRule('magic-vdm-incantation', true);
    const c = eusapia();
    const plan = aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 8 }, [foeAt('h1', 1, 0)], false, undefined, true); // 8 − NI 4 = +4 DR, budget VDM = 4
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 0, damage: 4 });
    expect(plan.extraTargetIds).toEqual([]);
  });

  it('option OFF (LDB) → aucun axe Dégâts, même sans cible neuve (aucun plan)', () => {
    const c = eusapia();
    expect(aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 8 }, [foeAt('h1', 1, 0)], false, undefined, true)).toEqual({});
  });

  it('sort NON-missile (`missile=false`) : l’axe Dégâts n’est JAMAIS proposé, même option ON', () => {
    setRule('magic-vdm-incantation', true);
    const c = eusapia();
    const plan = aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 8 }, [foeAt('h1', 1, 0)], false, undefined, false);
    expect(plan).toEqual({}); // aucune cible neuve, et l'axe Dégâts fermé par `missile=false` → rien à allouer
  });
});
