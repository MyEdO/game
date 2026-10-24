import { describe, expect, it } from 'vitest';
import { findTrappingById } from '../data';
import { apparencesCandidates, formeResolue, itemFromGive, weaponItem, type SourceDeForme } from './items';

describe('apparences candidates — une résolution, apparence admise puis racine', () => {
  it.each<[string, SourceDeForme, string[]]>([
    ['sans choix', itemFromGive({ trappingId: 'arme-simple' }), ['epee']],
    ['racine admise', itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'hache' } }), ['hache']],
    ['variante admise', itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'hache_naine' } }), ['hache_naine', 'hache']],
    ['racine non admise', { ...itemFromGive({ trappingId: 'arme-simple' }), apparence: 'zweihander' }, ['epee']],
    ['apparence inconnue', { ...itemFromGive({ trappingId: 'arme-simple' }), apparence: 'inconnue' }, ['epee']],
    ['arme invoquée', weaponItem({ label: 'Arme invoquée', damage: { plusBF: true, flat: 4 }, shape: findTrappingById('baton-de-combat')!.shape }), ['baton']],
    ['bouclier', itemFromGive({ trappingId: 'bouclier', apparence: { id: 'bouclier_pointes' } }), ['bouclier_pointes', 'rond']],
    ['variante non admise', { ...itemFromGive({ trappingId: 'bouclier' }), apparence: 'hache_naine' }, ['rond']],
    ['attaque naturelle', { ...itemFromGive({ trappingId: 'arme-simple' }), natural: true }, []],
    ['hors catalogue', {}, []],
  ])('%s', (_, source, candidats) => {
    expect(apparencesCandidates(source)).toEqual(candidats);
    expect(formeResolue(source)).toBe(candidats[candidats.length - 1]);
  });
});
