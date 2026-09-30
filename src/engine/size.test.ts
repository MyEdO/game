import { describe, it, expect } from 'vitest';
import {
  SIZE_ORDER,
  SIZE_RANGED_MOD,
  effectiveSize,
  sizeGap,
  parseSizeLabel,
  sizeDamageMultiplier,
  sizeGrantedQualities,
  forceOpposedOutcome,
  woundsForSize,
  stepSize,
  resizeBySteps,
  sizeFromProfile,
  type SizeCategory,
} from './size';
import type { Characteristics } from './types';

describe('sizeFromProfile — Taille d’un profil : Trait Taille, sinon Talent (LDB 85 l.279-280 ; LDB 10 l.943)', () => {
  const tailles: Record<string, SizeCategory> = { petit: 'petite', massif: 'grande' };
  const sizeOf = (id: string): SizeCategory | undefined => tailles[id];
  it('Talent seul : sa Taille', () => {
    expect(sizeFromProfile(undefined, [{ id: 'petit' }], sizeOf)).toBe('petite');
    expect(sizeFromProfile([{ id: 'arme', arg: '7' }], [{ id: 'massif' }], sizeOf)).toBe('grande');
  });
  it('le Trait Taille prime sur le Talent', () => {
    expect(sizeFromProfile([{ id: 'taille', arg: 'enorme' }], [{ id: 'petit' }], sizeOf)).toBe('enorme');
  });
  it('ni Trait Taille ni Talent de Taille : null', () => {
    expect(sizeFromProfile(undefined, undefined, sizeOf)).toBeNull();
    expect(sizeFromProfile([{ id: 'bestial' }], [{ id: 'sixieme-sens' }], sizeOf)).toBeNull();
  });
});

describe('size — modèle de Taille (LDB 85 l.279-280 ; 14 l.151-170)', () => {
  it('ordonne les 7 catégories 0..6', () => {
    expect(SIZE_ORDER.minuscule).toBe(0);
    expect(SIZE_ORDER.moyenne).toBe(3);
    expect(SIZE_ORDER.monstrueuse).toBe(6);
  });
  it("mod d'à-toucher au tir : -30 (Minuscule) .. +60 (Monstrueuse)", () => {
    expect(SIZE_RANGED_MOD.minuscule).toBe(-30);
    expect(SIZE_RANGED_MOD.moyenne).toBe(0);
    expect(SIZE_RANGED_MOD.grande).toBe(20);
    expect(SIZE_RANGED_MOD.monstrueuse).toBe(60);
  });
  it('Taille effective par défaut = Moyenne (standard implicite, LDB 14 l.128)', () => {
    expect(effectiveSize(undefined)).toBe('moyenne');
    expect(effectiveSize('grande')).toBe('grande');
  });
  it("sizeGap > 0 si l'attaquant est plus grand", () => {
    expect(sizeGap('grande', 'moyenne')).toBe(1);
    expect(sizeGap('moyenne', 'enorme')).toBe(-2);
    expect(sizeGap(undefined, undefined)).toBe(0);
  });
  it('parseSizeLabel — catégories simples (accents/casse insensibles)', () => {
    expect(parseSizeLabel('Énorme')).toBe('enorme');
    expect(parseSizeLabel('tres petite')).toBe('tresPetite');
    expect(parseSizeLabel('Très Petite')).toBe('tresPetite');
    expect(parseSizeLabel('inconnu')).toBeNull();
  });
  it('parseSizeLabel — plages narratives → borne HAUTE (design documenté)', () => {
    expect(parseSizeLabel('de Petite à Énorme')).toBe('enorme');
    expect(parseSizeLabel('Minuscule-Énorme')).toBe('enorme');
    expect(parseSizeLabel('de Petite à Moyenne')).toBe('moyenne');
    expect(parseSizeLabel('Énorme-Monstrueuse')).toBe('monstrueuse');
  });
});

