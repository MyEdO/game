import { tableTotale } from '../lib/tableTotale';
import { describe, it, expect } from 'vitest';
import type { RefASpecialisation } from '../data/schemas/grammaire/ref';
import { makeRNG, roll } from './dice';
import { findTableEntry } from './tables';
import { setRule } from './policy';
import { CHAR_KEYS, CharKey } from './types';
import {
  randomSpeciesTable,
  rollSpecies,
  speciesAllowed,
  rollCareer,
  validatePointBuy,
  POINT_BUY_TOTAL,
  rollInitialWealth,
  rollAge,
  rollHeight,
  rollEyes,
  rollHair,
  rollStar,
  applyStarOps,
  XP_SPECIES_ACCEPTED,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
  XP_STAR_ROLLED,
} from './creation';
import { careersForSpecies, findSpeciesById, offreDuJet, species, stars, type SpeciesData } from '../data';
import { setDataset } from '../data/overrides';
import { sousLeDe } from '../data/deDeLaTable.testkit';

describe('bonus de PX des choix aléatoires (LDB 04 l.91 / 05 l.208-341)', () => {
  it('valeurs verbatim', () => {
    expect(XP_SPECIES_ACCEPTED).toBe(20);
    expect(XP_CAREER_FIRST).toBe(50);
    expect(XP_CAREER_TOP3).toBe(25);
    expect(XP_CHARS_KEPT).toBe(50);
    expect(XP_CHARS_REASSIGNED).toBe(25);
  });
});

describe('rollStar — signe astral (ADE II, table d100)', () => {
  it('renvoie toujours un signe existant (par id STABLE) + le d100 tiré', () => {
    const ids = new Set(stars.map((s) => s.id));
    for (let seed = 0; seed < 200; seed++) {
      const r = rollStar(makeRNG(seed));
      expect(ids.has(r.id)).toBe(true);
      expect(r.roll).toBeGreaterThanOrEqual(1);
      expect(r.roll).toBeLessThanOrEqual(100);
    }
  });

  it('déterministe pour un même seed', () => {
    expect(rollStar(makeRNG(1234))).toEqual(rollStar(makeRNG(1234)));
  });

  it('la sentinelle de test « TEST » est absente des données émises', () => {
    expect(stars.some((s) => s.label === 'TEST' || s.rand > 100)).toBe(false);
  });

  it('l\'Étoile du Sorcier : le 1d10 interne produit les 4 variantes (ADE II 3 l.63)', () => {
    const variants = stars.filter((s) => /Étoile du Sorcier/.test(s.label)).map((s) => s.id);
    expect(variants.length).toBe(4);
    const seen = new Set<string>();
    for (let seed = 0; seed < 3000; seed++) {
      const r = rollStar(makeRNG(seed)).id;
      if (/etoile-du-sorcier/.test(r)) {
        expect(variants).toContain(r); // jamais une variante hors des 4 bandes
        seen.add(r);
      }
    }
    expect(seen.size).toBe(4); // les 4 bandes du d10 sont atteignables
  });
});

describe('applyStarOps — effet d\'un signe aux ATTRIBUTS DE DÉPART (ADE II 3 l.38)', () => {
  const baseChars = () => tableTotale(CHAR_KEYS, () => 30);

  it('XP_STAR_ROLLED = 25 (l.36)', () => {
    expect(XP_STAR_ROLLED).toBe(25);
  });

  it('applique les charMod (±carac) — Wymund : +2 Soc, +2 I, -3 Int', () => {
    const chars = baseChars();
    const talents: RefASpecialisation[] = [];
    applyStarOps('wymund-l-anachorete', chars, (t) => talents.push(t)); // id STABLE
    expect(chars.sociabilite).toBe(32);
    expect(chars.initiative).toBe(32);
    expect(chars.intelligence).toBe(27);
    expect(talents).toEqual([]);
  });

  it('octroie le Talent + applique la pénalité — Mummit le Fou : Chanceux, -3 FM', () => {
    const chars = baseChars();
    const talents: RefASpecialisation[] = [];
    applyStarOps('mummit-le-fou', chars, (t) => talents.push(t)); // id STABLE
    expect(chars['force-mentale']).toBe(27);
    expect(talents).toEqual([{ id: 'chanceux' }]);
  });

  it('un Talent octroyé « Au choix » est un emplacement `choix`, à l\'adresse de son op — Les Deux Bœufs', () => {
    const recus: [RefASpecialisation, number][] = [];
    applyStarOps('les-deux-boeufs', baseChars(), (t, k) => recus.push([t, k]));
    expect(recus).toEqual([[{ id: 'maitre-artisan', choix: true }, 1]]);
  });

  it('signe inconnu = aucun effet (pas d\'appel à addTalent)', () => {
    const chars = baseChars();
    applyStarOps('Inexistant', chars, () => { throw new Error('addTalent ne doit pas être appelé'); });
    expect(CHAR_KEYS.every((k) => chars[k] === 30)).toBe(true);
  });
});

