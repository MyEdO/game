import type { Settlement } from '../../engine/disponibilite';

/** Archétype de marchand (#2) — 1 fichier `defs/` = 1 entrée du registre généré. */
export interface MerchantArchetypeDef {
  /** Clé unique (référencée par l'entité de scène `merchant.archetype`). */
  id: string;
  type: 'merchants';
  /** Libellé FR (UI). */
  label: string;
  /** Familles vendues : filtre le catalogue par `type` et/ou `subType` de trapping
   *  (« un herboriste ne vend pas d'arquebuses »). */
  category: { categories?: string[]; subTypes?: string[] };
  /** Taille d'agglo par défaut (overridable par l'entité de scène). */
  settlement: Settlement;
  /** Taux de rachat : ½ du prix listé sur un Marchandage de vente GAGNÉ (LDB 59 l.54) ; sinon ¼ (resaleRate/2). */
  resaleRate: number;
  /** Majoration d'achat : multiplie le prix listé à l'ACHAT (1 = prix listé ; >1 = ce marchand vend plus cher,
   *  ex. village isolé/monopole). Défaut 1 si absent. */
  buyMarkup?: number;
  /** Valeur de Marchandage du marchand (opposant au Test, LDB 59 l.43). */
  bargainSkill: number;
  /** Délai de réassort en JOURS (#T3) : le stock est re-tiré (nouvelle Disponibilité) après ce délai
   *  écoulé sur l'horloge ; entre deux, la déplétion persiste. Défaut 1 jour si absent. */
  restockDays?: number;
  /** Articles garantis en stock (`TrappingData.id` EXACTS — matchés par `rollStock`, `engine/disponibilite.ts`,
   *  jamais par libellé), Disponibilité ignorée. */
  curated?: string[];
  /** Réplique de boniment (donnée d'auteur, saveur maison — pas de RAW à sourcer) affichée par le
   *  bandeau d'interlocuteur statique (`SpeakerBanner` variant `boniment`) au-dessus de l'étal. */
  boniment?: string;
  /** CATÉGORIES d'unités vendues (#619 Lot A) — jamais une liste d'ids en dur (doctrine `category` ci-
   *  dessus, même esprit que `fabricationAtouts` DÉRIVÉ de la donnée) : `computeFreshStockLines`
   *  (`state/merchantFlow.ts`) DÉRIVE les membres à chaque catégorie en itérant `creatures`/`vehicles`
   *  (facette `purchase`) — une monture/un véhicule neuf apparaît AUTOMATIQUEMENT, sans toucher ce
   *  fichier. `'bete'` = créatures à `purchase` (montures/bêtes de trait) ; `'vehicule-terrestre'` =
   *  véhicules à `purchase` sans coque (`!ship`). (`'navire'` : achat non géré par `payCart` -> #748.)
   *  Achetée, une unité crée une POSSESSION au lieu d'un objet de sac (`catalogEntryOf`,
   *  `state/merchantFlow.ts`). */
  unitKinds?: Array<'bete' | 'vehicule-terrestre'>;
}
