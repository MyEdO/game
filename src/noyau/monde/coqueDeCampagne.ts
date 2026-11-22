import type { CombatantAvecMilieuNaval } from '../../engine/vehicle';
import { findVehicleById } from '../../data';
import type { CampaignVessel } from '../etat';
import type { SceneEntity } from './scene';

export type CombattantDeRencontreOuTrajet = CombatantAvecMilieuNaval & {
  /** Identité du navire de campagne représenté par la coque. */
  navireDeCampagneUid?: string;
};

export function estUneCoqueNavale(entite: Pick<SceneEntity, 'vehicule'> | undefined): boolean {
  const ref = entite?.vehicule?.id;
  const fiche = ref ? findVehicleById(ref) : undefined;
  return !!fiche?.ship && !!fiche.hull;
}

/** Identité de campagne que la fiche de cette coque peut recevoir. */
export function uidDeCampagnePourLaCoque(vehiculeId: string | undefined, vessel?: Pick<CampaignVessel, 'uid' | 'vehicleId'> | null): string | undefined {
  return vehiculeId === vessel?.vehicleId ? vessel?.uid : undefined;
}

/** La coque représente cette instance à partir de sa construction ou de sa désignation dans la rencontre. */
export function lierLaCoqueDeCampagne(coque: CombattantDeRencontreOuTrajet, vessel: CampaignVessel): boolean {
  const uid = uidDeCampagnePourLaCoque(coque.creatureId, vessel);
  if (uid === undefined) return false;
  coque.navireDeCampagneUid = uid;
  return true;
}

export function estLeNavireDeCampagne(
  coque: CombattantDeRencontreOuTrajet | null | undefined,
  vessel: Pick<CampaignVessel, 'uid'> | null | undefined,
): boolean {
  return vessel?.uid !== undefined && coque?.navireDeCampagneUid === vessel.uid;
}