describe('Tableau des Races aléatoires (LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121)', () => {
  const GNOME = 'creation-gnome-jouable';
  const OGRE = 'creation-ogre-jouable';
  /** Les espèces que le jet `n` offre au joueur, sur la table qui s'applique. */
  const auJet = (n: number) => findTableEntry(randomSpeciesTable().entries, n).ids;
  /** Les espèces ouvertes de la race `race`, l'espèce nominale `nominale` en tête (LDB 04 l.91 ; ADE I 02 l.257). */
  const deLaRace = (nominale: string, race: string) => [nominale, ...species.filter((s) => s.refChar === race && s.id !== nominale).map((s) => s.id)];

  it('règles par défaut : la table du LDB, une rangée offre toute sa race, l’espèce nominale en tête', () => {
    expect(auJet(93)).toEqual(deLaRace('halflings', 'halfling'));
    expect(auJet(90)).toEqual(deLaRace('humains-reiklander', 'humain'));
    expect(auJet(98)).toEqual(deLaRace('nains', 'nain'));
    expect(auJet(99)).toEqual(['hauts-elfes']);
    expect(auJet(100)).toEqual(['elfes-sylvains']);
  });

  it('Gnome seul : la table de NADJ', () => {
    setRule(GNOME, true);
    expect(auJet(98)).toEqual(['gnomes']);
    expect(auJet(94)).toEqual(deLaRace('nains', 'nain'));
    expect(auJet(89)).toEqual(deLaRace('humains-reiklander', 'humain'));
  });

  it('Ogre seul : la table d’ADE II', () => {
    setRule(OGRE, true);
    expect(auJet(98)).toEqual(['ogres']);
    expect(auJet(90)).toEqual(deLaRace('halflings', 'halfling'));
  });

  it('Gnome et Ogre : la table maison', () => {
    setRule(GNOME, true);
    setRule(OGRE, true);
    expect(auJet(97)).toEqual(['gnomes']);
    expect(auJet(98)).toEqual(['ogres']);
    expect(auJet(89)).toEqual(deLaRace('halflings', 'halfling'));
    expect(auJet(88)).toEqual(deLaRace('humains-reiklander', 'humain'));
  });

  it('pour chaque combinaison des règles qui gatent une espèce, exactement une table s’applique, à rangées égales aux races ouvertes', () => {
    const regles = [...new Set(species.flatMap((s) => (s.gatedByRule ? [s.gatedByRule.id] : [])))];
    for (let masque = 0; masque < 2 ** regles.length; masque++) {
      regles.forEach((r, i) => setRule(r, (masque & (2 ** i)) !== 0));
      const ouvertes = new Set(species.filter(speciesAllowed).map((s) => s.refChar));
      const races = randomSpeciesTable().entries.map((e) => findSpeciesById(e.ids[0])!.refChar);
      expect(new Set(races), regles.filter((_, i) => masque & (2 ** i)).join('+') || 'aucune').toEqual(ouvertes);
      expect(races).toHaveLength(ouvertes.size);
    }
  });

  it('rollSpecies : au dé de la table, la rangée atteinte', () => {
    const a = rollSpecies(makeRNG(7));
    expect(a).toEqual(rollSpecies(makeRNG(7)));
    expect(a.ids).toEqual(auJet(a.roll));
  });

  it('le gate porte sur l’ESPÈCE (`gatedByRule`), pas sur son livre : une espèce NADJ sans le champ est ouverte dans sa race', () => {
    const gnome = findSpeciesById('gnomes')!;
    const fictive: SpeciesData = { ...gnome, id: 'sonde-espece-nadj', label: 'Sonde NADJ', refChar: 'halfling' };
    delete fictive.gatedByRule;
    setDataset('species', [...species, fictive]);
    try {
      expect(auJet(93)).toContain('sonde-espece-nadj');
      setRule(GNOME, true);
      expect(auJet(98)).toEqual(['gnomes']);
    } finally {
      setDataset('species', species.filter((s) => s !== fictive));
    }
  });
});

