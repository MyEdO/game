import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { findSpeciesById, talentConcrete, talents, specPoolOf, firstLevel, careerLevels, species } from '../data';
import { setDataset } from '../data/overrides';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { Combatant } from './types';
import {
  speciesSkillDefaults,
  rollRandomTalent,
  resolveSpeciesTalents,
  resolveSpeciesTalentsDetail,
  createHero,
  competencesDeCarriere,
  adresseDeCreation,
  libreDEspece,
  repartitionDeCarriere,
} from './character';
import { baseWithTalents } from './talentEffects';
import { acquerirTalent } from './careerSlots';
import { traitConsumptionFactor } from './provisions';
import { traitEncumbranceFactor } from './combatFeatures/dispatch';

const REIK = 'humains-reiklander';
const sp = () => findSpeciesById(REIK)!;

describe('speciesSkillDefaults — 3×+5 / 3×+3 (LDB 05 l.484)', () => {
  it('par défaut : 3 premières compétences +5, 3 suivantes +3', () => {
    const m = speciesSkillDefaults(sp());
    // Reiklander : Calme, Charme, Commandement, Corps à corps (Base), Évaluation, Langue (Bretonnien)…
    expect(m.plus5).toEqual([{ id: 'calme' }, { id: 'charme' }, { id: 'commandement' }]);
    expect(m.plus3).toEqual([{ id: 'corps-a-corps', spec: 'base' }, { id: 'evaluation' }, { id: 'langue', spec: 'bretonnien' }]);
  });
});

describe('rollRandomTalent — Tableau des Talents aléatoires (LDB 05 l.484)', () => {
  it('renvoie un talent de la table, non doublon sans Talent possédé', () => {
    const t = rollRandomTalent(makeRNG(1), [])!;
    expect(talents.find((x) => x.id === t.ref.id)?.rand).toBeDefined();
    expect(t.doublon).toBe(false);
  });

  it('LDB 05 l.484 « vous pouvez relancer » : le Talent déjà possédé est RENDU, marqué doublon, jamais relancé d\'office', () => {
    const first = rollRandomTalent(makeRNG(1), [])!;
    const second = rollRandomTalent(makeRNG(1), [first.ref])!;
    expect(second).toEqual({ ref: first.ref, doublon: true });
  });

  it('déterministe à seed égal', () => {
    expect(rollRandomTalent(makeRNG(42), [])).toEqual(rollRandomTalent(makeRNG(42), []));
  });

  it('LDB 10 l.17 : une AUTRE utilisation possédée fait du tirage un doublon ; il prend la 1re utilisation non possédée', () => {
    const tire = rollRandomTalent(makeRNG(2), [])!;
    const pool = specPoolOf(talents.find((t) => t.id === tire.ref.id)!);
    expect(pool.length).toBeGreaterThan(1);
    const [specA, specB] = pool;
    expect(tire.ref).toEqual({ id: tire.ref.id, spec: specA });
    expect(rollRandomTalent(makeRNG(2), [{ id: tire.ref.id, spec: specA }])).toEqual({ ref: { id: tire.ref.id, spec: specB }, doublon: true });
    const toutes = pool.map((spec) => ({ id: tire.ref.id, spec }));
    expect(rollRandomTalent(makeRNG(2), toutes)).toEqual({ ref: { id: tire.ref.id, spec: specA }, doublon: true });
    expect(rollRandomTalent(makeRNG(2), [], specB)).toEqual({ ref: { id: tire.ref.id, spec: specB }, doublon: false });
  });
});

