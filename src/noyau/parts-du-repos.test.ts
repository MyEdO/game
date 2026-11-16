/**
 * Part de chaque héros dans la note du repos (`partsDuRepos`) : le prix de chaque chambre partagé entre ses
 * occupants, la somme des parts est la note `restCost`. LDB 66 l.12-16, l.28
 */
import { describe, it, expect } from 'vitest';
import { offresDeLAubergeDeScene } from './worldMap';
import { fixtureText } from '../i18n/fixtureText';
import { partsDuRepos, restCost, prixDeLOffre, type PendingRest } from './restFlow';
import { toBrass, type Money } from '../engine/money';
import type { Combatant } from '../engine/types';

const hero = (id: string): Combatant => ({ id, label: id, items: [], wounds: { current: 10, max: 10 }, conditions: [] } as unknown as Combatant);
const pending = (perHero: PendingRest['perHero'], quality: PendingRest['quality'] = 'normale'): PendingRest =>
  ({ places: { auberge: true }, offres: offresDeLAubergeDeScene(), lieu: fixtureText('Auberge'), quality, days: 1, perHero, phase: 'setup' });
const somme = (parts: Record<string, Money>) => Object.values(parts).reduce((n, m) => n + toBrass(m), 0);

describe('partsDuRepos — la chambre partagée entre ses occupants (LDB 66 l.28)', () => {
  it('2 héros dans la même chambre sans repas : une chambre, une moitié chacun, somme = restCost', () => {
    const [a, b] = [hero('a'), hero('b')];
    const p = pending({ a: { lodging: 'chambre-1', food: 'rien' }, b: { lodging: 'chambre-1', food: 'rien' } });
    const chambre = toBrass(prixDeLOffre({ id: 'chambre' }, 'normale'));
    const parts = partsDuRepos(p, [a, b]);
    expect(toBrass(restCost(p, [a, b]))).toBe(chambre);
    expect([toBrass(parts.a), toBrass(parts.b)]).toEqual([chambre / 2, chambre / 2]);
    expect(somme(parts)).toBe(toBrass(restCost(p, [a, b])));
  });

  it('3 héros avec repas, piètre, le 3e seul dans sa chambre : il la paie seul, somme = restCost', () => {
    const party = ['a', 'b', 'c'].map(hero);
    const p = pending({ a: { lodging: 'chambre-1', food: 'repas' }, b: { lodging: 'chambre-1', food: 'repas' }, c: { lodging: 'chambre-2', food: 'repas' } }, 'pietre');
    const chambre = toBrass(prixDeLOffre({ id: 'chambre' }, 'normale'));
    const repas = toBrass(prixDeLOffre({ id: 'repas' }, 'normale'));
    const parts = partsDuRepos(p, party);
    expect(party.map((h) => toBrass(parts[h.id]))).toEqual([(chambre / 2 + repas) / 2, (chambre / 2 + repas) / 2, (chambre + repas) / 2]);
    expect(somme(parts)).toBe(toBrass(restCost(p, party)));
  });

  it('3 héros en grande chambre : le double du prix partagé à 3, somme = restCost', () => {
    const party = ['a', 'b', 'c'].map(hero);
    const p = pending({ a: { lodging: 'grande-1', food: 'rien' }, b: { lodging: 'grande-1', food: 'rien' }, c: { lodging: 'grande-1', food: 'rien' } });
    const grande = 2 * toBrass(prixDeLOffre({ id: 'chambre' }, 'normale'));
    const parts = partsDuRepos(p, party);
    const part = Math.floor(grande / 3);
    expect(party.map((h) => toBrass(parts[h.id]))).toEqual([grande - 2 * part, part, part]);
    expect(somme(parts)).toBe(grande);
  });
});
