import { describe, it, expect } from 'vitest';
import { atoutsMinimaux, craftPriceFactor, craftEncDelta, shiftAvailability, craftAtoutCount, craftDefautCount } from './craftEconomy';
import { parseQualityInstance } from '../../data/refFormatLivre';

/** Fixture : libellés FR (lisibles) → `QualityInstance[]` structurées via le parseur d'authoring. */
const it_ = (qualities: string[]) => ({ qualities: qualities.map((q) => parseQualityInstance(q)!) });

describe('craftEconomy — comptage & prix (LDB 60 l.11/42)', () => {
  it('compte les Atouts/Défauts d’OBJET seulement (ignore les qualités d’arme)', () => {
    expect(craftAtoutCount(it_(['Raffiné', 'Solide 3', 'Empaleuse']))).toBe(4); // Solide 3 = trois prises (LDB 60 l.30-32) ; Empaleuse = Arme, ignorée
    expect(craftDefautCount(it_(['Volumineux', 'Peu Fiable']))).toBe(2);
  });
  it('un Atout répété compte à chaque prise, un Atout indicé pour son Indice (LDB 60 l.26 ; LDB 60 l.30-32)', () => {
    expect(craftAtoutCount(it_(['Raffiné', 'Raffiné']))).toBe(2);
    expect(craftAtoutCount(it_(['Solide 2']))).toBe(2);
    expect(craftPriceFactor(it_(['Solide 2']))).toBe(4);
  });
  it('prix : chaque Atout ×2, chaque Défaut ÷2', () => {
    expect(craftPriceFactor(it_([]))).toBe(1);
    expect(craftPriceFactor(it_(['Raffiné', 'Solide 1']))).toBe(4); // 2 Atouts → ×4 (exemple pelle, l.14)
    expect(craftPriceFactor(it_(['Volumineux', 'Peu Fiable']))).toBe(0.25); // 2 Défauts → ¼ (exemple cotte, l.46)
  });
});

describe('craftEconomy — Disponibilité (LDB 60 l.11/42/44, échelle Commune<Limitée<Rare<Exotique)', () => {
  it('Atouts rendent plus RARE, Défauts plus COURANT', () => {
    expect(shiftAvailability('commune', it_(['Raffiné', 'Solide 1']))).toBe('rare'); // +2 (pelle Commune→Rare)
    expect(shiftAvailability('rare', it_(['Volumineux', 'Peu Fiable']))).toBe('commune'); // -2 (cotte Rare→Commune)
  });
  it('Exotique non rendu plus courant par un Défaut (l.44)', () => {
    expect(shiftAvailability('exotique', it_(['Bâclé']))).toBe('exotique');
  });
  it('plafonné aux bornes', () => {
    expect(shiftAvailability('commune', it_(['Bâclé', 'Laid']))).toBe('commune'); // déjà au plus courant
    expect(shiftAvailability('rare', it_(['Raffiné', 'Solide 1', 'Léger']))).toBe('exotique'); // +3 plafonné
  });
  it('option Guilde : Défauts réduisent la dispo, 1er Atout ne la réduit pas (l.36-38)', () => {
    expect(shiftAvailability('rare', it_(['Volumineux']), { guild: true })).toBe('limitee'); // Défaut -1
    expect(shiftAvailability('limitee', it_(['Raffiné']), { guild: true })).toBe('limitee'); // 1er Atout : pas de réduction
    expect(shiftAvailability('limitee', it_(['Raffiné', 'Solide 1']), { guild: true })).toBe('rare'); // 2e Atout réduit
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

describe('atoutsMinimaux (LDB 60 l.7 ; LDB 60 l.11)', () => {
  it('une Possession de Qualité : un Atout', () => {
    expect(atoutsMinimaux('qualite')).toBe(1);
    expect(atoutsMinimaux('qualite', 1)).toBe(1);
  });
  it('une Possession de Haute Qualité d’Encombrement 1 : deux Atouts', () => {
    expect(atoutsMinimaux('haute', 1)).toBe(2);
  });
});
