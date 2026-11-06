/**
 * Part de chaque héros dans la note du repos (`partsDuRepos`) : une chambre privée loge 2 invités
 * (LDB 66 l.28), la somme des parts est la note `restCost`. LDB 66 l.12-16
 */
import { describe, it, expect } from 'vitest';
import { partsDuRepos, restCost, restServicePrice, type PendingRest } from './restFlow';
import { toBrass, type Money } from '../engine/money';
import type { Combatant } from '../engine/types';

const hero = (id: string): Combatant => ({ id, label: id, items: [], wounds: { current: 10, max: 10 }, conditions: [] } as unknown as Combatant);
const pending = (perHero: PendingRest['perHero'], quality: PendingRest['quality'] = 'normale'): PendingRest =>
  ({ places: { auberge: true }, quality, days: 1, perHero, phase: 'setup' }) as PendingRest;
const somme = (parts: Record<string, Money>) => Object.values(parts).reduce((n, m) => n + toBrass(m), 0);

describe('partsDuRepos — chambre partagée par 2 (LDB 66 l.28)', () => {
  it('2 héros en chambre privée sans repas : une chambre, une moitié chacun, somme = restCost', () => {
    const [a, b] = [hero('a'), hero('b')];
    const p = pending({ a: { lodging: 'privee', food: 'rien' }, b: { lodging: 'privee', food: 'rien' } });
    const chambre = toBrass(restServicePrice('privee'));
    const parts = partsDuRepos(p, [a, b]);
    expect(toBrass(restCost(p, [a, b]))).toBe(chambre);
    expect([toBrass(parts.a), toBrass(parts.b)]).toEqual([chambre / 2, chambre / 2]);
    expect(somme(parts)).toBe(toBrass(restCost(p, [a, b])));
  });

  it('3 héros en chambre privée avec repas, piètre : le 3e paie sa chambre seul, somme = restCost', () => {
    const party = ['a', 'b', 'c'].map(hero);
    const p = pending({ a: { lodging: 'privee', food: 'repas' }, b: { lodging: 'privee', food: 'repas' }, c: { lodging: 'privee', food: 'repas' } }, 'pietre');
    const chambre = toBrass(restServicePrice('privee'));
    const repas = toBrass(restServicePrice('repas'));
    const parts = partsDuRepos(p, party);
    expect(party.map((h) => toBrass(parts[h.id]))).toEqual([(chambre / 2 + repas) / 2, (chambre / 2 + repas) / 2, (chambre + repas) / 2]);
    expect(somme(parts)).toBe(toBrass(restCost(p, party)));
  });
});
