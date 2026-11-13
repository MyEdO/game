/**
 * LES SCÈNES D'UNE CAMPAGNE EN COOP (#3009 E1) : l'invité qui a rejoint au lobby retrouve, après le lancement par
 * l'hôte, toutes les scènes du paquet dans son registre, de l'instantané seul (`appliquerLInstantane`, `noyau/coop.ts`).
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { afterEach, describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { tousLesHerosDeScenario } from '../../scenes/test-scenarios/_heros';
import { etatInitialDuJeu, initialNet, type EtatDeJeu } from '../../noyau/etat';
import { buildScene } from '../../noyau/mapSpec';
import { resetSceneRegistry, sceneDuRegistre } from '../../noyau/monde/registreDesScenes';
import { lancerCampagne } from '../../scenes/campaign';

const DEPART = buildScene({ id: 'campagne-coop-depart', label: 'Départ', size: [2, 2] });
const SUITE = buildScene({ id: 'campagne-coop-suite', label: 'Suite', size: [2, 2] });
const CAMPAGNE: NonNullable<EtatDeJeu['pendingCampaign']> = {
  id: 'campagne-coop', label: 'Campagne coop', scenes: [DEPART, SUITE],
  startSceneId: DEPART.id, worldMap: null, projet: { id: 'campagne-coop' },
};

afterEach(() => resetSceneRegistry());

describe('Campagne en coop : les scènes du paquet viennent de l’instantané', () => {
  it('un invité rejoint au lobby résout, après le lancement, une scène du paquet autre que la courante', () => {
    const [h1] = tousLesHerosDeScenario(idsDeTest);
    const hote = ouvrirLeBanc({ etat: { party: [h1], screen: 'party', pendingCampaign: CAMPAGNE, net: { ...initialNet(), mode: 'hote', roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, slots: [0, 0, 0, 0] } } });
    const invite = { etat: { ...etatInitialDuJeu(), net: { ...initialNet(), mode: 'invite' as const, mySeat: 1, roomCode: 'ABCDEF' } } as EtatDeJeu };
    const host = new HostSession({
      build: 'test',
      applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(hote.getState, seat, action, args); },
      getSnapshot: () => JSON.parse(JSON.stringify(instantaneDeLaCoop(hote.getState()))) as Record<string, unknown>,
    });
    let enAttente: Record<string, unknown> | null = null;
    const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (d) => { enAttente = d; } });
    const appliquer = () => { invite.etat = appliquerLInstantane(enAttente!, invite.etat).etat; enAttente = null; };
    const [a, b] = FakeTransport.pair();
    host.addGuest(a, 1);
    guest.connect(b);
    appliquer();
    expect(invite.etat.scene).toBeNull();
    expect(invite.etat.pendingCampaign?.label).toBe(CAMPAGNE.label);

    expect(lancerCampagne(hote.getState, hote.getState().pendingCampaign)).toBeNull();
    host.broadcastSnapshot();
    resetSceneRegistry();
    appliquer();

    expect(sceneDuRegistre(SUITE.id)?.id).toBe(SUITE.id);
    expect(invite.etat.scene?.id).toBe(DEPART.id);
  });
});
