import { describe, it, expect, afterEach } from 'vitest';
import { ligneDeTexte } from '../engine/journal';
import { aiOvercastPlan, overcastTargetCandidates } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput, type CastableSpell } from './monde/ai';
import { opValue, spellActionValue, type SpellPlacement } from './monde/aiSpellValue';
import { creatureToCombatant } from './monde/spawn';
import { emptyScene } from './monde/scene';
import { chebyshev } from '../engine/grid';
import { findCreatureById, type SpellData, findSpellById } from '../data';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';
import type { CastResult } from '../engine/magic';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { idDeFixture } from '../data/idDeFixture.testkit';

/**
 * IA — ÉVALUATEUR DE SORT op-driven (remplace `aiBestMissile`/`aiFocusPlan`/`aiAreaSpell`, supprimés).
 * Aucun planner par-catégorie : la valeur d'un sort = Σ valeur de ses `GameOp` (`opValue`/
 * `spellActionValue`, src/noyau/monde/aiSpellValue.ts) × fiabilité × opposition. `chooseEnemyAction` reçoit
 * `spells: CastableSpell[]` et en dérive des décisions `cast`/`castArea`/`focus`. `aiOvercastPlan` : Surincantation
 * du lanceur conduit par le moteur (LDB 47 l.13-17, l.28 ; LDB 41 l.21-27 ; LDB 42 l.9-13).
 */
const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

/** Héros minimal posé en (x,y). */
function foeAt(id: string, x: number, y: number): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    advantage: 0, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y },
  }) as Combatant;
}

