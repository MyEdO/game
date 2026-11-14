/**
 * LE MARCHÉ EN VUE (#3534) — ce qu'un hôte montre du marché de cargaison qui tient la main, au port (MDG 15) ou à la
 * halle (MSRC 13), par la formule de sa fenêtre (`FORMULES_DES_MARCHES`) : la bourse du groupe ; chaque offre, son Enc
 * disponible, son prix de base par Enc, la qualité du vin évalué ou son évaluation (`evaluerLeVin`), et le choix qui en
 * compose l'achat (`fenetreChoisir(fenetre, 'offre', …)`), son estimation ; chaque porteur de vrac du groupe, sa place
 * libre, et chacun de ses lots, sa vente et son bradage (les choix `vendre` et `jeter`) et son transfert vers un porteur
 * co-localisé (`deplacerLaCargaison`, `planDeTransfert`). Le porteur, l'Enc et la conclusion de l'achat en composition
 * sont les réglages de la fenêtre (`OUVERTS_DU_CHOIX`). Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau, GesteFermable } from './actionsDuNoyau';
import { formatMoney, fromBrass, PA_PER_CO } from '../engine/money';
import { carrierFreeEnc, findCargoById, type CargoCarrier } from '../engine/cargo';
import { bulkCarriers, planDeTransfert } from './carriers';
import { FORMULES_DES_MARCHES, achatDeLOffre, devisDeLAchat, type FenetreDuMarche } from './cargaison';
import { totalDesBourses, refusDeGesteSurLeGroupe } from './bourseFlow';
import { refusDEvaluerLeVin } from './landMarketFlow';
import { fenetreDuJeu } from './combatAuto';
import { VERBE_DE_CHOIX, type AxeDe } from './choixDesFenetres';

/** Un porteur nommé et sa place : l'Enc libre sur sa Contenance. */
export interface PorteurEnVue { id: string; nom: string; libre: number; capacite: number }

/** L'achat d'une offre : son geste en compose l'achat (`offre`) ; `compose` : l'achat en composition est le sien ;
 *  l'estimation avant Marchandage de son achat. */
export interface AchatEnVue extends GesteFermable { compose: boolean; estimation: string }

/** Une offre du marché : son nom, son Enc disponible, son prix de base par Enc, la qualité de son vin évalué (`fiable` :
 *  le Test d'Évaluation a réussi), l'évaluation d'un vin qui ne l'est pas, et son achat. */
export interface OffreEnVue {
  id: string; nom: string; dispo: number; prix: string;
  qualite: { texte: string; fiable: boolean } | null;
  evaluer: GesteFermable | null;
  acheter: AchatEnVue;
}

/** Le transfert d'un lot : les porteurs co-localisés qui le reçoivent, l'Enc qui passe au premier et sa borne ; son
 *  geste porte le lot, le premier porteur et cet Enc. */
export interface TransfertEnVue extends GesteFermable { vers: PorteurEnVue[]; enc: number; max: number }

/** Un lot de vrac : son nom, son Enc, son prix de base par Enc, sa vente, son bradage, son transfert. */
export interface LotEnVue { uid: string; nom: string; enc: number; prix: string; vendre: GesteFermable; brader: GesteFermable; deplacer: TransfertEnVue }

/** Le marché ouvert. */
export interface MarcheEnVue { bourse: string; offres: OffreEnVue[]; cargaison: (PorteurEnVue & { lots: LotEnVue[] })[] }

const prixEnCo = (gold: number) => formatMoney(fromBrass(gold * PA_PER_CO));

/** Le choix `axe` du marché `fenetre`, à la valeur `valeur`. */
const choix = (fenetre: FenetreDuMarche, axe: AxeDe<FenetreDuMarche>, valeur: string): GesteDuNoyau => ({ verbe: VERBE_DE_CHOIX, args: [fenetre, axe, valeur] });

/** Le marché de cargaison qui tient la main (`fenetreDuJeu`) ; `null` : aucun ne la tient. PUR. */
export function marcheEnVue(s: Jeu): MarcheEnVue | null {
  const cle = fenetreDuJeu(s)?.cle;
  if (cle !== 'port' && cle !== 'marcheDeTerre') return null;
  const formule = FORMULES_DES_MARCHES[cle];
  const enVue = (c: CargoCarrier): PorteurEnVue => ({ id: c.id, nom: c.label, libre: carrierFreeEnc(c), capacite: c.capacity });
  const compose = formule.brouillon(s)?.offre;
  const tous = bulkCarriers(s);
  return {
    bourse: formatMoney(totalDesBourses(s.party)),
    offres: formule.offres(s).map((o): OffreEnVue => ({
      id: o.cargoId, nom: o.label, dispo: o.enc, prix: prixEnCo(o.basePrice),
      qualite: o.wineTier ? { texte: o.wineTier, fiable: !!o.wineEvalOk } : null,
      evaluer: o.wine && !o.wineTier ? { geste: { verbe: 'evaluerLeVin', args: [o.cargoId] }, refus: refusDEvaluerLeVin(s, o.cargoId) } : null,
      acheter: {
        geste: choix(cle, 'offre', o.cargoId), refus: null, compose: compose === o.cargoId,
        estimation: prixEnCo(devisDeLAchat(s, formule, achatDeLOffre(s, formule, o.cargoId)).estimationGold),
      },
    })),
    cargaison: tous.filter((c) => c.cargo.length > 0).map((c) => ({
      ...enVue(c),
      lots: c.cargo.map((l): LotEnVue => {
        const vente = formule.refusDuPorteur(s, c.id);
        const plan = planDeTransfert(tous, { fromId: c.id, lotId: l.uid });
        return {
          uid: l.uid, nom: findCargoById(l.cargoId)?.label ?? l.cargoId, enc: l.enc, prix: prixEnCo(l.basePriceGold),
          vendre: { geste: choix(cle, 'vendre', l.uid), refus: vente },
          brader: { geste: choix(cle, 'jeter', l.uid), refus: vente ?? formule.refusDeBradage(s, l.cargoId) },
          deplacer: {
            geste: { verbe: 'deplacerLaCargaison', args: [l.uid, plan.to?.id ?? '', plan.enc] }, refus: refusDeGesteSurLeGroupe(s) ?? plan.refus,
            vers: plan.dests.map(enVue), enc: plan.enc, max: plan.maxEnc,
          },
        };
      }),
    })),
  };
}
