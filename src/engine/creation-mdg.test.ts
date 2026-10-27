/**
 * Tables de tirage MDG (La Mer des Griffes) :
 *  - Classe Côtier (MDG 09 l.9 + l.21-30) : la table Côtiers REMPLACE la portion Riverains — choix du
 *    joueur AVANT le d100, implémenté par filtrage de la liste passée à `rollCareer` (zéro changement
 *    moteur : `careerRollPool`, brouillon.ts). Bornes vérifiées colonne par colonne contre la table imprimée.
 *  - Carrières norses (MDG 07 l.269-303) : colonne `Norse` de `CareerData.rand`, lue via
 *    `SpeciesData.refCareer = 'Norse'` des 3 origines humaines norses — la table Norse embarque déjà
 *    les variantes côtières (pas de portion Riverains : rien à remplacer, swap indisponible).
 *  - Prêtre de Stromfels (MDG 11 l.89) : « Vous ne pouvez pas prendre Prêtre de Stromfels comme
 *    première Carrière » → aucune colonne de tirage, inaccessible à la création.
 */
import { describe, it, expect } from 'vitest';
import { rollCareer } from './creation';
import { careers, careersForSpecies, findCareerById, findSpeciesById, levelsForCareer, species } from '../data';
import { newDraft, withSpecies, withCoastalSwap, careerRollPool, coastalSwapAvailable, type CreatorDraft } from '../noyau/creation/brouillon';
import { deFixe } from './dice.testkit';

/** RNG figé : le d100 tombe toujours sur `v`. */
const fixed = deFixe;

/** Brouillon du créateur pour (espèce, swap) — la table effective est celle du VRAI créateur. */
const draft = (speciesId: string, coastalSwap: boolean): CreatorDraft =>
  withCoastalSwap(withSpecies(newDraft(1), speciesId), coastalSwap);
const poolFor = (speciesId: string, coastalSwap: boolean) => careerRollPool(draft(speciesId, coastalSwap));

const sp = (id: string) => findSpeciesById(id)!;

describe('Classe Côtier — swap Riverains ↔ Côtiers (MDG 09 l.9, table l.21-30)', () => {
  it('les plages Côtiers occupent exactement l’empan des Riverains (table contiguë après swap)', () => {
    for (const speciesId of ['humains-reiklander', 'nains', 'halflings', 'hauts-elfes', 'elfes-sylvains']) {
      const refCareer = sp(speciesId).refCareer;
      expect(coastalSwapAvailable(draft(speciesId, false)), speciesId).toBe(true);
      for (const swap of [false, true]) {
        const table = poolFor(speciesId, swap).filter((c) => c.rand?.[refCareer] != null);
        const bounds = [...new Set(table.map((c) => c.rand[refCareer] as number))].sort((a, b) => a - b);
        // chaque d100 de 1 à 100 résout sur une borne (aucun trou dans la table)
        expect(bounds[bounds.length - 1], `${refCareer} swap=${swap}`).toBe(100);
      }
    }
  });

  it('tirages côtiers verbatim (colonne Humain) : 60→Artilleur de navire · 65→Marin (Côtier) · 71→Prêtre marin · 73→Ratisseur', () => {
    const humain = sp('humains-reiklander');
    const cotier = poolFor('humains-reiklander', true);
    expect(rollCareer(cotier, humain, fixed(60))!.ids).toContain('artilleur-de-navire');
    expect(rollCareer(cotier, humain, fixed(65))!.ids).toContain('marin-cotier');
    expect(rollCareer(cotier, humain, fixed(71))!.ids).toContain('pretre-marin-de-manann');
    expect(rollCareer(cotier, humain, fixed(73))!.ids).toContain('ratisseur-de-plages');
    // sans swap, les mêmes d100 restent sur la portion Riverains LDB
    const ldb = poolFor('humains-reiklander', false);
    for (const r of [60, 65, 71, 73]) {
      const ids = rollCareer(ldb, humain, fixed(r))!.ids;
      for (const id of ids) expect(findCareerById(id)!.class).toBe('riverains');
    }
  });

  it('colonnes non-humaines verbatim : Nain 73→Artilleur · Halfling 70→Marin (Côtier) · Haut Elfe 78→Officier · Elfe Sylvain 61→Naufrageur (Côtier)', () => {
    expect(rollCareer(poolFor('nains', true), sp('nains'), fixed(73))!.ids).toContain('artilleur-de-navire');
    expect(rollCareer(poolFor('halflings', true), sp('halflings'), fixed(70))!.ids).toContain('marin-cotier');
    expect(rollCareer(poolFor('hauts-elfes', true), sp('hauts-elfes'), fixed(78))!.ids).toContain('officier');
    expect(rollCareer(poolFor('elfes-sylvains', true), sp('elfes-sylvains'), fixed(61))!.ids).toContain('naufrageur-cotier');
  });

  it('une borne tirée ne mélange JAMAIS Riverains et Côtiers (le swap est un remplacement, pas un cumul)', () => {
    const humain = sp('humains-reiklander');
    for (const swap of [false, true]) {
      const pool = poolFor('humains-reiklander', swap);
      for (let r = 1; r <= 100; r++) {
        const ids = rollCareer(pool, humain, fixed(r))!.ids;
        const classes = new Set(ids.map((id) => findCareerById(id)!.class));
        expect(classes.has('riverains') && classes.has('cotiers'), `d100=${r} swap=${swap}`).toBe(false);
      }
    }
  });

  it('tables régionales NON étendues par MDG (Nordland…) : swap indisponible, table LDB intacte', () => {
    expect(coastalSwapAvailable(draft('humains-nordland', false))).toBe(false);
    // même cochée, la bascule ne troue pas la table : la colonne Nordland garde ses Riverains
    const table = poolFor('humains-nordland', true).filter((c) => c.rand?.nordland != null);
    expect(table.some((c) => c.class === 'riverains')).toBe(true);
  });
});

