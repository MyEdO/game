import { describe, it, expect, expectTypeOf } from 'vitest';
import { declaredView, declaredViews, foldView, mapViews, nearestView, viewEntries, type ViewArt } from './viewArt';
import { VIEWS, type View } from './facing';
import { tableTotale } from '../../lib/tableTotale';
import type { PartArt, ViewSet } from './parts/types';

const full: ViewArt = { front: () => 'F', profile: () => 'P', back: () => 'B' };
const profileOnly: ViewArt = { profile: () => 'P' };
const frontBack: ViewArt = { front: () => 'F', back: () => 'B' };
/** Ordre de repli SANS repli : la vue demandée seule. */
const SANS_REPLI = tableTotale(VIEWS, (v) => [v]);

describe('viewArt — contrat PARTAGÉ des arts orientés', () => {
  it('declaredViews : couverture réelle dans l’ordre canon (face, profil, dos)', () => {
    expect(declaredViews(full)).toEqual(VIEWS);
    expect(declaredViews(profileOnly)).toEqual(['profile']);
    expect(declaredViews(frontBack)).toEqual(['front', 'back']);
    expect(declaredViews('<g/>')).toEqual(['front']);
    expect(declaredViews(null)).toEqual([]);
  });

  it('nearestView : mono-vue → toute vue demandée rend la seule déclarée', () => {
    expect(nearestView(profileOnly, 'front')()).toBe('P');
    expect(nearestView(profileOnly, 'back')()).toBe('P');
    expect(nearestView(profileOnly, 'profile')()).toBe('P');
  });

  it('nearestView : le profil est mitoyen ; face↔dos passent par lui d’abord', () => {
    expect(nearestView(frontBack, 'profile')()).toBe('F'); // profil absent → 1re déclarée (face)
    expect(nearestView({ front: () => 'F', profile: () => 'P' }, 'back')()).toBe('P');
    expect(nearestView(full, 'back')()).toBe('B'); // déclarée → elle-même
  });

  it('nearestView : renvoie la fonction de la vue repliée', () => {
    expect(nearestView(profileOnly, 'front')()).toBe('P');
    expect(nearestView(full, 'back')()).toBe('B');
  });

  it('nearestView : art sans aucune vue = erreur de donnée (lève)', () => {
    expect(() => nearestView({}, 'front')).toThrow();
  });

  it('foldView : une vue absente rend undefined sans lever, une vue déclarée rend son art', () => {
    expect(foldView(profileOnly, 'front', SANS_REPLI)).toBeUndefined();
    expect(foldView({}, 'back', SANS_REPLI)).toBeUndefined();
    expect(foldView(full, 'back', SANS_REPLI)?.()).toBe('B');
    expect(foldView('<g/>', 'front', SANS_REPLI)).toBe('<g/>');
    expect(foldView('<g/>', 'profile', SANS_REPLI)).toBeUndefined();
  });

  it('declaredView : une chaîne ne déclare que la face ; objet, null, vue déclarée vide', () => {
    expect(declaredView('<g/>', 'front')).toBe('<g/>');
    expect(declaredView('<g/>', 'back')).toBeUndefined();
    expect(declaredView({ front: 'F', back: 'B' }, 'back')).toBe('B');
    expect(declaredView({ front: 'F' }, 'profile')).toBeUndefined();
    expect(declaredView(null, 'front')).toBeUndefined();
    expect(declaredView(undefined, 'front')).toBeUndefined();
    expect(declaredView({ front: 'F', back: '' }, 'back')).toBe('');
    expect(declaredView({ front: 'F', back: '' }, 'back') != null).toBe(true);
  });

  it('viewEntries : les vues déclarées avec leur art, dans l’ordre de declaredViews', () => {
    expect(viewEntries('<g/>')).toEqual([['front', '<g/>']]);
    expect(viewEntries({ front: 'F', back: 'B', profile: 'P' })).toEqual([['front', 'F'], ['profile', 'P'], ['back', 'B']]);
    expect(viewEntries(null)).toEqual([]);
  });

  it('mapViews : une chaîne rend f(art) ; un objet garde ses clés présentes', () => {
    expect(mapViews('abc', (s) => s.length)).toBe(3);
    expect(mapViews({ front: 'a', back: 'bb' }, (s) => s.length)).toEqual({ front: 1, back: 2 });
    const partArt: PartArt = { front: 'a', profile: 'p' };
    expect(mapViews(partArt, (s) => s.toUpperCase())).toEqual({ front: 'A', profile: 'P' });
  });

  it('mapViews : type de sortie de la forme de l’entrée', () => {
    const partArt = { front: 'a' } as PartArt;
    const viewSet: ViewSet = { front: 'a', profile: 'p', back: 'b' };
    expectTypeOf(mapViews(partArt, (svg) => svg)).toMatchTypeOf<PartArt>();
    expectTypeOf(mapViews(viewSet, (svg) => svg)).toEqualTypeOf<Record<View, string>>();
    expectTypeOf(mapViews('abc', (s) => s.length)).toEqualTypeOf<number>();
    // @ts-expect-error — une chaîne rend la valeur de f, pas une chaîne
    const d: string = mapViews('abc', (s) => s.length);
    expect(d).toBe(3);
  });
});
