import { idsDeTest } from './idsDeTest.testkit';
import { describe, expect, it } from 'vitest';
import { findTrappingById } from '../data';
import { apparencesCandidates, formeResolue, itemFromGive, weaponItem, type SourceDeForme } from './items';

describe('apparences candidates — une résolution, apparence admise puis racine', () => {
  it.each<[string, SourceDeForme, string[]]>([
    ['sans choix', itemFromGive({ trappingId: 'arme-simple' }, idsDeTest), ['epee']],
    ['racine admise', itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'hache' } }, idsDeTest), ['hache']],
    ['variante admise', itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'hache_naine' } }, idsDeTest), ['hache_naine', 'hache']],
    ['racine non admise', { ...itemFromGive({ trappingId: 'arme-simple' }, idsDeTest), apparence: 'zweihander' }, ['epee']],
    ['apparence inconnue', { ...itemFromGive({ trappingId: 'arme-simple' }, idsDeTest), apparence: 'inconnue' }, ['epee']],
    ['arme invoquée', weaponItem({ label: 'Arme invoquée', damage: { plusBF: true, flat: 4 }, shape: findTrappingById('baton-de-combat')!.shape, uid: 'conjure-1' }), ['baton']],
    ['bouclier', itemFromGive({ trappingId: 'bouclier', apparence: { id: 'bouclier_pointes' } }, idsDeTest), ['bouclier_pointes', 'rond']],
    ['variante non admise', { ...itemFromGive({ trappingId: 'bouclier' }, idsDeTest), apparence: 'hache_naine' }, ['rond']],
    ['attaque naturelle', { ...itemFromGive({ trappingId: 'arme-simple' }, idsDeTest), natural: true }, []],
    ['hors catalogue', {}, []],
  ])('%s', (_, source, candidats) => {
    expect(apparencesCandidates(source)).toEqual(candidats);
    expect(formeResolue(source)).toBe(candidats[candidats.length - 1]);
  });
});
