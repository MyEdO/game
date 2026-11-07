/**
 * LE MARCHÉ EN VUE (#3534) — ce qu'un hôte montre du marché de cargaison qui tient la main, au port (MDG 15) ou à la
 * halle (MSRC 13), par sa formule (`formuleOuverte`) : la bourse du groupe ; chaque offre, son Enc disponible, son prix
 * de base par Enc, la qualité du vin évalué ou son évaluation (`evaluerLeVin`), et son achat (`acheterLaCargaison`) :
 * les porteurs qui le chargent, l'Enc retenu et sa borne, fermé avec sa raison ; chaque porteur de vrac du groupe, sa
 * place libre, et chacun de ses lots, sa vente (`vendreLaCargaison`), son bradage (`jeterLaCargaison`) et son
 * transfert vers un porteur co-localisé (`deplacerLaCargaison`, `planDeTransfert`). Lecteur PUR, lu par les hôtes du
 * noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteFermable } from './actionsDuNoyau';
import { formatMoney, toMoney } from '../engine/money';
import { carrierFreeEnc, findCargoById, type CargoCarrier } from '../engine/cargo';
import { bulkCarriers, planDeTransfert, primaryCargoCarrier } from './carriers';
import { formuleOuverte } from './cargaison';
import { totalDesBourses, refusDeGesteSurLeGroupe } from './bourseFlow';
import { appraiseRefus } from './merchantFlow';
import { fenetreDuJeu } from './combatAuto';

/** Un porteur nommé et sa place : l'Enc libre sur sa Contenance. */
export interface PorteurEnVue { id: string; nom: string; libre: number; capacite: number }

/** L'achat d'une offre : les porteurs qui le chargent, celui retenu d'abord (le premier qui le charge, dans l'ordre
 *  du porteur de défaut, `primaryCargoCarrier`), l'Enc retenu et sa borne, l'estimation avant Marchandage ; son geste
 *  porte le porteur, l'offre et l'Enc retenus. */
export interface AchatEnVue extends GesteFermable { porteurs: PorteurEnVue[]; enc: number; max: number; estimation: string }

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

const prixEnCo = (gold: number) => formatMoney(toMoney({ gold }));

/** Le marché de cargaison qui tient la main (`fenetreDuJeu`) ; `null` : aucun ne la tient. PUR. */
export function marcheEnVue(s: Jeu): MarcheEnVue | null {
  const cle = fenetreDuJeu(s)?.cle;
  const formule = cle === 'port' || cle === 'marcheDeTerre' ? formuleOuverte(s) : null;
  if (!formule) return null;
  const enVue = (c: CargoCarrier): PorteurEnVue => ({ id: c.id, nom: c.label, libre: carrierFreeEnc(c), capacite: c.capacity });
  const chargeurs = formule.porteurs(s);
  const defaut = primaryCargoCarrier(s);
  const porteurs = [...chargeurs.filter((c) => c.id === defaut?.id), ...chargeurs.filter((c) => c.id !== defaut?.id)].map(enVue);
  const refusDEvaluer = refusDeGesteSurLeGroupe(s) ?? appraiseRefus(s.party);
  const tous = bulkCarriers(s);
  return {
    bourse: formatMoney(totalDesBourses(s.party)),
    offres: formule.offres(s).map((o): OffreEnVue => {
      const parPorteur = porteurs.map((p) => ({ p, devis: formule.devis(s, p.id, o.cargoId) }));
      const retenu = parPorteur.find((d) => d.devis.refus === null) ?? parPorteur[0];
      const devis = retenu?.devis ?? formule.devis(s, '', o.cargoId);
      return {
        id: o.cargoId, nom: o.label, dispo: o.enc, prix: prixEnCo(o.basePrice),
        qualite: o.wineTier ? { texte: o.wineTier, fiable: !!o.wineEvalOk } : null,
        evaluer: o.wine && !o.wineTier ? { geste: { verbe: 'evaluerLeVin', args: [o.cargoId] }, refus: refusDEvaluer } : null,
        acheter: {
          geste: { verbe: 'acheterLaCargaison', args: [retenu?.p.id ?? '', o.cargoId, devis.enc] }, refus: devis.refus,
          porteurs: retenu ? [retenu.p, ...porteurs.filter((p) => p !== retenu.p)] : porteurs, enc: devis.enc, max: devis.max, estimation: prixEnCo(devis.estimationGold),
        },
      };
    }),
    cargaison: tous.filter((c) => c.cargo.length > 0).map((c) => ({
      ...enVue(c),
      lots: c.cargo.map((l): LotEnVue => {
        const vente = formule.refusDeVente(s, c.id);
        const plan = planDeTransfert(tous, { fromId: c.id, lotId: l.uid });
        return {
          uid: l.uid, nom: findCargoById(l.cargoId)?.label ?? l.cargoId, enc: l.enc, prix: prixEnCo(l.basePriceGold),
          vendre: { geste: { verbe: 'vendreLaCargaison', args: [l.uid] }, refus: vente },
          brader: { geste: { verbe: 'jeterLaCargaison', args: [l.uid] }, refus: vente ?? formule.refusDeBradage(s, l.cargoId) },
          deplacer: {
            geste: { verbe: 'deplacerLaCargaison', args: [l.uid, plan.to?.id ?? '', plan.enc] }, refus: refusDeGesteSurLeGroupe(s) ?? plan.refus,
            vers: plan.dests.map(enVue), enc: plan.enc, max: plan.maxEnc,
          },
        };
      }),
    })),
  };
}
