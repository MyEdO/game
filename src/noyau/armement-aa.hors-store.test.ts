import { afterEach, describe, expect, it } from 'vitest';
import { findTrappingById, findWeaponGroupById, trappingsEffectifs, trappingsInstanciables } from '../data';
import { resetRule, setRule } from '../engine/policy';
import { codexLookupById } from './codex/registry';
import { prixDeLigne, type MerchantState } from './merchantFlow';

const REGLE = 'combat-aa-armement';
const qualites = (id: string) => findTrappingById(id)?.qualities.map((q) => q.id);

describe('Option commune des profils d’armement (AA 02 l.17–21 ; AA 08 l.63–77)', () => {
  afterEach(() => resetRule(REGLE));

  it.each([
    ['arme-improvisee', 91, 135],
    ['lance-de-cavalerie', 93, 208],
    ['fleuret', 93, 220],
    ['brise-epee', 95, 288],
    ['hallebarde', 96, 302],
    ['grande-hache', 98, 360],
    ['arquebus-a-repetition', 101, 451],
    ['pistolet-a-repetition', 101, 454],
    ['arquebuse', 101, 457],
    ['long-fusil-d-hochland', 101, 463],
    ['pistolet', 101, 464],
    ['tromblon', 101, 466],
    ['fleche-elfique', 98, 377],
    ['epee-batarde', 97, 343],
    ['main-gauche', 96, 314],
  ] as const)('%s : la fiche garde son id et affiche la source AA p.%i, l.%i en mode AA', (id, page, ligne) => {
    const base = findTrappingById(id)!;
    expect(base.source.book).toBe('livre-de-base');
    expect(codexLookupById('trappings', id)?.source?.book).toBe('LDB');

    setRule(REGLE, true);
    const active = findTrappingById(id)!;
    expect(active.id).toBe(base.id);
    expect(active.source).toEqual({ book: 'aux-armes', page, note: `AA 08 l.${ligne}` });
    expect(trappingsEffectifs().find((t) => t.id === id)).toBe(active);
    expect(codexLookupById('trappings', id)?.source).toEqual({ book: 'AA', page });
  });

  it('applique les changements de qualités, d’indice, de dégâts et de disponibilité du tableau', () => {
    expect(qualites('arme-improvisee')).toEqual(['inoffensive']);
    expect(qualites('fleuret')).toEqual(['pointue', 'inoffensive']);
    expect(qualites('fleche-elfique')).toEqual(['precise', 'empaleuse', 'perforante']);
    expect(findTrappingById('brise-epee')?.damage).toEqual({ plusBF: true, flat: 3 });
    expect(findTrappingById('hallebarde')?.qualitesAuChoix).toBeUndefined();
    expect(findTrappingById('lance-de-cavalerie')?.availability).toBe('rare');
    expect(findTrappingById('grande-hache')?.availability).toBe('limitee');
    expect(findTrappingById('tromblon')?.qualities).toContainEqual({ id: 'a-explosion', value: 3 });

    setRule(REGLE, true);
    expect(qualites('arme-improvisee')).toEqual(['desequilibree', 'inoffensive']);
    expect(qualites('fleuret')).toEqual(['precise', 'inoffensive']);
    expect(qualites('fleche-elfique')).toEqual(['pointue', 'empaleuse', 'perforante']);
    expect(findTrappingById('fleche-elfique')?.alsoIn).toEqual([{ book: 'livre-de-base', page: 296, quote: 'Flèche elfe' }]);
    expect(findTrappingById('brise-epee')?.damage).toEqual({ plusBF: true, flat: 1 });
    expect(findTrappingById('hallebarde')?.qualitesAuChoix).toEqual(['taille', 'empaleuse']);
    expect(findTrappingById('lance-de-cavalerie')?.availability).toBe('limitee');
    expect(findTrappingById('grande-hache')?.availability).toBe('commune');
    expect(findTrappingById('tromblon')?.qualities).toContainEqual({ id: 'tir-de-zone', value: 3 });
    expect(qualites('tromblon')).not.toContain('a-explosion');
    expect(findTrappingById('petites-munitions-et-poudre')?.qualities).toEqual([{ id: 'a-explosion', majoration: 1 }]);
  });

  it.each([
    'arquebus-a-repetition', 'pistolet-a-repetition', 'arquebuse', 'long-fusil-d-hochland', 'pistolet', 'tromblon',
  ])('%s : Poudre noire et Dévastatrice sont les Atouts de la table LDB (LDB 62 l.99)', (id) => {
    expect(qualites(id)).toEqual(expect.arrayContaining(['a-poudre-noire', 'devastatrice']));
    setRule(REGLE, true);
    expect(qualites(id)).not.toContain('a-poudre-noire');
    expect(qualites(id)).not.toContain('devastatrice');
  });

  it('rechiffre une même ligne de stock du marchand à la bascule', () => {
    const id = 'long-fusil-d-hochland';
    const marchand: MerchantState = {
      entityId: 'armurier', archetype: 'forgeron', settlement: 'ville', resaleRate: 0.5,
      stock: [{ id, qty: 1 }], cart: [], bargainLocked: false,
    };
    const prix = () => prixDeLigne(marchand, id, undefined, [])?.gold;
    expect(prix()).toBe(100);
    expect(trappingsInstanciables().find((t) => t.id === id)?.price).toMatchObject({ gold: 100 });
    setRule(REGLE, true);
    expect(prix()).toBe(50);
    expect(trappingsInstanciables().find((t) => t.id === id)?.price).toMatchObject({ gold: 50 });
    resetRule(REGLE);
    expect(prix()).toBe(100);
  });

  it('active les deux maniements d’objet et le maniement commun du Groupe Escrime, en gardant Corbin', () => {
    const corbin = findTrappingById('marteau-a-bec-de-corbin')?.manieAussi;
    expect(corbin).toBeDefined();
    expect(findTrappingById('epee-batarde')?.manieAussi).toBeUndefined();
    expect(findTrappingById('main-gauche')?.manieAussi).toBeUndefined();
    expect(findWeaponGroupById('escrime')?.manieAussi).toBeUndefined();
    expect(codexLookupById('weaponGroups', 'escrime')?.source?.book).toBe('LDB');

    setRule(REGLE, true);
    expect(findTrappingById('epee-batarde')?.manieAussi?.base?.mains).toBe(1);
    expect(findTrappingById('main-gauche')?.manieAussi?.base?.retire).toEqual(['defensive']);
    expect(findWeaponGroupById('escrime')?.manieAussi?.base).toEqual({});
    expect(codexLookupById('weaponGroups', 'escrime')?.source).toEqual({ book: 'AA', page: 93 });
    expect(findTrappingById('marteau-a-bec-de-corbin')?.manieAussi).toBe(corbin);
  });
});
