/** Les réducteurs de lobby de `NetState` (#3041) : attribution d'un héros, d'un emplacement, rôle MJ — hôte-autoritaires. */
import { describe, expect, it } from 'vitest';
import { initialNet, type NetState } from './etat';
import { attribuerLEmplacement, attribuerLeHeros, poserLeSiegeMJ } from './sieges';

/** L'hôte d'une room à deux invités, aucun héros attribué. */
const hoteADeuxInvites = (): NetState => ({ ...initialNet(), mode: 'host', roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna', 2: 'Bruno' } });
/** L'invité Anna, assis au siège 1. */
const inviteAnna = (): NetState => ({ ...initialNet(), mode: 'guest', mySeat: 1, roomCode: 'ABC234' });
/** Une partie solo. */
const solo = (): NetState => initialNet();

describe('attribuerLeHeros', () => {
  it("l'hôte attribue un héros à un siège, puis le réattribue", () => {
    const net = attribuerLeHeros(attribuerLeHeros(hoteADeuxInvites(), 'pregen-101', 1), 'pregen-101', 2);
    expect(net.ownership).toEqual({ 'pregen-101': 2 });
  });

  it('un invité ou une partie solo : le réseau est rendu inchangé', () => {
    for (const net of [inviteAnna(), solo()]) expect(attribuerLeHeros(net, 'pregen-101', 1)).toBe(net);
  });
});

describe('poserLeSiegeMJ', () => {
  it('le rôle MJ est UNIQUE : le poser à un siège le retire au précédent ; null le rend à l’IA', () => {
    const anna = poserLeSiegeMJ(hoteADeuxInvites(), 1);
    expect(anna.gmSeat).toBe(1);
    expect(poserLeSiegeMJ(anna, 2).gmSeat).toBe(2);
    expect(poserLeSiegeMJ(anna, null).gmSeat).toBeUndefined();
  });

  it('en solo, le siège unique prend le rôle', () => {
    expect(poserLeSiegeMJ(solo(), 0).gmSeat).toBe(0);
  });

  it('un invité ne pose pas le rôle : le réseau est rendu inchangé', () => {
    const net = inviteAnna();
    expect(poserLeSiegeMJ(net, 1)).toBe(net);
  });
});

describe('attribuerLEmplacement', () => {
  it("l'hôte attribue un emplacement existant à un siège", () => {
    expect(attribuerLEmplacement(hoteADeuxInvites(), 1, 2).slots).toEqual([0, 2, 0, 0]);
  });

  it('hors des emplacements, chez un invité ou en solo : le réseau est rendu inchangé', () => {
    const hote = hoteADeuxInvites();
    expect(attribuerLEmplacement(hote, 4, 1)).toBe(hote);
    expect(attribuerLEmplacement(hote, -1, 1)).toBe(hote);
    for (const net of [inviteAnna(), solo()]) expect(attribuerLEmplacement(net, 1, 1)).toBe(net);
  });
});
