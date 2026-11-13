/**
 * L'élection du porteur se JOUE chez l'émetteur (#1411) : le mode de ciblage déclare que son clic n'est
 * qu'une élection (`TargetingMode.electionLocale`), et `emettreIntentInvite` (`noyau/reseau.ts`, éprouvé par
 * `src/noyau/reseau.hors-store.test.ts`) la joue en local au lieu d'émettre ; seul le COMMIT (`dissiperLeSort`,
 * allowlisté) voyage. Ici, le substitut que pose le store web. LDB 46 l.158-162
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { initialNet } from '../noyau/etat';
import { tableDeDissipation } from '../noyau/tableDeDissipation.testkit';
import { cliquerSurLeCombattant } from '../noyau/combatOrParty';

const get = () => useGame.getState();
const table = (mode: 'hote' | 'invite', porteurs: Record<string, number>) => useGame.setState(tableDeDissipation(mode, porteurs));

beforeEach(() => {
  useGame.setState({ battle: null, party: [], pendingDispel: null, pendingAttack: null, dispelCarrierId: null, net: initialNet() });
});
afterEach(() => {
  useGame.getState().restaurerLesIntentions();
  useGame.setState({ net: initialNet() });
});

describe('Dissipation en coop — l’élection du porteur ne voyage JAMAIS', () => {
  it('CÂBLAGE : le substitut RÉELLEMENT posé par `transmettreLesIntentions` fait le même partage', () => {
    // L'envoi passé à `transmettreLesIntentions` est inerte, donc la branche « envoyer » ne fait RIEN.
    // C'est ce qui rend le partage visible sur l'arbre réel — l'élection agit, le geste de jeu non.
    table('invite', { e1: 2, e2: 1 });
    useGame.getState().transmettreLesIntentions(() => {});
    try {
      cliquerSurLeCombattant(get, 'e1'); // 2 Sorts → élection LOCALE
      expect(get().dispelCarrierId, 'le substitut d’invité n’a pas joué l’élection en local').toBe('e1');
      get().designerLeSupport(null);
      cliquerSurLeCombattant(get, 'e2'); // 1 Sort → geste de jeu, parti au réseau (donc inerte ici)
      expect(get().dispelCarrierId).toBeNull();
      expect(get().pendingDispel, 'le commit a été joué en local au lieu de partir en intent').toBeNull();
    } finally {
      useGame.getState().restaurerLesIntentions();
    }
  });
});
