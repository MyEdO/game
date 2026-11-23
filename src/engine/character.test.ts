import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import {
  findSpeciesById,
  talentConcrete,
  talents,
  talentsAleatoires,
  tableDeTalents,
  specPoolOf,
  firstLevel,
  careerLevels,
  species,
  levelsForCareer,
} from '../data';
import { availableChars, candidatsDuSlot, designationsFor, skillSlots, talentSlots } from './careerSlots';
import { isCareerLevelComplete, validateCareerChange } from './advancement';
import { isHeld } from './weaponLoad';
import { loadoutSetActive, recomputeLoadout } from './items';
import { setDataset } from '../data/overrides';
import { findTableEntry } from './tables';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { Combatant } from './types';
import { toBrass } from './money';
import {
  fluxDeCreation,
  speciesSkillDefaults,
  resolveSpeciesTalents,
  resolveSpeciesTalentsDetail,
  createHero,
  competencesDeCarriere,
  libreDEspece,
  repartitionDeCarriere,
} from './character';
import { adresseDeCreation } from './adresseDeCreation';
import { baseWithTalents } from './talentEffects';
import { acquerirTalent } from './careerSlots';
import { traitConsumptionFactor } from './provisions';
import { traitEncumbranceFactor } from './combatFeatures/dispatch';

const REIK = 'humains-reiklander';
const TABLE = { id: 'talents-aleatoires' } as const;
const sp = () => findSpeciesById(REIK)!;

describe('speciesSkillDefaults — 3×+5 / 3×+3 (LDB 05 l.484)', () => {
  it('par défaut : 3 premières compétences +5, 3 suivantes +3', () => {
    const m = speciesSkillDefaults(sp());
    // Reiklander : Calme, Charme, Commandement, Corps à corps (Base), Évaluation, Langue (Bretonnien)…
    expect(m.plus5).toEqual([{ id: 'calme' }, { id: 'charme' }, { id: 'commandement' }]);
    expect(m.plus3).toEqual([{ id: 'corps-a-corps', spec: 'base' }, { id: 'evaluation' }, { id: 'langue', spec: 'bretonnien' }]);
  });
});

