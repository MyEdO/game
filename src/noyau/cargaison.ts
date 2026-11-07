/**
 * LE COMMERCE DE CARGAISON (#3371) : un verbe par geste — acheter, vendre, jeter un lot —, dont le marché ouvert
 * donne la formule : le port (MDG 15, `portFlow.ts`) ou la halle (MSRC 13, `landMarketFlow.ts`), le port d'abord comme
 * dans `SURFACES_HORS_PENDING` (`modalArbiter.ts`). Le porteur qui reçoit un achat est désigné ; un lot se désigne par
 * son `uid` (`CargoLot`). La formule dit aussi ce qu'un hôte en lit : les porteurs qui chargent un achat, le devis
 * d'une offre, ce qui ferme la vente et le bradage d'un lot (`marcheEnVue`).
 */
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { IdDeCargaison, IdDePorteurDeCargaison, IdDOffreDeCargaison } from './designations';
import { acheterAuPort, devisDAchatEnPort, jeterAuPort, refusDeBradageEnPort, vendreAuPort } from './portFlow';
import { acheterALaHalle, devisDAchatDeCargaison, jeterALaHalle, raisonDuRefusDAchatDeCargaison, refusDeBradageALaHalle, vendreALaHalle } from './landMarketFlow';
import { bulkCarriers, CAMPAIGN_VESSEL_CARRIER_ID } from './carriers';
import type { CargoCarrier } from '../engine/cargo';
import { refusDeGesteSurLeGroupe } from './bourseFlow';
import { t } from '../i18n';

/** Le devis d'achat d'une offre, avant Marchandage : l'Enc retenu et sa borne, l'estimation en CO, le refus. */
export interface DevisDeCargaison { enc: number; max: number; estimationGold: number; refus: string | null }

/** Les offres, les porteurs et les corps d'une formule de marché. */
export interface FormuleDeMarche {
  offres: (s: Pick<Jeu, 'port' | 'landMarket'>) => readonly { cargoId: string; label: string; enc: number; basePrice: number; wine?: boolean; wineTier?: string; wineEvalOk?: boolean }[];
  /** Les porteurs qui chargent un achat et dont les lots se vendent ici. */
  porteurs: (s: Jeu) => CargoCarrier[];
  devis: (s: Jeu, porteurId: IdDePorteurDeCargaison, cargoId: IdDOffreDeCargaison) => DevisDeCargaison;
  /** Pourquoi le lot du porteur `porteurId` ne se vend ni ne se brade ici (`null` : il se vend). */
  refusDeVente: (s: Jeu, porteurId: string) => string | null;
  refusDeBradage: (s: Jeu, cargoId: string) => string | null;
  acheter: (get: Get, set: Set, porteurId: IdDePorteurDeCargaison, cargoId: IdDOffreDeCargaison, enc: number) => void;
  vendre: (get: Get, set: Set, lotId: IdDeCargaison) => void;
  jeter: (get: Get, set: Set, lotId: IdDeCargaison) => void;
}

/** MDG 15 l.319 : le négoce maritime se fait sur le navire de campagne. */
const PORT: FormuleDeMarche = {
  offres: (s) => s.port?.offers ?? [],
  porteurs: (s) => bulkCarriers(s).filter((c) => c.id === CAMPAIGN_VESSEL_CARRIER_ID),
  devis: (s, porteurId, cargoId) => devisDAchatEnPort(s, porteurId, cargoId),
  refusDeVente: (s, porteurId) => refusDeGesteSurLeGroupe(s) ?? (porteurId === CAMPAIGN_VESSEL_CARRIER_ID ? null : t('port.horsDuNavire')),
  refusDeBradage: refusDeBradageEnPort,
  acheter: acheterAuPort, vendre: vendreAuPort, jeter: jeterAuPort,
};
const HALLE: FormuleDeMarche = {
  offres: (s) => s.landMarket?.offers ?? [],
  porteurs: bulkCarriers,
  devis: (s, porteurId, cargoId) => {
    const d = devisDAchatDeCargaison(s, porteurId, cargoId);
    return { enc: d.enc, max: d.offre?.enc ?? 0, estimationGold: d.estimationGold, refus: d.refus && raisonDuRefusDAchatDeCargaison(d.refus) };
  },
  refusDeVente: refusDeGesteSurLeGroupe,
  refusDeBradage: refusDeBradageALaHalle,
  acheter: acheterALaHalle, vendre: vendreALaHalle, jeter: jeterALaHalle,
};

/** La formule du marché ouvert, `null` sans marché. */
export const formuleOuverte = (s: Pick<Jeu, 'port' | 'landMarket'>): FormuleDeMarche | null => (s.port ? PORT : s.landMarket ? HALLE : null);

/** Les offres du marché ouvert. */
export const offresDeCargaison = (s: Pick<Jeu, 'port' | 'landMarket'>): readonly { cargoId: string; label: string }[] =>
  formuleOuverte(s)?.offres(s) ?? [];

export function creerActionsDeLaCargaison(get: Get, set: Set) {
  return {
    acheterLaCargaison: (porteurId, cargoId, enc) => formuleOuverte(get())?.acheter(get, set, porteurId, cargoId, enc),
    vendreLaCargaison: (lotId) => formuleOuverte(get())?.vendre(get, set, lotId),
    jeterLaCargaison: (lotId) => formuleOuverte(get())?.jeter(get, set, lotId),
  } satisfies FabriqueDuNoyau;
}