describe('Tableau des Classes et Carrières aléatoires (LDB 05 l.214+)', () => {
  it('rollCareer : la borne renvoie des carrières TOUTES accessibles à l\'espèce', () => {
    const sylvain = findSpeciesById('elfes-sylvains')!;
    const accessibles = new Set(careersForSpecies(sylvain).map((c) => c.id));
    for (let seed = 1; seed <= 20; seed++) {
      const r = rollCareer(sylvain, false, makeRNG(seed));
      for (const id of offreDuJet(sylvain, r)) expect(accessibles, id).toContain(id);
    }
  });
});

describe('répartition de 100 Points (LDB 05 l.341 : min 4, max 18)', () => {
  const alloc = (v: number): Record<CharKey, number> => tableTotale(CHAR_KEYS, () => v);
  it('valide : 10 × 10 = 100', () => {
    expect(validatePointBuy(alloc(10)).ok).toBe(true);
    expect(POINT_BUY_TOTAL).toBe(100);
  });
  it('refus : total ≠ 100, min < 4, max > 18', () => {
    expect(validatePointBuy({ ...alloc(10), 'capacite-de-combat': 11 }).ok).toBe(false); // 101
    expect(validatePointBuy({ ...alloc(10), 'capacite-de-combat': 3, 'capacite-de-tir': 17 }).ok).toBe(false); // min
    expect(validatePointBuy({ ...alloc(10), 'capacite-de-combat': 19, 'capacite-de-tir': 1 }).ok).toBe(false); // max
  });
});

describe('Richesse initiale (LDB 05 l.578-583)', () => {
  it('Bronze N : 2N d10 sous ; Argent N : N d10 pistoles ; Or N : N CO ; Standing 0 : rien', () => {
    const bronze = rollInitialWealth({ tier: 'bronze', standing: 3 }, makeRNG(1)).montant;
    expect(bronze.gold).toBe(0);
    expect(bronze.silver).toBe(0);
    expect(bronze.brass).toBeGreaterThanOrEqual(6); // 6d10
    expect(bronze.brass).toBeLessThanOrEqual(60);
    const silver = rollInitialWealth({ tier: 'argent', standing: 3 }, makeRNG(1)).montant;
    expect(silver.silver).toBeGreaterThanOrEqual(3);
    expect(silver.silver).toBeLessThanOrEqual(30);
    expect(rollInitialWealth({ tier: 'or', standing: 3 }, makeRNG(1)).montant).toEqual({ gold: 3, silver: 0, brass: 0 });
    expect(rollInitialWealth({ tier: 'bronze', standing: 0 }, makeRNG(1)).montant).toEqual({ gold: 0, silver: 0, brass: 0 });
  });
});

describe('Détails (LDB 05 l.701-768)', () => {
  it('âge/taille dans les bornes par espèce', () => {
    const human = findSpeciesById('humains-reiklander')!;
    const dwarf = findSpeciesById('nains')!;
    for (let seed = 1; seed <= 10; seed++) {
      const a = rollAge(human.refChar, makeRNG(seed));
      expect(a).toBeGreaterThanOrEqual(16); // 15 + 1d10
      expect(a).toBeLessThanOrEqual(25);
      const t = rollHeight(dwarf.refChar, makeRNG(seed)); // 130 + 3d10
      expect(t).toBeGreaterThanOrEqual(133);
      expect(t).toBeLessThanOrEqual(160);
    }
  });
  it('Taille gnome : 1d10 × 2,5 cm + 100 cm, bornée 102,5 à 125 (NADJ 15 l.112)', () => {
    const gnome = findSpeciesById('gnomes')!;
    const tailles = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) tailles.add(rollHeight(gnome.refChar, makeRNG(seed)));
    expect(Math.min(...tailles)).toBe(102.5);
    expect(Math.max(...tailles)).toBe(125);
    expect([...tailles].every((t) => (t - 100) % 2.5 === 0)).toBe(true);
  });
  it('yeux/cheveux : libellé non vide tiré des tables, déterministe', () => {
    const elf = findSpeciesById('hauts-elfes')!;
    expect(rollEyes(elf.refChar, makeRNG(3))).toBe(rollEyes(elf.refChar, makeRNG(3)));
    expect(rollEyes(elf.refChar, makeRNG(3)).length).toBeGreaterThan(0);
    expect(rollHair(elf.refChar, makeRNG(3)).length).toBeGreaterThan(0);
  });
});

