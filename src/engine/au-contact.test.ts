import { describe, it, expect } from 'vitest';
import { effectiveWeapon, effectiveWeaponDamage } from './weaponDamage';
import { areInContact, setContact, clearContact, disengageFrom, decayEngagement, engage } from './engagement';
import { hasQuality } from './qualities/dispatch';
import type { Weapon, Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

// Au Contact (Issue #42.5, LDB 62 l.176) :
// « Pendant un combat au contact, n'importe quelle arme plus longue que Courte est considérée comme
//   une Arme improvisée. »

const w = (reach: string, name = 'Arme'): Weapon => ({
  label: name, type: 'melee', reach: reach as Weapon['reach'], damage: { plusBF: true, flat: 5 },
  qualities: [{ id: 'empaleuse' }, { id: 'percutante' }],
});

describe('effectiveWeapon — combat au contact (LDB 62 l.176)', () => {
  it('arme Longue (> Courte) au contact → Arme improvisée (+BF+1, Inoffensive, Atouts perdus)', () => {
    const r = effectiveWeapon(w('Longue'), { auContact: true });
    expect(r.damage).toEqual({ plusBF: true, flat: 1 });
    expect(r.qualities).toEqual([{ id: 'inoffensive' }]);
    expect(hasQuality(r, 'empaleuse')).toBe(false);
    expect(effectiveWeaponDamage(r, 4)).toBe(5); // BF4 + 1
  });
  it('Très longue / Moyenne (> Courte) au contact → improvisée', () => {
    expect(effectiveWeapon(w('Très longue'), { auContact: true }).damage).toEqual({ plusBF: true, flat: 1 });
    expect(effectiveWeapon(w('Moyenne'), { auContact: true }).damage).toEqual({ plusBF: true, flat: 1 });
  });
  it('arme Courte (dague) au contact → INCHANGÉE (même référence)', () => {
    const d = w('Courte', 'Dague');
    expect(effectiveWeapon(d, { auContact: true })).toBe(d);
  });
  it('Très courte / Personnelle (mains nues) au contact → inchangée', () => {
    const tc = w('Très courte');
    const perso = w('Personnelle');
    expect(effectiveWeapon(tc, { auContact: true })).toBe(tc);
    expect(effectiveWeapon(perso, { auContact: true })).toBe(perso);
  });
  it('SANS auContact → arme Longue INCHANGÉE (même référence)', () => {
    const l = w('Longue');
    expect(effectiveWeapon(l)).toBe(l);
    expect(effectiveWeapon(l, {})).toBe(l);
    expect(effectiveWeapon(l, { auContact: false })).toBe(l);
  });
  // « plus longue que Courte » (l.176) suppose une LONGUEUR ordonnable ; l'Arme improvisée est d'Allonge
  // « Variable » (l.31) et EST déjà le profil improvisé — il n'y a rien à reclasser.
  it('Allonge « Variable » (Arme improvisée, LDB 62 l.31) au contact → inchangée', () => {
    const v = w('Variable', 'Arme improvisée');
    expect(effectiveWeapon(v, { auContact: true })).toBe(v);
  });
  it('le profil improvisé porte l’Allonge « Variable » du RAW (LDB 62 l.31), jamais un rang inventé', () => {
    expect(effectiveWeapon(w('Longue'), { auContact: true }).reach).toBe('Variable');
    expect(effectiveWeapon(w('Moyenne'), { improvised: true }).reach).toBe('Variable');
  });
});

describe('effectiveWeapon — improvisation par CONTEXTE générique (funnel)', () => {
  it('ctx.improvised (ex. Bélier hors-porte, ADE II 8 l.249) → profil improvisé (+BF+1, Inoffensive, Atouts perdus)', () => {
    const belier = { name: 'Bélier', type: 'melee', reach: 'Moyenne', damage: { plusBF: true, flat: 10 }, qualities: [{ id: 'siege' }, { id: 'belier' }] } as unknown as Weapon;
    const r = effectiveWeapon(belier, { improvised: true });
    expect(r.damage).toEqual({ plusBF: true, flat: 1 });
    expect(r.qualities).toEqual([{ id: 'inoffensive' }]); // Siège + Bélier tombés
  });
  it('ctx.improvised absent/false → arme INCHANGÉE (même référence)', () => {
    const l = w('Longue');
    expect(effectiveWeapon(l, { improvised: false })).toBe(l);
  });
});

const C = (id: string, p?: Partial<Combatant>): Combatant => (blessuresSurLeProfil({
  id, name: id, kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
}) as unknown as Combatant);

describe('areInContact / setContact / clearContact — relation symétrique + purge', () => {
  it('areInContact est SYMÉTRIQUE après setContact (posé par paire)', () => {
    const a = C('a'), b = C('b');
    expect(areInContact(a, b)).toBe(false);
    setContact(a, b);
    expect(areInContact(a, b)).toBe(true);
    expect(areInContact(b, a)).toBe(true);
    expect(a.contactWith).toEqual(['b']);
    expect(b.contactWith).toEqual(['a']);
    setContact(a, b); // idempotent
    expect(a.contactWith).toEqual(['b']);
  });
  it('clearContact retire des DEUX côtés', () => {
    const a = C('a'), b = C('b');
    setContact(a, b);
    clearContact(a, b);
    expect(areInContact(a, b)).toBe(false);
    expect(a.contactWith).toEqual([]);
    expect(b.contactWith).toEqual([]);
  });
  it('disengageFrom purge le contact (sous-ensemble de l’Engagement)', () => {
    const a = C('a'), b = C('b');
    engage(a, b);
    setContact(a, b);
    disengageFrom(a, b);
    expect(a.engagedWith).toEqual([]);
    expect(areInContact(a, b)).toBe(false);
  });
  it('decayEngagement : l’Engagement périmé tombe → le contact tombe avec', () => {
    const a = C('a', { meleeThisRound: [] }), b = C('b', { meleeThisRound: [] });
    a.engagedWith = ['b']; b.engagedWith = ['a'];
    setContact(a, b);
    decayEngagement([a, b]); // aucune mêlée échangée ce Round → Engagement purgé
    expect(a.engagedWith).toEqual([]);
    expect(areInContact(a, b)).toBe(false);
  });
});