describe('Talent d’espèce tiré — Tableau des Talents aléatoires (LDB 05 l.484)', () => {
  // Le tirage vit à l'adresse `especeTirage(PREALABLES, 0)`, quels que soient les Talents possédés : les
  // emplacements préalables non tenus portent un Talent hors du Tableau.
  const DU_TABLEAU = new Set<string>(tableDeTalents(TABLE).entries.map((r) => r.id));
  const PREALABLES = Math.max(1, ...talents.filter((t) => DU_TABLEAU.has(t.id)).map((t) => specPoolOf(t).length));
  const horsTableau = talents.find((t) => !DU_TABLEAU.has(t.id) && !specPoolOf(t).length)!;
  const tirage = (seed: number, possedes: RefDesignee[] = [], opts: { randomSpecPicks?: Record<string, string> } = {}) => {
    const prealables = [...possedes, ...Array.from({ length: PREALABLES - possedes.length }, () => ({ id: horsTableau.id }))];
    const out = resolveSpeciesTalentsDetail({ ...sp(), talents: [...prealables, { pick: 1, table: TABLE }] }, { seed, ...opts });
    const t = out[out.length - 1];
    return { ref: t.ref, doublon: t.tirage!.doublon };
  };
  const ADRESSE = adresseDeCreation.especeTirage(PREALABLES, 0);

  it('renvoie un talent de la table, non doublon sans Talent possédé', () => {
    const t = tirage(1);
    expect(DU_TABLEAU).toContain(t.ref.id);
    expect(t.doublon).toBe(false);
  });

  it('LDB 05 l.484 « vous pouvez relancer » : le Talent déjà possédé est RENDU, marqué doublon, jamais relancé d\'office', () => {
    const first = tirage(1);
    expect(tirage(1, [first.ref])).toEqual({ ref: first.ref, doublon: true });
  });

  it('déterministe à seed égal', () => {
    expect(tirage(42)).toEqual(tirage(42));
  });

  it('LDB 10 l.17 : une AUTRE utilisation possédée fait du tirage un doublon ; il prend une utilisation non possédée, tirée au dé', () => {
    const seed = Array.from({ length: 500 }, (_, i) => i + 1).find((s) => specPoolOf(talents.find((t) => t.id === tirage(s).ref.id)!).length > 1)!;
    const { id, spec } = tirage(seed).ref;
    const pool = specPoolOf(talents.find((t) => t.id === id)!);
    expect(pool).toContain(spec);
    const autre = tirage(seed, [{ id, spec }]);
    expect(autre.doublon).toBe(true);
    expect(pool.filter((s) => s !== spec)).toContain(autre.ref.spec);
    const toutes = tirage(seed, pool.map((s) => ({ id, spec: s })));
    expect(toutes.doublon).toBe(true);
    expect(pool).toContain(toutes.ref.spec);
    const choisie = pool.find((s) => s !== spec)!;
    expect(tirage(seed, [], { randomSpecPicks: { [ADRESSE]: choisie } })).toEqual({ ref: { id, spec: choisie }, doublon: false });
  });

  it('le tirage suit le `die` du document `talents-aleatoires`, jamais un d100 recopié (LDB 05 l.514 ; #3578)', () => {
    const imprimes = [...talentsAleatoires];
    setDataset('talentsAleatoires', imprimes.map((d) => ({ ...d, die: { n: 1, sides: 10 } })));
    try {
      const atteignables = new Set(Array.from({ length: 10 }, (_, i) => findTableEntry(tableDeTalents(TABLE).entries, i + 1).id));
      const tires = new Set(Array.from({ length: 200 }, (_, i) => tirage(i + 1).ref.id));
      expect(tires, 'un 1d10 n’atteint que les rangées de 1 à 10').toEqual(atteignables);
    } finally {
      setDataset('talentsAleatoires', imprimes);
    }
  });

  it('à graine égale, la suite des tirages est celle du d100 d’avant le document (témoin : b1acab5ac, `roll(1, 100)`)', () => {
    // 6 tirages Reiklander, graines 1 à 12, Talents sans leur utilisation ; « ! » = doublon.
    const TEMOIN = [
      'ame-pure lire-ecrire reflexes-foudroyants reflexes-foudroyants! costaud sens-aiguise',
      'dur-a-cuire fuite imperturbable tres-resistant bonnes-jambes noblesse',
      'doigts-de-fee bonnes-jambes bonnes-jambes! oreille-absolue sens-de-l-orientation sens-de-l-orientation!',
      'bonnes-jambes affable imperturbable resistance doigts-de-fee doigts-de-fee!',
      'ame-pure sixieme-sens tres-resistant affinite-avec-les-animaux ame-pure! ame-pure!',
      'affinite-avec-les-animaux affable artiste resistance tres-resistant vivacite',
      'vision-nocturne doue-en-calcul ame-pure ame-pure! sixieme-sens fuite',
      'resistance affable oreille-absolue resistance! sens-aiguise sens-de-l-orientation',
      'sens-aiguise ame-pure ambidextre chanceux ame-pure! tres-resistant',
      'lire-ecrire resistance doigts-de-fee sixieme-sens reflexes-foudroyants chanceux',
      'doue-en-calcul tres-resistant affable maitre-artisan guerrier-ne doue-en-calcul!',
      'ame-pure vision-nocturne doigts-de-fee sixieme-sens imperturbable attirant',
    ];
    const suite = (seed: number) => resolveSpeciesTalentsDetail({ ...sp(), talents: [{ pick: 6, table: TABLE }] }, { seed })
      .map((t) => `${t.ref.id}${t.tirage!.doublon ? '!' : ''}`).join(' ');
    expect(TEMOIN.map((_, i) => suite(i + 1))).toEqual(TEMOIN);
  });
});

