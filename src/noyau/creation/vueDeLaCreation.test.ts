/**
 * LA CRÉATION EN PAGES (#3328) : un hôte joue l'assistant page à page, chaque option par le geste qu'elle porte ; aucun
 * dé ne parle avant le geste qui le jette.
 */
import { describe, it, expect } from 'vitest';
import { carrieresOffertes, draftSpecies, newDraft, withCareer, withCoastalSwap, withSpecies, type CreatorDraft } from './brouillon';
import { apresLeGeste, brouillonDeLaPartie, pagesDeCreation, rubriquesDeLaPage, type RubriqueDeCreation } from './vueDeLaCreation';
import { carrieresAleatoires, fabricationAtouts, findQualityById, species } from '../../data';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../../data/dotations.fixture';
import { adresseDeCreation } from '../../engine/adresseDeCreation';
import { setDataset } from '../../data/overrides';
import { rollCareer } from '../../engine/creation';
import { deFixe, deMin } from '../../engine/dice.testkit';

const rubrique = (r: RubriqueDeCreation[], id: string): RubriqueDeCreation => {
  const x = r.find((e) => e.id === id);
  if (!x) throw new Error(`aucune rubrique ${id} : ${r.map((e) => e.id).join(', ')}`);
  return x;
};
const options = (r: RubriqueDeCreation) => (r.genre === 'choix' ? r.options : []);

describe('la création en pages', () => {
  it('un brouillon neuf par rang, le même pour la même partie', () => {
    expect(brouillonDeLaPartie(7, 0)).toEqual(brouillonDeLaPartie(7, 0));
    expect(brouillonDeLaPartie(7, 1).seed).not.toBe(brouillonDeLaPartie(7, 0).seed);
  });

  it('aucun dé ne parle avant son geste : chaque tirage est un geste, son jet dit après', () => {
    const d = withCareer(withSpecies(brouillonDeLaPartie(7, 0), 'humains-reiklander'), 'soldat');
    for (const p of pagesDeCreation()) expect(rubriquesDeLaPage(d, p).filter((r) => r.genre === 'jet'), p).toEqual([]);
    const tirage = rubrique(rubriquesDeLaPage(d, 'chars'), 'tirage');
    expect(rubriquesDeLaPage(d, 'chars').filter((r) => r.id.startsWith('carac/')).map((r) => r.genre === 'valeur' && r.valeur), 'les Caractéristiques se taisent avant les dés').toEqual(Array(10).fill(null));
    const tiree = apresLeGeste(d, (tirage as Extract<RubriqueDeCreation, { genre: 'geste' }>).geste);
    expect(rubriquesDeLaPage(tiree, 'chars').filter((r) => r.id.startsWith('carac/')).every((r) => r.genre === 'valeur' && /^\d+$/.test(r.valeur!)), 'puis se disent').toBe(true);
  });

  it('chaque option se choisit par son geste ; au-delà du quota, plus rien à répartir', () => {
    const d = brouillonDeLaPartie(7, 0);
    const halflings = options(rubrique(rubriquesDeLaPage(d, 'species'), 'famille')).find((o) => o.libelle === 'Halflings')!;
    expect(options(rubrique(rubriquesDeLaPage(apresLeGeste(d, halflings.geste), 'species'), 'famille')).filter((o) => o.choisie).map((o) => o.libelle)).toEqual(['Halflings']);

    let c = withCareer(withSpecies(d, 'humains-reiklander'), 'soldat');
    c = apresLeGeste(c, (rubrique(rubriquesDeLaPage(c, 'chars'), 'tirage') as Extract<RubriqueDeCreation, { genre: 'geste' }>).geste);
    const [premiere, seconde] = rubriquesDeLaPage(c, 'chars').filter((r) => r.id.startsWith('augmentation/'));
    c = apresLeGeste(c, options(premiere).find((o) => o.libelle === '5')!.geste);
    expect(options(rubrique(rubriquesDeLaPage(c, 'chars'), seconde.id)).map((o) => [o.libelle, o.refus !== null])).toEqual([['0', false], ['1', true], ['2', true], ['3', true], ['4', true], ['5', true]]);
  });
});

