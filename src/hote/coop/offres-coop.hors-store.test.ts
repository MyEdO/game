/**
 * LES OFFRES EN COOP (#3371), sur transport en mémoire (`FakeTransport`) : l'invité du siège 1 joue chez l'hôte
 * l'offre d'un corps (`jouerLOffre`, routée par son lieu, `lieuDeLOffre`) ; un relais ne voyage pas, il s'élit chez
 * l'émetteur (`intentEluLocalement`) et c'est son verbe qui voyage (`fenetreValider`, `leverLaMain`) ; un sort hors
 * combat se route au propriétaire de son lanceur.
 */
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege, type IssueDIntention } from '../../noyau/intentionsDeSiege';
import { instantaneDeLaCoop } from '../../noyau/coop';
import { activeCombatant } from '../../noyau/combatFlow';
import { intentEluLocalement } from '../../noyau/targetingModes';
import { testScene } from '../../scenes/test-fixture';
import type { NetState } from '../../noyau/etat';
import { pregen, PREGEN } from '../../data/pregens';
import type { Combatant } from '../../engine/types';

const NET: NetState = {
  mode: 'host', mySeat: 0, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'ok', hostAway: false, ownership: { L: 1 }, slots: [1, 1, 0, 0], rangs: {},
};

/** Un sorcier en Langue (Magick) 60, qui connaît l'Arme aethyrique. */
function sorcier(id: string): Combatant {
  const h = pregen(PREGEN.sorcier);
  h.id = id; h.label = id;
  h.spells = ['arme-aethyrique'];
  h.skills = [...h.skills.filter((s) => s.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 }] as typeof h.skills;
  return h;
}

/** La table : l'hôte (banc, héros `H`) et l'invité du siège 1 (héros `L`), reliés par transport ; chaque intention
 *  appliquée chez l'hôte rend son issue. */
function table(): { banc: Banc; envoyer: (action: string, args: unknown[]) => IssueDIntention } {
  const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [sorcier('H'), sorcier('L')], net: NET, screen: 'campaign' } });
  const issues: IssueDIntention[] = [];
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { issues.push(appliquerLIntentionDUnSiege(banc.getState, seat, action, args)); },
    getSnapshot: () => instantaneDeLaCoop(banc.getState()),
  });
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: () => {} });
  const [a, b] = FakeTransport.pair();
  host.addGuest(a, 1);
  guest.connect(b);
  return { banc, envoyer: (action, args) => { guest.sendIntent(action, args); return issues[issues.length - 1]; } };
}

/** Le combat ouvert, en pause de Round. */
function enPause(): ReturnType<typeof table> {
  const t = table();
  t.banc.getState().startScene(testScene());
  t.banc.getState().startCombat('enc-mutants');
  return t;
}

/** Le combat au tour du héros `id`, Action dépensée. */
function auTourDe(t: ReturnType<typeof table>, id: string): void {
  t.banc.getState().fenetreValider('roundStart');
  t.envoyer('fenetreValider', ['roundStart']);
  const b = t.banc.getState().battle!;
  t.banc.setState({ battle: { ...b, turn: b.order.indexOf(id), acted: true, action: null }, pendingRoundStart: null });
}

describe('Offres en coop : le corps voyage, le relais s’élit chez l’émetteur', () => {
  it('le corps `end-turn` de l’invité finit le tour de SON héros ; au tour d’autrui il est refusé', () => {
    const t = enPause();
    auTourDe(t, 'L');
    expect(t.envoyer('jouerLOffre', ['end-turn'])).toBe('appliquee');
    const apres = activeCombatant(t.banc.getState().battle!)?.id;
    expect(apres, 'le tour du héros de l’invité n’a pas fini').not.toBe('L');
    auTourDe(t, 'H');
    expect(t.envoyer('jouerLOffre', ['end-turn']), 'l’invité finissait le tour du héros de l’hôte').toBe('refusee');
    expect(activeCombatant(t.banc.getState().battle!)?.id).toBe('H');
  });

  it('`round-start` est un relais : élu chez l’émetteur, il ne voyage pas ; son verbe marque le siège prêt', () => {
    const t = enPause();
    expect(t.banc.getState().pendingRoundStart, 'témoin : la pause de Round est ouverte').toBeTruthy();
    expect(intentEluLocalement(t.banc.getState, 'jouerLOffre', ['round-start'])).toBe(true);
    expect(t.envoyer('jouerLOffre', ['round-start'])).toBe('refusee');
    expect(t.banc.getState().pendingRoundStart!.readyBySeat?.[1] ?? false).toBe(false);
    expect(t.envoyer('fenetreValider', ['roundStart'])).toBe('appliquee');
    expect(t.banc.getState().pendingRoundStart!.readyBySeat?.[1]).toBe(true);
  });

  it('`raise-hand` est un relais : son verbe lève la main du siège 1, hors de son tour', () => {
    const t = enPause();
    auTourDe(t, 'H');
    expect(intentEluLocalement(t.banc.getState, 'jouerLOffre', ['raise-hand'])).toBe(true);
    expect(t.envoyer('leverLaMain', [true])).toBe('appliquee');
    expect(t.banc.getState().battle!.handRaisedBy).toEqual([1]);
  });
});

describe('Sort hors combat en coop : le geste se route au propriétaire du lanceur', () => {
  it('l’invité incante avec SON héros ; avec le héros de l’hôte il est refusé', () => {
    const t = table();
    t.banc.getState().startScene(testScene());
    expect(t.envoyer('incanterLeSort', ['H', 'arme-aethyrique', 'H']), 'l’invité incantait pour le héros de l’hôte').toBe('refusee');
    expect(t.banc.getState().pendingCast ?? null).toBeNull();
    expect(t.envoyer('incanterLeSort', ['L', 'arme-aethyrique', 'L'])).toBe('appliquee');
    expect(t.banc.getState().pendingCast).toMatchObject({ casterId: 'L' });
  });
});