describe('resolveSpeciesTalents — fixes / choix / aléatoires', () => {
  it('Reiklander : Destinée (fixe), un choix résolu, et 3 tirages à leur adresse', () => {
    const out = resolveSpeciesTalentsDetail(sp(), { seed: 7 });
    expect(out.map((t) => t.ref)).toContainEqual({ id: 'destinee' });
    expect(out).toHaveLength(5);
    expect(out.flatMap((t) => (t.tirage ? [t.tirage.adresse] : []))).toEqual([0, 1, 2].map((j) => adresseDeCreation.especeTirage(2, j)));
  });

  it('LDB 05 l.484 : sans choix, l\'option « A ou B » est tirée au dé de la création, la même pour la même graine', () => {
    const option = (seed: number) => resolveSpeciesTalents(sp(), { seed, talentsRolled: false })[0];
    const graines = Array.from({ length: 40 }, (_, i) => i);
    expect(new Set(graines.map((g) => option(g).id))).toEqual(new Set(['affable', 'perspicace']));
    expect(graines.map(option)).toEqual(graines.map(option));
  });

  it('le choix « A ou B » est surchargeable, par adresse d\'emplacement', () => {
    const out = resolveSpeciesTalents(sp(), { seed: 7, speciesTalentChoices: { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } } });
    expect(out).toContainEqual({ id: 'perspicace' });
    expect(out).not.toContainEqual({ id: 'affable' });
  });

  it('LDB 05 l.484 : une option hors des choix « A ou B » est refusée, jamais remplacée par un tirage', () => {
    expect(() => resolveSpeciesTalents(sp(), { seed: 7, speciesTalentChoices: { [adresseDeCreation.especeTalent(0)]: { id: 'vision-nocturne' } } })).toThrow(/hors des options/);
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
  const affable = { [adresseDeCreation.especeTalent(0)]: { id: 'affable' } };
  const perspicaceChoisi = { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } };
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
    const inverse = { ...sp(), talents: sp().talents.map((t) => ('of' in t ? { ...t, of: [...t.of].reverse() } : t)) };
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
    const heros = { characteristics: createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'soldat', label: 'x', seed: 3 }).characteristics, talents: [] as Combatant['talents'] };
    acquerirTalent(heros, { id: 'perspicace' });
    acquerirTalent(heros, { id: 'perspicace' });
    expect(heros.talents).toEqual([{ talentId: 'perspicace', spec: undefined, times: 1 }]);
  });

  it('createHero : un doublon gardé au Maxi n\'ajoute pas d\'acquisition', () => {
    // Graine 5 : Perspicace (Maxi 1) choisi, puis tiré en doublon au tirage 1.
    const choix = { seed: 5, speciesTalentChoices: { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } } };
    expect(resolveSpeciesTalentsDetail(sp(), choix)[3]).toMatchObject({ ref: { id: 'perspicace' }, tirage: { doublon: true } });
    const hero = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'soldat', label: 'x', ...choix });
    expect(hero.talents.find((t) => t.talentId === 'perspicace')?.times).toBe(1);
  });
});

