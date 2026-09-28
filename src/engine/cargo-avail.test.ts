/**
 * DISPONIBILITÉ SAISONNIÈRE — contrat du tirage de cargaison (#1659 L-1659-2).
 *
 * Ce que ce fichier tient : la colonne saisonnière est une TABLE À FOURCHETTES lue par le lookup
 * partagé, et un jet que rien ne couvre est une ANOMALIE NOMMÉE. Le repli sur la dernière cargaison
 * (`?? cargoes.at(-1)`) donnait une réponse PLAUSIBLE à une table trouée : « Pièces détachées de
 * navire » sortait pour tout jet orphelin, et rien ne le disait.
 *
 * CONSTAT D'ÉQUIVALENCE du 2026-09-01, NON REJOUABLE (l'ancien code n'existe plus après ce commit) —
 * il est consigné, pas asserté. Méthode : l'expression de `cargo.ts:78` telle qu'elle était écrite à
 * `ea223a59c` — `cargoes.find((c) => r >= c.avail[season][0] && r <= c.avail[season][1]) ??
 * cargoes[cargoes.length - 1]` — appliquée aux catalogues échangeables de la donnée du MÊME commit,
 * confrontée à `rollRandomCargo` / `rollRandomLandCargo` d'aujourd'hui, RNG forcé, r = 1..100 sur les
 * 8 colonnes : 800 jets comparés, 0 divergence. Les 8 séquences, en bornes (chaque jet rend la
 * cargaison dont la fourchette le contient) :
 *   mer/printemps  cereales 1-5, armes 6-8, produits-de-luxe 9-13, metaux 14-19, bois 20-28, vin 29-33, laine 34-50, sel 51-60, huile 61-70, poisson-sale 71-90, pieces-detachees-de-navire 91-100
 *   mer/ete        cereales 1-9, armes 10-12, produits-de-luxe 13-16, metaux 17-22, bois 23-44, vin 45-56, laine 57-62, sel 63-75, huile 76-82, poisson-sale 83-90, pieces… 91-100
 *   mer/automne    cereales 1-18, armes 19-21, produits-de-luxe 22-25, metaux 26-30, bois 31-46, vin 47-60, laine 61-65, sel 66-72, huile 73-83, poisson-sale 84-90, pieces… 91-100
 *   mer/hiver      cereales 1-9, armes 10-12, produits-de-luxe 13-16, metaux 17-25, bois 26-36, vin 37-56, laine 57-60, sel 61-64, huile 65-81, poisson-sale 82-90, pieces… 91-100
 *   terre/printemps vivres 1-9, armement 10-15, produits-de-luxe 16-20, metal 21-30, bois 31-55, vin 56-75, laine 76-100
 *   terre/ete       vivres 1-19, armement 20-23, produits-de-luxe 24-29, metal 30-39, bois 40-74, vin 75-85, laine 86-100
 *   terre/automne   vivres 1-35, armement 36-40, produits-de-luxe 41-44, metal 45-60, bois 61-80, vin 81-95, laine 96-100
 *   terre/hiver     vivres 1-19, armement 20-23, produits-de-luxe 24-29, metal 30-44, bois 45-60, vin 61-95, laine 96-100
 * Ces bornes ne sont pas recopiées ici pour foi : `src/data/cargo-avail-raw.test.ts` les tient
 * cellule par cellule contre les deux livres, à chaque exécution.
 */
import { describe, it, expect } from 'vitest';
import { rollSeasonalCargo, type CargoDef } from './cargo';
import { cargoes } from './seaVoyage';
import type { RNG } from './dice';

const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

/** Deux cargaisons NUES, dont les fourchettes laissent 41–100 sans couverture. */
const trouee: CargoDef[] = [
  { id: 'a', label: 'A', avail: { printemps: { min: 1, max: 20 }, ete: { min: 1, max: 20 }, automne: { min: 1, max: 20 }, hiver: { min: 1, max: 20 } }, price: { printemps: 1, ete: 1, automne: 1, hiver: 1 } },
  { id: 'b', label: 'B', avail: { printemps: { min: 21, max: 40 }, ete: { min: 21, max: 40 }, automne: { min: 21, max: 40 }, hiver: { min: 21, max: 40 } }, price: { printemps: 1, ete: 1, automne: 1, hiver: 1 } },
];

describe('rollSeasonalCargo — la table couvre, ou elle se NOMME (#1659)', () => {
  it('un jet hors de toute fourchette LÈVE, en nommant le jet et la saison — jamais la dernière cargaison', () => {
    expect(() => rollSeasonalCargo(trouee, 'hiver', seq(77))).toThrowError(/le jet 77 .*hiver/);
    // La preuve du contraire : sans le refus, le repli aurait rendu « B », réponse plausible et fausse.
    expect(rollSeasonalCargo(trouee, 'hiver', seq(40)).id).toBe('b');
  });

  it('les bornes sont INCLUSIVES des deux côtés, et la borne basse compte', () => {
    expect(rollSeasonalCargo(trouee, 'ete', seq(21)).id).toBe('b');
    expect(rollSeasonalCargo(trouee, 'ete', seq(20)).id).toBe('a');
    expect(() => rollSeasonalCargo(trouee, 'ete', seq(41))).toThrowError(/le jet 41/);
  });

  it('le catalogue maritime authoré ne lève JAMAIS : les 100 jets d’une colonne rendent une cargaison (MDG 15 l.406-418)', () => {
    const catalogue = [...cargoes()];
    for (let r = 1; r <= 100; r++) expect(rollSeasonalCargo(catalogue, 'automne', seq(r)).id).toBeTruthy();
    // Les deux bouts imprimés de la colonne d'automne : 01-18 Céréales, 91-00 Pièces détachées.
    expect(rollSeasonalCargo(catalogue, 'automne', seq(1)).id).toBe('cereales');
    expect(rollSeasonalCargo(catalogue, 'automne', seq(100)).id).toBe('pieces-detachees-de-navire');
  });
});