describe('resolveSpeciesTalents — fixes / choix / aléatoires', () => {
  it('Reiklander : Destinée (fixe), un choix résolu, et 3 tirages à leur adresse', () => {
    const out = resolveSpeciesTalentsDetail(sp(), { seed: 7 });
    // « Affable ou Perspicace » → 1er par défaut ; « Destinée » fixe ; « 3 Talent aléatoire »
    expect(out.map((t) => t.ref)).toContainEqual({ id: 'destinee' });
    expect(out.map((t) => t.ref)).toContainEqual({ id: 'affable' });
    expect(out).toHaveLength(5);
    expect(out.flatMap((t) => (t.tirage ? [t.tirage.adresse] : []))).toEqual([0, 1, 2].map((j) => adresseDeCreation.especeTirage(2, j)));
  });

  it('le choix « A ou B » est surchargeable, par adresse d\'emplacement', () => {
    const out = resolveSpeciesTalents(sp(), { seed: 7, speciesTalentChoices: { 'espece:talents:0': { id: 'perspicace' } } });
    expect(out).toContainEqual({ id: 'perspicace' });
    expect(out).not.toContainEqual({ id: 'affable' });
  });

  // Graine 169 : Doué en calcul au tirage 0 puis au tirage 1.
  const tirage1 = adresseDeCreation.especeTirage(2, 1);
  it('LDB 05 l.484 : un doublon est GARDÉ sans relance décidée', () => {
    const out = resolveSpeciesTalentsDetail(sp(), { seed: 169 });
    expect(out.slice(2).map((t) => [t.ref.id, t.tirage?.rang, t.tirage?.doublon])).toEqual([
      ['doue-en-calcul', 0, false], ['doue-en-calcul', 0, true], ['sixieme-sens', 0, false],
    ]);
  });

  it('LDB 05 l.484 : la relance décidée remplace CE SEUL tirage, les autres gardent leur d100', () => {
    const out = resolveSpeciesTalentsDetail(sp(), { seed: 169, talentRerolls: { [tirage1]: 1 } });
    expect(out.slice(2).map((t) => [t.ref.id, t.tirage?.rang, t.tirage?.doublon])).toEqual([
      ['doue-en-calcul', 0, false], ['doigts-de-fee', 1, false], ['sixieme-sens', 0, false],
    ]);
  });

  it('une relance au-delà du premier non-doublon est ignorée', () => {
    const une = resolveSpeciesTalentsDetail(sp(), { seed: 169, talentRerolls: { [tirage1]: 1 } });
    expect(resolveSpeciesTalentsDetail(sp(), { seed: 169, talentRerolls: { [tirage1]: 5 } })).toEqual(une);
  });

  // Graine 5 : Perspicace au tirage 1 — doublon sous « Perspicace », pas sous « Affable ».
  const affable = { 'espece:talents:0': { id: 'affable' } };
  const perspicaceChoisi = { 'espece:talents:0': { id: 'perspicace' } };
  it('le statut doublon d\'un tirage suit les Talents résolus avant lui (choix « A ou B »), à d100 inchangé', () => {
    const perspicace = resolveSpeciesTalentsDetail(sp(), { seed: 5, speciesTalentChoices: perspicaceChoisi });
    const avecAffable = resolveSpeciesTalentsDetail(sp(), { seed: 5, speciesTalentChoices: affable });
    expect(perspicace[3]).toEqual({ ref: { id: 'perspicace' }, tirage: { adresse: tirage1, rang: 0, doublon: true } });
    expect(avecAffable[3]).toEqual({ ref: { id: 'perspicace' }, tirage: { adresse: tirage1, rang: 0, doublon: false } });
    expect(avecAffable.slice(2).map((t) => t.ref)).toEqual(perspicace.slice(2).map((t) => t.ref));
  });

  it('une relance devenue sans objet (le tirage n\'est plus un doublon) ne s\'applique pas', () => {
    const relance = resolveSpeciesTalentsDetail(sp(), { seed: 5, speciesTalentChoices: affable, talentRerolls: { [tirage1]: 1 } });
    expect(relance).toEqual(resolveSpeciesTalentsDetail(sp(), { seed: 5, speciesTalentChoices: affable }));
    expect(resolveSpeciesTalentsDetail(sp(), { seed: 5, speciesTalentChoices: perspicaceChoisi, talentRerolls: { [tirage1]: 1 } })[3].tirage?.rang).toBe(1);
  });

  it('l\'option « A ou B » se garde par son identité (`cleDOption`), quel que soit l\'ordre de `of`', () => {
    const inverse = { ...sp(), talents: sp().talents.map((t) => ('pick' in t ? { ...t, of: [...t.of].reverse() } : t)) };
    const fixes = (espece: typeof inverse) => resolveSpeciesTalents(espece, { seed: 1, talentsRolled: false, speciesTalentChoices: affable });
    expect(fixes(sp())).toEqual([{ id: 'affable' }, { id: 'destinee' }]);
    expect(fixes(inverse)).toEqual(fixes(sp()));
  });

  it('#393 : `talentsRolled: false` résout les tirages sans les rendre ; absent, ils sont rendus', () => {
    const tous = resolveSpeciesTalentsDetail(sp(), { seed: 169 });
    expect(tous.filter((t) => t.tirage)).toHaveLength(3);
    expect(resolveSpeciesTalentsDetail(sp(), { seed: 169, talentsRolled: false })).toEqual(tous.filter((t) => !t.tirage));
    expect(resolveSpeciesTalentsDetail(sp(), { seed: 169, talentsRolled: true })).toEqual(tous);
  });
});

