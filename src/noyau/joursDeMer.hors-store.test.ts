/**
 * Jours de mer jugés par le NOYAU (#3059) : le geste `startTravel` en traversée RAPIDE pose
 * `sea.fast.days` au M de croisière du navire (gréement + Améliorations), au rythme de la règle maison
 * `sea-night-sailing`, et refuse d'appareiller un navire sans M ou à la cale surchargée. L'estimation
 * de la carte du monde lit les mêmes fonctions. MDG 12 l.70-75 ; MDG 12 l.293 ; MDG 15 l.25 ;
 * MDG 15 l.57-70 ; MDG 15 l.76.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie } from './index';
import { makePregens } from '../data/pregens';
import { emptyScene } from './monde/scene';
import type { WorldMap } from './worldMap';
import type { NavalTraitRef } from '../engine/types';
import type { CargoLot } from '../engine/seaVoyage';
import { findVehicleById } from '../data';
import { dureeDeTraversee, mDeCroisiere, refusDAppareiller } from './seaVoyageFlow';

const KM = 550;

const carte: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b' },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: KM, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

interface Navire { vehicleId: string; upgrades?: NavalTraitRef[]; cargo?: CargoLot[] }

/** Appareille en traversée rapide par le geste `startTravel` et rend les jours que le noyau a posés
 *  (`undefined` : aucun départ). */
function joursDeLaTraverseeRapide(navire: Navire, reglesMaison: Record<string, unknown> = {}): number | undefined {
  const entrees: EntreesDeLaPartie = { graine: 7, reglesMaison, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };
  const partie = creerPartie({
    ...etatInitialDuJeu(),
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    worldMap: carte,
    gameTime: 8 * 60,
    vessel: { ...navire, morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
  }, entrees);
  try {
    partie.envoyer({ type: 'startTravel', args: ['r1', 'mer', { fast: true }] });
    return partie.etat().travelPlan?.sea?.fast?.days;
  } finally {
    partie.fermer();
  }
}

const COGUE: Navire = { vehicleId: 'cogue' };
const COGUE_LISSEE: Navire = { vehicleId: 'cogue', upgrades: [{ id: 'lissage' }] };
const CORACLE_IMMOBILE: Navire = { vehicleId: 'coracle', upgrades: [{ id: 'bouteur' }, { id: 'bouteur' }, { id: 'bouteur' }] };
/** Cogue chargée au double de sa Contenance, au-delà du plafond dur. */
const COGUE_SURCHARGEE: Navire = { vehicleId: 'cogue', cargo: [{ cargoId: 'bois', enc: 2 * findVehicleById('cogue')!.ship!.capacity, basePriceGold: 10 }] };

describe('#3059 — jours de mer : une seule durée pour la carte et le noyau', () => {
  it('cogue (M 5) qui vogue de nuit : 550 milles en 7 jours', () => {
    expect(joursDeLaTraverseeRapide(COGUE, { 'sea-night-sailing': true })).toBe(7);
  });

  it('sans voguer de nuit : la distance du jour est divisée par deux, 550 milles en 13 jours', () => {
    expect(joursDeLaTraverseeRapide(COGUE, { 'sea-night-sailing': false })).toBe(13);
  });

  it('cogue au Lissage (M 6) : 550 milles en 6 jours', () => {
    expect(joursDeLaTraverseeRapide(COGUE_LISSEE)).toBe(6);
  });

  it('navire à M 0 : aucune traversée ne part', () => {
    expect(joursDeLaTraverseeRapide(CORACLE_IMMOBILE)).toBeUndefined();
  });

  it('cale chargée au-delà du plafond dur : aucune traversée ne part', () => {
    expect(joursDeLaTraverseeRapide(COGUE_SURCHARGEE)).toBeUndefined();
  });

  it("l'estimation de la carte lit le M de croisière et le refus d'appareiller du noyau", () => {
    for (const navire of [COGUE, COGUE_LISSEE]) {
      expect(refusDAppareiller(navire)).toBeNull();
      expect(dureeDeTraversee(KM, mDeCroisiere(navire))).toBe(joursDeLaTraverseeRapide(navire));
    }
    expect(refusDAppareiller(CORACLE_IMMOBILE)).toEqual({ motif: 'immobile' });
    expect(refusDAppareiller(COGUE_SURCHARGEE)).toEqual({ motif: 'cale', ratioPct: 200 });
  });
});
