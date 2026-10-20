import { describe, it, expect } from 'vitest';
import { combatOrder } from '../noyau/combatSetup';
import { isPassengerInBattle } from '../noyau/monde/shipPostes';
import type { Combatant } from '../engine/types';

// PASSAGER = membre d'ÉQUIPAGE d'une coque, à l'échelle MER : le navire agit en UNITÉ (MDG 14 l.39) → pas de
// tour propre. Une MONTURE n'est PAS un passager : RAW « Combat monté » (LDB 14 l.182) — « une monture sans le
// Trait Nerveux est un autre combattant à part entière, et peut effectuer sa propre Action » → elle GARDE son tour
// (la désynchro monture/cavalier est un bug de synchro de POSITION, pas de tour).
const mk = (id: string, initiative: number, extra: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, initiative, weapons: [], ...extra }) as unknown as Combatant;

const hull = mk('ship', 50, { bodyShape: 'vehicule', crewIds: ['c1', 'c2'] });
const c1 = mk('c1', 90); // équipage (Initiative haute, mais passager à la Mer)
const c2 = mk('c2', 80);
const rider = mk('rider', 70, { mountId: 'horse' });
const horse = mk('horse', 60, { riderId: 'rider' }); // monture chevauchée — GARDE son tour (RAW)
const enemyShip = mk('eship', 40, { bodyShape: 'vehicule' });
const all = [hull, c1, c2, rider, horse, enemyShip];

describe('Passager au combat — équipage de navire SEULEMENT (la monture garde son tour)', () => {
  it('isPassengerInBattle : équipage = passager à la Mer ; monture, coque, cavalier ne le sont JAMAIS', () => {
    // équipage → passager UNIQUEMENT à la Mer (au person-scale/Pont, il garde son tour)
    expect(isPassengerInBattle(c1, all, true)).toBe(true);
    expect(isPassengerInBattle(c1, all, false)).toBe(false);
    // RAW : une monture chevauchée RESTE un combattant à part entière (LDB 14 l.182) — jamais passagère
    expect(isPassengerInBattle(horse, all, true)).toBe(false);
    expect(isPassengerInBattle(horse, all, false)).toBe(false);
    // ni une coque, ni un cavalier, ni un combattant libre ne sont passagers
    expect(isPassengerInBattle(hull, all, true)).toBe(false);
    expect(isPassengerInBattle(rider, all, true)).toBe(false);
    expect(isPassengerInBattle(enemyShip, all, true)).toBe(false);
  });

  it('échelle MER : l\'équipage sort de l\'ordre ; la MONTURE et le cavalier gardent leur tour', () => {
    // Triés par Initiative : rider 70 > horse 60 > hull 50 > eship 40 (c1/c2 équipage EXCLUS ; horse INCLUS)
    expect(combatOrder(all, true)).toEqual(['rider', 'horse', 'ship', 'eship']);
  });

  it('person-scale : tout le monde garde son tour (équipage ET monture)', () => {
    // c1 90 > c2 80 > rider 70 > horse 60 > hull 50 > eship 40
    expect(combatOrder(all, false)).toEqual(['c1', 'c2', 'rider', 'horse', 'ship', 'eship']);
  });

  it('rétro-compat : sans navire, l\'ordre est inchangé à toute échelle (pur tri d\'Initiative)', () => {
    const plain = [mk('a', 30), mk('b', 50), mk('c', 40)];
    expect(combatOrder(plain, true)).toEqual(['b', 'c', 'a']);
    expect(combatOrder(plain, false)).toEqual(['b', 'c', 'a']);
  });
});