describe('Couleur des cheveux — bornes 2d10 PAR RACE (rollHair, #420)', () => {
  // NADJ « 15 - _GoBack.md » l.99-104 (gnome, p.89) : bornes 4-6/7-10/11 ≠ LDB.
  const gnomeHair = (d2: number): string =>
    d2 <= 2 ? 'Noir' : d2 === 3 ? 'Brun foncé' : d2 <= 6 ? 'Brun' : d2 <= 10 ? 'Brun pâle'
    : d2 === 11 ? 'Auburn' : d2 <= 14 ? 'Roux' : d2 <= 17 ? 'Blond roux' : d2 === 18 ? 'Bond doré'
    : d2 === 19 ? 'Blond platine' : 'Blanc';
  // LDB 05 l.758-768 (humain reiklander) : bornes 4/5-7/8-11.
  const humainHair = (d2: number): string =>
    d2 <= 2 ? 'Blond blanc' : d2 === 3 ? 'Blond doré' : d2 === 4 ? 'Blond roux' : d2 <= 7 ? 'Brun doré'
    : d2 <= 11 ? 'Brun clair' : d2 <= 14 ? 'Brun foncé' : d2 <= 17 ? 'Noir' : d2 === 18 ? 'Auburn'
    : d2 === 19 ? 'Roux' : 'Gris';
  // ADE II « 02 - Les ogres.md » l.305-311 (p.21) : bornes 2/3/4/5-7/8-11 — motif IDENTIQUE au LDB (#423).
  const ogreHair = (d2: number): string =>
    d2 <= 2 ? 'Marron' : d2 === 3 ? 'Acajou' : d2 === 4 ? 'Blond cendré' : d2 <= 7 ? 'Marron clair'
    : d2 <= 11 ? 'Lie de vin' : d2 <= 14 ? 'Marron foncé' : d2 <= 17 ? 'Noir' : d2 === 18 ? 'Charbon'
    : d2 === 19 ? 'Noir de jais' : 'Bleu nuit';
  const gnome = findSpeciesById('gnomes')!;
  const humain = findSpeciesById('humains-reiklander')!;
  const ogre = findSpeciesById('ogres')!;
  it('Gnome : chaque 2d10 rend la couleur NADJ — décalée du LDB pour 5,6,8,9,10 (rouge avant #420)', () => {
    for (let seed = 0; seed < 400; seed++) {
      const d2 = roll(2, 10, makeRNG(seed)); // même 1er tirage que rollHair(makeRNG(seed))
      expect(rollHair(gnome.refChar, makeRNG(seed)), `seed=${seed} 2d10=${d2}`).toBe(gnomeHair(d2));
    }
  });
  it('Les races LDB gardent les bornes LDB (override race-scopé) — humain reiklander', () => {
    for (let seed = 0; seed < 400; seed++) {
      const d2 = roll(2, 10, makeRNG(seed));
      expect(rollHair(humain.refChar, makeRNG(seed)), `seed=${seed} 2d10=${d2}`).toBe(humainHair(d2));
    }
  });
  it('Ogre : chaque 2d10 rend la couleur ADE II — motif LDB confirmé au livre (#423)', () => {
    for (let seed = 0; seed < 400; seed++) {
      const d2 = roll(2, 10, makeRNG(seed));
      expect(rollHair(ogre.refChar, makeRNG(seed)), `seed=${seed} 2d10=${d2}`).toBe(ogreHair(d2));
    }
  });
});

describe('Couleur des yeux / des cheveux — le tirage suit le dé de sa table (#3578)', () => {
  const humain = findSpeciesById('humains-reiklander')!;
  const tirages = (tirer: typeof rollEyes) => new Set(Array.from({ length: 300 }, (_, seed) => tirer(humain.refChar, makeRNG(seed))));
  it('à 1d10 posé par le seam, aucune couleur au-delà du seuil 10 (LDB 05 l.745-749, l.759-763)', () => {
    sousLeDe('eyes', '1d10', () => sousLeDe('hairs', '1d10', () => {
      expect(tirages(rollEyes)).toEqual(new Set(['Au choix', 'Vert', 'Bleu pâle', 'Bleu', 'Gris pâle']));
      expect(tirages(rollHair)).toEqual(new Set(['Blond blanc', 'Blond doré', 'Blond roux', 'Brun doré', 'Brun clair']));
    }));
  });
});
