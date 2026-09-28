/**
 * Génération de noms à la création (Jalon 3). Pools : `src/data/names.json` (banque de noms par
 * race et par sexe, projet WarhammerV2 de l'utilisateur). Structure par espèce : « Prénom + Nom »
 * pour tous, SAUF les Nains dont le nom de famille est GÉNÉRÉ selon le canon — parent + suffixe
 * sexué (LDB 05 l.620-624 : « –sson » fils de…, « –sdottir » fille de…, « –snev »/« –sniz »).
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { generateName } from './names';
import { names as N } from '../data';
import speciesJson from '../data/species.json';
import { sexeSchema, type RaceKey } from '../data/schemas/grammaire/valeurs';
const startsWithOne = (name: string, pool: string[]) => pool.some((p) => name.startsWith(p + ' '));
const endsWithOne = (name: string, pool: string[]) => pool.some((p) => name.endsWith(' ' + p));
/** Banque d'une race, retrouvée par son id — `names.json` est une LISTE de documents (#1467 L1b). */
const banque = (id: RaceKey) => N.find((n) => n.id === id)!;

// generateName est keyé par `species.refChar` (`RaceKey`, #313) et le document de banque porte le
// MÊME id (#1467 L1b) : la résolution est directe, sans conversion (cf. `engine/names.ts`).
describe('generateName — banque names.json + canon nain (LDB 05 l.627-633)', () => {
  it('Humain : « Prénom Famille », prénom du pool du SEXE', () => {
    for (let s = 1; s <= 25; s++) {
      const m = generateName('humain', 'M', makeRNG(s))!;
      expect(startsWithOne(m, banque('humain').maleFirstNames), m).toBe(true);
      expect(endsWithOne(m, banque('humain').lastNames), m).toBe(true);
      const f = generateName('humain', 'F', makeRNG(s))!;
      expect(startsWithOne(f, banque('humain').femaleFirstNames), f).toBe(true);
    }
  });

  it('Nain : famille = parent + suffixe SEXUÉ (l.622), jamais le pool (vide)', () => {
    for (let s = 1; s <= 25; s++) {
      const m = generateName('nain', 'M', makeRNG(s))!;
      expect(startsWithOne(m, banque('nain').maleFirstNames), m).toBe(true);
      expect(m).toMatch(/(sson|snev)$/);
      const f = generateName('nain', 'F', makeRNG(s))!;
      expect(startsWithOne(f, banque('nain').femaleFirstNames), f).toBe(true);
      expect(f).toMatch(/(sdottir|sniz)$/);
    }
  });

  it('le parent du patronyme nain vient du pool de prénoms nains (mono-mot)', () => {
    const m = generateName('nain', 'M', makeRNG(7))!;
    const fam = m.slice(m.lastIndexOf(' ') + 1);
    const suffix = banque('nain').lastNameSuffixes!.M.find((sf) => fam.endsWith(sf))!;
    const parent = fam.slice(0, -suffix.length);
    expect([...banque('nain').maleFirstNames, ...banque('nain').femaleFirstNames]).toContain(parent);
  });

  it('Elfes : prénom du pool de la lignée + épithète (lastNames) — deux banques distinctes', () => {
    const he = generateName('haut-elfe', 'M', makeRNG(3))!;
    expect(startsWithOne(he, banque('haut-elfe').maleFirstNames), he).toBe(true);
    expect(endsWithOne(he, banque('haut-elfe').lastNames), he).toBe(true);
    const es = generateName('elfe-sylvain', 'F', makeRNG(3))!;
    expect(startsWithOne(es, banque('elfe-sylvain').femaleFirstNames), es).toBe(true);
    expect(endsWithOne(es, banque('elfe-sylvain').lastNames), es).toBe(true);
  });

  it('CHAQUE species de species.json résout son pool (par refChar) et produit un nom (M et F)', () => {
    // Preuve du routage par refChar : on parcourt les VRAIES espèces (les 20 variantes régionales
    // partagent la banque de leur race — `humain`, `halfling`, `nain`…).
    const species = speciesJson as { label: string; refChar: RaceKey }[];
    for (const sp of species) {
      expect(N.find((n) => n.id === sp.refChar), `${sp.label} → refChar ${JSON.stringify(sp.refChar)} absent de names.json`).toBeTruthy();
      for (const sex of sexeSchema.options) {
        const n = generateName(sp.refChar, sex, makeRNG(11));
        expect(n, `${sp.label} (${sp.refChar}) ${sex}`).toBeTruthy();
        expect(n!.split(' ').length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('déterministe à graine égale, varie avec la graine', () => {
    expect(generateName('nain', 'F', makeRNG(42))).toBe(generateName('nain', 'F', makeRNG(42)));
    const set = new Set(Array.from({ length: 12 }, (_, i) => generateName('humain', 'M', makeRNG(i + 1))));
    expect(set.size).toBeGreaterThan(6); // banque large → très peu de collisions sur 12 tirages
  });
});
