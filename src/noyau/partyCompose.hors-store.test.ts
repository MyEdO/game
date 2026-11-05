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
import { emplacementsDuGroupe, fermerLeSiege } from './sieges';
import { refusDeComposerLeHeros, refusDeLancer } from './partyFlow';
import { lancerCampagne } from '../scenes/campaign';
import { t } from '../i18n';

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

  it('partyRemoveHero : le siège retire SON héros et nettoie sa possession', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => banc.getState().partyAddHero(hero('g1')));
    withActingSeat(1, () => banc.getState().partyRemoveHero('g1'));
    const s = banc.getState();
    expect(s.party).toHaveLength(0);
    expect(s.net.ownership['g1']).toBeUndefined();
  });

  it('D4 — l’hôte ne retire, ne remplace ni ne modifie le héros d’un invité : refusé, le refus au journal', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => banc.getState().partyAddHero(hero('g1')));
    const journal = banc.getState().journal.length;
    banc.getState().partyRemoveHero('g1');
    banc.getState().partyReplaceHero('g1', hero('z'));
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['g1']);
    expect(s.net.ownership['g1']).toBe(1);
    expect(s.journal.slice(journal)).toEqual([t('pf.heroOfAnotherSeat'), t('pf.heroOfAnotherSeat')]);
    expect(refusDeComposerLeHeros(s, 'g1', 0)).toBe(t('pf.heroOfAnotherSeat'));
    expect(refusDeComposerLeHeros(s, 'g1', 1)).toBeNull();
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

const occupants = (b: Banc) => emplacementsDuGroupe(b.getState()).map((e) => e.heroId);

describe('le rang de chaque héros est un état du jeu (`net.rangs`, #3059 F10)', () => {
  it('solo : un héros retiré laisse son rang vide en place, le suivant recruté y entre', () => {
    for (const id of ['a', 'b', 'c']) banc.getState().partyAddHero(hero(id));
    banc.getState().partyRemoveHero('b');
    expect(occupants(banc)).toEqual(['a', null, 'c', null]);
    banc.getState().partyAddHero(hero('d'));
    expect(occupants(banc)).toEqual(['a', 'd', 'c', null]);
  });

  it('remplacer garde le rang ; le rang voyage dans l’état (`net.rangs`)', () => {
    for (const id of ['a', 'b']) banc.getState().partyAddHero(hero(id));
    banc.getState().partyRemoveHero('a');
    banc.getState().partyReplaceHero('b', hero('z'));
    expect(occupants(banc)).toEqual([null, 'z', null, null]);
    expect(banc.getState().net.rangs).toEqual({ z: 1 });
  });

  it('coop : un héros ajouté par un siège entre dans un emplacement de CE siège ; fermer le siège garde son rang', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 0, 1, 0] } });
    withActingSeat(1, () => banc.getState().partyAddHero(hero('g1')));
    banc.getState().partyAddHero(hero('h1'));
    expect(occupants(banc)).toEqual(['h1', null, 'g1', null]);
    banc.setState({ net: fermerLeSiege(banc.getState().net, 1) });
    expect(emplacementsDuGroupe(banc.getState())[2]).toEqual({ rang: 2, siege: 0, heroId: 'g1', proprietaire: 0 });
  });
});

describe('lancer la partie : `refusDeLancer`, lu par `lancerCampagne` (#3059 F10)', () => {
  it('D1 — un groupe vide : `lancerCampagne` rend le refus, aucune scène n’est posée', () => {
    expect(lancerCampagne(banc.getState, null)).toBe(t('party.action.start.empty'));
    expect(banc.getState().scene).toBeNull();
  });

  it('D2 — un siège invité nommé sans héros refuse le lancement, même quand un orphelin de l’hôte occupe son emplacement', () => {
    banc.setState({
      party: ['a', 'b', 'c', 'd'].map(hero),
      net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] },
    });
    expect(emplacementsDuGroupe(banc.getState())[1].heroId, 'témoin : l’orphelin de l’hôte occupe l’emplacement de l’invité').toBe('b');
    expect(refusDeLancer(banc.getState())).toBe(t('party.action.start.guestPending'));
    expect(lancerCampagne(banc.getState, null)).toBe(t('party.action.start.guestPending'));
    expect(banc.getState().scene).toBeNull();
  });

  it('un groupe dont chaque siège invité a rempli ses emplacements se lance', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => banc.getState().partyAddHero(hero('g1')));
    expect(refusDeLancer(banc.getState())).toBeNull();
  });
});
