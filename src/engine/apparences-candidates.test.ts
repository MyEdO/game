import { describe, expect, it } from 'vitest';
import { apparencesCandidates, formeResolue, type SourceDeForme } from './items';

describe('apparences candidates — une résolution, apparence admise puis racine', () => {
  it.each<[string, SourceDeForme, string[]]>([
    ['sans choix', { trappingId: 'arme-simple' }, ['epee']],
    ['racine admise', { trappingId: 'arme-simple', apparence: 'hache' }, ['hache']],
    ['variante admise', { trappingId: 'arme-simple', apparence: 'hache_naine' }, ['hache_naine', 'hache']],
    ['racine non admise', { trappingId: 'arme-simple', apparence: 'zweihander' }, ['epee']],
    ['apparence inconnue', { trappingId: 'arme-simple', apparence: 'inconnue' }, ['epee']],
    ['arme invoquée', { trappingId: 'arme-simple', apparence: 'hache_naine', form: 'baton-de-combat' }, ['baton']],
    ['bouclier', { trappingId: 'bouclier', apparence: 'bouclier_pointes' }, ['bouclier_pointes', 'rond']],
    ['variante non admise', { trappingId: 'bouclier', apparence: 'hache_naine' }, ['rond']],
    ['attaque naturelle', { trappingId: 'arme-simple', apparence: 'hache_naine', natural: true }, []],
    ['hors catalogue', {}, []],
  ])('%s', (_, source, candidats) => {
    expect(apparencesCandidates(source)).toEqual(candidats);
    expect(formeResolue(source)).toBe(candidats[candidats.length - 1]);
  });
});
