/**
 * LA CRÉATION EN PAGES (#3328) : un hôte joue l'assistant page à page, chaque option par le geste qu'elle porte ; aucun
 * dé ne parle avant le geste qui le jette.
 */
import { describe, it, expect } from 'vitest';
import { withCareer, withSpecies } from './brouillon';
import { apresLeGeste, brouillonDeLaPartie, pagesDeCreation, rubriquesDeLaPage, type RubriqueDeCreation } from './vueDeLaCreation';

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
