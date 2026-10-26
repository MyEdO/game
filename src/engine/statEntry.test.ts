import { describe, it, expect } from 'vitest';
import { parseStatEntry, poseDeTrait, resoudreTrait, statName } from './statEntry';
import type { EffectSource } from './types';
import { statblockToCombatant } from '../noyau/monde/spawn';

describe('parseStatEntry — parseur canonique des chaînes de statbloc', () => {
  const cases: [string, Partial<ReturnType<typeof parseStatEntry>>][] = [
    ['Arme +7', { name: 'Arme', bonus: 7 }],
    ['Arme (Bâton de combat) +7', { name: 'Arme', arg: 'Bâton de combat', bonus: 7 }],
    ['À distance +8 (50)', { name: 'À distance', bonus: 8, range: 50 }],
    ['8 Tentacules +9', { name: 'Tentacules', count: 8, bonus: 9 }],
    ['Animosité (Tiléens)', { name: 'Animosité', arg: 'Tiléens' }],
    ['Démoniaque 8+', { name: 'Démoniaque', indice: 8 }],
    ['Immunité (Poison)', { name: 'Immunité', arg: 'Poison' }],
    ['Vol 100', { name: 'Vol', indice: 100 }],
    ['Souffle +15 (Feu)', { name: 'Souffle', bonus: 15, arg: 'Feu' }],
    ['Peur 2', { name: 'Peur', indice: 2 }],
    ['Vision nocturne', { name: 'Vision nocturne' }],
    ['Chevaucher (Cheval) 58', { name: 'Chevaucher', arg: 'Cheval', indice: 58 }],
    ["Corps à corps (Arme d'hast) 62", { name: 'Corps à corps', arg: "Arme d'hast", indice: 62 }],
    ['Commandement 47', { name: 'Commandement', indice: 47 }],
    ['Magie des Arcanes (Ghur)', { name: 'Magie des Arcanes', arg: 'Ghur' }],
    ['Magie mineure', { name: 'Magie mineure' }],
    ['Lire/Écrire', { name: 'Lire/Écrire' }],
    ['Résistance à la Magie 2', { name: 'Résistance à la Magie', indice: 2 }],
    ['Taille (Énorme)', { name: 'Taille', arg: 'Énorme' }],
  ];

  for (const [raw, expected] of cases) {
    it(`« ${raw} »`, () => {
      const got = parseStatEntry(raw);
      for (const [k, v] of Object.entries(expected)) {
        expect(got[k as keyof typeof got]).toBe(v);
      }
      // les champs non attendus restent absents (pas de bruit)
      for (const k of ['count', 'bonus', 'indice', 'range', 'arg'] as const) {
        if (!(k in expected)) expect(got[k]).toBeUndefined();
      }
    });
  }

  it('statName = nom canonique seul', () => {
    expect(statName('8 Tentacules +9')).toBe('Tentacules');
    expect(statName('À distance +8 (50)')).toBe('À distance');
  });
});

describe('resoudreTrait / poseDeTrait — la seule résolution d’un Trait posé, et son inverse', () => {
  const provenance = { source: { book: 'livre-fixture', page: 1 }, alsoIn: [{ book: 'livre-fixture', page: 2 }], maison: 'raison fixture' };
  const jeu = { id: 'trait-fixture', value: 3, arg: 'spec-fixture', count: 2, range: 10, natural: true, hidden: true };
  const src: EffectSource = { kind: 'mutation', id: 'mutation-fixture' };

  it('l’instance de jeu garde tout le Trait posé sauf sa provenance de livre', () => {
    expect(resoudreTrait({ ...jeu, ...provenance })).toEqual(jeu);
  });
  it('un Trait accordé porte la provenance de son octroi', () => {
    expect(resoudreTrait({ ...jeu, ...provenance }, src)).toEqual({ ...jeu, src });
  });
  it('poseDeTrait rend la forme posée sans la provenance d’octroi', () => {
    expect(poseDeTrait(resoudreTrait(jeu, src))).toEqual(jeu);
  });
  it('le spawn d’un statbloc pose les Traits résolus', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Fixture', char: {}, traits: [{ id: 'elite', ...provenance }] }, 'fixture', { x: 0, y: 0 });
    expect(c.traits).toEqual([{ id: 'elite' }]);
  });
});