describe('createHero — applique compétences et talents raciaux', () => {
  it('le héros reçoit ses compétences d’espèce (advances ≥ valeur raciale) et ses talents', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'soldat', label: 'Test', seed: 3 });
    const calme = hero.skills.find((s) => s.id === 'calme');
    expect(calme).toBeTruthy();
    expect(calme!.advances).toBeGreaterThanOrEqual(5); // +5 d'espèce (additif si aussi en carrière)
    expect(hero.talents.map((t) => talentConcrete(t))).toContain('Destinée');
    // 5 talents raciaux + l'éventuel talent de carrière
    expect(hero.talents.length).toBeGreaterThanOrEqual(5);
  });

  it('aucun libellé « (Au choix) » résiduel sur le héros (specs résolues)', () => {
    for (const seed of [1, 5, 9]) {
      const hero = createHero({ idNeuf: idsDeTest, speciesId: 'nains', careerId: 'artisan', label: 'T', seed });
      for (const s of hero.skills) expect(s.spec ?? '').not.toMatch(/au choix|\sou\s/i);
      for (const t of hero.talents) expect(talentConcrete(t)).not.toMatch(/\(.*au choix.*\)/i);
    }
  });

  it('5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.459)', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3 });
    const total = Object.values(hero.charAdvances ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(5);
    // La répartition explicite s'ajoute aux valeurs initiales.
    const manual = createHero({ idNeuf: idsDeTest,
      speciesId: REIK,
      careerId: 'soldat', // Caractéristiques de carrière : CC, F, E (Recrue)
      label: 'T',
      seed: 3,
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      careerTalent: { id: 'infatigable' }, // PAS Guerrier né (+5 CC), pour isoler les Augmentations
      speciesTalentChoices: { [adresseDeCreation.especeTalent(0)]: { id: 'affable' } },
      talentsRolled: false,
    });
    expect(manual.talents.map((t) => t.talentId)).toEqual(['affable', 'destinee', 'infatigable']);
    expect(manual.charAdvances!['capacite-de-combat']).toBe(5);
    expect(manual.characteristics['capacite-de-combat']).toBe(35);
  });

  it('« +5 Caractéristique de départ » passif (Affable → Soc +5 via charMod), sans Augmentation comptée', () => {
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: REIK,
      careerId: 'soldat',
      label: 'T',
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      speciesTalentChoices: { [adresseDeCreation.especeTalent(0)]: { id: 'affable' } },
      talentsRolled: false,
      seed: 3,
    });
    // La valeur brute reste 30 (passif non cuit) ; baseWithTalents lit le charMod du talent.
    expect(hero.characteristics.sociabilite).toBe(30); // base INCHANGÉE
    expect(baseWithTalents(hero, 'sociabilite')).toBe(35); // base + passif Affable = 35
    expect(hero.charAdvances?.sociabilite ?? 0).toBe(0);
  });

  it('talent de carrière = talent d\'espèce → times 2 (LDB 05 l.535, LDB 10 l.9) ; Blessures avec Dur à cuire', () => {
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: 'elfes-sylvains', // « Dur à cuire ou Seconde vue », aucun Talent aléatoire
      speciesTalentChoices: { [adresseDeCreation.especeTalent(findSpeciesById('elfes-sylvains')!.talents.findIndex((t) => 'of' in t && t.of.some((o) => 'id' in o && o.id === 'dur-a-cuire')))]: { id: 'dur-a-cuire' } },
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
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: REIK,
      careerId: 'soldat',
      label: 'T',
      seed: 3,
      xpBonus: 95,
      details: {
        age: 22, height: 178, eyes: [{ id: 'bleu', colonne: 'humain' }], hair: { id: 'brun-clair', colonne: 'humain' },
        ambitionShort: 'X', ambitionLong: 'Y',
      },
    });
    expect(hero.xp).toBe(95);
    expect(hero.details?.age).toBe(22);
    expect(hero.details?.ambitionLong).toBe('Y');
  });

  it('Halfling Herboriste : Sens aiguisé (Goût) d\'espèce reprenable en talent de carrière (times 2)', () => {
    const hero = createHero({ idNeuf: idsDeTest,
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
      () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'pretre', label: 'T', careerTalent, seed: 5 });
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
      speciesTalentChoices: { [adresseDeCreation.especeTalent(1)]: { pick: 1, table: TABLE } }, // « Destinée ou Talent aléatoire » → la branche aléatoire
    });
    expect(out).not.toContainEqual({ id: 'destinee' });
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createHero — sorts de Magie mineure par id (LDB 10 l.714)', () => {
  const sorcier = (pettySpells: string[]) => createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'sorcier', label: 'S', seed: 3, careerTalent: { id: 'magie-mineure' }, pettySpells });
  it('un sort mineur choisi est appris par son id', () => {
    expect(sorcier(['alerte']).spells).toContain('alerte');
  });
  it('un id hors des sorts mineurs lève, nommé, au lieu de s’écrire sur le héros', () => {
    expect(() => sorcier(['zorglub'])).toThrow(/« zorglub »/);
    expect(() => sorcier(['benediction-de-bataille'])).toThrow(/« benediction-de-bataille »/);
  });
});

