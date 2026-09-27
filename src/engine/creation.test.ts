import { describe, it, expect, afterEach } from 'vitest';
import type { RefASpecialisation } from '../data/schemas/grammaire/ref';
import { makeRNG, roll } from './dice';
import { setRule, resetRule } from './policy';
import { CHAR_KEYS, CharKey } from './types';
import {
  randomSpeciesTable,
  rollSpecies,
  rollCareer,
  validatePointBuy,
  POINT_BUY_TOTAL,
  parseStatus,
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
import { careers, findSpeciesById, species, stars, type SpeciesData } from '../data';
import { setDataset } from '../data/overrides';

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
  const baseChars = () => Object.fromEntries(CHAR_KEYS.map((k) => [k, 30])) as Record<CharKey, number>;

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

describe('Tableau des Races aléatoires (LDB 04 l.93-101) — borne = CHOIX (species.rand partagé)', () => {
  it('bornes croissantes jusqu\'à 100 ; chaque borne porte TOUTES ses espèces (choix RAW)', () => {
    const table = randomSpeciesTable();
    const bounds = table.map((e) => e.max);
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
    expect(bounds[bounds.length - 1]).toBe(100);
    // Le jet désigne une borne ; le joueur choisit librement parmi ses espèces (plus de représentante).
    const byMax = Object.fromEntries(table.map((e) => [e.max, e.ids]));
    expect(byMax[90]).toContain('humains-reiklander');
    expect(byMax[94]).toContain('halflings');
    expect(byMax[99]).toContain('hauts-elfes');
    expect(byMax[100]).toContain('elfes-sylvains');
    // Toute id de toute borne doit résoudre vers une espèce existante.
    for (const e of table) for (const id of e.ids) expect(findSpeciesById(id), id).toBeTruthy();
  });
  it('rollSpecies : déterministe (RNG seedé) et cohérent — le jet tombe dans la borne renvoyée', () => {
    const a = rollSpecies(makeRNG(7));
    expect(a).toEqual(rollSpecies(makeRNG(7)));
    const entry = randomSpeciesTable().find((e) => a.roll <= e.max)!;
    expect(a.ids).toEqual(entry.ids);
  });
});

describe('Gnome jouable — règle optionnelle (NADJ 14 l.5)', () => {
  afterEach(() => resetRule('creation-gnome-jouable'));
  it('off (défaut) : le Gnome (NADJ) n\'est dans AUCUNE borne du Tableau des Races aléatoires', () => {
    expect(randomSpeciesTable().some((e) => e.ids.includes('gnomes'))).toBe(false);
  });
  it('on : le Gnome est une option NORMALE de sa borne 98 — Gnome ET Ogre y co-existent (choix)', () => {
    setRule('creation-gnome-jouable', true);
    const t = randomSpeciesTable();
    const b98 = t.find((e) => e.max === 98)!;
    expect(b98.ids).toContain('gnomes'); // ajouté par la règle
    expect(b98.ids).toContain('ogres'); // l'Ogre ADE II reste présent (aucune priorité)
  });

  it('SÉMANTIQUE : le gate porte sur l’ESPÈCE (`gatedByRule`), PAS sur son LIVRE — une autre espèce du MÊME livre sans le champ reste ouverte', () => {
    // Le filtre historique masquait TOUT le livre NADJ ; il porte désormais sur le champ déclaré par
    // l'entrée. Une espèce NADJ future SANS `gatedByRule` est donc ouverte — comportement VOULU,
    // asserté ici pour qu'aucune relecture ne le prenne pour une régression.
    const gnome = findSpeciesById('gnomes')!;
    expect(gnome.source.book).toBe('nuits-agitees-et-dures-journees');
    const fictive: SpeciesData = { ...gnome, id: 'sonde-espece-nadj', label: 'Sonde NADJ', rand: 97 };
    delete fictive.gatedByRule;
    setDataset('species', [...species, fictive]);
    try {
      const ids = () => randomSpeciesTable().flatMap((e) => e.ids);
      expect(ids()).toContain('sonde-espece-nadj'); // même livre, aucun champ → jamais masquée
      expect(ids()).not.toContain('gnomes'); // champ + règle inactive → masquée
      setRule('creation-gnome-jouable', true);
      expect(ids()).toContain('gnomes'); // règle active → ouverte
      expect(ids()).toContain('sonde-espece-nadj');
    } finally {
      setDataset('species', species.filter((s) => s !== fictive));
    }
  });
});

describe('Tableau des Classes et Carrières aléatoires (LDB 05 l.214+)', () => {
  it('rollCareer : la borne renvoie des carrières TOUTES accessibles à l\'espèce', () => {
    const sylvain = findSpeciesById('elfes-sylvains')!;
    for (let seed = 1; seed <= 20; seed++) {
      const r = rollCareer(careers, sylvain, makeRNG(seed))!;
      expect(r.ids.length).toBeGreaterThan(0);
      for (const id of r.ids) {
        const career = careers.find((c) => c.id === id)!;
        expect(career.rand[sylvain.refCareer], id).not.toBeNull();
      }
    }
  });
});

describe('répartition de 100 Points (LDB 05 l.341 : min 4, max 18)', () => {
  const alloc = (v: number): Record<CharKey, number> => Object.fromEntries(CHAR_KEYS.map((k) => [k, v])) as Record<CharKey, number>;
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
  it('parseStatus : Bronze/Argent/Or + Standing ; typo de données « Agent 1 » tolérée', () => {
    expect(parseStatus('Bronze 2')).toEqual({ tier: 'Bronze', standing: 2 });
    expect(parseStatus('Argent 5')).toEqual({ tier: 'Argent', standing: 5 });
    expect(parseStatus('Or 7')).toEqual({ tier: 'Or', standing: 7 });
    expect(parseStatus('Agent 1')).toEqual({ tier: 'Argent', standing: 1 });
  });
  it('Bronze N : 2N d10 sous ; Argent N : N d10 pistoles ; Or N : N CO ; Standing 0 : rien', () => {
    const bronze = rollInitialWealth({ tier: 'Bronze', standing: 3 }, makeRNG(1));
    expect(bronze.gold).toBe(0);
    expect(bronze.silver).toBe(0);
    expect(bronze.brass).toBeGreaterThanOrEqual(6); // 6d10
    expect(bronze.brass).toBeLessThanOrEqual(60);
    const silver = rollInitialWealth({ tier: 'Argent', standing: 3 }, makeRNG(1));
    expect(silver.silver).toBeGreaterThanOrEqual(3);
    expect(silver.silver).toBeLessThanOrEqual(30);
    expect(rollInitialWealth({ tier: 'Or', standing: 3 }, makeRNG(1))).toEqual({ gold: 3, silver: 0, brass: 0 });
    expect(rollInitialWealth({ tier: 'Bronze', standing: 0 }, makeRNG(1))).toEqual({ gold: 0, silver: 0, brass: 0 });
  });
});

describe('Détails (LDB 05 l.701-768)', () => {
  it('âge/taille dans les bornes par espèce', () => {
    const human = findSpeciesById('humains-reiklander')!;
    const dwarf = findSpeciesById('nains')!;
    for (let seed = 1; seed <= 10; seed++) {
      const a = rollAge(human, makeRNG(seed));
      expect(a).toBeGreaterThanOrEqual(16); // 15 + 1d10
      expect(a).toBeLessThanOrEqual(25);
      const t = rollHeight(dwarf, makeRNG(seed)); // 130 + 3d10
      expect(t).toBeGreaterThanOrEqual(133);
      expect(t).toBeLessThanOrEqual(160);
    }
  });
  it('yeux/cheveux : libellé non vide tiré des tables, déterministe', () => {
    const elf = findSpeciesById('hauts-elfes')!;
    expect(rollEyes(elf, makeRNG(3))).toBe(rollEyes(elf, makeRNG(3)));
    expect(rollEyes(elf, makeRNG(3)).length).toBeGreaterThan(0);
    expect(rollHair(elf, makeRNG(3)).length).toBeGreaterThan(0);
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
      expect(rollHair(gnome, makeRNG(seed)), `seed=${seed} 2d10=${d2}`).toBe(gnomeHair(d2));
    }
  });
  it('Les races LDB gardent les bornes LDB (override race-scopé) — humain reiklander', () => {
    for (let seed = 0; seed < 400; seed++) {
      const d2 = roll(2, 10, makeRNG(seed));
      expect(rollHair(humain, makeRNG(seed)), `seed=${seed} 2d10=${d2}`).toBe(humainHair(d2));
    }
  });
  it('Ogre : chaque 2d10 rend la couleur ADE II — motif LDB confirmé au livre (#423)', () => {
    for (let seed = 0; seed < 400; seed++) {
      const d2 = roll(2, 10, makeRNG(seed));
      expect(rollHair(ogre, makeRNG(seed)), `seed=${seed} 2d10=${d2}`).toBe(ogreHair(d2));
    }
  });
});
