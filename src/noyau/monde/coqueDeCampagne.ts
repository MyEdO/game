import type { Combatant } from '../../engine/types';
import { findVehicleById } from '../../data';
import type { CampaignVessel } from '../etat';
import type { SceneEntity } from './scene';

export type CombattantDeRencontreOuTrajet = Combatant & {
  /** Identité du navire de campagne représenté par la coque. */
  navireDeCampagneUid?: string;
};

export function estUneCoqueNavale(entite: Pick<SceneEntity, 'vehicule'> | undefined): boolean {
  const ref = entite?.vehicule?.id;
  const fiche = ref ? findVehicleById(ref) : undefined;
  return !!fiche?.ship && !!fiche.hull;
}

/** La coque représente cette instance à partir de sa construction ou de sa désignation dans la rencontre. */
export function lierLaCoqueDeCampagne(coque: CombattantDeRencontreOuTrajet, vessel: CampaignVessel): boolean {
  if (vessel.uid === undefined || coque.creatureId !== vessel.vehicleId) return false;
  coque.navireDeCampagneUid = vessel.uid;
  return true;
}

export function estLeNavireDeCampagne(
  coque: CombattantDeRencontreOuTrajet | null | undefined,
  vessel: Pick<CampaignVessel, 'uid'> | null | undefined,
): boolean {
  return vessel?.uid !== undefined && coque?.navireDeCampagneUid === vessel.uid;
}
