/**
 * Lecteurs de la COQUE d'un `Combatant` : véhicule, navire, profil naval — module FEUILLE (aucun import
 * du moteur hors types), lu par `vehicle.ts`, `structures.ts`, `conditions.ts` et les flux.
 */
import type { Combatant, VehicleData } from './types';
import { findVehicleById } from '../data';

/** Ce combattant est-il un VÉHICULE-coque (navire, chariot, barge) — `bodyShape:'vehicule'` ? Un véhicule agit en
 *  UNITÉ (Tests d'équipage) ; il n'a ni arme tenue, ni sort, ni marche de fantassin. */
export function isVehicle(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'vehicule';
}

/** Profil NAVAL (facette `ship`, MDG 12) de ce combattant-coque ; `undefined` = une coque qui n'est PAS
 *  un navire (véhicule routier, EDOC 07 l.184). */
export function profilNavalDe(c: Pick<Combatant, 'bodyShape' | 'creatureId'>): NonNullable<VehicleData['ship']> | undefined {
  return isVehicle(c) ? findVehicleById(c.creatureId ?? '')?.ship : undefined;
}

/** Ce combattant est-il un NAVIRE (coque à profil naval, `profilNavalDe`) ? */
export function estNavire(c: Pick<Combatant, 'bodyShape' | 'creatureId'>): boolean {
  return profilNavalDe(c) !== undefined;
}
