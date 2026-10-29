/**
 * `ciblage` : la Cible d'un Trait psy se fabrique, se lit, se compare et s'affiche en un seul module
 * (#1463, #3045). Entrées de donnée choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect } from 'vitest';
import { ciblePsy, cibleDeRef, cibleDuPorteur, ciblePsyLue, estCibleType, identiteDeCiblage, libelleDeCible, refDeCible, selonCible, varianteAdmise, varianteDe, type CiblePsy } from './ciblage';
import { dataLabel, groupLabel, groups, psychologies } from '../../data';
import { t } from '../../i18n';

const groupe = groups[0];
/** Un id de combattant quelconque : la forme d'un `Combatant.id`, jamais un id du dépôt. */
const individu = 'combattant-1';
const lecture = { groupe: (id: string) => `g:${id}`, individu: (id: string) => `i:${id}` };

describe('ciblePsy — la seule fabrique', () => {
  it('précondition : le registre des Groupes a une entrée', () => {
    expect(groupe).toBeDefined();
  });

  it('un id de Groupe donne la Cible de ce Groupe', () => {
    const cible = ciblePsy.groupe(groupe.id);
    expect(selonCible(cible, lecture)).toBe(`g:${groupe.id}`);
  });

  it('un id de combattant donne la Cible de cet individu, distincte du Groupe de même id', () => {
    const cible = ciblePsy.individu(individu);
    expect(selonCible(cible, lecture)).toBe(`i:${individu}`);
    expect(ciblePsy.individu(groupe.id) === ciblePsy.groupe(groupe.id)).toBe(false);
    expect(varianteDe(cible)).toBe('individu');
    expect(varianteDe(ciblePsy.groupe(groupe.id))).toBe('groupe');
  });

  it('lève sur un id hors du motif, dont un `@` en tête : erreur de programmation', () => {
    expect(() => ciblePsy.groupe(`@${groupe.id}`)).toThrow(/n'est pas un id de Groupe/);
    expect(() => ciblePsy.groupe(groupe.label)).toThrow(/n'est pas un id de Groupe/);
    expect(() => ciblePsy.groupe('')).toThrow(/n'est pas un id de Groupe/);
  });

  it('lève sur un id d’individu vide ou déjà préfixé', () => {
    expect(() => ciblePsy.individu('')).toThrow(/n'est pas un id de combattant/);
    expect(() => ciblePsy.individu(`@${individu}`)).toThrow(/n'est pas un id de combattant/);
  });
});

describe('cibleDuPorteur — la Cible que désigne un porteur', () => {
  it('son 1er Groupe, fabriqué ; aucun Groupe, aucune Cible', () => {
    expect(cibleDuPorteur({ groups: [groupe.id] })).toBe(ciblePsy.groupe(groupe.id));
    expect(cibleDuPorteur({})).toBeUndefined();
  });
});

describe('ciblePsyLue — la Cible qu’écrit une chaîne de donnée', () => {
  it('un id de Groupe connu donne sa Cible ; `@id` donne l’individu', () => {
    expect(ciblePsyLue(groupe.id)).toBe(ciblePsy.groupe(groupe.id));
    expect(ciblePsyLue(`@${individu}`)).toBe(ciblePsy.individu(individu));
  });

  it('un libellé, un id hors registre, un `@` seul ou doublé n’en donnent aucune', () => {
    expect(ciblePsyLue(groupe.label)).toBeUndefined();
    expect(ciblePsyLue('groupe-hors-registre')).toBeUndefined();
    expect(ciblePsyLue('@')).toBeUndefined();
    expect(ciblePsyLue(`@@${individu}`)).toBeUndefined();
    expect(ciblePsyLue('')).toBeUndefined();
  });
});

describe('cibleDeRef / refDeCible — la seule couture entre la référence d’op et le moteur', () => {
  it('la référence d’un Groupe ou d’un individu donne sa Cible, et réciproquement', () => {
    for (const cible of [ciblePsy.groupe(groupe.id), ciblePsy.individu(individu)]) {
      expect(cibleDeRef(refDeCible(cible))).toBe(cible);
    }
    expect(refDeCible(ciblePsy.groupe(groupe.id))).toEqual({ id: groupe.id });
    expect(refDeCible(ciblePsy.individu(individu))).toEqual({ personnage: individu });
  });

  it('lève sur une référence hors du motif des Groupes', () => {
    expect(() => cibleDeRef({ id: groupe.label })).toThrow(/n'est pas un id de Groupe/);
  });
});

describe('varianteAdmise — les variantes que `psychology.json` déclare (`cibles`)', () => {
  const ciblees = psychologies.filter((p) => p.cibles);

  it('les variantes d’une entrée ciblée sont exactement les admises', () => {
    expect(ciblees.length).toBeGreaterThan(0);
    for (const p of ciblees) {
      expect(varianteAdmise(p.id, 'groupe')).toBe(!!p.cibles?.includes('groupe'));
      expect(varianteAdmise(p.id, 'individu')).toBe(!!p.cibles?.includes('individu'));
    }
  });

  it('une entrée non ciblée n’admet aucune Cible', () => {
    const autre = psychologies.find((p) => !p.cibles);
    expect(autre).toBeDefined();
    expect(varianteAdmise(autre!.id, 'groupe')).toBe(false);
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

  it('une Cible d’individu s’affiche par le nom que fournit l’appelant, jamais par son id', () => {
    const nom = 'Un nom de personne';
    expect(libelleDeCible(ciblePsy.individu(individu), (id) => (id === individu ? nom : undefined))).toBe(dataLabel(nom));
  });

  it('sans nom connu, une Cible d’individu s’affiche par le texte générique', () => {
    const generique = t('cible.personneDeLaScene');
    expect(libelleDeCible(ciblePsy.individu(individu))).toBe(generique);
    expect(libelleDeCible(ciblePsy.individu(individu), () => undefined)).toBe(generique);
    expect(generique).not.toContain(individu);
  });
});

describe('estCibleType — dérivé de `psychology.json`', () => {
  it('vrai pour toute entrée à `cibles`, faux pour les autres', () => {
    const ciblees = psychologies.filter((p) => p.cibles);
    const autres = psychologies.filter((p) => !p.cibles);
    expect(ciblees.length).toBeGreaterThan(0);
    expect(autres.length).toBeGreaterThan(0);
    expect(ciblees.every((p) => estCibleType(p.id))).toBe(true);
    expect(autres.some((p) => estCibleType(p.id))).toBe(false);
  });

  it('faux pour un type hors du registre', () => {
    expect(estCibleType('hors-registre')).toBe(false);
  });
});

describe('CiblePsy — marque purement typologique (#3045)', () => {
  it('la copie JSON rend la chaîne de l’id, égale par `===` à la Cible fabriquée', () => {
    const cible = ciblePsy.groupe(groupe.id);
    const copie: { cible: CiblePsy } = JSON.parse(JSON.stringify({ cible }));
    expect(copie.cible === cible).toBe(true);
    expect(JSON.stringify(cible)).toBe(JSON.stringify(groupe.id));
  });

  it('ni une chaîne nue, ni un `as` vers le texte joueur, ni un paramètre de `t()` n’acceptent une Cible', () => {
    const cible = ciblePsy.groupe(groupe.id);
    const texte = libelleDeCible(cible);
    // @ts-expect-error #3045
    const nue: CiblePsy = groupe.id;
    // @ts-expect-error #3045
    const forge = cible as typeof texte;
    // @ts-expect-error #3045
    const ligne = t('turn.psychSuperseded', { name: cible, psych: texte });
    expect([nue, forge]).toEqual([groupe.id, groupe.id]);
    expect(ligne).toContain(groupe.id);
  });
});