describe('createHero — Trait racial + Taille par talent (#572)', () => {
  it('un héros Ogre porte le trait racial `ogre` (encombrance/consommation ×2) et sa Taille est Grande', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'ogres', careerId: 'ratier', label: 'Grosminet', seed: 3 });
    expect(hero.traits).toEqual([{ id: 'ogre' }]);
    expect(hero.talents.some((t) => t.talentId === 'massif')).toBe(true);
    expect(hero.size).toBe('grande');
    expect(traitConsumptionFactor(hero)).toBe(2);
    expect(traitEncumbranceFactor(hero)).toBe(2);
  });

  it('un héros Halfling (talent Petit) a une Taille Petite, sans trait racial ni facteur ×2', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'halflings', careerId: 'marchand', label: 'Bilbon', seed: 3 });
    expect(hero.talents.some((t) => t.talentId === 'petit')).toBe(true);
    expect(hero.size).toBe('petite');
    expect(hero.traits ?? []).toEqual([]);
    expect(traitConsumptionFactor(hero)).toBe(1);
    expect(traitEncumbranceFactor(hero)).toBe(1);
  });

  it('un héros humain (ni Massif ni Petit) a une Taille Moyenne', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3 });
    expect(hero.size).toBe('moyenne');
  });
});

describe('createHero — Signe astral à Talent non désigné (ADE II 03 l.235)', () => {
  it('Les Deux Bœufs : le Métier choisi à l’adresse de l’op du signe désigne le Talent octroyé', () => {
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3, talentsRolled: false,
      starId: 'les-deux-boeufs', specChoices: { [adresseDeCreation.signe(1)]: 'armurier' },
    });
    expect(hero.talents.filter((t) => t.talentId === 'maitre-artisan')).toEqual([{ talentId: 'maitre-artisan', spec: 'armurier', times: 1 }]);
  });
});

describe('joker de création — une référence déjà tenue par un autre emplacement (LDB 05 l.535, l.484)', () => {
  const sansEspece = { plus5: [], plus3: [] };
  const gladiateur = (spec: string) =>
    createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'gladiateur', label: 'g', seed: 1, speciesSkillAdvances: sansEspece, specChoices: { [adresseDeCreation.carriereCompetence(2)]: spec } });

  it('gladiateur : le joker Corps à corps qui désigne Bagarre, déjà au Niveau 1, est refusé par son nom', () => {
    expect(() => gladiateur('bagarre')).toThrow(/Compétence de carrière « corps-a-corps\|bagarre » : déjà pris par un autre emplacement/);
  });

  it('gladiateur : le joker sur Base tient 8 Compétences et 40 Augmentations', () => {
    const h = gladiateur('base');
    expect(h.skills).toHaveLength(8);
    expect(h.skills.reduce((a, s) => a + s.advances, 0)).toBe(40);
  });

  const piedpaille = (plus5: RefDesignee[]) =>
    createHero({ idNeuf: idsDeTest, speciesId: 'halflings-piedpaille', careerId: 'gladiateur', label: 'h', seed: 1, speciesSkillAdvances: { plus5, plus3: [] } });

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
      const h = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'gladiateur', label: 'g', seed: 1, speciesSkillAdvances: { plus5: [], plus3: [] } });
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
      const h = createHero({ idNeuf: idsDeTest, speciesId: 'halflings-piedpaille', careerId: 'gladiateur', label: 'h', seed: 1, speciesSkillAdvances: { plus5: [{ id: 'metier' }, { id: 'metier' }, { id: 'metier', spec: 'cuisinier' }], plus3: [] } });
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
    const h = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'archer', label: 'a', seed: 1, speciesSkillAdvances: { plus5: [], plus3: [] } });
    expect(h.skills.reduce((a, s) => a + s.advances, 0)).toBe(40);
    expect(h.skills.filter((s) => s.advances > 0)).toHaveLength(8);
  });
});