describe('acquerirTalent — Maxi (LDB 05 l.475, LDB 10 l.18)', () => {
  it('une acquisition de plus sous le Maxi ; aucune au Maxi', () => {
    const heros = { characteristics: createHero({ speciesId: REIK, careerId: 'soldat', label: 'x', seed: 3 }).characteristics, talents: [] as Combatant['talents'] };
    acquerirTalent(heros, { id: 'perspicace' });
    acquerirTalent(heros, { id: 'perspicace' });
    expect(heros.talents).toEqual([{ talentId: 'perspicace', spec: undefined, times: 1 }]);
  });

  it('createHero : un doublon gardé au Maxi n\'ajoute pas d\'acquisition', () => {
    // Graine 5 : Perspicace (Maxi 1) choisi, puis tiré en doublon au tirage 1.
    const choix = { seed: 5, speciesTalentChoices: { 'espece:talents:0': { id: 'perspicace' } } };
    expect(resolveSpeciesTalentsDetail(sp(), choix)[3]).toMatchObject({ ref: { id: 'perspicace' }, tirage: { doublon: true } });
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'x', ...choix });
    expect(hero.talents.find((t) => t.talentId === 'perspicace')?.times).toBe(1);
  });
});

describe('createHero — applique compétences et talents raciaux', () => {
  it('le héros reçoit ses compétences d’espèce (advances ≥ valeur raciale) et ses talents', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'Test', seed: 3 });
    const calme = hero.skills.find((s) => s.id === 'calme');
    expect(calme).toBeTruthy();
    expect(calme!.advances).toBeGreaterThanOrEqual(5); // +5 d'espèce (additif si aussi en carrière)
    expect(hero.talents.map((t) => talentConcrete(t))).toContain('Destinée');
    // 5 talents raciaux + l'éventuel talent de carrière
    expect(hero.talents.length).toBeGreaterThanOrEqual(5);
  });

  it('aucun libellé « (Au choix) » résiduel sur le héros (specs résolues)', () => {
    for (const seed of [1, 5, 9]) {
      const hero = createHero({ speciesId: 'nains', careerId: 'artisan', label: 'T', seed });
      for (const s of hero.skills) expect(s.spec ?? '').not.toMatch(/au choix|\sou\s/i);
      for (const t of hero.talents) expect(talentConcrete(t)).not.toMatch(/\(.*au choix.*\)/i);
    }
  });

  it('5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.459)', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3 });
    const total = Object.values(hero.charAdvances ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(5);
    // La répartition explicite s'ajoute aux valeurs initiales.
    const manual = createHero({
      speciesId: REIK,
      careerId: 'soldat', // Caractéristiques de carrière : CC, F, E (Recrue)
      label: 'T',
      seed: 3,
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      careerTalent: { id: 'infatigable' }, // PAS Guerrier né (+5 CC), pour isoler les Augmentations
      speciesTalentChoices: { 'espece:talents:0': { id: 'affable' } },
      talentsRolled: false,
    });
    expect(manual.talents.map((t) => t.talentId)).toEqual(['affable', 'destinee', 'infatigable']);
    expect(manual.charAdvances!['capacite-de-combat']).toBe(5);
    expect(manual.characteristics['capacite-de-combat']).toBe(35);
  });

  it('« +5 Caractéristique de départ » passif (Affable → Soc +5 via charMod), sans Augmentation comptée', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'soldat',
      label: 'T',
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      speciesTalentChoices: { 'espece:talents:0': { id: 'affable' } },
      talentsRolled: false,
      seed: 3,
    });
    // La valeur brute reste 30 (passif non cuit) ; baseWithTalents lit le charMod du talent.
    expect(hero.characteristics.sociabilite).toBe(30); // base INCHANGÉE
    expect(baseWithTalents(hero, 'sociabilite')).toBe(35); // base + passif Affable = 35
    expect(hero.charAdvances?.sociabilite ?? 0).toBe(0);
  });

  it('talent de carrière = talent d\'espèce → times 2 (LDB 05 l.535, LDB 10 l.9) ; Blessures avec Dur à cuire', () => {
    const hero = createHero({
      speciesId: 'elfes-sylvains', // « Dur à cuire ou Seconde vue » (1re option), aucun Talent aléatoire
      careerId: 'milicien', // Niveau 1 propose « Dur à cuire »
      label: 'T',
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      careerTalent: { id: 'dur-a-cuire' },
      seed: 3,
    });
    expect(hero.talents.find((t) => talentConcrete(t) === 'Dur à cuire')!.times).toBe(2);
    // Blessures = BF+2BE+BFM (3+6+3=12) + 2 × BE (Dur à cuire ×2) = 18.
    expect(hero.wounds.max).toBe(18);
  });

  it('PX bonus de la création conservés ; détails portés', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'soldat',
      label: 'T',
      seed: 3,
      xpBonus: 95,
      details: { age: 22, height: 178, eyes: 'Bleu', hair: 'Brun clair', ambitionShort: 'X', ambitionLong: 'Y' },
    });
    expect(hero.xp).toBe(95);
    expect(hero.details?.age).toBe(22);
    expect(hero.details?.ambitionLong).toBe('Y');
  });

  it('Halfling Herboriste : Sens aiguisé (Goût) d\'espèce reprenable en talent de carrière (times 2)', () => {
    const hero = createHero({
      speciesId: 'halflings',
      careerId: 'herboriste',
      label: 'T',
      careerTalent: { id: 'sens-aiguise', spec: 'gout' },
      talentsRolled: false,
      seed: 3,
    });
    expect(hero.talents.map((t) => t.talentId)).toEqual(['petit', 'resistance', 'sens-aiguise', 'vision-nocturne']);
    expect(hero.talents.find((t) => talentConcrete(t) === 'Sens aiguisé (Goût)')!.times).toBe(2);
  });

  it('Talent de carrière : pris au Niveau 1 (LDB 05 l.535), un emplacement « (Au choix) » exige sa spécialisation (LDB 10 l.17)', () => {
    const cree = (careerTalent: { id: string; spec?: string }) =>
      () => createHero({ speciesId: 'humains-reiklander', careerId: 'pretre', label: 'T', careerTalent, seed: 5 });
    expect(cree({ id: 'beni' })).toThrow(/Talent de carrière « beni ».*pretre.*exige une spécialisation \(LDB 10 l\.17\)/);
    expect(cree({ id: 'acrobate' })).toThrow(/Talent de carrière « acrobate ».*absent du Niveau 1 de « pretre » \(LDB 05 l\.535\)/);
    const hero = cree({ id: 'beni', spec: 'sigmar' })();
    expect(Object.values(hero.careerSlotChoices?.pretre ?? {})).toContain('beni|sigmar');
  });

  it('entrée d\'espèce mixte « Destinée ou Talent aléatoire » : la branche aléatoire tire un talent', () => {
    const middenland = findSpeciesById('humains-middenland');
    if (!middenland) return; // espèce ADE absente → rien à tester
    const out = resolveSpeciesTalents(middenland, {
      seed: 11,
      speciesTalentChoices: { 'espece:talents:1': { random: 1 } }, // « Destinée ou Talent aléatoire » → la branche aléatoire
    });
    expect(out).not.toContainEqual({ id: 'destinee' });
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createHero — Trait racial + Taille par talent (#572)', () => {
  it('un héros Ogre porte le trait racial `ogre` (encombrance/consommation ×2) et sa Taille est Grande', () => {
    const hero = createHero({ speciesId: 'ogres', careerId: 'ratier', label: 'Grosminet', seed: 3 });
    expect(hero.traits).toEqual([{ id: 'ogre' }]);
    expect(hero.talents.some((t) => t.talentId === 'massif')).toBe(true);
    expect(hero.size).toBe('grande');
    expect(traitConsumptionFactor(hero)).toBe(2);
    expect(traitEncumbranceFactor(hero)).toBe(2);
  });

  it('un héros Halfling (talent Petit) a une Taille Petite, sans trait racial ni facteur ×2', () => {
    const hero = createHero({ speciesId: 'halflings', careerId: 'marchand', label: 'Bilbon', seed: 3 });
    expect(hero.talents.some((t) => t.talentId === 'petit')).toBe(true);
    expect(hero.size).toBe('petite');
    expect(hero.traits ?? []).toEqual([]);
    expect(traitConsumptionFactor(hero)).toBe(1);
    expect(traitEncumbranceFactor(hero)).toBe(1);
  });

  it('un héros humain (ni Massif ni Petit) a une Taille Moyenne', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3 });
    expect(hero.size).toBe('moyenne');
  });
});

