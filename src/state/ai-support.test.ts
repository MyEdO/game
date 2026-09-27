/**
 * IA — SORTS de SOUTIEN / INVOCATION, évalués op-driven (aucun planner par-catégorie, aucun
 * `outnumberedFactor`). La valeur d'un soin/buff/invocation = Σ valeur de ses `GameOp`
 * (`opValue`/`spellActionValue`) ; l'Unicité RAW (un effet/une invocation de CE sort déjà actif) retire
 * le sort des candidats. Tout passe par le MÊME `cast` (résolu par `castSpell` côté store). PUR/déterministe.
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput, type CastableSpell } from './ai';
import { opValue } from './aiSpellValue';
import { emptyScene } from './scene';
import { findSpellById, type SpellData } from '../data';
import { isDispellableSpell } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

/** Lanceur générique ARMÉ par défaut, avec de vraies Caractéristiques (espérances chiffrables). */
function caster(id: string, pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind: 'enemy', pos,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 60, 'force-mentale': 60, sociabilite: 60 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, ...opts,
  } as Combatant;
}

function foeAt(id: string, x: number, y: number, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 35, force: 35, endurance: 35, initiative: 35, agilite: 35, dexterite: 35, intelligence: 35, 'force-mentale': 35, sociabilite: 35 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [MELEE],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y }, ...opts,
  } as Combatant;
}

function spellData(over: Partial<SpellData> = {}): SpellData {
  return { id: 'sp', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, ...over } as SpellData;
}
const doOps = (ops: unknown[], on: 'target' | 'caster' = 'target') => ({ kind: 'do', effect: { type: 'ops', on, ops } }) as unknown as SpellData['effects'];
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data = over.data ?? spellData({ id: over.id ?? 'sp' });
  return { id: over.id ?? data.id, data, cn: over.cn ?? data.cn ?? 0, range: over.range ?? null, shape: over.shape ?? 'single', landProb: over.landProb ?? 1, focusState: over.focusState ?? 'none', active: over.active ?? false };
}

