/**
 * L'INTERLUDE EN COOP (#3059 S2), sur transport en mémoire (`FakeTransport`) : l'invité demande ses gestes
 * d'Activité à l'hôte, qui les filtre par siège (`appliquerLIntentionDUnSiege`). L'invité mène l'Entraînement,
 * la Faveur et la préparation de bataille de SON héros, est refusé sur celles du héros d'un autre siège, et ne
 * décide pas des jeux de taverne, ni chez l'hôte ni dans son propre store.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, vi } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { draineCascade } from '../../noyau/cascade.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { battleActivityById, peutTenterAction } from '../../noyau/massBattleFlow';
import { createHero } from '../../engine/character';
import { withBourseMoney } from '../../engine/bourse';
import type { Combatant } from '../../engine/types';
import type { NetState } from '../../noyau/etat';

/** Texte FIGÉ du refus de possession que l'hôte pose au journal. */
const REFUS_DE_SIEGE = 'Action refusée : elle ne revient pas au joueur qui l’a demandée.';
/** Texte FIGÉ du refus d'un geste de groupe chez l'invité. */
const HOTE_SEUL = 'L’hôte seul ouvre la table de jeu.';

/** Un héros riche, à PX, qui doit une Faveur Mineure. */
function heros(label: string, seed: number): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed });
  h.xp = 2000;
  return withBourseMoney(h, { gold: 20, silver: 0, brass: 0 }, idsDeTest);
}

const NET_DE_L_HOTE = (invite: string): NetState => ({
  mode: 'hote', mySeat: 0, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { [invite]: 1 }, slots: [1, 1, 0, 0], rangs: {},
});

/** L'hôte (banc du noyau) d'un interlude ouvert, ses Activités ouvertes, et l'invité du siège 1 qui possède `invite`. */
function table(): { banc: Banc; guest: GuestSession; hote: Combatant; invite: Combatant } {
  const hote = heros('Hôtelier', 1601);
  const invite = heros('Invitée', 1602);
  const banc = ouvrirLeBanc({
    graine: 7, desFixes: false,
    etat: {
      party: [hote, invite], net: NET_DE_L_HOTE(invite.id),
      favors: [hote, invite].map((h) => ({ id: `faveur-${h.id}`, heroId: h.id, level: 'mineure' as const, owedTo: 'Un échevin', desc: 'Un service', progress: 0 })),
    },
  });
  banc.actions.ouvrirLInterlude(1);
  draineCascade(banc.getState);
  expect(banc.getState().interlude?.phase, 'témoin : les Activités sont ouvertes').toBe('activities');
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(banc.getState, seat, action, args); },
    getSnapshot: () => ({}),
  });
  const [a, b] = FakeTransport.pair();
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: vi.fn() });
  host.addGuest(a, 1);
  guest.connect(b);
  return { banc, guest, hote, invite };
}

const left = (banc: Banc, heroId: string) => banc.getState().interlude!.perHero[heroId].left;
/** Les intentions qui composent l'Entraînement de l'Intelligence du héros `heroId`, puis le pratiquent (LDB 23 l.132). */
const entrainement = (heroId: string) => [
  ['interlude', 'activite', 'entrainement', heroId], ['interlude', 'entrainement', 'intelligence', heroId], ['interlude', 'pratiquer', true, heroId],
];
/** Une préparation de bataille que `h` peut mener (aucun prérequis). */
const prepaDe = (h: Combatant) => ['inspire', 'reperage', 'rassembler-des-forces'].find((id) => peutTenterAction(h, battleActivityById(id)!))!;

describe('Interlude en coop : l’invité mène les Activités de SON héros', () => {
  it('Entraînement : l’Activité de son héros est dépensée', () => {
    const { banc, guest, invite } = table();
    const avant = left(banc, invite.id);
    for (const args of entrainement(invite.id)) guest.sendIntent('fenetreChoisir', args);
    expect(left(banc, invite.id)).toBe(avant - 1);
  });

  it('Faveur : son Activité acquitte la Faveur de son héros', () => {
    const { banc, guest, invite } = table();
    const avant = left(banc, invite.id);
    guest.sendIntent('solderLaFaveur', [invite.id, `faveur-${invite.id}`]);
    expect(left(banc, invite.id)).toBe(avant - 1);
    expect(banc.getState().favors.some((f) => f.heroId === invite.id)).toBe(false);
  });

  it('préparation de bataille : le jet s’ouvre MENÉ par son héros', () => {
    const { banc, guest, invite } = table();
    banc.actions.amorcerLaBataille({ puissanceAlliee: 50, puissanceEnnemie: 55, plannedRounds: 3 });
    guest.sendIntent('menerLActionDeBataille', [invite.id, prepaDe(invite)]);
    expect(banc.getState().pendingActivity?.heroId).toBe(invite.id);
  });
});

describe('Interlude en coop : l’invité est refusé sur le héros d’un autre siège', () => {
  it('Entraînement, Faveur, préparation de bataille du héros de l’hôte : rien ne bouge, le refus se dit', () => {
    const { banc, guest, hote } = table();
    banc.actions.amorcerLaBataille({ puissanceAlliee: 50, puissanceEnnemie: 55, plannedRounds: 3 });
    const avant = JSON.stringify([banc.getState().interlude, banc.getState().favors, banc.getState().pendingActivity]);
    const journal = banc.getState().journal.length;
    for (const args of entrainement(hote.id)) guest.sendIntent('fenetreChoisir', args);
    guest.sendIntent('solderLaFaveur', [hote.id, `faveur-${hote.id}`]);
    guest.sendIntent('menerLActionDeBataille', [hote.id, prepaDe(hote)]);
    expect(JSON.stringify([banc.getState().interlude, banc.getState().favors, banc.getState().pendingActivity])).toBe(avant);
    expect(banc.getState().journal.slice(journal)).toEqual(Array(5).fill(REFUS_DE_SIEGE));
  });
});

describe('Interlude en coop : la table de taverne est celle de l’hôte', () => {
  it('dans le store de l’invité, ouvrir la table et jouer une partie sont refusés, et le refus se dit', () => {
    const [a, b] = [heros('Hôtelier', 1601), heros('Invitée', 1602)];
    const banc = ouvrirLeBanc({ reglesMaison: { 'jeux-de-taverne': true }, etat: { party: [a, b], net: { ...NET_DE_L_HOTE(b.id), mode: 'invite', mySeat: 1 } } });
    const journal = banc.getState().journal.length;
    banc.actions.ouvrirLesJeux();
    banc.actions.jouerALaTaverne(b.id, { gameId: 'dominos', opponent: { kind: 'heros', id: a.id } });
    expect(banc.getState().tavernGames).toBeNull();
    expect(banc.getState().sequence ?? null).toBeNull();
    expect(banc.getState().journal.slice(journal)).toEqual([HOTE_SEUL, HOTE_SEUL]);
  });
});
