import { EtalLotModal } from './EtalLotModal';
import { nomDuSiege } from '../state/netFlow';
import { useGame } from '../state/store';
import { spectatorSeatOfModal } from './ownership';
import { willAutoResolve } from '../state/combatAuto';
import type { JSX } from 'react';
import { SpectatorChip } from './SpectatorChip';
import { ReloadModal } from './ReloadModal';
import { HandGateModal } from './HandGateModal';
import { StateRecoveryModal } from './StateRecoveryModal';
import { SteamSaveModal } from './SteamSaveModal';
import { RenounceModal } from './RenounceModal';
import { MountTargetModal } from './MountTargetModal';
import { FateSaveModal } from './FateSaveModal';
import { BattementModal } from './BattementModal';
import { DistraireModal } from './DistraireModal';
import { ManeuverModal } from './ManeuverModal';
import { RunModal } from './RunModal';
import { FallModal } from './FallModal';
import { ShipManeuverModal } from './ShipManeuverModal';
import { ShipBatteryModal } from './ShipBatteryModal';
import { CrewTestModal } from './CrewTestModal';
import { ShantyModal } from './ShantyModal';
import { ApproachModal } from './ApproachModal';
import { WardModal } from './WardModal';
import { FocusModal } from './FocusModal';
import { DispelModal } from './DispelModal';
import { FrenzyModal } from './FrenzyModal';
import { AuContactModal } from './AuContactModal';
import { GrappleModal } from './GrappleModal';
import { HealModal } from './HealModal';
import { MedicModal } from './MedicModal';
import { RestModal } from './RestModal';
import { CouncilModal } from './CouncilModal';
// CastModal n'est plus monté ici : la situation d'incantation est une étape `jet:'cast'` de la
// cascade (rendue par `CascadeModal`, qui hôte `CastModal`) — cf. state/modalArbiter (entrée `cast` retirée).
import { CascadeModal } from './CascadeModal';
import { CorruptionModal } from './CorruptionModal';
import { ActivityModal } from './ActivityModal';

// REGISTRE des modales : state/modalArbiter (une entrée = quand + concerné, ordre = priorité).
// Ajouter une modale = 1 entrée au registre + son composant dans COMPONENT ci-dessous.
export { pickActiveModalKey } from '../state/modalArbiter';
import { pickActiveModalKey, voyageHubActive, type ModalKey } from '../state/modalArbiter';

const COMPONENT: Record<ModalKey, () => JSX.Element | null> = {
  etalLot: () => <EtalLotModal />,
  fateSave: FateSaveModal, renounce: RenounceModal,
  battement: BattementModal, distraire: DistraireModal, maneuver: ManeuverModal,
  mountTarget: MountTargetModal, frenzy: FrenzyModal, auContact: AuContactModal, grapple: GrappleModal, approach: ApproachModal, ward: WardModal, run: RunModal, fall: FallModal, shipManeuver: ShipManeuverModal, shipBattery: ShipBatteryModal, crewTest: CrewTestModal, shanty: ShantyModal, focus: FocusModal, dispel: DispelModal,
  medic: MedicModal, rest: RestModal, council: CouncilModal, heal: HealModal, cascade: CascadeModal, reload: ReloadModal, handGate: HandGateModal, stateRecovery: StateRecoveryModal, steamSave: SteamSaveModal,
  corruption: CorruptionModal, activity: ActivityModal,
};

/**
 * Arbitre de modales (R2) : ne monte QUE la modale de combat la plus prioritaire active — au lieu de ~20
 * modales montées côte à côte dont l'empilement dépendait de l'ordre JSX. Les modales HORS combat
 * (Marchand, Document) ne passent pas par l'arbitre (contexte exclusif).
 * EN COOP : la modale ne s'affiche que chez le PROPRIÉTAIRE du combattant concerné ('*' = tous) ;
 * les autres voient la scène + une puce « X joue… ».
 */
export function ActiveModal(): JSX.Element | null {
  const s = useGame();
  const key = pickActiveModalKey(s);
  if (!key) return null;
  // Cascade/nuit de voyage : l'écran-hub (`VoyageScreen`, #333) les héberge EN SON CENTRE (`CascadeBody`/
  // `RestBody embedded`) — pas de modale flottante par-dessus le hub (anti-tunnel). Hors hub, inchangé.
  if ((key === 'cascade' || key === 'rest') && voyageHubActive(s)) return null;
  // Cadence Rapide/Auto : si le driver va auto-résoudre cette modale, NE PAS la rendre (fini le flash
  // de quelques ms). Le BILAN voyage/nuit et les vrais choix (surincantation/Destin en Rapide) restent rendus.
  if (willAutoResolve(s)) return null;
  // La modale ne s'affiche que chez le propriétaire du combattant concerné ; ailleurs, la puce NOMME
  // le siège attendu. Qui la pose est UNE décision (`spectatorSeatOfModal`, `ui/ownership`) que la
  // bande d'attente de la console lit aussi : une seule puce à l'écran.
  const seat = spectatorSeatOfModal(s);
  if (seat !== null) return <SpectatorChip pose="ecran" label={nomDuSiege(s.net, seat)} />;
  const Comp = COMPONENT[key];
  return <Comp />;
}
