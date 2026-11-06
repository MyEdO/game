/**
 * L'élection du porteur se JOUE chez l'émetteur (#1411) : le mode de ciblage déclare que son clic n'est
 * qu'une élection (`TargetingMode.electionLocale`), et `emettreIntentInvite` la joue en local au lieu
 * d'émettre ; seul le COMMIT (`dissiperLeSort`, allowlisté) voyage. LDB 46 l.158-162
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emettreIntentInvite, interceptGuestActions, restoreGuestActions } from './netFlow';
import { initialNet } from '../noyau/etat';
import { tableDeDissipation } from '../noyau/tableDeDissipation.testkit';
import { cliquerSurLeCombattant } from '../noyau/combatOrParty';

const get = () => useGame.getState();
const caseDe = (id: string) => ({ ...get().battle!.combatants.find((c) => c.id === id)!.pos! });
const table = (mode: 'host' | 'guest', porteurs: Record<string, number>) => useGame.setState(tableDeDissipation(mode, porteurs));

beforeEach(() => {
  useGame.setState({ battle: null, party: [], pendingDispel: null, pendingAttack: null, dispelCarrierId: null, net: initialNet() });
});
afterEach(() => {
  restoreGuestActions();
  useGame.setState({ net: initialNet() });
});

describe('Dissipation en coop — l’élection du porteur ne voyage JAMAIS', () => {
  it('INVITÉ, porteur à 2 Sorts : le panneau naît CHEZ LUI et rien ne part sur le fil', () => {
    table('guest', { e1: 2 });
    const local = get().cliquerLaCase;
    const envoyer = vi.fn();
    emettreIntentInvite('cliquerLaCase', local as never, envoyer, [caseDe('e1'), 'e1']);
    expect(get().dispelCarrierId, 'l’élection n’a pas eu lieu dans le store de l’ÉMETTEUR : aucun panneau à l’écran').toBe('e1');
    expect(envoyer, 'l’élection est partie chez l’hôte : le panneau s’y ouvrirait, jamais chez l’invité').not.toHaveBeenCalled();
    expect(get().pendingDispel, 'rien n’est engagé tant que le Sort n’est pas choisi').toBeNull();
  });

  it('INVITÉ, porteur à 1 Sort : rien à élire — le GESTE part à l’hôte (c’est un acte de jeu)', () => {
    table('guest', { e1: 1 });
    const local = get().cliquerLaCase;
    const envoyer = vi.fn();
    emettreIntentInvite('cliquerLaCase', local as never, envoyer, [caseDe('e1'), 'e1']);
    expect(get().dispelCarrierId, 'aucun paramètre à demander : rien ne doit être élu').toBeNull();
    expect(get().pendingDispel, 'le commit s’est joué EN LOCAL chez l’invité — il sera écrasé au snapshot').toBeNull();
    expect(envoyer, 'le geste de jeu doit VOYAGER').toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0][0]).toBe('cliquerLaCase');
    expect(envoyer.mock.calls[0][1]).toEqual([caseDe('e1'), 'e1', { approche: false }]);
  });

  it('CÂBLAGE : le substitut RÉELLEMENT posé par `interceptGuestActions` fait le même partage', () => {
    // Pas de session (pas de relay) : `guest` est nul, donc la branche « envoyer » ne fait RIEN.
    // C'est ce qui rend le partage visible sur l'arbre réel — l'élection agit, le geste de jeu non.
    table('guest', { e1: 2, e2: 1 });
    interceptGuestActions();
    try {
      cliquerSurLeCombattant(get, 'e1'); // 2 Sorts → élection LOCALE
      expect(get().dispelCarrierId, 'le substitut d’invité n’a pas joué l’élection en local').toBe('e1');
      get().dispelSelectCarrier(null);
      cliquerSurLeCombattant(get, 'e2'); // 1 Sort → geste de jeu, parti au réseau (donc inerte ici)
      expect(get().dispelCarrierId).toBeNull();
      expect(get().pendingDispel, 'le commit a été joué en local au lieu de partir en intent').toBeNull();
    } finally {
      restoreGuestActions();
    }
  });
});
