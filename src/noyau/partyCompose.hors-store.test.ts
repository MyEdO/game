/**
 * Composition d'équipe coop (recruterLeHeros/renvoyerLeHeros + emplacements `net.slots`) :
 * point d'entrée unique de l'écran d'équipe — quota par siège, doublons, bourse, possession.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
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
import { brouillonComplet, engage } from './creation/engagement.testkit';
import { draftWealth, newDraft } from './creation/brouillon';
import { pregens } from '../data';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function hero(id: string): Combatant {
  const h: Combatant = JSON.parse(JSON.stringify(makePregens(idsDeTest)[0]));
  h.id = id;
  h.label = `Héros ${id}`;
  return h;
}

describe('composition d’équipe (partyFlow + net.slots)', () => {
  it('recruterLeHeros : le noyau bâtit le héros du brouillon, pose la possession du siège, crédite sa Richesse de départ', () => {
    banc.getState().recruterLeHeros(engage('a', 'Anna'));
    const s = banc.getState();
    expect(s.party.map((h) => [h.id, h.label, h.career])).toEqual([['a', 'Anna', brouillonComplet().careerId]]);
    expect(s.net.ownership['a']).toBe(0);
    expect(toBrass(bourseOf(s.party[0]))).toBe(toBrass(draftWealth(brouillonComplet()).montant));
  });

  it('recruterLeHeros : un brouillon incomplet est refusé par sa première étape invalide, rien n’entre', () => {
    banc.getState().recruterLeHeros({ brouillon: newDraft(4242), id: 'a' });
    const { party, journal } = banc.getState();
    expect(party).toEqual([]);
    expect(journal[journal.length - 1]).toBe('Choisissez votre race.');
  });

  it('recruterLeHeros : un pré-tiré se désigne par son id, le noyau le bâtit de la donnée', () => {
    const [def] = pregens;
    banc.getState().recruterLeHeros({ pretire: def.id });
    expect(banc.getState().party.map((h) => [h.id, h.label])).toEqual([[`pregen-${def.seed}`, def.label]]);
  });

  it('recruterLeHeros : refuse les doublons d’id et le groupe plein', () => {
    const st = banc.getState();
    st.recruterLeHeros(engage('a'));
    st.recruterLeHeros(engage('a'));
    expect(banc.getState().party).toHaveLength(1);
    for (const id of ['b', 'c', 'd', 'e']) banc.getState().recruterLeHeros(engage(id));
    expect(banc.getState().party).toHaveLength(4); // 'e' refusé
  });

  it('recruterLeHeros : respecte le quota d’emplacements du siège (hôte autoritaire)', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 0, 0, 1] } });
    const st = banc.getState();
    withActingSeat(1, () => st.recruterLeHeros(engage('g1')));
    withActingSeat(1, () => st.recruterLeHeros(engage('g2'))); // 1 seul slot au siège 1 → refusé
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['g1']);
    expect(s.net.ownership['g1']).toBe(1);
  });

  it('renvoyerLeHeros : le siège retire SON héros et nettoie sa possession', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => banc.getState().recruterLeHeros(engage('g1')));
    withActingSeat(1, () => banc.getState().renvoyerLeHeros('g1'));
    const s = banc.getState();
    expect(s.party).toHaveLength(0);
    expect(s.net.ownership['g1']).toBeUndefined();
  });

  it('D4 — l’hôte ne retire, ne remplace ni ne modifie le héros d’un invité : refusé, le refus au journal', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    withActingSeat(1, () => banc.getState().recruterLeHeros(engage('g1')));
    const journal = banc.getState().journal.length;
    banc.getState().renvoyerLeHeros('g1');
    banc.getState().remplacerLeHeros('g1', engage('z'));
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['g1']);
    expect(s.net.ownership['g1']).toBe(1);
    expect(s.journal.slice(journal)).toEqual([t('pf.heroOfAnotherSeat'), t('pf.heroOfAnotherSeat')]);
    expect(refusDeComposerLeHeros(s, 'g1', 0)).toBe(t('pf.heroOfAnotherSeat'));
    expect(refusDeComposerLeHeros(s, 'g1', 1)).toBeNull();
  });

  it('remplacerLeHeros : substitution EN PLACE (index/ordre préservés), possession transférée, la Bourse du remplacé portée, aucune Richesse créditée', () => {
    const st = banc.getState();
    st.recruterLeHeros(engage('a'));
    st.recruterLeHeros(engage('b'));
    st.recruterLeHeros(engage('c'));
    const bourseDe = (id: string) => toBrass(bourseOf(banc.getState().party.find((h) => h.id === id)!));
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    const bourseDeA = bourseDe('a');
    banc.getState().remplacerLeHeros('a', engage('z')); // remplace le 1er de 3
    const s = banc.getState();
    expect(s.party.map((h) => h.id)).toEqual(['z', 'b', 'c']); // longueur 3, ordre conservé, a→z en place
    expect(s.net.ownership['z']).toBe(0); // possession transférée au siège
    expect(s.net.ownership['a']).toBeUndefined(); // l'ancien id libéré
    expect(bourseDeA).toBeGreaterThan(0);
    expect(bourseDe('z')).toBe(bourseDeA);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore);
  });

  it('remplacerLeHeros : rejette un oldId inconnu, et un hero.id déjà présent en le disant', () => {
    const st = banc.getState();
    st.recruterLeHeros(engage('a'));
    st.recruterLeHeros(engage('b'));
    banc.getState().remplacerLeHeros('zzz', engage('z')); // ancien absent → no-op
    expect(banc.getState().party.map((h) => h.id)).toEqual(['a', 'b']);
    banc.getState().remplacerLeHeros('a', engage('b'));
    expect(banc.getState().party.map((h) => h.id)).toEqual(['a', 'b']);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('pf.partyDuplicate', { name: 'Héros b' }));
  });

  it('ecrireLHistorique : édite Motivation + Ambitions sur le héros du groupe (hors combat)', () => {
    banc.getState().recruterLeHeros(engage('a'));
    banc.getState().ecrireLHistorique('a', { motivation: 'Foi', ambitionShort: 'Survivre', ambitionLong: 'Régner' });
    const h = banc.getState().party.find((x) => x.id === 'a')!;
    expect(h.motivation).toBe('Foi');
    expect(h.details?.ambitionShort).toBe('Survivre');
    expect(h.details?.ambitionLong).toBe('Régner');
  });
});

const occupants = (b: Banc) => emplacementsDuGroupe(b.getState()).map((e) => e.heroId);

describe('le rang de chaque héros est un état du jeu (`net.rangs`, #3059 F10)', () => {
  it('solo : un héros retiré laisse son rang vide en place, le suivant recruté y entre', () => {
    for (const id of ['a', 'b', 'c']) banc.getState().recruterLeHeros(engage(id));
    banc.getState().renvoyerLeHeros('b');
    expect(occupants(banc)).toEqual(['a', null, 'c', null]);
    banc.getState().recruterLeHeros(engage('d'));
    expect(occupants(banc)).toEqual(['a', 'd', 'c', null]);
  });

  it('remplacer garde le rang ; le rang voyage dans l’état (`net.rangs`)', () => {
    for (const id of ['a', 'b']) banc.getState().recruterLeHeros(engage(id));
    banc.getState().renvoyerLeHeros('a');
    banc.getState().remplacerLeHeros('b', engage('z'));
    expect(occupants(banc)).toEqual([null, 'z', null, null]);
    expect(banc.getState().net.rangs).toEqual({ z: 1 });
  });

  it('coop : un héros ajouté par un siège entre dans un emplacement de CE siège ; fermer le siège garde son rang', () => {
    banc.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 0, 1, 0] } });
    withActingSeat(1, () => banc.getState().recruterLeHeros(engage('g1')));
    banc.getState().recruterLeHeros(engage('h1'));
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
    withActingSeat(1, () => banc.getState().recruterLeHeros(engage('g1')));
    expect(refusDeLancer(banc.getState())).toBeNull();
  });
});
