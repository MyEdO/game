/**
 * Lecteurs de la coque d'un `Combatant` : véhicule, navire, profil naval et taille.
 */
import type { Combatant, VehicleData } from './types';
import type { MilieuDeNavigation } from './shipBuild';
import type { CombatantAvecMilieuNaval } from './vehicle';
import { findVehicleById, shipConstruction, type ShipSize } from '../data';
import { memoParVersion } from '../data/versionDataset';
import { findTableEntryIndex, tableOuverte } from './tables';

export type CoqueAvecContexteNaval = Pick<CombatantAvecMilieuNaval, 'creatureId' | 'milieuNaval'>;
export type ContexteDeTrajetNaval = { river?: unknown; sea?: unknown } | null;

/** MSRC 07 l.48–58, l.172–178 ; MDG 13 l.571–582. */
export function milieuNavalDeclare(coque: CoqueAvecContexteNaval, trajet?: ContexteDeTrajetNaval): MilieuDeNavigation | undefined {
  if (trajet?.river) return 'fluvial';
  if (trajet?.sea) return 'maritime';
  return coque.milieuNaval;
}

/** MSRC 07 l.172–178 ; MDG 12 l.85–91. */
export function milieuDeLaCoque(coque: CoqueAvecContexteNaval, trajet?: ContexteDeTrajetNaval): MilieuDeNavigation {
  const declare = milieuNavalDeclare(coque, trajet);
  if (declare) return declare;
  return findVehicleById(coque.creatureId ?? '')?.hull?.propulsion === 'fluvial' ? 'fluvial' : 'maritime';
}

/** Ce combattant est-il un VÉHICULE-coque (navire, chariot, barge) — `bodyShape:'vehicule'` ? Un véhicule agit en
 *  UNITÉ (Tests d'équipage) ; il n'a ni arme tenue, ni sort, ni marche de fantassin. */
export function isVehicle(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'vehicule';
}

/** La coque `vehiculeId` (`vehicles.json`) est-elle terrestre (`hull.propulsion`) ? EDOC 07 l.184. */
export const estCoqueTerrestre = (vehiculeId: string | undefined): boolean =>
  findVehicleById(vehiculeId ?? '')?.hull?.propulsion === 'terrestre';

/** Profil NAVAL (facette `ship`, MDG 12) de ce combattant-coque ; `undefined` = une coque qui n'est PAS
 *  un navire (véhicule routier, EDOC 07 l.184). */
export function profilNavalDe(c: Pick<Combatant, 'bodyShape' | 'creatureId'>): NonNullable<VehicleData['ship']> | undefined {
  return isVehicle(c) ? findVehicleById(c.creatureId ?? '')?.ship : undefined;
}

/** Ce combattant est-il un NAVIRE (coque à profil naval, `profilNavalDe`) ? */
export function estNavire(c: Pick<Combatant, 'bodyShape' | 'creatureId'>): boolean {
  return profilNavalDe(c) !== undefined;
}

/** MDG 12 l.122-129 */
const standardLookup = memoParVersion('shipHullSizes', () =>
  tableOuverte(shipConstruction.standard.map((row) => ({ ...row.lengthM, size: row.size }))).sort((a, b) => a.min - b.min),
);

/** MDG 12 l.122-129 */
export function shipSizeOfLength(lengthM: number): ShipSize {
  const lookup = standardLookup();
  const i = findTableEntryIndex(lookup, lengthM);
  if (i < 0) {
    throw new Error(
      `shipSizeOfLength : la longueur ${lengthM} m ne tombe dans aucune bande de la colonne « Taille » (MDG 12 l.122-129) — le tableau couvre les longueurs ENTIÈRES à partir de 1 m, sans plafond.`,
    );
  }
  return lookup[i].size;
}

/** MDG 12 l.120-129 */
export function hullShipSize(hull: Pick<Combatant, 'bodyShape' | 'creatureId'>): ShipSize | undefined {
  const lengthM = profilNavalDe(hull)?.lengthM;
  return lengthM === undefined ? undefined : shipSizeOfLength(lengthM);
}
