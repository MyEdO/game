/**
 * Tables de tirage MDG (La Mer des Griffes) :
 *  - Classe Côtier (MDG 09 l.9 + l.21-30) : la table Côtiers REMPLACE la portion Riverains — choix du
 *    joueur AVANT le d100 : la portion de la colonne (`carrieres-aleatoires.json`, `colonne` posée) remplace
 *    l'étendue qu'elle couvre (`tableDeCarrieres`). Bornes vérifiées colonne par colonne contre la table imprimée.
 *  - Carrières norses (MDG 07 l.269-303) : colonne `norse` de `carrieres-aleatoires.json`, lue via
 *    `SpeciesData.refCareer = 'Norse'` des 3 origines humaines norses — la table Norse embarque déjà
 *    les variantes côtières (pas de portion Riverains : rien à remplacer, swap indisponible).
 *  - Prêtre de Stromfels (MDG 11 l.89) : « Vous ne pouvez pas prendre Prêtre de Stromfels comme
 *    première Carrière » → aucune colonne de tirage, inaccessible à la création.
 */
import { describe, it, expect } from 'vitest';
import { rollCareer } from './creation';
import { careersForSpecies, colonneDeCarrieres, findCareerById, findSpeciesById, levelsForCareer, offreDuJet, species, tableDeCarrieres } from '../data';
import { newDraft, withSpecies, withCoastalSwap, coastalSwapAvailable, type CreatorDraft } from '../noyau/creation/brouillon';
import { deFixe } from './dice.testkit';

/** RNG figé : le d100 tombe toujours sur `v`. */
const fixed = deFixe;

/** Brouillon du créateur pour (espèce, swap) — la table effective est celle du VRAI créateur. */
const draft = (speciesId: string, coastalSwap: boolean): CreatorDraft =>
  withCoastalSwap(withSpecies(newDraft(1), speciesId), coastalSwap);
/** Le jet `r` d'une espèce, avec ou sans le remplacement. */
const tire = (speciesId: string, swap: boolean, r: number) => offreDuJet(sp(speciesId), rollCareer(sp(speciesId), swap, fixed(r)));

const sp = (id: string) => findSpeciesById(id)!;

