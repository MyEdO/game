/**
 * Composition d'équipe coop (partyAddHero/partyRemoveHero + emplacements `net.slots`) :
 * point d'entrée unique de l'écran d'équipe — quota par siège, doublons, bourse, possession.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { initialNet } from '../noyau/etat';
import { makePregens } from '../data/pregens';
import type { Combatant } from '../engine/types';
import { toBrass } from '../engine/money';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { bourseOf } from '../engine/bourse';
import { withActingSeat } from '../noyau/netOwnership';

function hero(id: string): Combatant {
  const h: Combatant = JSON.parse(JSON.stringify(makePregens()[0]));
  h.id = id;
  h.label = `Héros ${id}`;
  return h;
}

function reset() {
  useGame.setState({
    party: [],
    journal: [],
    net: initialNet(),
  });
}

describe('composition d’équipe (partyFlow + net.slots)', () => {
  beforeEach(reset);

  it('partyAddHero : ajoute une copie, pose la possession du siège, crédite la bourse', () => {
    useGame.getState().partyAddHero(hero('a'), { gold: 1, silver: 2, brass: 3 });
    const s = useGame.getState();
    expect(s.party.map((h) => h.id)).toEqual(['a']);
    expect(s.net.ownership['a']).toBe(0);
    expect(toBrass(bourseOf(s.party[0]))).toBe(toBrass({ gold: 1, silver: 2, brass: 3 }));
  });

  it('partyAddHero : refuse les doublons d’id et le groupe plein', () => {
    const st = useGame.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('a'));
    expect(useGame.getState().party).toHaveLength(1);
    for (const id of ['b', 'c', 'd', 'e']) useGame.getState().partyAddHero(hero(id));
    expect(useGame.getState().party).toHaveLength(4); // 'e' refusé
  });

  it('partyAddHero : respecte le quota d’emplacements du siège (hôte autoritaire)', () => {
    useGame.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 0, 0, 1] } });
    const st = useGame.getState();
    withActingSeat(1, () => st.partyAddHero(hero('g1')));
    withActingSeat(1, () => st.partyAddHero(hero('g2'))); // 1 seul slot au siège 1 → refusé
    const s = useGame.getState();
    expect(s.party.map((h) => h.id)).toEqual(['g1']);
    expect(s.net.ownership['g1']).toBe(1);
  });

  it('partyRemoveHero : retire le héros et nettoie sa possession', () => {
    useGame.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => useGame.getState().partyAddHero(hero('g1')));
    useGame.getState().partyRemoveHero('g1');
    const s = useGame.getState();
    expect(s.party).toHaveLength(0);
    expect(s.net.ownership['g1']).toBeUndefined();
  });

  it('partyReplaceHero : substitution EN PLACE (index/ordre préservés), possession transférée, bourse INCHANGÉE', () => {
    const st = useGame.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('b'));
    st.partyAddHero(hero('c'));
    const moneyBefore = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().partyReplaceHero('a', hero('z')); // remplace le 1er de 3
    const s = useGame.getState();
    expect(s.party.map((h) => h.id)).toEqual(['z', 'b', 'c']); // longueur 3, ordre conservé, a→z en place
    expect(s.net.ownership['z']).toBe(0); // possession transférée au siège
    expect(s.net.ownership['a']).toBeUndefined(); // l'ancien id libéré
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(moneyBefore); // pas de re-crédit (≠ recrutement)
  });

  it('partyReplaceHero : rejette un oldId inconnu et un hero.id déjà présent (doublon)', () => {
    const st = useGame.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('b'));
    useGame.getState().partyReplaceHero('zzz', hero('z')); // ancien absent → no-op
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['a', 'b']);
    useGame.getState().partyReplaceHero('a', hero('b')); // 'b' déjà dans le groupe → no-op
    expect(useGame.getState().party.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('setHeroBackground : édite Motivation + Ambitions sur le héros du groupe (hors combat)', () => {
    useGame.getState().partyAddHero(hero('a'));
    useGame.getState().setHeroBackground('a', { motivation: 'Foi', ambitionShort: 'Survivre', ambitionLong: 'Régner' });
    const h = useGame.getState().party.find((x) => x.id === 'a')!;
    expect(h.motivation).toBe('Foi');
    expect(h.details?.ambitionShort).toBe('Survivre');
    expect(h.details?.ambitionLong).toBe('Régner');
  });

  it('netAssignSlot : hôte seul, bornes 0-3', () => {
    useGame.getState().netAssignSlot(1, 1); // mode local → refusé
    expect(useGame.getState().net.slots).toEqual([0, 0, 0, 0]);
    useGame.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' } } });
    useGame.getState().netAssignSlot(1, 1);
    useGame.getState().netAssignSlot(7, 1); // hors bornes → ignoré
    expect(useGame.getState().net.slots).toEqual([0, 1, 0, 0]);
  });
});
