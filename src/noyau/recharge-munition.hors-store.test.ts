/**
 * Le Test de rechargement vise la Recharge de l'arme fusionnée avec la munition qu'on charge (`weaponWithAmmo`) :
 * mortier à main (Recharge 2) chargé d'un grappin (Recharge +2) → 4 DR. LDB 62 l.335 ; AA 08 l.497 ; #4417
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { emptyScene } from './monde/scene';
import type { BattleState } from './etat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Un héros au mortier à main déchargé, avec une balle de gros calibre et un grappin, seul actif du combat. */
function mortier() {
  const arme = itemFromTrappingById('mortier-a-main', idsDeTest)!;
  const balle = itemFromTrappingById('balle-de-gros-calibre-et-poudre', idsDeTest)!;
  const grappin = itemFromTrappingById('grappin-munition', idsDeTest)!;
  const H = combattantDeTest({ id: 'heros-1', label: 'Tireur', kind: 'heros', pos: { x: 0, y: 0 }, items: [arme, balle, grappin], loadouts: [{ id: 'm', main: arme.uid }] as never, activeLoadoutId: 'm' });
  recomputeLoadout(H);
  const E = combattantDeTest({ id: 'ennemi-1', label: 'Cible', kind: 'ennemi', pos: { x: 4, y: 0 } });
  const battle = {
    combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8), pendingReload: null });
  return { arme: arme.uid, balle: balle.uid, grappin: grappin.uid };
}

describe('Test de rechargement : Recharge de l’arme fusionnée avec la munition chargée (#4417)', () => {
  it.each([
    ['grappin', 4], // Recharge 2 + 2 : AA 08 l.497
    ['balle', 2],
  ] as const)('mortier à main + %s : le Test vise %d DR', (munition, attendu) => {
    const uids = mortier();
    banc.getState().approvisionnerLArme(uids[munition], uids.arme);
    banc.getState().rechargerLArme(uids.arme);
    expect(banc.getState().pendingReload?.weaponUid).toBe(uids.arme);
    expect(banc.getState().pendingReload?.reload).toBe(attendu);
  });
});
