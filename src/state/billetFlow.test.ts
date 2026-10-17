/**
 * #2534 — l'issue d'un Marchandage de billet ne vaut que pour CE billet d'auteur (EDO 01 l.142) : la clé
 * `cleDeBillet` porte le lieu de départ, et l'offre ne joint une issue qu'à un billet d'auteur.
 */
import { describe, it, expect } from 'vitest';
import { offreDePassage } from './billetFlow';
import { billetImplicite, transportCost } from '../engine/travel';
import { cleDeBillet, type MapRoute, type WorldMap } from './worldMap';
import { toBrass } from '../engine/money';

const route: MapRoute = {
  id: 'r', a: 'A', b: 'B', km: 100, modes: ['diligence'],
  billets: {
    diligence: {
      prix: { exterieur: 48, interieur: 96 }, depuis: 'A', maison: 'test',
      marchandage: { presetId: 'vendeur', paliers: [{ drMin: 0, prix: { exterieur: 36, interieur: 72 } }] },
    },
  },
};
const carte: WorldMap = {
  id: 'm', label: 'Carte',
  places: [{ id: 'A', label: 'A', pos: { x: 0, y: 0 }, scene: 'a' }, { id: 'B', label: 'B', pos: { x: 9, y: 0 }, scene: 'b' }],
  routes: [route],
};
/** L'état que `merchantFlow.bargainConfirm` écrit après un Marchandage du billet gagné au départ de A. */
const gagneDepuisA = { [cleDeBillet('r', 'diligence', 'A')]: { won: true, drNet: 6, negotiator: true } };

describe('#2534 M1 — route à double sens, billet d’auteur au départ de A, marchandé et gagné', () => {
  it('au départ de A : le billet d’auteur porte l’issue (palier marchandé)', () => {
    const offre = offreDePassage(carte, route, 'diligence', 'A', null, gagneDepuisA);
    if (!offre || offre.couvert) throw new Error('aucune offre au départ de A');
    expect(toBrass(transportCost(offre.tarif, 'exterieur', 1, offre.issue))).toBe(36);
  });
  it('au départ de B : billet implicite au km, prix PLEIN — l’issue de A ne s’y applique pas', () => {
    const offre = offreDePassage(carte, route, 'diligence', 'B', null, gagneDepuisA);
    if (!offre || offre.couvert) throw new Error('aucune offre au départ de B');
    expect(offre.issue).toBeUndefined();
    expect(offre.vendeurPresetId).toBeUndefined();
    const plein = toBrass(transportCost(billetImplicite(100, 'diligence')!, 'exterieur', 1));
    expect(toBrass(transportCost(offre.tarif, 'exterieur', 1, offre.issue))).toBe(plein);
  });
});