describe('Taille en combat (T2/T3/T4) — LDB 85 l.293-352', () => {
  it('sizeDamageMultiplier : ×1 si ≤ +1 cat, ×N si ≥ +2', () => {
    expect(sizeDamageMultiplier('moyenne', 'moyenne')).toBe(1);
    expect(sizeDamageMultiplier('grande', 'moyenne')).toBe(1); // +1 cat → ×1 (no-op)
    expect(sizeDamageMultiplier('enorme', 'moyenne')).toBe(2); // +2 → ×2
    expect(sizeDamageMultiplier('monstrueuse', 'moyenne')).toBe(3); // +3 → ×3
    expect(sizeDamageMultiplier('petite', 'moyenne')).toBe(1); // plus petit → ×1
  });
  it('sizeGrantedQualities : ∅ / Dévastatrice / Dévastatrice+Percutante (cumul)', () => {
    expect(sizeGrantedQualities('moyenne', 'moyenne')).toEqual([]);
    expect(sizeGrantedQualities('grande', 'moyenne')).toEqual(['devastatrice']); // ids stables
    expect(sizeGrantedQualities('enorme', 'moyenne')).toEqual(['devastatrice', 'percutante']);
  });
  it('forceOpposedOutcome : autoWin / needCrit / normal', () => {
    expect(forceOpposedOutcome('enorme', 'moyenne')).toBe('autoWin'); // a ≥ +2 cat
    expect(forceOpposedOutcome('grande', 'moyenne')).toBe('normal'); // a +1 cat → normal (b plus petit, pas a)
    expect(forceOpposedOutcome('moyenne', 'moyenne')).toBe('normal');
    expect(forceOpposedOutcome('petite', 'grande')).toBe('needCrit'); // a plus petit → doit un Critique
  });
  it('woundsForSize : table par catégorie (BF=3, BE=4, BFM=3 → Moyenne 14)', () => {
    expect(woundsForSize(3, 4, 3, 'moyenne')).toBe(14);
    expect(woundsForSize(3, 4, 3, 'petite')).toBe(11); // 2·BE+BFM
    expect(woundsForSize(3, 4, 3, 'tresPetite')).toBe(4); // BE
    expect(woundsForSize(3, 4, 3, 'minuscule')).toBe(1);
    expect(woundsForSize(3, 4, 3, 'grande')).toBe(28); // ×2
    expect(woundsForSize(3, 4, 3, 'enorme')).toBe(56); // ×4
    expect(woundsForSize(3, 4, 3, 'monstrueuse')).toBe(112); // ×8
  });
});

describe('Agrandir/Réduire — « Utiliser les Tailles » (LDB 85 l.276-277)', () => {
  it('stepSize : décale la catégorie, bornée Minuscule..Monstrueuse', () => {
    expect(stepSize('grande', 1)).toBe('enorme');
    expect(stepSize('enorme', 1)).toBe('monstrueuse');
    expect(stepSize('moyenne', -2)).toBe('tresPetite');
    expect(stepSize('monstrueuse', 3)).toBe('monstrueuse'); // plafonné
    expect(stepSize('minuscule', -3)).toBe('minuscule'); // plancher
    expect(stepSize(undefined, 1)).toBe('grande'); // défaut Moyenne +1
  });
  it('resizeBySteps : +10 F, +10 E, −5 Ag PAR catégorie (inverse en réduction)', () => {
    const base = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as Characteristics;
    const up2 = resizeBySteps(base, 2);
    expect(up2.force).toBe(50); // +10 ×2
    expect(up2.endurance).toBe(50);
    expect(up2.agilite).toBe(20); // −5 ×2
    expect(up2['capacite-de-combat']).toBe(30); // inchangé
    const down1 = resizeBySteps(base, -1);
    expect(down1.force).toBe(20);
    expect(down1.agilite).toBe(35); // +5
    expect(resizeBySteps(base, 0)).toEqual(base); // no-op
  });
});