describe('createHero — les Possessions du premier Échelon, argent, valeur et mentions comprises (LDB 05 l.572)', () => {
  const heros = (careerId: string, speciesId = REIK, seed = 4) => createHero({ idNeuf: idsDeTest, speciesId, careerId, label: 'T', seed });
  const bourse = (h: Combatant) => h.items!.filter((i) => i.trappingId === 'bourse');

  it('le Marchand porte dans sa Bourse les 3d10 pistoles d’argent de son Échelon (LDB 08 l.419)', () => {
    for (const seed of [1, 2, 3]) {
      const sacs = bourse(heros('marchand', REIK, seed));
      const pistoles = toBrass(sacs[0].money!) / 12;
      expect([sacs.length, Number.isInteger(pistoles) && pistoles >= 3 && pistoles <= 30], String(pistoles)).toEqual([1, true]);
    }
  });

  it('le Noble porte des bijoux valant 3d10 couronnes d’or, au prix tiré (LDB 08 l.965)', () => {
    const bijoux = heros('noble').items!.filter((i) => i.trappingId === 'bijoux');
    expect(bijoux).toHaveLength(1);
    const p = bijoux[0].price!;
    expect([p.silver, p.brass, p.gold >= 3 && p.gold <= 30], String(p.gold)).toEqual([0, 0, true]);
  });

  it('le Tueur porte la mention « Honte », sous sa nature (LDB 08 l.1474)', () => {
    expect(heros('tueur', 'nains').mentions).toEqual([{ nature: 'intangible', label: 'Honte', nombre: 1 }]);
  });

  it('un héros sans mention n’a pas de champ `mentions`', () => {
    expect('mentions' in heros('soldat')).toBe(false);
  });
});

describe('createHero — recrue de Niveau N : chaque Niveau en dessous achevé par achats (LDB 07 l.124, l.137)', () => {
  const recrue = (careerLevel: number) => createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'chasseur', label: 'Recrue', seed: 11, careerLevel });
  const levels = levelsForCareer('chasseur');
  const acheve = (h: Combatant, n: number) => isCareerLevelComplete(h, n, { skillSlots: skillSlots(levels, n), talentSlots: talentSlots(levels, n), careerChars: availableChars(levels, n), designations: designationsFor(h, 'chasseur') });
  const ctx = (completed: boolean) => ({ completed, sameClass: true, targetLevelExists: true });

  it('Chasseur 2 : Niveau 1 achevé, ses Caractéristiques de carrière à 5 Augmentations, le Niveau 2 à achever', () => {
    const h = recrue(2);
    expect(h.careerLevel).toBe(2);
    expect(acheve(h, 1)).toBe(true);
    expect(acheve(h, 2)).toBe(false);
    expect(availableChars(levels, 1).map((k) => h.charAdvances?.[k])).toEqual(availableChars(levels, 1).map(() => 5));
    expect(validateCareerChange(h, 'chasseur', 3, ctx(acheve(h, 2))).ok).toBe(false);
  });

  it('Chasseur 3 : Niveaux 1 et 2 achevés, le passage au Niveau 4 attend l\'achèvement du 3', () => {
    const h = recrue(3);
    expect([acheve(h, 2), acheve(h, 3)]).toEqual([true, false]);
    expect(availableChars(levels, 2).every((k) => (h.charAdvances?.[k] ?? 0) >= 10)).toBe(true);
    expect(validateCareerChange(h, 'chasseur', 4, ctx(acheve(h, 3))).ok).toBe(false);
  });

  it('les Valeurs suivent les Augmentations : chaque Augmentation achetée ajoute +1 (LDB 07 l.47)', () => {
    const n1 = recrue(1);
    const n2 = recrue(2);
    for (const k of availableChars(levels, 1)) expect(n2.characteristics[k] - n1.characteristics[k]).toBe((n2.charAdvances?.[k] ?? 0) - (n1.charAdvances?.[k] ?? 0));
  });

  it('les Possessions de Classe et des Niveaux 1 à N, chacune dans la panoplie sans uid orphelin (LDB 05 l.572)', () => {
    const h = recrue(2);
    expect(['fronde', 'arc', 'cape'].every((id) => h.items?.some((i) => i.trappingId === id))).toBe(true);
    const uids = new Set(h.items?.map((i) => i.uid));
    expect((h.loadouts ?? []).flatMap((lo) => [lo.main, lo.secondaire]).filter((u) => u != null && !uids.has(u))).toEqual([]);
  });

  it('un Niveau absent de la carrière est refusé', () => {
    expect(() => recrue(5)).toThrow(/Niveau 5/);
    expect(() => recrue(0)).toThrow(/Niveau 0/);
    expect(() => recrue(-1)).toThrow(/Niveau -1/);
    expect(() => recrue(NaN)).toThrow(/Niveau NaN/);
  });

  it('LDB 05 l.535 ; LDB 07 l.124 : sans choix, le Talent de chaque Niveau est tiré au dé de la création', () => {
    const graines = Array.from({ length: 40 }, (_, i) => i);
    const duNiveau = (seed: number, n: number) => {
      const h = createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'chasseur', label: 'Recrue', seed, careerLevel: 3, talentsRolled: false });
      const offerts = new Set(talentSlots(levels, n).flatMap((s) => s.options.map((o) => o.optionId)));
      return h.talents.filter((t) => offerts.has(t.talentId)).map((t) => t.talentId).sort().join('+');
    };
    for (const n of [1, 2]) expect(new Set(graines.map((g) => duNiveau(g, n))).size, `Niveau ${n}`).toBeGreaterThan(1);
  });
});

