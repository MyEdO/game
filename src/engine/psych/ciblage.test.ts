/**
 * `ciblage` : la Cible d'un Trait psy se fabrique, se lit, se compare et s'affiche en un seul module
 * (#1463, #3045). Entrées de donnée choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect } from 'vitest';
import { ciblePsy, cibleDuPorteur, ciblePsyLue, estCibleType, identiteDeCiblage, libelleDeCible, refDeCible, selonCible } from './ciblage';
import { groupLabel, groups, psychologies } from '../../data';

const groupe = groups[0];

describe('ciblePsy — la seule fabrique', () => {
  it('précondition : le registre des Groupes a une entrée', () => {
    expect(groupe).toBeDefined();
  });

  it('un id de Groupe donne la Cible de ce Groupe', () => {
    const cible = ciblePsy.groupe(groupe.id);
    expect(selonCible(cible, { groupe: (id) => id })).toBe(groupe.id);
  });

  it('lève sur un id hors du motif, dont un `@` en tête : erreur de programmation', () => {
    expect(() => ciblePsy.groupe(`@${groupe.id}`)).toThrow(/n'est pas un id de Groupe/);
    expect(() => ciblePsy.groupe(groupe.label)).toThrow(/n'est pas un id de Groupe/);
    expect(() => ciblePsy.groupe('')).toThrow(/n'est pas un id de Groupe/);
  });
});

describe('cibleDuPorteur — la Cible que désigne un porteur', () => {
  it('son 1er Groupe, fabriqué ; aucun Groupe, aucune Cible', () => {
    expect(cibleDuPorteur({ groups: [groupe.id] })).toBe(ciblePsy.groupe(groupe.id));
    expect(cibleDuPorteur({})).toBeUndefined();
  });
});

describe('ciblePsyLue / refDeCible — la seule couture entre la donnée et le moteur', () => {
  it('la référence de donnée d’un Groupe donne sa Cible, et réciproquement', () => {
    const cible = ciblePsy.groupe(groupe.id);
    expect(ciblePsyLue({ id: groupe.id })).toBe(cible);
    expect(refDeCible(cible)).toEqual({ id: groupe.id });
    expect(ciblePsyLue(refDeCible(cible))).toBe(cible);
  });

  it('lève sur une référence hors du motif des Groupes', () => {
    expect(() => ciblePsyLue({ id: groupe.label })).toThrow(/n'est pas un id de Groupe/);
  });
});

describe('identiteDeCiblage — une seule identité de Trait psy', () => {
  const cible = ciblePsy.groupe(groupe.id);

  it('même type et même Cible : même identité', () => {
    expect(identiteDeCiblage('t', cible)).toBe(identiteDeCiblage('t', ciblePsy.groupe(groupe.id)));
  });

  it('un autre type, une autre Cible ou une Cible absente : une autre identité', () => {
    const autre = groups.find((g) => g.id !== groupe.id);
    expect(autre).toBeDefined();
    const ids = new Set([
      identiteDeCiblage('t', cible),
      identiteDeCiblage('u', cible),
      identiteDeCiblage('t', ciblePsy.groupe(autre!.id)),
      identiteDeCiblage('t'),
    ]);
    expect(ids.size).toBe(4);
  });
});

describe('libelleDeCible — le libellé joueur d’une Cible', () => {
  it('une Cible de Groupe s’affiche par le libellé du Groupe, jamais par son id', () => {
    expect(libelleDeCible(ciblePsy.groupe(groupe.id))).toBe(groupLabel(groupe.id));
  });
});

describe('estCibleType — dérivé de `psychology.json`', () => {
  it('vrai pour toute entrée `targeted`, faux pour les autres', () => {
    const ciblees = psychologies.filter((p) => p.targeted);
    const autres = psychologies.filter((p) => !p.targeted);
    expect(ciblees.length).toBeGreaterThan(0);
    expect(autres.length).toBeGreaterThan(0);
    expect(ciblees.every((p) => estCibleType(p.id))).toBe(true);
    expect(autres.some((p) => estCibleType(p.id))).toBe(false);
  });

  it('faux pour un type hors du registre', () => {
    expect(estCibleType('hors-registre')).toBe(false);
  });
});