/** `SpellData` réduit aux champs lus par l'évaluateur (effects/missile/damage/opposed). */
function spellData(over: Partial<SpellData> = {}): SpellData {
  return { id: idDeFixture('spell', 'sp'), type: 'spells', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, ...over };
}
type OpsDeSort = Extract<NonNullable<SpellData['effects']>, { kind: 'effet' }>['effet']['ops'];
const doOps = (ops: OpsDeSort, on: 'target' | 'caster' = 'target'): SpellData['effects'] => ({ kind: 'effet', effet: { type: 'ops', on, ops } });
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data = over.data ?? spellData({ id: idDeFixture('spell', over.id ?? 'sp'), missile: true, damage: 8 });
  return { id: over.id ?? data.id, data, cn: over.cn ?? data.cn ?? 0, range: over.range ?? null, shape: over.shape ?? 'single', landProb: over.landProb ?? 1, focusState: over.focusState ?? 'none', active: over.active ?? false };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// opValue / spellActionValue — la valeur vient des GameOp, flag `missile` OU non
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('opValue / spellActionValue — un sort de dégâts vaut des Blessures, missile ou pas', () => {
  const caster = (): Combatant => (blessuresSurLeProfil({
    id: 'e', label: 'e', kind: 'ennemi', characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 60, 'force-mentale': 60, sociabilite: 40 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
  }) as Combatant);
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
  const scene = emptyScene('scene-test', 16, 16);
  function mk(id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
    return blessuresSurLeProfil({
      id, label: id, kind, pos, wounds: blessuresDeBase(10), weapons: [MELEE],
      characteristics: {} as never, advantage: 0, conditions: [], armour: {} as never,
      skills: [], talents: [], movement: 4, ...opts,
    }) as Combatant;
  }
  function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
    return { enemy, heroes, scene, env: { blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)) }, movement: enemy.movement, manoeuvresSurSoiOffertes: [], spells: [], ...extra };
  }

  it('missile FAISABLE (focusState none, en portée) → cast mono-cible', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'heros', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20 })] }))).toEqual({ kind: 'incantation', targetId: 'h', spell: 'carreau' });
  });

  it('ZdE couvrant ≥2 héros groupés → castArea auto-posé', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'heros', { x: 5, y: 9 });
    const h2 = mk('h2', 'heros', { x: 6, y: 9 }); // collés (Chebyshev 1)
    const areaSp = castable({ id: 'vortex-d-ames', shape: { area: { radius: 1 } }, range: 20, data: spellData({ id: 'vortex-d-ames', effects: doOps([{ op: 'wounds', amount: 8 }]) }) });
    const a = chooseEnemyAction(input(e, [h1, h2], { spells: [areaSp] }));
    expect(a.kind).toBe('incantationDeZone');
    if (a.kind === 'incantationDeZone') {
      expect(a.spell).toBe('vortex-d-ames');
      const cov = [h1, h2].filter((h) => chebyshev(h.pos!, a.center) <= 1).length;
      expect(cov).toBe(2);
    }
  });

  const PLAN = { rounds: 2, landProbNI0: 0.9 };
  it('sort FOCALISABLE (peu fiable d’un jet) hors contact → focus (au lieu de rater en boucle)', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'heros', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'vortex-d-ames', landProb: 0.1, focusState: PLAN })] }))).toEqual({ kind: 'focalisation', spell: 'vortex-d-ames' });
  });

  // #4821 : la Focalisation entre dans l'argmax, à sa valeur répartie sur ses Rounds (LDB 46 l.128-132).
  describe('Focalisation contre un sort mineur lançable d’un jet', () => {
    const flechette = castable({ id: 'flechette', range: 20, landProb: 0.4, data: spellData({ id: idDeFixture('spell', 'flechette'), missile: true, damage: 3 }) });
    const voie = castable({ id: 'boule', range: 20, landProb: 0.1, focusState: { rounds: 1, landProbNI0: 0.95 }, data: spellData({ id: idDeFixture('spell', 'boule'), missile: true, damage: 12 }) });
    const choix = (blessures: number) => chooseEnemyAction(input(mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] }), [mk('h', 'heros', { x: 5, y: 9 }, { wounds: blessuresDeBase(20, blessures) })], { spells: [flechette, voie] }));

    it('cible robuste : le sort de voie se focalise', () => {
      expect(choix(20)).toEqual({ kind: 'focalisation', spell: 'boule' });
    });

    it('Focalisation longue : le sort de voie se lance d’un jet', () => {
      const long = castable({ ...voie, landProb: 0.4, focusState: { rounds: 6, landProbNI0: 0.95 } });
      expect(chooseEnemyAction(input(mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] }), [mk('h', 'heros', { x: 5, y: 9 }, { wounds: blessuresDeBase(20) })], { spells: [flechette, long] })))
        .toEqual({ kind: 'incantation', targetId: 'h', spell: 'boule' });
    });

    it('un sort qui n’aboutit jamais d’un jet ne s’incante pas', () => {
      const vain = castable({ ...voie, landProb: 0, focusState: 'none' });
      expect(chooseEnemyAction(input(mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] }), [mk('h', 'heros', { x: 5, y: 9 })], { spells: [vain] })).kind).not.toBe('incantation');
    });

    it('cible à 1 Blessure, à portée d’achèvement du sort mineur : il la lance', () => {
      expect(choix(1)).toEqual({ kind: 'incantation', targetId: 'h', spell: 'flechette' });
    });
  });

  it('sort déjà focalisé et PRÊT (focusState ready) → cast à NI 0', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'heros', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20, focusState: 'ready' })] }))).toEqual({ kind: 'incantation', targetId: 'h', spell: 'carreau' });
  });

  it('Unicité : un sort déjà ACTIF est EXCLU de l’énumération (seul sort + sans arme → end)', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'heros', { x: 5, y: 9 });
    const a = chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20, active: true })] }));
    expect(a.kind).toBe('fin'); // sort actif ignoré + aucune arme → aucune action
  });

  // ── ZdE NET : anti tir-ami (indiscriminée, RAW) + buff/soin de zone ──────────────────────────────
  const areaDmg = (radius: number) => castable({ id: 'comete', shape: { area: { radius } }, range: 20, data: spellData({ id: idDeFixture('spell', 'comete'), effects: doOps([{ op: 'wounds', amount: 8 }]) }) });

  it('AoE indiscriminée : un allié SEUL dans le rayon (1 ennemi touché ≈ 1 allié) → net ≤ 0 → ne se canarde PAS', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const foe = mk('h', 'heros', { x: 5, y: 9 });
    const ally = mk('a', 'ennemi', { x: 4, y: 9 }, { weapons: [MELEE] }); // dans le rayon 1 de l'unique ennemi
    const a = chooseEnemyAction(input(e, [foe], { spells: [areaDmg(1)], squad: [ally] }));
    expect(a.kind).not.toBe('incantationDeZone'); // dégâts au seul ennemi − tir ami sur l'allié ⇒ net ≤ 0
  });

  it('AoE indiscriminée : alliés HORS du rayon → castArea (net positif, aucun tir ami)', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'heros', { x: 5, y: 9 });
    const h2 = mk('h2', 'heros', { x: 6, y: 9 }); // 2 ennemis groupés
    const ally = mk('a', 'ennemi', { x: 0, y: 0 }, { weapons: [MELEE] }); // loin, hors du rayon
    const a = chooseEnemyAction(input(e, [h1, h2], { spells: [areaDmg(1)], squad: [ally] }));
    expect(a.kind).toBe('incantationDeZone'); // dégâts à 2 ennemis − 0 tir ami > 0
  });

  it('buff de ZONE (bénéfique) → castArea sur les alliés (jadis ignoré : le bloc ZdE scorait sur les ennemis)', () => {
    const C = { 'capacite-de-combat': 45, 'capacite-de-tir': 40, force: 45, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 } as Combatant['characteristics'];
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [MELEE], characteristics: C });
    const foe = mk('h', 'heros', { x: 5, y: 14 }, { characteristics: C }); // ennemi très loin (rien à frapper/approcher d'utile)
    const ally = mk('a', 'ennemi', { x: 5, y: 6 }, { weapons: [MELEE], characteristics: C }); // allié armé adjacent
    const buff = castable({ id: 'prouesses', shape: { area: { radius: 2 } }, range: null, data: spellData({ id: idDeFixture('spell', 'prouesses'), effects: doOps([{ op: 'charMod', characteristic: 'capacite-de-combat', mod: 20 }]) }) });
    const a = chooseEnemyAction(input(e, [foe], { spells: [buff], squad: [ally] }));
    expect(a.kind).toBe('incantationDeZone'); // le buff de zone couvre soi + l'allié armé → bénéfice marginal > 0
    if (a.kind === 'incantationDeZone') expect(a.spell).toBe('prouesses');
  });

  // LDB 41 l.17 ; #5056
  describe('cible principale d’une Prière : écarte celle qu’elle ferait pécher', () => {
    afterEach(() => resetRule('priere-repetee-peche'));
    const guerison = castable({ id: 'benediction-de-guerison', range: 1, data: findSpellById('benediction-de-guerison')! });
    const choix = (consignees: string[]) => {
      const e = mk('e', 'ennemi', { x: 5, y: 5 }, { weapons: [], prieresDeRencontre: { 'benediction-de-guerison': consignees } });
      const blesse = (id: string, x: number) => mk(id, 'ennemi', { x, y: 6 }, { weapons: [], wounds: blessuresDeBase(10, 4) });
      return chooseEnemyAction(input(e, [mk('h', 'heros', { x: 5, y: 15 }, { weapons: [] })], { spells: [guerison], squad: [blesse('a1', 5), blesse('a2', 6)] }));
    };

    it('témoin : sans Prière consignée, le premier blessé', () => {
      expect(choix([])).toEqual({ kind: 'incantation', targetId: 'a1', spell: 'benediction-de-guerison' });
    });

    it('règle à 1 : le blessé déjà prié est écarté', () => {
      expect(choix(['a1'])).toEqual({ kind: 'incantation', targetId: 'a2', spell: 'benediction-de-guerison' });
    });

    it('règle à 0 : le blessé déjà prié reste retenu', () => {
      setRule('priere-repetee-peche', 0);
      expect(choix(['a1'])).toEqual({ kind: 'incantation', targetId: 'a1', spell: 'benediction-de-guerison' });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// aiOvercastPlan — Surincantation AUTOMATIQUE (LDB 47 l.28-31)
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** Jet d'incantation du Carreau tel que `evaluateCasting` le rend : son NI effectif figé (`niRequired`). */
const jetDuCarreau = (cast: boolean, sl: number): CastResult =>
  ({ cast, sl, niRequired: findSpellById('carreau')!.cn!, roll: 50, target: 60, isCritical: false, isFumble: false, log: ligneDeTexte('') });

describe('aiOvercastPlan — Surincantation automatique de l’IA (LDB 47 l.28-31)', () => {
  const eusapia = () => creatureToCombatant(findCreatureById('eusapia-balacanon')!, 'e1', { x: 0, y: 0 });
  const carreau = findSpellById('carreau')!; // NI 4, Portée (Force Mentale) mètres → FM 53 → 26 cases

  it('surplus de 4 DR au-dessus du NI → 2 cibles supplémentaires, les plus proches À PORTÉE', () => {
    const c = eusapia();
    const foes = [foeAt('h1', 1, 0), foeAt('h2', 3, 0), foeAt('h3', 5, 0), foeAt('h4', 90, 0)]; // h4 hors portée
    const plan = aiOvercastPlan(null, c, { targetId: 'h1', missile: true }, carreau, jetDuCarreau(true, 8), foes); // 8 − NI 4 = +4 DR
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 2, damage: 0 });
    expect(plan.extraTargetIds).toEqual(['h2', 'h3']); // h1 = cible principale, exclue ; h4 trop loin
  });

  it('DR juste au NI (pas de surplus) ou sort raté → aucun plan', () => {
    const c = eusapia();
    const foes = [foeAt('h1', 1, 0), foeAt('h2', 3, 0)];
    expect(aiOvercastPlan(null, c, { targetId: 'h1', missile: true }, carreau, jetDuCarreau(true, 5), foes)).toEqual({}); // surplus 1 < 2
    expect(aiOvercastPlan(null, c, { targetId: 'h1', missile: true }, carreau, jetDuCarreau(false, 9), foes)).toEqual({});
  });

  it('budget plafonné par les adversaires disponibles', () => {
    const c = eusapia();
    const plan = aiOvercastPlan(null, c, { targetId: 'h1', missile: true }, carreau, jetDuCarreau(true, 12), [foeAt('h1', 1, 0), foeAt('h2', 2, 0)]);
    expect(plan.extraTargetIds).toEqual(['h2']); // budget 4 mais une seule cible en plus
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// aiOvercastPlan — axe Dégâts VDM (#885 : le nerf du Projectile sans jamais sa contrepartie)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('aiOvercastPlan — axe Dégâts (VDM 02 l.198, option `magie-vdm-incantation`)', () => {
  afterEach(() => resetRule('magie-vdm-incantation'));
  const eusapia = () => creatureToCombatant(findCreatureById('eusapia-balacanon')!, 'e1', { x: 0, y: 0 });
  const carreau = findSpellById('carreau')!; // NI 4, Projectile magique

  it('option ON, aucune cible neuve à portée → le reliquat ENTIER rejoint l’axe Dégâts (jamais gaspillé)', () => {
    setRule('magie-vdm-incantation', true);
    const c = eusapia();
    const plan = aiOvercastPlan(null, c, { targetId: 'h1', missile: true }, carreau, jetDuCarreau(true, 8), [foeAt('h1', 1, 0)]); // 8 − NI 4 = +4 DR, budget VDM = 4
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 0, damage: 4 });
    expect(plan.extraTargetIds).toEqual([]);
  });

  it('option OFF (LDB) → aucun axe Dégâts, même sans cible neuve (aucun plan)', () => {
    const c = eusapia();
    expect(aiOvercastPlan(null, c, { targetId: 'h1', missile: true }, carreau, jetDuCarreau(true, 8), [foeAt('h1', 1, 0)])).toEqual({});
  });

  it('sort NON-missile (`missile=false`) : l’axe Dégâts n’est JAMAIS proposé, même option ON', () => {
    setRule('magie-vdm-incantation', true);
    const c = eusapia();
    const plan = aiOvercastPlan(null, c, { targetId: 'h1', missile: false }, carreau, jetDuCarreau(true, 8), [foeAt('h1', 1, 0)]);
    expect(plan).toEqual({}); // aucune cible neuve, et l'axe Dégâts fermé par `missile=false` → rien à allouer
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// aiOvercastPlan — toute source, polarité du sort (LDB 41 l.21-27 ; LDB 42 l.9-13 ; LDB 47 l.13-17)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('aiOvercastPlan — Bénédictions, Miracles et sorts non Projectile', () => {
  afterEach(() => resetRule('priere-repetee-peche'));
  const guerison = findSpellById('benediction-de-guerison')!; // Contact, Cible 1, Instantanée
  const jet = (sl: number): CastResult => ({ cast: true, sl, niRequired: 0, roll: 10, target: 60, isCritical: false, isFumble: false, log: ligneDeTexte('') });
  const pose = (id: string, kind: 'heros' | 'ennemi', x: number, y = 0, manque = 3): Combatant => {
    const c = { ...foeAt(id, x, y), kind };
    return { ...c, wounds: { ...c.wounds, current: c.wounds.max - manque } };
  };
  const pretre = () => pose('p', 'heros', 0, 0, 0);
  const planDe = (spell: SpellData, sl: number, pool: Combatant[], lanceur = pretre(), targetId = 'a1') =>
    aiOvercastPlan(null, lanceur, { targetId, missile: false }, spell, jet(sl), [lanceur, ...pool]);

  it('Guérison à +4 DR, trois alliés blessés et un ennemi au contact → trois soignés, jamais l’ennemi (LDB 41 l.27)', () => {
    const plan = planDe(guerison, 4, [pose('a1', 'heros', 1), pose('a2', 'heros', 1, 1), pose('a3', 'heros', 0, 1), pose('e1', 'ennemi', -1)]);
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 2, damage: 0 });
    expect(plan.extraTargetIds).toEqual(['a2', 'a3']);
  });

  it('Guérison à +4 DR, alliés à 6 m → un pas Portée, un pas Cible : deux soignés (LDB 41 l.27)', () => {
    const plan = planDe(guerison, 4, [pose('a1', 'heros', 3), pose('a2', 'heros', 3, 1), pose('a3', 'heros', 3, 2)]);
    expect(plan.overcast).toEqual({ range: 1, zone: 0, duration: 0, targets: 1, damage: 0 });
    expect(plan.extraTargetIds).toEqual(['a2']);
  });

  it('un allié intact n’est pas retenu (LDB 41 l.27)', () => {
    const plan = planDe(guerison, 4, [pose('a1', 'heros', 1), pose('a2', 'heros', 1, 1, 0), pose('a3', 'heros', 0, 1)]);
    expect(plan.extraTargetIds).toEqual(['a3']);
  });

  it('règle `priere-repetee-peche` à 1 : l’allié déjà prié est écarté ; à 0, retenu (LDB 41 l.17)', () => {
    const lanceur = { ...pretre(), prieresDeRencontre: { 'benediction-de-guerison': ['a2'] } };
    const pool = [pose('a1', 'heros', 1), pose('a2', 'heros', 1, 1), pose('a3', 'heros', 0, 1)];
    expect(planDe(guerison, 4, pool, lanceur).extraTargetIds).toEqual(['a3']);
    setRule('priere-repetee-peche', 0);
    expect(planDe(guerison, 4, pool, lanceur).extraTargetIds).toEqual(['a2', 'a3']);
  });

  it('Miracle de Contact : aucun pas Portée, les alliés hors contact ne sont pas retenus (LDB 42 l.9)', () => {
    const caresse = findSpellById('caresse-de-rhya')!; // Contact, Cible 1
    const plan = planDe(caresse, 4, [pose('a1', 'heros', 1), pose('a2', 'heros', 1, 1), pose('a3', 'heros', 3)]);
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 1, damage: 0 });
    expect(plan.extraTargetIds).toEqual(['a2']);
  });

  it('Bénédiction en Rounds sans cible en plus → le reliquat va à la Durée (LDB 41 l.25)', () => {
    const chasse = findSpellById('benediction-de-la-chasse')!; // 6 m, Cible 1, 6 Rounds
    const plan = planDe(chasse, 4, [pose('a1', 'heros', 1)]);
    expect(plan.overcast).toEqual({ range: 0, zone: 0, duration: 2, targets: 0, damage: 0 });
    expect(plan.extraTargetIds).toEqual([]);
  });

  it('Choc, deux ennemis au contact : le second est retenu, par le joueur comme par l’IA (LDB 47 l.13-17)', () => {
    const choc = findSpellById('choc')!; // Contact, Cible 1, État Sonné
    const lanceur = pretre();
    const pool = [lanceur, pose('e1', 'ennemi', 1), pose('e2', 'ennemi', 1, 1), pose('a1', 'heros', 0, 1)];
    expect(overcastTargetCandidates(null, pool, lanceur, 'e1', choc, 'arcane', 0).map((c) => c.id)).toEqual(['e2']);
    expect(aiOvercastPlan(null, lanceur, { targetId: 'e1', missile: false }, choc, jet(2), pool).extraTargetIds).toEqual(['e2']);
  });
});
