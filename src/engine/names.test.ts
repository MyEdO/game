import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { desEnSuite } from './dice.testkit';
import { generateName } from './names';
import { names as N, species } from '../data';
import { sexeSchema, type RaceKey } from '../data/schemas/grammaire/valeurs';
const startsWithOne = (name: string, pool: string[]) => pool.some((p) => name.startsWith(p + ' '));
const endsWithOne = (name: string, pool: string[]) => pool.some((p) => name.endsWith(' ' + p));
/** Banque d'une race, retrouvée par son id — `names.json` est une LISTE de documents (#1467 L1b). */
const banque = (id: RaceKey) => N.find((n) => n.id === id)!;

// generateName est keyé par `species.refChar` (`RaceKey`, #313) et le document de banque porte le
// MÊME id (#1467 L1b) : la résolution est directe, sans conversion (cf. `engine/names.ts`).
describe('generateName — banques de noms', () => {
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

  it('Gnome : prénom du sexe et clan ou pseudonyme de sa banque (NADJ 15 l.55-72)', () => {
    for (const sex of sexeSchema.options) {
      const gnome = banque('gnome');
      const nom = generateName('gnome', sex, makeRNG(42))!;
      expect(startsWithOne(nom, sex === 'F' ? gnome.femaleFirstNames : gnome.maleFirstNames)).toBe(true);
      expect(endsWithOne(nom, gnome.lastNames)).toBe(true);
    }
  });

  it.each([
    [1, 1, 'Arabba'],
    [65, 19, 'Tergarthash'],
    [67, 24, 'Thagelg'],
    [68, 27, 'Thazelg'],
    [69, 1, 'Thegizabba'],
    [70, 1, 'Therabba'],
    [71, 1, 'Thugabba'],
    [100, 100, 'Zoyogg'],
  ] as const)('Ogre traditionnel : les faces %i et %i donnent %s', (racine, terminaison, attendu) => {
    expect(generateName('ogre', 'F', desEnSuite([racine - 1, terminaison - 1]))).toBe(attendu);
  });

  it('Ogre : parcours humain et déterminisme à graine égale (ADE II 02 l.325-334)', () => {
    for (const sex of sexeSchema.options) {
      expect(generateName('ogre', sex, makeRNG(42), 'humain')).toBe(generateName('humain', sex, makeRNG(42)));
      expect(generateName('ogre', sex, makeRNG(42))).toBe(generateName('ogre', sex, makeRNG(42)));
    }
  });

  it('CHAQUE species de species.json résout son pool (par refChar) et produit un nom (M et F)', () => {
    // Preuve du routage par refChar : on parcourt les VRAIES espèces (les 20 variantes régionales
    // partagent la banque de leur race — `humain`, `halfling`, `nain`…).
    for (const sp of species) {
      expect(N.find((n) => n.id === sp.refChar), `${sp.label} → refChar ${JSON.stringify(sp.refChar)} absent de names.json`).toBeTruthy();
      for (const sex of sexeSchema.options) {
        const n = generateName(sp.refChar, sex, makeRNG(11));
        expect(n, `${sp.label} (${sp.refChar}) ${sex}`).toBeTruthy();
        if (sp.refChar === 'ogre') {
          expect(n).toMatch(/^\S+$/);
        } else {
          expect(n!.split(' ').length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('déterministe à graine égale, varie avec la graine', () => {
    expect(generateName('nain', 'F', makeRNG(42))).toBe(generateName('nain', 'F', makeRNG(42)));
    const set = new Set(Array.from({ length: 12 }, (_, i) => generateName('humain', 'M', makeRNG(i + 1))));
    expect(set.size).toBeGreaterThan(6); // banque large → très peu de collisions sur 12 tirages
  });
});