describe('la race puis la lignée : les espèces se groupent par race (`refChar`), jamais par leur libellé `family`', () => {
  it('une lignée au `family` renommé reste dans sa race, sous le libellé de l’espèce canonique', () => {
    const origine = [...species];
    const renommee = origine.map((s) => (s.id === 'nains-norse' ? { ...s, family: 'Nains du Norsca' } : s));
    setDataset('species', renommee);
    try {
      const page = rubriquesDeLaPage(withSpecies(newDraft(1), 'nains'), 'species');
      const races = options(rubrique(page, 'famille')).map((o) => o.libelle);
      expect(races.filter((l) => l.startsWith('Nains'))).toEqual(['Nains']);
      expect(options(rubrique(page, 'lignee')).map((o) => o.libelle)).toEqual(renommee.filter((s) => s.refChar === 'nain').map((s) => s.variant ?? s.label));
    } finally {
      setDataset('species', origine);
    }
  });
});

describe('les carrières offertes : celles que le tirage offre sur la table effective (LDB 05 l.204-212 ; MDG 09 l.9)', () => {
  /** Les carrières que `rollCareer` rend, d100 de 1 à 100, à l'espèce du brouillon sous son remplacement. */
  const tirees = (d: CreatorDraft) => [...new Set(Array.from({ length: 100 }, (_, i) => rollCareer(draftSpecies(d)!, d.coastalSwap, deFixe(i + 1)).ids).flat())].sort();
  const offertes = (d: CreatorDraft) => carrieresOffertes(d).map((c) => c.id).sort();
  const brouillon = (speciesId: string, swap: boolean) => withCoastalSwap(withSpecies(newDraft(1), speciesId), swap);

  it('par espèce × remplacement, les offertes sont exactement les tirées', () => {
    for (const sp of species) for (const swap of [false, true]) {
      const d = brouillon(sp.id, swap);
      expect(offertes(d), `${sp.id} swap=${swap}`).toEqual(tirees(d));
    }
  });

  it('une colonne éditée au Codex qui porte une carrière de la Classe remplacée : la carrière tirée reste offerte', () => {
    const imprimes = structuredClone([...carrieresAleatoires]);
    try {
      // Officier (Côtiers, portion `cotiers-humain`) sans remplacement, Batelier (Riverains, colonne `humain`) avec.
      for (const [swap, document, id] of [[false, 'cotiers-humain', 'officier'], [true, 'humain', 'batelier']] as const) {
        const edite = structuredClone(imprimes);
        edite.find((x) => x.id === 'humain')!.entries[0].id = imprimes.find((x) => x.id === document)!.entries.find((r) => r.id === id)!.id;
        setDataset('carrieresAleatoires', edite);
        const d = brouillon('humains-reiklander', swap);
        expect(rollCareer(draftSpecies(d)!, swap, deMin).ids[0]).toBe(id);
        expect(offertes(d), `swap=${swap}`).toContain(id);
        expect(offertes(d), `swap=${swap}`).toEqual(tirees(d));
      }
    } finally {
      setDataset('carrieresAleatoires', imprimes);
    }
  });
});

describe('les possessions : l’Atout au choix d’une arme au choix suit son arme, à son adresse (LDB 60 l.9-32)', () => {
  it('un joker à Atout donne deux rubriques, l’arme puis l’Atout à `[...chemin, 0]`, et le geste de l’Atout pose sa valeur là', () => {
    avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, () => {
      const dot = adresseDeCreation.dotation;
      const d = withCareer(withSpecies(brouillonDeLaPartie(7, 0), 'humains-reiklander'), CARRIERE_FIXTURE);
      const page = rubriquesDeLaPage(d, 'trappings');
      const ids = page.map((r) => r.id);
      expect(ids.indexOf(dot([7, 0])), 'l’Atout suit l’arme').toBe(ids.indexOf(dot([7])) + 1);
      expect(options(rubrique(page, dot([7]))).length).toBeGreaterThan(0);
      const atout = rubrique(page, dot([7, 0]));
      expect(options(atout).map((o) => o.libelle)).toEqual(fabricationAtouts().map((id) => findQualityById(id)!.label));
      const solide = options(atout).find((o) => o.libelle === findQualityById('solide')!.label)!;
      const pose = apresLeGeste(d, solide.geste);
      expect(pose.trappingChoices?.[dot([7, 0])]).toBe('solide');
      expect(options(rubrique(rubriquesDeLaPage(pose, 'trappings'), dot([7, 0]))).filter((o) => o.choisie).map((o) => o.libelle)).toEqual([solide.libelle]);
    });
  });
});
