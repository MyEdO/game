import { describe, it, expect } from 'vitest';
import { shipOfCrew, mountedWeaponBears, applyShipPostes } from '../noyau/monde/shipPostes';
import type { Combatant, ShipPoste } from '../engine/types';

/**
 * PORTÉE D'ARC d'une pièce MONTÉE en combat — helpers PURS et KIND-AGNOSTIQUES (prennent « un combattant »
 * et « un poste », jamais « un héros »). La pièce est montée sur un SUPPORT (coque navale) dont le cap
 * détermine l'arc : `mountedWeaponBears` ne contraint que si l'arme porte un `mountSide` ET qu'on a résolu
 * cap + position du support — sinon aucune restriction (pièce non montée, ou support non résolu).
 */
const hull = { id: 'cogue', pos: { x: 5, y: 5 }, crewIds: ['gunner', 'aide'] } as unknown as Combatant;
const gunner = { id: 'gunner', pos: { x: 5, y: 5 } } as unknown as Combatant;
const combatants = [hull, gunner];

describe('shipOfCrew — la coque dont l’équipage inclut le combattant (kind-agnostique)', () => {
  it('retrouve la coque par crewIds ; rien si non équipier', () => {
    expect(shipOfCrew(combatants, 'gunner')?.id).toBe('cogue');
    expect(shipOfCrew(combatants, 'aide')?.id).toBe('cogue');
    expect(shipOfCrew(combatants, 'inconnu')).toBeUndefined();
  });
});

describe('mountedWeaponBears — une pièce montée porte-t-elle sur la cible ?', () => {
  const tribord = { mountSide: 'tribord' as const };

  it('cap Nord : la cible à l’est (tribord) porte ; à l’ouest (bâbord) non', () => {
    expect(mountedWeaponBears(tribord, 'N', hull.pos, { x: 9, y: 5 })).toBe(true);
    expect(mountedWeaponBears(tribord, 'N', hull.pos, { x: 0, y: 5 })).toBe(false);
  });

  it('virer le navire au Sud inverse bâbord/tribord (l’arc suit le cap)', () => {
    expect(mountedWeaponBears(tribord, 'S', hull.pos, { x: 9, y: 5 })).toBe(false);
    expect(mountedWeaponBears(tribord, 'S', hull.pos, { x: 0, y: 5 })).toBe(true);
  });

  it('arme NON montée (pas de mountSide) → aucune contrainte d’arc', () => {
    expect(mountedWeaponBears({}, 'N', hull.pos, { x: 0, y: 5 })).toBe(true);
  });

  it('support/cap non résolu (cap ou position absents) → aucune contrainte (défensif)', () => {
    expect(mountedWeaponBears(tribord, undefined, hull.pos, { x: 0, y: 5 })).toBe(true);
    expect(mountedWeaponBears(tribord, 'N', undefined, { x: 0, y: 5 })).toBe(true);
  });
});

describe('applyShipPostes — pose mannedPoste sur le chef de pièce de chaque poste de la coque (kind-agnostique)', () => {
  const poste = (crew: string[]): ShipPoste => ({ item: { uid: 'c', name: 'Canon', kind: 'ranged', damage: { plusBF: false, flat: 14 }, qualities: [], enc: 0 } as never, side: 'tribord', crewIds: crew });

  it('chaque poste pose son arme sur crewIds[0] (chef de pièce), pas sur les aides', () => {
    const h = { id: 'cogue', crewIds: ['chef', 'aide'], postes: [poste(['chef', 'aide'])] } as unknown as Combatant;
    const chef = { id: 'chef' } as unknown as Combatant;
    const aide = { id: 'aide' } as unknown as Combatant;
    applyShipPostes([h, chef, aide]);
    expect(chef.mannedPoste?.side).toBe('tribord'); // le chef SERT le poste
    expect(chef.weapons?.some((w) => w.uid === 'c' && w.mountSide === 'tribord')).toBe(true); // canon octroyé, tagué tribord
    expect(aide.mannedPoste).toBeUndefined(); // l'aide recharge, ne sert pas le jet
    expect(aide.weapons).toBeUndefined(); // pas de canon pour l'aide
  });

  it('coque sans postes, ou chef de pièce absent → rien (défensif)', () => {
    const h = { id: 'cogue', postes: [poste(['fantome'])] } as unknown as Combatant;
    expect(() => applyShipPostes([h])).not.toThrow(); // chef introuvable → ignoré
    const plain = { id: 'x' } as unknown as Combatant;
    applyShipPostes([plain]);
    expect(plain.mannedPoste).toBeUndefined();
  });
});
