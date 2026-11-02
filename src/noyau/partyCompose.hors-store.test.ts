/**
 * Composition d'équipe coop (partyAddHero/partyRemoveHero + emplacements `net.slots`) :
 * point d'entrée unique de l'écran d'équipe — quota par siège, doublons, bourse, possession.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { makePregens } from '../data/pregens';
import type { Combatant } from '../engine/types';
import { toBrass } from '../engine/money';
import { partyMoneyTotal } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import { withActingSeat } from './netOwnership';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function hero(id: string): Combatant {
  const h: Combatant = JSON.parse(JSON.stringify(makePregens()[0]));
  h.id = id;
  h.label = `Héros ${id}`;
  return h;
}

describe('composition d’équipe (partyFlow + net.slots)', () => {
  it('partyAddHero : ajoute une copie, pose la possession du siège, crédite la bourse', () => {
    banc.getState().partyAddHero(hero('a'), { gold: 1, silver: 2, brass: 3 });
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['a']);
    expect(s.net.ownership['a']).toBe(0);
    expect(toBrass(bourseOf(s.party[0]))).toBe(toBrass({ gold: 1, silver: 2, brass: 3 }));
  });

  it('partyAddHero : refuse les doublons d’id et le groupe plein', () => {
    const st = banc.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('a'));
    expect(banc.getState().party).toHaveLength(1);
    for (const id of ['b', 'c', 'd', 'e']) banc.getState().partyAddHero(hero(id));
    expect(banc.getState().party).toHaveLength(4); // 'e' refusé
  });

  it('partyAddHero : respecte le quota d’emplacements du siège (hôte autoritaire)', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 0, 0, 1] } });
    const st = banc.getState();
    withActingSeat(1, () => st.partyAddHero(hero('g1')));
    withActingSeat(1, () => st.partyAddHero(hero('g2'))); // 1 seul slot au siège 1 → refusé
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['g1']);
    expect(s.net.ownership['g1']).toBe(1);
  });

  it('partyRemoveHero : retire le héros et nettoie sa possession', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => banc.getState().partyAddHero(hero('g1')));
    banc.getState().partyRemoveHero('g1');
    const s = banc.getState();
    expect(s.party).toHaveLength(0);
    expect(s.net.ownership['g1']).toBeUndefined();
  });

  it('partyReplaceHero : substitution EN PLACE (index/ordre préservés), possession transférée, bourse INCHANGÉE', () => {
    const st = banc.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('b'));
    st.partyAddHero(hero('c'));
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().partyReplaceHero('a', hero('z')); // remplace le 1er de 3
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['z', 'b', 'c']); // longueur 3, ordre conservé, a→z en place
    expect(s.net.ownership['z']).toBe(0); // possession transférée au siège
    expect(s.net.ownership['a']).toBeUndefined(); // l'ancien id libéré
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore); // pas de re-crédit (≠ recrutement)
  });

  it('partyReplaceHero : rejette un oldId inconnu et un hero.id déjà présent (doublon)', () => {
    const st = banc.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('b'));
    banc.getState().partyReplaceHero('zzz', hero('z')); // ancien absent → no-op
    expect(banc.getState().party.map((h) => h.id)).toEqual(['a', 'b']);
    banc.getState().partyReplaceHero('a', hero('b')); // 'b' déjà dans le groupe → no-op
    expect(banc.getState().party.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('setHeroBackground : édite Motivation + Ambitions sur le héros du groupe (hors combat)', () => {
    banc.getState().partyAddHero(hero('a'));
    banc.getState().setHeroBackground('a', { motivation: 'Foi', ambitionShort: 'Survivre', ambitionLong: 'Régner' });
    const h = banc.getState().party.find((x) => x.id === 'a')!;
    expect(h.motivation).toBe('Foi');
    expect(h.details?.ambitionShort).toBe('Survivre');
    expect(h.details?.ambitionLong).toBe('Régner');
  });
});
