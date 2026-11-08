import { describe, it, expect } from 'vitest';
import { craftPriceFactor, craftEncDelta, shiftAvailability, qualityClass, qualityClassLabel, craftAtoutCount, craftDefautCount } from './craftEconomy';
import { parseQualityInstance } from '../../data/refFormatLivre';

/** Fixture : libellés FR (lisibles) → `QualityInstance[]` structurées via le parseur d'authoring. */
const it_ = (qualities: string[]) => ({ qualities: qualities.map((q) => parseQualityInstance(q)!) });

describe('craftEconomy — comptage & prix (LDB 60 l.11/42)', () => {
  it('compte les Atouts/Défauts d’OBJET seulement (ignore les qualités d’arme)', () => {
    expect(craftAtoutCount(it_(['Raffiné', 'Solide 3', 'Empaleuse']))).toBe(2); // Empaleuse = Arme, ignorée
    expect(craftDefautCount(it_(['Volumineux', 'Peu Fiable']))).toBe(2);
  });
  it('prix : chaque Atout ×2, chaque Défaut ÷2', () => {
    expect(craftPriceFactor(it_([]))).toBe(1);
    expect(craftPriceFactor(it_(['Raffiné', 'Solide 1']))).toBe(4); // 2 Atouts → ×4 (exemple pelle, l.14)
    expect(craftPriceFactor(it_(['Volumineux', 'Peu Fiable']))).toBe(0.25); // 2 Défauts → ¼ (exemple cotte, l.46)
  });
});

describe('craftEconomy — Disponibilité (LDB 60 l.11/42/44, échelle Commune<Limitée<Rare<Exotique)', () => {
  it('Atouts rendent plus RARE, Défauts plus COURANT', () => {
    expect(shiftAvailability('Commune', it_(['Raffiné', 'Solide 1']))).toBe('Rare'); // +2 (pelle Commune→Rare)
    expect(shiftAvailability('Rare', it_(['Volumineux', 'Peu Fiable']))).toBe('Commune'); // -2 (cotte Rare→Commune)
  });
  it('Exotique non rendu plus courant par un Défaut (l.44)', () => {
    expect(shiftAvailability('Exotique', it_(['Bâclé']))).toBe('Exotique');
  });
  it('plafonné aux bornes', () => {
    expect(shiftAvailability('Commune', it_(['Bâclé', 'Laid']))).toBe('Commune'); // déjà au plus courant
    expect(shiftAvailability('Rare', it_(['Raffiné', 'Solide 1', 'Léger']))).toBe('Exotique'); // +3 plafonné
  });
  it('option Guilde : Défauts réduisent la dispo, 1er Atout ne la réduit pas (l.36-38)', () => {
    expect(shiftAvailability('Rare', it_(['Volumineux']), { guild: true })).toBe('Limitée'); // Défaut -1
    expect(shiftAvailability('Limitée', it_(['Raffiné']), { guild: true })).toBe('Limitée'); // 1er Atout : pas de réduction
    expect(shiftAvailability('Limitée', it_(['Raffiné', 'Solide 1']), { guild: true })).toBe('Rare'); // 2e Atout réduit
  });
});

describe('craftEncDelta (Léger -1 / Volumineux +1, LDB 60 l.18/62)', () => {
  it('somme les déltas d’Enc des qualités d’artisanat', () => {
    expect(craftEncDelta(it_(['Léger']))).toBe(-1);
    expect(craftEncDelta(it_(['Volumineux']))).toBe(1);
    expect(craftEncDelta(it_(['Léger', 'Volumineux']))).toBe(0);
    expect(craftEncDelta(it_(['Empaleuse']))).toBe(0); // qualité d'arme : pas de délta
  });
});

describe('qualityClass (LDB 60 l.7/11/42)', () => {
  it('Haute Qualité = 0 Défaut ET plus d’Atouts que l’Enc', () => {
    expect(qualityClass(it_(['Raffiné', 'Solide 1', 'Léger']), 2)).toBe('haute'); // 3 Atouts > Enc 2, 0 Défaut
    expect(qualityClass(it_(['Raffiné', 'Solide 1']), 2)).toBe('qualite'); // 2 Atouts = Enc 2 (pas >)
  });
  it('Qualité / Défectueuse / Standard', () => {
    expect(qualityClass(it_(['Raffiné']), 5)).toBe('qualite'); // plus d'Atouts
    expect(qualityClass(it_(['Bâclé', 'Laid']), 5)).toBe('defectueuse'); // plus de Défauts
    expect(qualityClass(it_(['Raffiné', 'Bâclé']), 5)).toBe('standard'); // égalité
    expect(qualityClass(it_([]), 5)).toBe('standard');
  });
  it('le LIBELLÉ de chaque classe vient du catalogue (l’id reste la logique)', () => {
    expect(qualityClassLabel(qualityClass(it_(['Raffiné', 'Solide 1', 'Léger']), 2))).toBe('Haute Qualité');
    expect(qualityClassLabel('qualite')).toBe('Qualité');
    expect(qualityClassLabel('defectueuse')).toBe('Défectueuse');
    expect(qualityClassLabel('standard')).toBe('Standard');
  });
});