const scene = emptyScene(20, 20);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 1. BUFF de combat = bénéfice MARGINAL réel (op charMod), pas une liste de carac
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('opValue — un buff de combat vaut son bénéfice marginal (armé > 0, désarmé ≈ 0)', () => {
  const buff = { op: 'charMod', char: 'capacite-de-combat', mod: 10 } as never;
  it('combattant ARMÉ : +10 CC améliore l’EV d’attaque → valeur > 0', () => {
    const e = caster('e', { x: 0, y: 0 });
    const armed = caster('a', { x: 1, y: 0 }, { weapons: [MELEE] });
    const ref = foeAt('h', 2, 0);
    expect(opValue(buff, e, armed, { refEnemy: ref, horizon: 3 })).toBeGreaterThan(0);
  });
  it('combattant SANS arme : +10 CC n’améliore aucune attaque → valeur ≈ 0', () => {
    const e = caster('e', { x: 0, y: 0 });
    const unarmed = caster('u', { x: 1, y: 0 }, { weapons: [] });
    const ref = foeAt('h', 2, 0);
    expect(opValue(buff, e, unarmed, { refEnemy: ref, horizon: 3 })).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 2. INVOCATION — Unicité RAW (invoque à parité ; PAS si l'invocation est déjà active)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('chooseEnemyAction — invocation : Unicité (plus d’outnumberedFactor)', () => {
  // Invocation centrée sur le lanceur (shape 'self'), op summon allié sur 'caster'.
  const summonSpell = (over: Partial<CastableSpell> = {}): CastableSpell => castable({
    id: 'hurlement-du-loup', shape: 'self', range: 0,
    data: spellData({ id: 'hurlement-du-loup', effects: doOps([{ op: 'summon', ref: 'loup', count: 1, allyOfCaster: true }], 'caster') }),
    ...over,
  });

  it('À PARITÉ (1v1, héros loin) une invocation NON active vaut sa créature → cast (l’invoque)', () => {
    const e = caster('e', { x: 5, y: 5 }, { weapons: [] });
    const h = foeAt('h', 5, 14); // loin → attaque/approche dérisoires
    const a = chooseEnemyAction(input(e, [h], { spells: [summonSpell()] }));
    expect(a.kind).toBe('cast');
    if (a.kind === 'cast') { expect(a.spell).toBe('hurlement-du-loup'); expect(a.targetId).toBe('e'); }
  });

  it('Unicité : la MÊME invocation déjà ACTIVE (loup vivant) → JAMAIS re-castée → approche', () => {
    const e = caster('e', { x: 5, y: 5 }, { weapons: [MELEE] });
    const h = foeAt('h', 5, 11); // loin (pas au contact), atteignable en approche
    const a = chooseEnemyAction(input(e, [h], { spells: [summonSpell({ active: true })] }));
    expect(a.kind).not.toBe('cast'); // l'invocation active est exclue (Unicité)
    expect(a.kind).toBe('move');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 3. SOIN / repli ATTAQUE — l'esprit conservé (un soutien inutile perd face à l'attaque)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('chooseEnemyAction — soin & anti-spam (op-driven)', () => {
  const healSpell = castable({ id: 'soin', shape: 'single', range: 20, data: spellData({ id: 'soin', effects: doOps([{ op: 'heal', amount: 6 }]) }) });

  it('SOIGNE l’allié le plus BAS (PB manquants) et PAS un allié plein', () => {
    const e = caster('e', { x: 5, y: 5 }, { weapons: [] });
    const hurt = caster('a-hurt', { x: 6, y: 5 }, { wounds: { current: 2, max: 12, base: 12 } });
    const full = caster('a-full', { x: 4, y: 5 }, { wounds: { current: 12, max: 12, base: 12 } });
    const h = foeAt('h', 5, 14); // héros LOIN → soin gagne
    const a = chooseEnemyAction(input(e, [h], { squad: [hurt, full], spells: [healSpell] }));
    expect(a.kind).toBe('cast');
    if (a.kind === 'cast') { expect(a.spell).toBe('soin'); expect(a.targetId).toBe('a-hurt'); }
  });

  it('rien à soigner (allié plein) → soin de valeur 0 → repli ATTAQUE (mêlée au contact)', () => {
    const e = caster('e', { x: 5, y: 5 }, { weapons: [MELEE] });
    const ally = caster('a', { x: 4, y: 5 }, { wounds: { current: 12, max: 12, base: 12 } });
    const h = foeAt('h', 5, 6); // au contact → attaque utile
    const a = chooseEnemyAction(input(e, [h], { squad: [ally], spells: [healSpell] }));
    expect(a).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('Unicité buff : buff déjà ACTIF → ne réapplique pas → attaque', () => {
    const e = caster('e', { x: 5, y: 5 }, { weapons: [MELEE] });
    const buffSelf = castable({ id: 'benediction', shape: 'self', range: 0, active: true, data: spellData({ id: 'benediction', effects: doOps([{ op: 'charMod', char: 'capacite-de-combat', mod: 10 }], 'caster') }) });
    const h = foeAt('h', 5, 6);
    expect(chooseEnemyAction(input(e, [h], { spells: [buffSelf] }))).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('FRÉNÉSIE : aucun sort de soutien lancé (le frénétique ne lance RIEN, LDB 21 l.33)', () => {
    const e = caster('e', { x: 5, y: 5 }, { psychState: [{ type: 'frenesie' }] } as Partial<Combatant>);
    const ally = caster('a', { x: 6, y: 5 }, { wounds: { current: 1, max: 12, base: 12 } });
    const h = foeAt('h', 5, 6);
    expect(chooseEnemyAction(input(e, [h], { squad: [ally], spells: [healSpell] })).kind).not.toBe('cast');
  });

  it('spells vide → comportement INCHANGÉ (parité : pas de candidat de soutien)', () => {
    const e = caster('e', { x: 5, y: 5 }, { weapons: [MELEE] });
    const h = foeAt('h', 5, 6);
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'melee', targetId: 'h' });
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 4. Dissipabilité (LDB 46) — donnée, pas de chemin spécial IA
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('Dissipabilité (LDB 46) — donnée, pas de chemin spécial IA', () => {
  it('une Bénédiction n’est PAS dissipable ; un Sort arcanique l’est', () => {
    const priere = findSpellById('benediction-de-bataille')!;
    const arcane = findSpellById('armure-aethyrique')!;
    expect(isDispellableSpell(priere)).toBe(false);
    expect(isDispellableSpell(arcane)).toBe(true);
  });
});
