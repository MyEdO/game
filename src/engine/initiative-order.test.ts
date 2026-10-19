import { describe, it, expect } from 'vitest';
import { initiativeOrder } from './combat';
import { makeRNG } from './dice';
import type { Combatant } from './types';

/**
 * Ordre d'Initiative — LDB 13 l.31 :
 * « Si plusieurs combattants ont la même Initiative, c'est celui qui a la valeur d'Agilité la plus haute
 *   qui joue en premier, et ainsi de suite. S'il y a encore égalité, demandez un Test opposé d'Agilité. »
 */
const c = (id: string, I: number, Ag: number): Combatant =>
  ({ id, name: id, initiative: I, characteristics: { initiative: I, agilite: Ag }, liveTraits: [], activeEffects: [] }) as unknown as Combatant;
const ids = (cs: Combatant[]) => cs.map((x) => x.id);

describe('initiativeOrder — tri RAW (LDB 13 l.31)', () => {
  it('Initiative distincte : triée par Initiative décroissante (le rng ne change rien sans égalité)', () => {
    const cs = [c('a', 30, 30), c('b', 50, 30), c('c', 40, 30)];
    expect(ids(initiativeOrder(cs))).toEqual(['b', 'c', 'a']);
    expect(ids(initiativeOrder(cs, makeRNG(1)))).toEqual(['b', 'c', 'a']); // pas d'égalité exacte → aucun Test
  });

  it('Initiative égale, Agilité distincte : départage par Agilité décroissante (inchangé, avec ou sans rng)', () => {
    const cs = [c('a', 40, 30), c('b', 40, 50), c('c', 40, 40)];
    expect(ids(initiativeOrder(cs))).toEqual(['b', 'c', 'a']);
    expect(ids(initiativeOrder(cs, makeRNG(7)))).toEqual(['b', 'c', 'a']); // Ag distincte → pas de Test d'Ag
  });

  it('égalité EXACTE I+Ag, SANS rng : ordre d’entrée stable (comportement historique conservé)', () => {
    const cs = [c('a', 40, 35), c('b', 40, 35), c('c', 40, 35)];
    expect(ids(initiativeOrder(cs))).toEqual(['a', 'b', 'c']);
  });

  it('égalité EXACTE I+Ag, AVEC rng seedé : départage par Test d’Agilité — déterministe + permutation', () => {
    const mk = () => [c('a', 40, 35), c('b', 40, 35), c('c', 40, 35)];
    const o1 = ids(initiativeOrder(mk(), makeRNG(123)));
    const o2 = ids(initiativeOrder(mk(), makeRNG(123)));
    expect(o1).toEqual(o2);                       // même graine → même ordre (déterministe)
    expect([...o1].sort()).toEqual(['a', 'b', 'c']); // permutation : aucun combattant perdu/dupliqué
  });

  it('le Test d’Agilité réordonne réellement : au moins une graine produit un ordre ≠ ordre d’entrée', () => {
    const mk = () => [c('a', 40, 35), c('b', 40, 35), c('c', 40, 35)];
    const orders = Array.from({ length: 40 }, (_, s) => ids(initiativeOrder(mk(), makeRNG(s))).join(','));
    expect(orders.some((o) => o !== 'a,b,c')).toBe(true);
  });

  it('égalité exacte PARTIELLE : seul le sous-groupe à I+Ag égales est départagé par le Test ; les autres restent triés', () => {
    // d (I=50) toujours 1er ; {a,c} (40/30) départagés par Test ; b (40/35) avant {a,c} (Ag plus haute)
    const cs = [c('a', 40, 30), c('b', 40, 35), c('c', 40, 30), c('d', 50, 30)];
    const out = ids(initiativeOrder(cs, makeRNG(5)));
    expect(out[0]).toBe('d');
    expect(out[1]).toBe('b');
    expect([...out.slice(2)].sort()).toEqual(['a', 'c']); // a et c en queue, départagés par le Test
  });

  it('égalité EXACTE I+Ag : le Test d’Agilité se jette sur la valeur de Test, États compris (LDB 16 l.125)', () => {
    const a = c('a', 40, 40); a.conditions = [{ id: 'sonne', value: 3 }];
    const b = c('b', 40, 40);
    // Dé 30 pour chacun : b réussit (40), a Sonné ×3 échoue (40 − 30 = 10) → b d'abord.
    expect(ids(initiativeOrder([a, b], { int: () => 30 }))).toEqual(['b', 'a']);
  });
});
