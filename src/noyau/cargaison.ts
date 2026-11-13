/**
 * LE COMMERCE DE CARGAISON (#3371, #3612) : les choix des deux marchés de cargaison, le port (MDG 15, `portFlow.ts`) et
 * la halle (MSRC 13, `landMarketFlow.ts`), chacun sa fenêtre (`port`, `marcheDeTerre`, `SURFACES_HORS_PENDING` de
 * `modalArbiter.ts`) et sa formule. Un achat se compose en brouillon tenu par le marché (`BrouillonDAchat`) : l'offre,
 * le porteur qui la charge, l'Enc, puis se conclut ; un lot se vend ou se brade par son `uid` (`CargoLot`). La formule
 * dit aussi ce qu'un hôte en lit : les porteurs qui chargent un achat, le devis d'une offre, ce qui ferme la vente et le
 * bradage d'un lot (`marcheEnVue`).
 */
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import type { IdDeCargaison, IdDePorteurDeCargaison, IdDOffreDeCargaison } from './designations';
import type { CorpsDesChoix } from './choixDesFenetres';
import { acheterAuPort, devisDAchatEnPort, jeterAuPort, refusDeBradageEnPort, vendreAuPort } from './portFlow';
import {
  acheterALaHalle,
  devisDAchatDeCargaison,
  jeterALaHalle,
  raisonDuRefusDAchatDeCargaison,
  refusDeBradageALaHalle,
  vendreALaHalle,
} from './landMarketFlow';
import { bulkCarriers, CAMPAIGN_VESSEL_CARRIER_ID, primaryCargoCarrier } from './carriers';
import type { CargoCarrier } from '../engine/cargo';
import { refusDeGesteSurLeGroupe } from './bourseFlow';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';

/** Le devis d'achat d'une offre, avant Marchandage : l'Enc retenu et sa borne, l'estimation en CO, le refus. */
export interface DevisDeCargaison { enc: number; max: number; estimationGold: number; refus: string | null }

/** L'achat en composition au marché ouvert : l'offre, le porteur qui la charge, l'Enc acheté. */
export interface BrouillonDAchat { offre: IdDOffreDeCargaison; porteur: IdDePorteurDeCargaison; enc: number }

/** Les offres, les porteurs, le brouillon d'achat et les corps d'une formule de marché. */
export interface FormuleDeMarche {
  offres: (s: Pick<Jeu, 'port' | 'landMarket'>) => readonly { cargoId: string; label: string; enc: number; basePrice: number; wine?: boolean; wineTier?: string; wineEvalOk?: boolean }[];
  /** Les porteurs qui chargent un achat et dont les lots se vendent ici. */
  porteurs: (s: Jeu) => CargoCarrier[];
  devis: (s: Jeu, porteurId: IdDePorteurDeCargaison, cargoId: IdDOffreDeCargaison, enc?: number) => DevisDeCargaison;
  /** Pourquoi le porteur `porteurId` ne charge pas d'achat ici, et pourquoi ses lots ne s'y vendent ni ne s'y bradent
   *  (`null` : il charge et vend). */
  refusDuPorteur: (s: Jeu, porteurId: string) => string | null;
  refusDeBradage: (s: Jeu, cargoId: string) => string | null;
  /** L'achat en composition ; `undefined` : aucun. */
  brouillon: (s: Pick<Jeu, 'port' | 'landMarket'>) => BrouillonDAchat | undefined;
  /** Pose (ou retire, `undefined`) l'achat en composition. */
  poser: (get: Get, set: Set, achat: BrouillonDAchat | undefined) => void;
  acheter: (get: Get, set: Set, porteurId: IdDePorteurDeCargaison, cargoId: IdDOffreDeCargaison, enc: number) => void;
  vendre: (get: Get, set: Set, lotId: IdDeCargaison) => void;
  jeter: (get: Get, set: Set, lotId: IdDeCargaison) => void;
}

/** L'état `etat` d'un marché, sans son brouillon d'achat, puis avec `achat`. */
const avecLAchat = <E extends { achat?: BrouillonDAchat }>(etat: E, achat: BrouillonDAchat | undefined): E => {
  const { achat: _ancien, ...reste } = etat;
  return (achat ? { ...reste, achat } : reste) as E;
};

