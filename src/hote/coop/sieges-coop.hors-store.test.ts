/**
 * LES SIÈGES EN COOP (#3059 F10), sur transport en mémoire (`FakeTransport`) : l'hôte et l'invité lisent les MÊMES
 * emplacements du groupe (`emplacementsDuGroupe`) et le MÊME refus de lancer (`refusDeLancer`), de l'instantané que
 * l'hôte diffuse et que l'invité applique (`appliquerLInstantane`) ; l'invité compose dans SON emplacement, et
 * l'attribution d'un emplacement lui est refusée.
 */
import { idsDeTest, rosterDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { emplacementsDuGroupe } from '../../noyau/sieges';
import { refusDeLancer } from '../../noyau/partyFlow';
import { makePregens } from '../../data/pregens';
import { pregens } from '../../data';
import { etatInitialDuJeu, initialNet, type EtatDeJeu } from '../../noyau/etat';
import { t } from '../../i18n';
import { engagerLeHeros } from '../roster';
import { creerFabriqueDIds } from '../../noyau/idsDuMonde';
import { brouillonComplet } from '../../noyau/creation/engagement.testkit';
import { stockageEnMemoire } from '../../lib/stockage.testkit';

/** L'hôte (banc) d'une table à un invité au siège 1, qui remplit l'emplacement 2, relié par transport à l'invité. */
function table() {
  const [h1, g1] = makePregens(idsDeTest);
  const hote = ouvrirLeBanc({ etat: { party: [h1], net: { ...initialNet(), mode: 'host', roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, slots: [0, 0, 1, 0] } } });
  // L'invité : son état de jeu, posé par chaque instantané reçu (un seul jeu se branche par test).
  const invite = { etat: { ...etatInitialDuJeu(), net: { ...initialNet(), mode: 'guest' as const, mySeat: 1, roomCode: 'ABCDEF' } } as EtatDeJeu };
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(hote.getState, seat, action, args); },
    getSnapshot: () => JSON.parse(JSON.stringify(instantaneDeLaCoop(hote.getState()))) as Record<string, unknown>,
  });
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (d) => { invite.etat = appliquerLInstantane(d, invite.etat).etat; } });
  const [a, b] = FakeTransport.pair();
  host.addGuest(a, 1);
  guest.connect(b);
  host.broadcastSnapshot();
  return { hote, invite, host, guest, g1 };
}

const lecture = (s: EtatDeJeu) => ({ emplacements: emplacementsDuGroupe(s), refus: refusDeLancer(s) });

describe('Sièges en coop : la même lecture chez l’hôte et chez l’invité', () => {
  it('avant et après la composition de l’invité : mêmes emplacements, même refus de lancer', () => {
    const { hote, invite, host, guest, g1 } = table();
    expect(lecture(invite.etat)).toEqual(lecture(hote.getState()));
    expect(lecture(hote.getState()).refus).toBe(t('party.action.start.guestPending'));

    guest.sendIntent('recruterLeHeros', [{ pretire: pregens[1].id }]);
    host.broadcastSnapshot();
    expect(lecture(invite.etat)).toEqual(lecture(hote.getState()));
    expect(lecture(hote.getState()).emplacements[2]).toEqual({ rang: 2, siege: 1, heroId: g1.id, proprietaire: 1 });
    expect(lecture(hote.getState()).refus).toBeNull();
  });

  it('un `netAssignSlot` émis par l’invité est refusé : les emplacements ne bougent pas', () => {
    const { hote, host, guest } = table();
    const avant = hote.getState().net.slots;
    guest.sendIntent('netAssignSlot', [3, 1]);
    host.broadcastSnapshot();
    expect(hote.getState().net.slots).toEqual(avant);
  });
});

describe('Engager en coop : le héros de chaque siège entre au groupe (#2907 S3)', () => {
  it('l’hôte puis l’invité engagent un brouillon depuis le même instantané : deux héros de plus au groupe', () => {
    const { hote, invite, host, guest } = table();
    // L'entropie de chaque siège est sa source propre (`idDEntropie` au web). Le jeu de l'invité : son miroir, son compteur d'ids lié au miroir comme celui de son store, ses intentions vers l'hôte.
    const lireLeMiroir = () => invite.etat;
    const ecrireLeMiroir = ((p: Partial<EtatDeJeu>) => { invite.etat = { ...invite.etat, ...p }; }) as Parameters<typeof creerFabriqueDIds>[1];
    const jeuDeLInvite = {
      ...invite.etat,
      ...creerFabriqueDIds(lireLeMiroir as never, ecrireLeMiroir),
      recruterLeHeros: (h: unknown) => guest.sendIntent('recruterLeHeros', [h]),
      remplacerLeHeros: (id: string, h: unknown) => guest.sendIntent('remplacerLeHeros', [id, h]),
    } as unknown as Parameters<typeof engagerLeHeros>[1];
    expect(engagerLeHeros(stockageEnMemoire(), hote.getState(), brouillonComplet('Hôte'), rosterDeTest('entropie-hote'))).toBeNull();
    expect(engagerLeHeros(stockageEnMemoire(), jeuDeLInvite, brouillonComplet('Invité'), rosterDeTest('entropie-invite'))).toBeNull();
    host.broadcastSnapshot();
    expect(hote.getState().party.map((h) => h.label).slice(1).sort()).toEqual(['Hôte', 'Invité']);
    expect(lecture(invite.etat)).toEqual(lecture(hote.getState()));
  });
});
