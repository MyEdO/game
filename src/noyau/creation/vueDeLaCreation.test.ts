/**
 * LA CRÉATION EN PAGES (#3328) : un hôte joue l'assistant page à page, chaque option par le geste qu'elle porte ; aucun
 * dé ne parle avant le geste qui le jette.
 */
import { describe, it, expect } from 'vitest';
import { carrieresOffertes, draftSpecies, newDraft, rollDraftCareer, withCareer, withCoastalSwap, withSpecies, type CreatorDraft } from './brouillon';
import { apresLeGeste, brouillonDeLaPartie, pagesDeCreation, rubriquesDeLaPage, type RubriqueDeCreation } from './vueDeLaCreation';
import { carrieresAleatoires, offreDuJet, species, varianteDe } from '../../data';
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
  /** Ce qu'offrent les jets de `rollCareer`, d100 de 1 à 100, à l'espèce du brouillon sous son remplacement, sans ou avec
   *  chaque rangée du second lancer (`offreDuJet`, `varianteDe`). */
  const tirees = (d: CreatorDraft) => {
    const sp = draftSpecies(d)!;
    return [...new Set(Array.from({ length: 100 }, (_, i) => {
      const { id } = rollCareer(sp, d.coastalSwap, deFixe(i + 1));
      return [...offreDuJet(sp, { id }), ...(varianteDe(id, sp)?.entries ?? []).flatMap((second) => offreDuJet(sp, { id, second }))];
    }).flat())].sort();
  };
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
        expect(rollCareer(draftSpecies(d)!, swap, deMin).id).toBe(id);
        expect(offertes(d), `swap=${swap}`).toContain(id);
        expect(offertes(d), `swap=${swap}`).toEqual(tirees(d));
      }
    } finally {
      setDataset('carrieresAleatoires', imprimes);
    }
  });
});

describe('le second lancer : un geste offert au jet dont la carrière a une variante (AA 02 l.109-111 ; VDM 03 l.17-19)', () => {
  /** Le premier brouillon d'un Reiklander, graines 1.., dont le premier jet de carrière vérifie `voulu`. */
  const premierJetOu = (voulu: (d: CreatorDraft) => boolean) => {
    for (let graine = 1; graine < 5000; graine++) {
      const d = rollDraftCareer(withSpecies(newDraft(graine), 'humains-reiklander'));
      if (voulu(d)) return d;
    }
    throw new Error('aucune graine');
  };
  const aUneVariante = (d: CreatorDraft) => !!varianteDe(d.careerRolls[0].id, draftSpecies(d)!);

  it('offert sur un jet à variante, il tire le second d100, que le tirage dit, puis ne s’offre plus', () => {
    const soldat = premierJetOu((d) => d.careerRolls[0].id === 'soldat');
    const offert = rubrique(rubriquesDeLaPage(soldat, 'career'), 'variante/0');
    expect(offert.genre === 'geste' && offert.libelle).toBe('Second lancer : Soldat');
    const engage = apresLeGeste(soldat, (offert as Extract<RubriqueDeCreation, { genre: 'geste' }>).geste);
    const [jet] = engage.careerRolls;
    const page = rubriquesDeLaPage(engage, 'career');
    expect(page.filter((r) => r.id.startsWith('variante/')), 'fait, le second lancer ne s’offre plus').toEqual([]);
    const tirage = rubrique(page, 'tirage');
    expect(tirage.genre === 'jet' && tirage.resultat, 'le tirage dit les deux d100').toBe(`${jet.roll} → ${jet.second!.roll}`);
  });

  it('absent sur un jet dont la carrière n’a pas de variante', () => {
    const sans = premierJetOu((d) => !aUneVariante(d));
    expect(rubriquesDeLaPage(sans, 'career').filter((r) => r.id.startsWith('variante/'))).toEqual([]);
  });
});