describe('Carrières norses (MDG 07 l.269-303) — colonne Norse + refCareer des origines', () => {
  it('les 3 origines humaines norses tirent sur la colonne Norse ; le nain norse reste sur la table Nain (ch.6 muet)', () => {
    for (const id of ['humains-bjornling-norse', 'humains-sarl-norse', 'humains-skaeling-norse'])
      expect(sp(id).refCareer, id).toBe('norse');
    expect(sp('nains-norse').refCareer).toBe('nain');
  });

  it('la table Norse n’a pas de portion Riverains : rien à remplacer — le pool du créateur garde les variantes côtières', () => {
    expect(coastalSwapAvailable(draft('humains-skaeling-norse', false))).toBe(false);
    const norse = sp('humains-skaeling-norse');
    // pool par défaut (swap décoché) : le d100 12-29 DOIT tomber sur les carrières côtières de la table
    const ids = rollCareer(poolFor('humains-skaeling-norse', false), norse, fixed(15))!.ids;
    expect(ids).toContain('marin-cotier');
  });

  it('tirages norses verbatim : 02→Agitateur · 12/19→Marin (Côtier) · 24→Naufrageur (Côtier) · 29→Ratisseur · 56→Soldat · 77→Sorcier dissident · 95→Villageois', () => {
    const norse = sp('humains-skaeling-norse');
    const at = (r: number) => rollCareer(careers, norse, fixed(r))!.ids;
    expect(at(2)).toContain('agitateur');
    expect(at(12)).toContain('marin-cotier');
    expect(at(19)).toContain('marin-cotier');
    expect(at(24)).toContain('naufrageur-cotier');
    expect(at(29)).toContain('ratisseur-de-plages');
    expect(at(56)).toContain('soldat');
    expect(at(77)).toContain('sorcier-dissident');
    expect(at(95)).toContain('villageois');
  });

  it('la table Norse est contiguë (borne max 100) et route la classe CÔTIERS vers les variantes côtières', () => {
    const table = careers.filter((c) => c.rand?.norse != null);
    const bounds = [...new Set(table.map((c) => c.rand.norse as number))].sort((a, b) => a - b);
    expect(bounds[bounds.length - 1]).toBe(100);
    for (const c of table.filter((x) => x.class === 'cotiers'))
      expect(['marin-cotier', 'naufrageur-cotier', 'nautonier-cotier', 'ratisseur-de-plages']).toContain(c.id);
    // aucune carrière Riverains dans la table norse (classe absente du tableau MDG 07)
    expect(table.some((c) => c.class === 'riverains')).toBe(false);
  });
});

describe('Prêtre de Stromfels (MDG 11 l.85-137)', () => {
  it('interdit en première Carrière : absent de toute colonne de tirage/accessibilité', () => {
    for (const s of species) expect(careersForSpecies(s.refCareer).some((c) => c.id === 'pretre-de-stromfels'), s.id).toBe(false);
  });
  it('4 niveaux complets, schéma de progression PDF p.90 (N1 CC/F/I · N2 Soc · N3 Ag · N4 CT)', () => {
    const levels = levelsForCareer('pretre-de-stromfels');
    expect(levels.map((l) => l.label)).toEqual(['Initié', 'Prêtre de Stromfels', 'Prêtre pirate', 'Prêtre terreur des mers']);
    expect(levels.map((l) => l.status)).toEqual(['Argent 2', 'Argent 3', 'Argent 4', 'Argent 5']);
    expect(levels.map((l) => l.characteristics)).toEqual([['capacite-de-combat', 'force', 'initiative'], ['sociabilite'], ['agilite'], ['capacite-de-tir']]);
  });
});