describe('createHero — Signe astral à Talent non désigné (ADE II 03 l.235)', () => {
  it('Les Deux Bœufs : le Métier choisi à l’adresse de l’op du signe désigne le Talent octroyé', () => {
    const hero = createHero({
      speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3, talentsRolled: false,
      starId: 'les-deux-boeufs', specChoices: { [adresseDeCreation.signe(1)]: 'armurier' },
    });
    expect(hero.talents.filter((t) => t.talentId === 'maitre-artisan')).toEqual([{ talentId: 'maitre-artisan', spec: 'armurier', times: 1 }]);
  });
});

describe('joker de création — une référence déjà tenue par un autre emplacement (LDB 05 l.535, l.484)', () => {
  const sansEspece = { plus5: [], plus3: [] };
  const gladiateur = (spec: string) =>
    createHero({ speciesId: REIK, careerId: 'gladiateur', label: 'g', seed: 1, speciesSkillAdvances: sansEspece, specChoices: { [adresseDeCreation.carriereCompetence(2)]: spec } });

  it('gladiateur : le joker Corps à corps qui désigne Bagarre, déjà au Niveau 1, est refusé par son nom', () => {
    expect(() => gladiateur('bagarre')).toThrow(/Compétence de carrière « corps-a-corps\|bagarre » : déjà pris par un autre emplacement/);
  });

  it('gladiateur : le joker sur Base tient 8 Compétences et 40 Augmentations', () => {
    const h = gladiateur('base');
    expect(h.skills).toHaveLength(8);
    expect(h.skills.reduce((a, s) => a + s.advances, 0)).toBe(40);
  });

  const piedpaille = (plus5: RefDesignee[]) =>
    createHero({ speciesId: 'halflings-piedpaille', careerId: 'gladiateur', label: 'h', seed: 1, speciesSkillAdvances: { plus5, plus3: [] } });

  it('Halfling Piedpaille : le joker Métier qui désigne Cuisinier, déjà dans la liste, est refusé par son nom', () => {
    expect(() => piedpaille([{ id: 'metier', spec: 'cuisinier' }, { id: 'metier', spec: 'cuisinier' }, { id: 'charme' }])).toThrow(
      /Compétence d'espèce « metier\|cuisinier » : déjà retenue par un autre emplacement/,
    );
  });

  it('Halfling Piedpaille : un joker Métier sans spécialisation prend la 1re LIBRE, jamais Cuisinier', () => {
    const libre = libreDEspece(findSpeciesById('halflings-piedpaille')!, { id: 'metier', choix: true });
    expect(libre('cuisinier')).toBe(false);
    const h = piedpaille([{ id: 'metier', spec: 'cuisinier' }, { id: 'metier' }, { id: 'charme' }]);
    const metiers = h.skills.filter((s) => s.id === 'metier');
    expect(metiers).toHaveLength(2);
    expect(metiers.map((s) => s.spec)).toContain('cuisinier');
    expect(metiers.every((s) => s.advances === 5)).toBe(true);
  });

  it('le libre d\'un joker de carrière exclut la référence d\'un autre emplacement et garde sa propre désignation', () => {
    const [c] = competencesDeCarriere(firstLevel('gladiateur'), { characteristics: {}, talents: [] } as unknown as Combatant, { [adresseDeCreation.carriereCompetence(2)]: 'escrime' }).filter((e) => e.adresse === adresseDeCreation.carriereCompetence(2));
    expect(c.libre('bagarre')).toBe(false);
    expect(c.libre('escrime')).toBe(true);
  });

  it('Chevalier du Soleil flamboyant : Savoir (Guerre) est une entrée fixe du Niveau 1 (AA 03 l.322)', () => {
    const entrees = competencesDeCarriere(firstLevel('chevalier-du-soleil-flamboyant'), { characteristics: {}, talents: [] } as unknown as Combatant);
    expect(entrees.find((e) => e.designee?.id === 'savoir' && e.designee.spec === 'guerre')?.ref).toEqual({ id: 'savoir', spec: 'guerre' });
    expect(entrees.some((e) => e.ref.choix != null && e.ref.id === 'savoir')).toBe(false);
  });
});