describe('createHero — chaque choix du joueur absent est tiré au dé de la création (LDB 05 l.484, l.535)', () => {
  const graines = Array.from({ length: 20 }, (_, i) => i);

  it('les 3 Compétences d\'espèce à +5 et les 3 à +3, six distinctes de la liste, la même pour la même graine', () => {
    const retenues = (seed: number) => {
      const rng = fluxDeCreation(seed, 'competences-espece');
      return speciesSkillDefaults(sp(), (n) => rng.int(0, n - 1));
    };
    const cle = (seed: number) => [...retenues(seed).plus5, ...retenues(seed).plus3].map((r) => `${r.id}:${r.spec ?? ''}`).join('+');
    for (const g of graines) expect(new Set(cle(g).split('+')).size).toBe(6);
    expect(new Set(graines.map(cle)).size).toBeGreaterThan(1);
    expect(graines.map(cle)).toEqual(graines.map(cle));
  });

  it('la spécialisation d\'une Compétence de carrière « au choix » du Niveau 1', () => {
    const duelliste = levelsForCareer('duelliste');
    const [joker] = skillSlots(duelliste, 1).filter((s) => s.needsChoice && candidatsDuSlot(s).length > 1);
    const designee = (seed: number) => designationsFor(createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'duelliste', label: 'Recrue', seed }), 'duelliste')[joker.key];
    expect(new Set(graines.map(designee)).size).toBeGreaterThan(1);
  });
});

describe('une arme de dotation se tient par la panoplie, elle ne naît pas portée (#4831)', () => {
  const chasseur = () => createHero({ idNeuf: idsDeTest, speciesId: REIK, careerId: 'chasseur', label: 'Chasseur', seed: 7 });

  it('aucune arme de dotation ne naît « équipée » ; la Fronde n\'est tenue que quand son set est actif', () => {
    const h = chasseur();
    const fronde = h.items!.find((i) => i.trappingId === 'fronde')!;
    expect(h.items!.filter((i) => (i.kind === 'melee' || i.kind === 'distance') && i.equipped)).toEqual([]);
    const set = h.loadouts!.find((lo) => lo.main === fronde.uid)!;
    expect(h.activeLoadoutId).not.toBe(set.id);
    expect(isHeld(h, fronde)).toBe(false);
    loadoutSetActive(h, set.id);
    recomputeLoadout(h);
    expect(isHeld(h, fronde)).toBe(true);
    expect(h.weapons.map((w) => w.uid)).toContain(fronde.uid);
  });
});
