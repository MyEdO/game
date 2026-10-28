/**
 * Coop — transport des RÈGLES MAISON dans le snapshot (parité hôte/invité). Le snapshot réseau
 * n'a qu'un champ `data` opaque : les surcharges de `policy.ts` voyagent sous une clé réservée
 * (`packHouseRules`/`unpackHouseRules`, pures). Sans ça, l'invité calculerait sur SES propres
 * surcharges localStorage et divergerait de l'hôte.
 */
import { describe, it, expect } from 'vitest';
import { packHouseRules, unpackHouseRules } from '../noyau/persistance/save';

describe('coop — règles maison dans le snapshot (pack/unpack purs)', () => {
  it('pack joint les règles sous UNE clé réservée, sans toucher au reste', () => {
    const data = { gameTime: 7, flags: { a: true } };
    const packed = packHouseRules(data, { 'test-x': true, 'p': 2 });
    expect(packed).toMatchObject(data);
    expect(Object.keys(packed)).toHaveLength(Object.keys(data).length + 1);
  });

  it('unpack sépare l’état des règles ET retire la clé réservée de `game`', () => {
    const { game, rules } = unpackHouseRules(packHouseRules({ gameTime: 7 }, { 'test-x': true }));
    expect(game).toEqual({ gameTime: 7 }); // pas de pollution de GameState
    expect(rules).toEqual({ 'test-x': true });
  });

  it('payload SANS règles (ancien hôte) → rules undefined, état intact', () => {
    const { game, rules } = unpackHouseRules({ gameTime: 9 });
    expect(game).toEqual({ gameTime: 9 });
    expect(rules).toBeUndefined();
  });

  it('round-trip : unpack(pack(data, rules)) restitue état et règles', () => {
    const data = { gameTime: 3, party: [{ id: 'h1' }] };
    const rules = { 'test-critiques-doubles': true };
    const { game, rules: out } = unpackHouseRules(packHouseRules(data, rules));
    expect(game).toEqual(data);
    expect(out).toEqual(rules);
  });
});