describe('Classe Côtier — swap Riverains ↔ Côtiers (MDG 09 l.9, table l.21-30)', () => {
  it('les plages Côtiers occupent exactement l’empan des Riverains (table contiguë après swap)', () => {
    for (const speciesId of ['humains-reiklander', 'nains', 'halflings', 'hauts-elfes', 'elfes-sylvains']) {
      const refCareer = sp(speciesId).refCareer;
      expect(coastalSwapAvailable(draft(speciesId, false)), speciesId).toBe(true);
      for (const swap of [false, true]) {
        const table = tableDeCarrieres(refCareer, swap).entries;
        // chaque d100 de 1 à 100 résout sur une rangée (aucun trou ni chevauchement)
        expect(table.map((r) => `${r.min}-${r.max}`).join(' '), `${refCareer} swap=${swap}`).toBe(
          table.map((r, i) => `${i ? table[i - 1].max + 1 : 1}-${r.max}`).join(' '),
        );
        expect(table[table.length - 1].max, `${refCareer} swap=${swap}`).toBe(100);
      }
    }
  });

  it('tirages côtiers verbatim (colonne Humain) : 60→Artilleur de navire · 65→Marin (Côtier) · 71→Prêtre marin · 73→Ratisseur', () => {
    expect(tire('humains-reiklander', true, 60)).toContain('artilleur-de-navire');
    expect(tire('humains-reiklander', true, 65)).toContain('marin-cotier');
    expect(tire('humains-reiklander', true, 71)).toContain('pretre-marin-de-manann');
    expect(tire('humains-reiklander', true, 73)).toContain('ratisseur-de-plages');
    // sans swap, les mêmes d100 restent sur la portion Riverains LDB
    for (const r of [60, 65, 71, 73]) {
      const ids = tire('humains-reiklander', false, r);
      for (const id of ids) expect(findCareerById(id)!.class.id).toBe('riverains');
    }
  });

  it('colonnes non-humaines verbatim : Nain 73→Artilleur · Halfling 70→Marin (Côtier) · Haut Elfe 78→Officier · Elfe Sylvain 61→Naufrageur (Côtier)', () => {
    expect(tire('nains', true, 73)).toContain('artilleur-de-navire');
    expect(tire('halflings', true, 70)).toContain('marin-cotier');
    expect(tire('hauts-elfes', true, 78)).toContain('officier');
    expect(tire('elfes-sylvains', true, 61)).toContain('naufrageur-cotier');
  });

  it('une borne tirée ne mélange JAMAIS Riverains et Côtiers (le swap est un remplacement, pas un cumul)', () => {
    for (const swap of [false, true]) {
      for (let r = 1; r <= 100; r++) {
        const ids = tire('humains-reiklander', swap, r);
        const classes = new Set(ids.map((id) => findCareerById(id)!.class.id));
        expect(classes.has('riverains') && classes.has('cotiers'), `d100=${r} swap=${swap}`).toBe(false);
      }
    }
  });

  it('tables régionales NON étendues par MDG (Nordland…) : swap indisponible, table LDB intacte', () => {
    expect(coastalSwapAvailable(draft('humains-nordland', false))).toBe(false);
    // même cochée, la bascule ne troue pas la table : la colonne Nordland garde ses Riverains
    const ids = tableDeCarrieres('nordland', true).entries.map((r) => r.id);
    expect(ids.some((id) => findCareerById(id)!.class.id === 'riverains')).toBe(true);
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
    // swap décoché : le d100 12-29 DOIT tomber sur les carrières côtières de la table
    expect(tire('humains-skaeling-norse', false, 15)).toContain('marin-cotier');
  });

  it('tirages norses verbatim : 02→Agitateur · 12/19→Marin (Côtier) · 24→Naufrageur (Côtier) · 29→Ratisseur · 56→Soldat · 77→Sorcier dissident · 95→Villageois', () => {
    const at = (r: number) => tire('humains-skaeling-norse', false, r);
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
    const rangees = colonneDeCarrieres('norse').entries;
    expect(rangees[rangees.length - 1].max).toBe(100);
    const table = rangees.map((r) => r.id).map((id) => findCareerById(id)!);
    for (const c of table.filter((x) => x.class.id === 'cotiers'))
      expect(['marin-cotier', 'naufrageur-cotier', 'nautonier-cotier', 'ratisseur-de-plages']).toContain(c.id);
    // aucune carrière Riverains dans la table norse (classe absente du tableau MDG 07)
    expect(table.some((c) => c.class.id === 'riverains')).toBe(false);
  });
});

describe('Prêtre de Stromfels (MDG 11 l.85-137)', () => {
  it('interdit en première Carrière : absent de toute colonne de tirage/accessibilité', () => {
    for (const s of species) expect(careersForSpecies(s).some((c) => c.id === 'pretre-de-stromfels'), s.id).toBe(false);
  });
  it('4 niveaux complets, schéma de progression PDF p.90 (N1 CC/F/I · N2 Soc · N3 Ag · N4 CT)', () => {
    const levels = levelsForCareer('pretre-de-stromfels');
    expect(levels.map((l) => l.label)).toEqual(['Initié', 'Prêtre de Stromfels', 'Prêtre pirate', 'Prêtre terreur des mers']);
    expect(levels.map((l) => l.status)).toEqual(['Argent 2', 'Argent 3', 'Argent 4', 'Argent 5']);
    expect(levels.map((l) => l.characteristics)).toEqual([['capacite-de-combat', 'force', 'initiative'], ['sociabilite'], ['agilite'], ['capacite-de-tir']]);
  });
});
