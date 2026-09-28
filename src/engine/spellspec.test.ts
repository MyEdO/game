/**
 * engine/spellspec + SpellData — métadonnées de résolution curées.
 * Les specs curées vivent dans SpellData (spells.json). Ces tests vérifient que la résolution
 * applique bien les effets curés et que la désambiguïsation par école fonctionne directement sur les
 * données JSON.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { applyOps, resolveFormula } from './ops';
import { spells, findSpellById, type SpellData } from '../data';
import { spellOps } from '../state/flow';
import { spellSupportOf } from './spellspec';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 42 },
    wounds: { current: 6, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  } as Combatant;
}

/** Applique les effets d'un sort comme applyCast le fait (ops `on:'target'` de `spell.effects`, durée
 *  résolue contre le lanceur). La durée et les effets vivent désormais sur SpellData (données JSON). */
function castVia(spell: SpellData, caster: Combatant, target: Combatant): string[] {
  const rounds = spell.duration?.kind === 'rounds' ? resolveFormula(spell.duration.value, caster) : null;
  return applyOps(target, spellOps(spell.effects, 'target'), { caster, label: spell.label, ...(rounds != null ? { defaultDurationRounds: rounds } : {}) });
}

describe('specs curées — résolution', () => {
  it('Bénédiction de Guérison : op heal littérale (+1 PB)', () => {
    const spell = findSpellById('benediction-de-guerison')!;
    const target = hero();
    castVia(spell, hero({ id: 'c' }), target);
    expect(target.wounds.current).toBe(7);
  });

  it('Caresse de Rhya : « Guérir (Bonus de Sociabilité) Blessures » résolu contre le LANCEUR', () => {
    const spell = findSpellById('caresse-de-rhya')!;
    const caster = hero({ id: 'c' }); // Soc 42 → BSoc 4
    const target = hero();
    castVia(spell, caster, target);
    expect(target.wounds.current).toBe(10); // 6 + 4
  });

  it('Écorce : +2 BE (charMod E +20) et −10 en Agilité/Dextérité — effets lus de spell.effects', () => {
    const spell = findSpellById('ecorce')!;
    expect(spellOps(spell.effects, 'target')).toEqual([
      { op: 'charMod', char: 'endurance', mod: 20 },
      { op: 'charMod', char: 'agilite', mod: -10 },
      { op: 'charMod', char: 'dexterite', mod: -10 },
    ]);
  });
});

describe('registre curé — couverture & désambiguïsation', () => {
  it('les 19 Bénédictions sont toutes curées', () => {
    const blessed = spells.filter((s) => s.ecole === 'Béni');
    expect(blessed).toHaveLength(19);
    for (const s of blessed) expect(s.curated, s.label).toBe(true);
  });

  it('labels en double : « Enchevêtrement » résolu par type (Arcane vs miracle de Taal)', () => {
    const arcane = spells.find((s) => s.label === 'Enchevêtrement' && s.ecole === 'Magie des Arcanes');
    const taal = spells.find((s) => s.label === 'Enchevêtrement' && s.ecole === 'Invocation');
    expect(arcane?.ecole).toBe('Magie des Arcanes');
    expect(taal?.ecole).toBe('Invocation');
  });
});

describe('spellSupport — seul ce qui PRODUIT un effet compte mécanique', () => {
  const sansOp = (p: Partial<SpellData>): SpellData => ({
    ...findSpellById('explosion')!, missile: false, curated: true, effects: { kind: 'seq', steps: [] },
    target: { kind: 'area', span: 'diameter', meters: 8 }, ...p,
  });

  it('une ZdE sans op ne fait que choisir des cibles : narratif, curée ou non', () => {
    expect(spellSupportOf(sansOp({}))).toBe('narratif');
    expect(spellSupportOf(sansOp({ curated: false }))).toBe('narratif');
  });

  it('la touche d’un Projectile et l’attaque du Souffle produisent un effet sans op', () => {
    expect(spellSupportOf(sansOp({ missile: true }))).toBe('mecanique');
    expect(spellSupportOf(sansOp({ breathAttack: true }))).toBe('mecanique');
  });
});