describe('deux jokers de même id non désignés : chacun prend le premier LIBRE (LDB 05 l.535, l.484)', () => {
  it('Niveau 1 : deux jokers Corps à corps prennent deux spécialisations distinctes, hors Bagarre', () => {
    const origine = [...careerLevels];
    const glad = origine.find((l) => l.id === 'gladiateur-1')!;
    const fixture = { ...glad, skills: glad.skills.map((r, i) => (i === 1 ? { id: 'corps-a-corps', choix: true as const } : r)) };
    setDataset('careerLevels', origine.map((l) => (l === glad ? fixture : l)));
    try {
      const h = createHero({ speciesId: REIK, careerId: 'gladiateur', label: 'g', seed: 1, speciesSkillAdvances: { plus5: [], plus3: [] } });
      const cac = h.skills.filter((s) => s.id === 'corps-a-corps').map((s) => s.spec);
      expect(cac).toHaveLength(3);
      expect(new Set(cac).size).toBe(3);
      expect(cac).toContain('bagarre');
    } finally {
      setDataset('careerLevels', origine);
    }
  });

  it('liste d\'espèce : deux jokers Métier retenus prennent deux spécialisations distinctes, hors Cuisinier', () => {
    const origine = [...species];
    const pp = origine.find((s) => s.id === 'halflings-piedpaille')!;
    const fixture = { ...pp, skills: [{ id: 'metier', choix: true as const }, { id: 'metier', choix: true as const }, ...pp.skills] };
    setDataset('species', origine.map((s) => (s === pp ? fixture : s)));
    try {
      const defauts = speciesSkillDefaults(fixture);
      expect(defauts.plus5[0].spec).not.toBe(defauts.plus5[1].spec);
      const h = createHero({ speciesId: 'halflings-piedpaille', careerId: 'gladiateur', label: 'h', seed: 1, speciesSkillAdvances: { plus5: [{ id: 'metier' }, { id: 'metier' }, { id: 'metier', spec: 'cuisinier' }], plus3: [] } });
      const metiers = h.skills.filter((s) => s.id === 'metier').map((s) => s.spec);
      expect(new Set(metiers).size).toBe(3);
    } finally {
      setDataset('species', origine);
    }
  });
});

describe('répartition par défaut des 40 Augmentations de carrière (LDB 05 l.535 ; AA 02 l.134)', () => {
  it('archer (dix Compétences) : createHero et le créateur lisent la même répartition, 8 Compétences, 40 Augmentations', () => {
    const entrees = competencesDeCarriere(firstLevel('archer'), { characteristics: {}, talents: [] } as unknown as Combatant);
    expect(entrees).toHaveLength(10);
    const r = repartitionDeCarriere(entrees);
    expect(Object.values(r)).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
    const h = createHero({ speciesId: REIK, careerId: 'archer', label: 'a', seed: 1, speciesSkillAdvances: { plus5: [], plus3: [] } });
    expect(h.skills.reduce((a, s) => a + s.advances, 0)).toBe(40);
    expect(h.skills.filter((s) => s.advances > 0)).toHaveLength(8);
  });
});
