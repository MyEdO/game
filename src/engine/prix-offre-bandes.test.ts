/**
 * PRIX D'OFFRE — la table à BANDES rend ce que le lookup à SEUILS rendait (#1463 L-gram-3).
 *
 * Les deux tableaux de vente étaient authorés par leur seule borne BASSE (`sum` maritime, `richesse`
 * terrestre) et relus par un `[...t].reverse().find(v >= seuil)` à repli muet sur la première rangée.
 * Ils sont désormais des fourchettes `{min, max}` lues par `findTableEntry` (`./tables`), la dernière
 * bande maritime gardant sa borne haute OUVERTE (MDG 15 l.383 « 4 ou plus »).
 *
 * Ce test ÉPINGLE l'arbitrage au lieu de le laisser implicite : sur tout le domaine, le rendu est
 * IDENTIQUE à l'ancien — SAUF sous la première bande, où l'ancien repliait en silence sur la rangée
 * la plus basse et où le nouveau REFUSE en nommant la valeur. Ce refus n'est pas théorique : c'est le
 * seul endroit où le comportement change, et il ne peut être atteint qu'avec un profil hors des
 * indices imprimés (MSRC 13 l.44-50 : Taille 1 à 4 ; l.52-60 : Richesse 1 à 5 — « Misérable » y porte
 * « - », donc aucun indice), que le schéma de scène refuse d'authorer (`defs-scenes/worldmap.ts`).
 */
import { describe, it, expect } from 'vitest';
import { offerPricePct, type PortProfile } from './seaVoyage';
import { sellOfferPct, type LandMarketProfile } from './landCargo';

/** Le tableau MARITIME tel qu'il était AUTHORÉ avant le lot (MDG 15 l.378-383, colonne « Prix d'offre »). */
const SEUILS_MER = [{ sum: 1, pct: -50 }, { sum: 2, pct: -25 }, { sum: 3, pct: -10 }, { sum: 4, pct: 0 }];
/** Le tableau TERRESTRE tel qu'il était AUTHORÉ avant le lot (MSRC 13 l.150-156, colonne « Offre »). */
const SEUILS_TERRE = [{ richesse: 1, pct: -50 }, { richesse: 2, pct: -20 }, { richesse: 3, pct: 0 }, { richesse: 4, pct: 5 }, { richesse: 5, pct: 10 }];

/** Le lookup d'AVANT le lot, transcrit : borne basse seule, parcours à l'envers, repli sur la 1ʳᵉ rangée. */
const ancienPct = <T>(table: T[], seuilDe: (r: T) => number, pctDe: (r: T) => number, v: number): number =>
  100 + pctDe([...table].reverse().find((r) => v >= seuilDe(r)) ?? table[0]);

/** Port forgé dont la somme Richesse + Taille + Demande vaut exactement `somme`. */
const port = (somme: number): PortProfile => ({ taille: 0, richesse: somme, production: [] });
/** Lieu terrestre forgé d'Indice de richesse `richesse`. */
const lieu = (richesse: number): LandMarketProfile => ({ taille: 1, richesse, produits: [] });

describe('prix d’offre — équivalence bandes / seuils sur tout le domaine (#1463 L-gram-3)', () => {
  it('MER : de 1 à 12, `findTableEntry` rend exactement ce que le lookup à seuils rendait', () => {
    const rendus: Record<number, [number, number]> = {};
    for (let somme = 1; somme <= 12; somme++) {
      rendus[somme] = [ancienPct(SEUILS_MER, (r) => r.sum, (r) => r.pct, somme), offerPricePct(port(somme), 'bois-mer')];
    }
    expect(Object.fromEntries(Object.entries(rendus).filter(([, [a, b]]) => a !== b)), 'le rendu a CHANGÉ dans le domaine du livre').toEqual({});
    // La sonde mesure vraiment les quatre bandes, pas quatre fois la même.
    expect([1, 2, 3, 4, 12].map((s) => offerPricePct(port(s), 'bois-mer'))).toEqual([50, 75, 90, 100, 100]);
  });

  it('TERRE : de 1 à 9, `findTableEntry` rend exactement ce que le lookup à seuils rendait', () => {
    const rendus: Record<number, [number, number]> = {};
    for (let richesse = 1; richesse <= 5; richesse++) {
      rendus[richesse] = [ancienPct(SEUILS_TERRE, (r) => r.richesse, (r) => r.pct, richesse), sellOfferPct(lieu(richesse))];
    }
    expect(Object.fromEntries(Object.entries(rendus).filter(([, [a, b]]) => a !== b)), 'le rendu a CHANGÉ dans le domaine du livre').toEqual({});
    expect([1, 2, 3, 4, 5].map((r) => sellOfferPct(lieu(r)))).toEqual([50, 80, 100, 105, 110]);
    // Au-dessus de l'échelle imprimée, l'ancien lookup rendait la dernière rangée EN SILENCE. Le
    // tableau s'arrêtant à 5 (l.52-60), un indice 6 est désormais REFUSÉ et NOMMÉ.
    for (let richesse = 6; richesse <= 9; richesse++) {
      expect(ancienPct(SEUILS_TERRE, (r) => r.richesse, (r) => r.pct, richesse)).toBe(110);
      expect(() => sellOfferPct(lieu(richesse))).toThrow(/hors du tableau/);
    }
  });

  it('SOUS la première bande, le repli MUET devient un refus NOMMÉ (mer et terre)', () => {
    for (let somme = -3; somme <= 0; somme++) {
      // L'ancien lookup rabattait tout sur la rangée la plus basse, sans rien dire.
      expect(ancienPct(SEUILS_MER, (r) => r.sum, (r) => r.pct, somme)).toBe(50);
      expect(() => offerPricePct(port(somme), 'bois-mer')).toThrow(
        new RegExp(`= ${somme}, hors du tableau \\(MDG 15 l\\.378-383`),
      );
    }
    for (let richesse = -3; richesse <= 0; richesse++) {
      expect(ancienPct(SEUILS_TERRE, (r) => r.richesse, (r) => r.pct, richesse)).toBe(50);
      expect(() => sellOfferPct(lieu(richesse))).toThrow(
        new RegExp(`Indice de richesse ${richesse} hors du tableau \\(MSRC 13 l\\.150-156`),
      );
    }
  });
});