/** MDG 15 l.319 : le négoce maritime se fait sur le navire de campagne. */
const PORT: FormuleDeMarche = {
  offres: (s) => s.port?.offers ?? [],
  porteurs: (s) => bulkCarriers(s).filter((c) => c.id === CAMPAIGN_VESSEL_CARRIER_ID),
  devis: (s, porteurId, cargoId, enc) => devisDAchatEnPort(s, porteurId, cargoId, enc),
  refusDuPorteur: (s, porteurId) => refusDeGesteSurLeGroupe(s) ?? (porteurId === CAMPAIGN_VESSEL_CARRIER_ID ? null : t('port.horsDuNavire')),
  refusDeBradage: refusDeBradageEnPort,
  brouillon: (s) => s.port?.achat,
  poser: (get, set, achat) => set({ port: avecLAchat(garanti(get().port, 'port', 'port ouvert'), achat) }),
  acheter: acheterAuPort, vendre: vendreAuPort, jeter: jeterAuPort,
};
const HALLE: FormuleDeMarche = {
  offres: (s) => s.landMarket?.offers ?? [],
  porteurs: bulkCarriers,
  devis: (s, porteurId, cargoId, enc) => {
    const d = devisDAchatDeCargaison(s, porteurId, cargoId, enc);
    return { enc: d.enc, max: d.offre?.enc ?? 0, estimationGold: d.estimationGold, refus: d.refus && raisonDuRefusDAchatDeCargaison(d.refus) };
  },
  refusDuPorteur: refusDeGesteSurLeGroupe,
  refusDeBradage: refusDeBradageALaHalle,
  brouillon: (s) => s.landMarket?.achat,
  poser: (get, set, achat) => set({ landMarket: avecLAchat(garanti(get().landMarket, 'halle', 'halle ouverte'), achat) }),
  acheter: acheterALaHalle, vendre: vendreALaHalle, jeter: jeterALaHalle,
};

/** La formule de chaque fenêtre de marché. */
export const FORMULES_DES_MARCHES = { port: PORT, marcheDeTerre: HALLE } as const satisfies Record<string, FormuleDeMarche>;
/** Une fenêtre de marché de cargaison. */
export type FenetreDuMarche = keyof typeof FORMULES_DES_MARCHES;

/** La formule du marché ouvert, le port d'abord comme dans `SURFACES_HORS_PENDING` ; `null` sans marché. */
const formuleOuverte = (s: Pick<Jeu, 'port' | 'landMarket'>): FormuleDeMarche | null => (s.port ? PORT : s.landMarket ? HALLE : null);

/** Les offres du marché ouvert. */
export const offresDeCargaison = (s: Pick<Jeu, 'port' | 'landMarket'>): readonly { cargoId: string; label: string }[] =>
  formuleOuverte(s)?.offres(s) ?? [];

/** Les porteurs qui chargent un achat au marché `formule`, le porteur de défaut d'abord (`primaryCargoCarrier`). */
export function porteursDeLAchat(s: Jeu, formule: FormuleDeMarche): CargoCarrier[] {
  const chargeurs = formule.porteurs(s);
  const defaut = primaryCargoCarrier(s);
  return [...chargeurs.filter((c) => c.id === defaut?.id), ...chargeurs.filter((c) => c.id !== defaut?.id)];
}

/** L'achat de l'offre `cargoId` au marché `formule` : le brouillon s'il la compose, sinon son achat de défaut, sur le
 *  premier porteur qui la charge (`porteursDeLAchat`, à défaut le premier) et l'Enc que son devis retient. */
export function achatDeLOffre(s: Jeu, formule: FormuleDeMarche, cargoId: IdDOffreDeCargaison): BrouillonDAchat {
  const brouillon = formule.brouillon(s);
  if (brouillon?.offre === cargoId) return brouillon;
  const porteurs = porteursDeLAchat(s, formule);
  const porteur = (porteurs.find((p) => formule.devis(s, p.id, cargoId).refus === null) ?? porteurs[0])?.id ?? '';
  return { offre: cargoId, porteur, enc: formule.devis(s, porteur, cargoId).enc };
}

/** Le devis de l'achat `achat` au marché `formule`. */
export const devisDeLAchat = (s: Jeu, formule: FormuleDeMarche, achat: BrouillonDAchat): DevisDeCargaison => formule.devis(s, achat.porteur, achat.offre, achat.enc);

/** Les choix de chaque marché : l'offre, le porteur et l'Enc de l'achat en composition, sa conclusion, la vente et le
 *  bradage d'un lot. */
export function choixDesMarches(get: Get, set: Set) {
  const choixDu = (fenetre: FenetreDuMarche) => {
    const f = FORMULES_DES_MARCHES[fenetre];
    const brouillon = () => garanti(f.brouillon(get()), fenetre, 'achat en composition');
    return {
      offre: (cargoId: IdDOffreDeCargaison) => f.poser(get, set, achatDeLOffre(get(), f, cargoId)),
      porteur: (porteur: IdDePorteurDeCargaison) => f.poser(get, set, { ...brouillon(), porteur, enc: f.devis(get(), porteur, brouillon().offre).enc }),
      encombrement: (enc: number) => f.poser(get, set, { ...brouillon(), enc }),
      acheter: () => {
        const achat = brouillon();
        f.poser(get, set, undefined);
        f.acheter(get, set, achat.porteur, achat.offre, achat.enc);
      },
      vendre: (lotId: IdDeCargaison) => f.vendre(get, set, lotId),
      jeter: (lotId: IdDeCargaison) => f.jeter(get, set, lotId),
    };
  };
  return { port: choixDu('port'), marcheDeTerre: choixDu('marcheDeTerre') } satisfies Partial<CorpsDesChoix>;
}
