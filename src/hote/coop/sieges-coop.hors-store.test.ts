/**
 * LES SIÈGES EN COOP (#3059 F10), sur transport en mémoire (`FakeTransport`) : l'hôte et l'invité lisent les MÊMES
 * emplacements du groupe (`emplacementsDuGroupe`), de l'instantané que l'hôte diffuse et que l'invité applique
 * (`appliquerLInstantane`) ; le refus de lancer (`refusDeLancer`) se lit chez l'hôte, l'invité ne lance pas (#3009) ;
 * l'invité compose dans SON emplacement, et l'attribution d'un emplacement lui est refusée.
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
import { tousLesHerosDeScenario } from '../../scenes/test-scenarios/_heros';
import { idDuPretire } from '../../data/pregens';
import { PRETIRE_DE_TEST, poserLesPretires } from '../../noyau/creation/pretireDeTest.testkit';
import { etatInitialDuJeu, initialNet, type EtatDeJeu } from '../../noyau/etat';
import { t } from '../../i18n';
import { engagerSurLeJeu } from '../roster.testkit';
import { brouillonComplet } from '../../noyau/creation/engagement.testkit';
import { stockageEnMemoire } from '../../lib/stockage.testkit';

/** L'hôte (banc) d'une table à un invité au siège 1, qui remplit l'emplacement 2, relié par transport à l'invité. */
function table() {
  const [h1] = tousLesHerosDeScenario(idsDeTest);
  const hote = ouvrirLeBanc({ etat: { party: [h1], net: { ...initialNet(), mode: 'hote', roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, slots: [0, 0, 1, 0] } } });
  // L'invité : son état de jeu, posé par chaque instantané reçu (un seul jeu se branche par test).
  const invite = { etat: { ...etatInitialDuJeu(), net: { ...initialNet(), mode: 'invite' as const, mySeat: 1, roomCode: 'ABCDEF' } } as EtatDeJeu };
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
  return { hote, invite, host, guest };
}

describe('Sièges en coop : la même lecture chez l’hôte et chez l’invité', () => {
  it('avant et après la composition de l’invité : mêmes emplacements ; l’hôte garde ses verdicts de lancement, l’invité ne lance pas', () => {
    poserLesPretires();
    const { hote, invite, host, guest } = table();
    expect(emplacementsDuGroupe(invite.etat)).toEqual(emplacementsDuGroupe(hote.getState()));
    expect(refusDeLancer(hote.getState())).toBe(t('party.action.start.guestPending'));
    expect(refusDeLancer(invite.etat)).toBe(t('party.guest.waiting'));

    guest.sendIntent('recruterLeHeros', [{ pretire: PRETIRE_DE_TEST.id }]);
    host.broadcastSnapshot();
    expect(emplacementsDuGroupe(invite.etat)).toEqual(emplacementsDuGroupe(hote.getState()));
    expect(emplacementsDuGroupe(hote.getState())[2]).toEqual({ rang: 2, siege: 1, heroId: idDuPretire(PRETIRE_DE_TEST.id), proprietaire: 1 });
    expect(refusDeLancer(hote.getState())).toBeNull();
    expect(refusDeLancer(invite.etat), 'son emplacement rempli, l’invité ne lance toujours pas').toBe(t('party.guest.waiting'));
  });

  it('un `affecterLEmplacementAuSiege` émis par l’invité est refusé ; le même joué par l’hôte déplace l’emplacement', () => {
    const { hote, host, guest } = table();
    const avant = hote.getState().net.slots;
    guest.sendIntent('affecterLEmplacementAuSiege', [3, 1]);
    host.broadcastSnapshot();
    expect(hote.getState().net.slots).toEqual(avant);
    hote.getState().affecterLEmplacementAuSiege(3, 1);
    expect(hote.getState().net.slots).toEqual([0, 0, 1, 1]);
  });
});

describe('Engager en coop : le héros de chaque siège entre au groupe (#2907 S3)', () => {
  it('l’hôte et deux invités engagent chacun un brouillon depuis le même instantané : trois héros de plus, aux ids distincts', () => {
    const [h1] = tousLesHerosDeScenario(idsDeTest);
    const hote = ouvrirLeBanc({ etat: { party: [h1], net: { ...initialNet(), mode: 'hote', roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Berthe' }, slots: [0, 0, 1, 2] } } });
    const host = new HostSession({
      build: 'test',
      applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(hote.getState, seat, action, args); },
      getSnapshot: () => JSON.parse(JSON.stringify(instantaneDeLaCoop(hote.getState()))) as Record<string, unknown>,
    });
    // L'invité au siège `siege` : son miroir, ses intentions vers l'hôte ; l'entropie de chaque siège est sa source propre.
    const invite = (siege: number, label: string) => {
      const miroir = { etat: { ...etatInitialDuJeu(), net: { ...initialNet(), mode: 'invite' as const, mySeat: siege, roomCode: 'ABCDEF' } } as EtatDeJeu };
      const session = new GuestSession({ build: 'test', label, applySnapshot: (d) => { miroir.etat = appliquerLInstantane(d, miroir.etat).etat; } });
      const [a, b] = FakeTransport.pair();
      host.addGuest(a, siege);
      session.connect(b);
      return () => ({
        ...miroir.etat,
        recruterLeHeros: (h: unknown) => session.sendIntent('recruterLeHeros', [h]),
        remplacerLeHeros: (id: string, h: unknown) => session.sendIntent('remplacerLeHeros', [id, h]),
      }) as unknown as Parameters<typeof engagerSurLeJeu>[1];
    };
    const [antoine, berthe] = [invite(1, 'Antoine'), invite(2, 'Berthe')];
    host.broadcastSnapshot();
    expect(engagerSurLeJeu(stockageEnMemoire(), hote.getState(), brouillonComplet('Hôte'), rosterDeTest('entropie-hote'))).toBeNull();
    expect(engagerSurLeJeu(stockageEnMemoire(), antoine(), brouillonComplet('Antoine'), rosterDeTest('entropie-antoine'))).toBeNull();
    expect(engagerSurLeJeu(stockageEnMemoire(), berthe(), brouillonComplet('Berthe'), rosterDeTest('entropie-berthe'))).toBeNull();
    host.broadcastSnapshot();
    const groupe = hote.getState().party;
    expect(groupe.map((h) => h.label).slice(1).sort()).toEqual(['Antoine', 'Berthe', 'Hôte']);
    expect(new Set(groupe.map((h) => h.id)).size).toBe(groupe.length);
  });
});
