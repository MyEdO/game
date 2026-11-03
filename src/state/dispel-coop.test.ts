/**
 * L'ÉLECTION DU PORTEUR EST UN CHOIX D'ÉCRAN — elle se joue chez l'ÉMETTEUR (#1411).
 *
 * Mode Dissiper (LDB 46 l.158-162), spec HUD §1d : le clic-token élit le PORTEUR, il reste à choisir
 * LEQUEL de ses Sorts dissiper — c'est le panneau-paramètre de la console qui le demande. Rien n'est
 * engagé par cette élection : elle vit à la racine du store (`dispelCarrierId`), hors `battle`, et le
 * snapshot de l'hôte l'efface (`coop.instantaneDeLaCoop`).
 *
 * Le défaut mesuré : `battleClickEntity` est un intent d'allowlist, donc chez l'invité il partait à
 * l'hôte, qui exécutait `dispelSelectCarrier` DANS SON PROPRE STORE — un panneau étranger s'ouvrait
 * chez l'hôte, et l'invité n'en voyait jamais aucun (son élection n'existait nulle part).
 *
 * La couture est celle, déjà écrite, du verdict d'armement (`localIntent.argsAvecVerdictLocal`) : ce
 * qui est un mode d'écran se calcule et se JOUE chez l'émetteur. Ici le mode de ciblage DÉCLARE que
 * son clic n'est qu'une élection (`TargetingMode.electionLocale`), et `emettreIntentInvite` la joue
 * en local au lieu d'émettre. Seul le COMMIT (`battleDispelSpell`, allowlisté) voyage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emettreIntentInvite, interceptGuestActions, restoreGuestActions } from './netFlow';
import { initialNet } from '../noyau/etat';
import { tableDeDissipation } from '../noyau/tableDeDissipation.testkit';

const get = () => useGame.getState();
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
    const local = get().battleClickEntity;
    const envoyer = vi.fn();
    emettreIntentInvite('battleClickEntity', local as never, envoyer, ['e1']);
    expect(get().dispelCarrierId, 'l’élection n’a pas eu lieu dans le store de l’ÉMETTEUR : aucun panneau à l’écran').toBe('e1');
    expect(envoyer, 'l’élection est partie chez l’hôte : le panneau s’y ouvrirait, jamais chez l’invité').not.toHaveBeenCalled();
    expect(get().pendingDispel, 'rien n’est engagé tant que le Sort n’est pas choisi').toBeNull();
  });

  it('INVITÉ, porteur à 1 Sort : rien à élire — le GESTE part à l’hôte (c’est un acte de jeu)', () => {
    table('guest', { e1: 1 });
    const local = get().battleClickEntity;
    const envoyer = vi.fn();
    emettreIntentInvite('battleClickEntity', local as never, envoyer, ['e1']);
    expect(get().dispelCarrierId, 'aucun paramètre à demander : rien ne doit être élu').toBeNull();
    expect(get().pendingDispel, 'le commit s’est joué EN LOCAL chez l’invité — il sera écrasé au snapshot').toBeNull();
    expect(envoyer, 'le geste de jeu doit VOYAGER').toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0][0]).toBe('battleClickEntity');
    expect(envoyer.mock.calls[0][1]).toEqual(['e1', { approche: false }]);
  });

  it('CÂBLAGE : le substitut RÉELLEMENT posé par `interceptGuestActions` fait le même partage', () => {
    // Pas de session (pas de relay) : `guest` est nul, donc la branche « envoyer » ne fait RIEN.
    // C'est ce qui rend le partage visible sur l'arbre réel — l'élection agit, le geste de jeu non.
    table('guest', { e1: 2, e2: 1 });
    interceptGuestActions();
    try {
      get().battleClickEntity('e1'); // 2 Sorts → élection LOCALE
      expect(get().dispelCarrierId, 'le substitut d’invité n’a pas joué l’élection en local').toBe('e1');
      get().dispelSelectCarrier(null);
      get().battleClickEntity('e2'); // 1 Sort → geste de jeu, parti au réseau (donc inerte ici)
      expect(get().dispelCarrierId).toBeNull();
      expect(get().pendingDispel, 'le commit a été joué en local au lieu de partir en intent').toBeNull();
    } finally {
      restoreGuestActions();
    }
  });
});
