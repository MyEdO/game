/**
 * Le propriétaire de l'état hors du web (`proprietaireDuJeu.ts`) applique la transition du jeu après chaque
 * écriture : le maximum des Blessures suit ses porteurs (LDB 05 l.1001, LDB 48 l.23), le courant suit le
 * delta (LDB 48 l.27).
 */
import { describe, expect, it } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { CHEMINS_NOMMES, lireAuChemin, poserAuChemin } from './combattantsDeLEtat.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { PORTEURS_HORS_TALENT } from '../engine/porteursDePassifs.testkit';
import { blessuresDeBase } from '../engine/characteristics';

describe('propriétaire du jeu : l’écriture d’un porteur non réconcilié finit au maximum suivi', () => {
  it.each(CHEMINS_NOMMES)('%s', (_, chemin) => {
    const banc = ouvrirLeBanc();
    const c = combattantDeTest({ kind: 'hero', wounds: blessuresDeBase(12, 10) });
    PORTEURS_HORS_TALENT[0][2](c, [{ op: 'attrMod', attr: 'wounds', mod: 3 }]);
    banc.setState(poserAuChemin(banc.getState(), chemin, c));
    expect(lireAuChemin(banc.getState(), chemin).wounds).toMatchObject({ max: 15, current: 13 });
  });
});
