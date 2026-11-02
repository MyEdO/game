/**
 * ANIMOSITÉ ACQUISE sur un Destin dépensé (ADE II 09 l.15 ; Q16 A, #3045) : les Cibles qu'offre le tueur, lues
 * sur les Races (`racesDe`) de l'appartenance du porteur et de la vue perçue du tueur, et la Haine qui remplace
 * une Animosité déjà possédée.
 */
import { describe, it, expect } from 'vitest';
import { ciblesDAnimositeAcquise, traitAcquis } from './psychology';
import { ciblePsy } from './psych/ciblage';
import { findGroupById } from '../data';

const humain = { groups: ['humain'] };
const tueur = (groups: string[], p: { traits?: { id: string; hidden?: boolean }[] } = {}) => ({ id: 'tueur', groups, ...p });
const groupes = (...ids: string[]) => ids.map((id) => ciblePsy.groupe(id));

describe('ciblesDAnimositeAcquise — le tueur de la Race du porteur (ADE II 09 l.15)', () => {
  it('ses sous-groupes seulement, dans l’ordre de `groups.json`, le premier par défaut', () => {
    expect(findGroupById('humain')?.race).toBe(true);
    expect(ciblesDAnimositeAcquise(humain, tueur(['soldat', 'humain', 'criminel']))).toEqual({
      candidats: groupes('criminel', 'soldat'),
      parDefaut: ciblePsy.groupe('criminel'),
    });
  });

  it('un tueur à plusieurs Races, dont l’une est celle du porteur : de la Race du porteur', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur(['humain', 'nain', 'soldat']))).toEqual({ candidats: groupes('soldat'), parDefaut: ciblePsy.groupe('soldat') });
    expect(ciblesDAnimositeAcquise({ groups: ['nain'] }, tueur(['humain', 'nain', 'soldat']))).toEqual({ candidats: groupes('soldat'), parDefaut: ciblePsy.groupe('soldat') });
  });

  it('sans sous-groupe : l’individu (#3045)', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur(['humain']))).toEqual({ candidats: [ciblePsy.individu('tueur')], parDefaut: ciblePsy.individu('tueur') });
  });
});

describe('ciblesDAnimositeAcquise — le tueur d’une autre Race (ADE II 09 l.15)', () => {
  it('sa Race ou ses sous-groupes, la Race par défaut (Q16 A, #3045)', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur(['soldat', 'nain']))).toEqual({
      candidats: groupes('nain', 'soldat'),
      parDefaut: ciblePsy.groupe('nain'),
    });
    expect(ciblesDAnimositeAcquise(humain, tueur(['skaven', 'mort-vivant'])), 'la Race, même après un sous-groupe dans `groups.json`').toEqual({
      candidats: groupes('mort-vivant', 'skaven'),
      parDefaut: ciblePsy.groupe('skaven'),
    });
  });

  it('un tueur à plusieurs Races, aucune du porteur : la première dans l’ordre de `groups.json` par défaut', () => {
    expect(ciblesDAnimositeAcquise({ groups: ['elfe'] }, tueur(['nain', 'humain'])).parDefaut).toBe(ciblePsy.groupe('humain'));
  });

  it('sans sous-groupe : sa Race (#3045)', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur(['nain']))).toEqual({ candidats: groupes('nain'), parDefaut: ciblePsy.groupe('nain') });
  });

  it('un porteur sans Race est d’une autre Race que tout tueur à Race', () => {
    expect(ciblesDAnimositeAcquise({ groups: ['mort-vivant'] }, tueur(['humain', 'soldat']))).toEqual({
      candidats: groupes('humain', 'soldat'),
      parDefaut: ciblePsy.groupe('humain'),
    });
  });
});

describe('ciblesDAnimositeAcquise — le tueur sans Race (#3045)', () => {
  it('ses Groupes perçus, le premier par défaut', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur(['demon', 'mort-vivant']))).toEqual({
      candidats: groupes('mort-vivant', 'demon'),
      parDefaut: ciblePsy.groupe('mort-vivant'),
    });
  });

  it('sans Groupe perçu : l’individu', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur([]))).toEqual({ candidats: [ciblePsy.individu('tueur')], parDefaut: ciblePsy.individu('tueur') });
  });

  it('le Groupe d’un Trait dissimulé n’est pas perçu (`groupesPercus`)', () => {
    expect(ciblesDAnimositeAcquise(humain, tueur([], { traits: [{ id: 'demoniaque', hidden: true }] })).candidats).toEqual([ciblePsy.individu('tueur')]);
    expect(ciblesDAnimositeAcquise(humain, tueur([], { traits: [{ id: 'demoniaque' }] })).candidats).toEqual(groupes('demon'));
  });
});

describe('traitAcquis — « Si un Personnage obtient une Animosité qu’il possède déjà, celle-ci devient de la Haine » (ADE II 09 l.15)', () => {
  const soldat = ciblePsy.groupe('soldat');
  const possedee = () => ({ type: 'animosite' as const, cible: soldat });

  it('une Animosité neuve ; possédée, la Haine qui la remplace', () => {
    expect(traitAcquis({}, 'animosite', soldat)).toEqual({ type: 'animosite', remplace: [] });
    const p = possedee();
    const acquis = traitAcquis({ psychTraits: [p] }, 'animosite', soldat);
    expect(acquis).toEqual({ type: 'haine', remplace: [p] });
    expect(acquis.remplace[0]).toBe(p);
    expect(traitAcquis({ psychTraits: [p] }, 'animosite', ciblePsy.groupe('nain'))).toEqual({ type: 'animosite', remplace: [] });
  });

  it('la Haine remplace TOUTES les Animosités identiques, et elles seules', () => {
    const [a, b] = [possedee(), possedee()];
    const autre = { type: 'animosite' as const, cible: ciblePsy.groupe('nain') };
    const peur = { type: 'peur' as const, indice: 1 };
    const acquis = traitAcquis({ psychTraits: [a, autre, b, peur] }, 'animosite', soldat);
    expect(acquis.type).toBe('haine');
    expect(acquis.remplace).toHaveLength(2);
    expect(acquis.remplace[0]).toBe(a);
    expect(acquis.remplace[1]).toBe(b);
  });

  it('une Animosité suspendue par un effet (`suppressedPsych`) est possédée : la Haine la remplace', () => {
    const suspendue = possedee();
    const acquis = traitAcquis({ activeEffects: [{ suppressedPsych: [suspendue] } as never] }, 'animosite', soldat);
    expect(acquis.type).toBe('haine');
    expect(acquis.remplace[0]).toBe(suspendue);
  });

  it('une Phobie ne remplace rien', () => {
    expect(traitAcquis({ psychTraits: [{ type: 'phobie', cible: ciblePsy.groupe('skaven') }] }, 'phobie', ciblePsy.groupe('skaven'))).toEqual({ type: 'phobie', remplace: [] });
  });
});
