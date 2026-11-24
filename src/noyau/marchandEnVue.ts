/**
 * L'ÉCHOPPE EN VUE (#3534, #4574) — ce qu'un hôte montre de l'échoppe qui tient la main : la bourse du groupe ; l'étal rangé
 * par famille (`merchantFamilies`), chaque article à son prix (`prixDeLigne`), sa quantité en stock et son ajout au
 * panier ou recours de Guilde (`lignesDAchat`) ; le panier (`devisDuPanier`), chaque ligne ôtée d'une unité, son total
 * et le paiement (`marchand.payer`) ; les possessions de chaque héros à vendre, leur gain (`sellGain`) et leur refus
 * (`sellRefusal`), puis le lot (`devisDeVente`), son total et la vente (`marchand.vendre`). Prix en `Money`, ids du
 * marchand et des objets. Lecteur PUR, lu par la projection des hôtes (`hote/projection.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau, GesteFermable } from './actionsDuNoyau';
import { AVAILABILITIES } from '../engine/types';
import type { Money } from '../engine/money';
import { isShieldTrapping } from '../engine/items';
import { findTrappingById, merchantFamilies } from '../data/index';
import {
  catalogEntryOf,
  contexteDAchat,
  devisDeVente,
  devisDuPanier,
  lignesDAchat,
  sellGain,
  sellRefusal,
  type MerchantState,
} from './merchantFlow';
import { totalDesBourses } from './bourseFlow';
import { fenetreDuJeu } from './combatAuto';
import { VERBE_DE_CHOIX, type AxeDe, type ChoixDesFenetres } from './choixDesFenetres';
import { garanti } from '../lib/garanti';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { nomEnVue } from './visionDuGroupe';
import type { PlayerText } from '../i18n/playerText';

/** Un article de l'étal : son nom, sa quantité en stock, son prix unitaire (`null` : sans prix), ce que le panier en
 *  tient, et son ajout au panier. */
export interface ArticleEnVue { id: string; nom: string; stock: number; prix: Money | null; auPanier: number; recoursDeGuilde: boolean; ajouter: GesteFermable }

/** Une famille de l'étal et ses articles, du plus courant au plus rare puis par nom. */
export interface FamilleEnVue { id: string; nom: string; articles: ArticleEnVue[] }

/** Une ligne du panier : l'article, sa quantité, son prix unitaire et son sous-total (`null` : sans prix), et le geste
 *  qui en ôte une unité. */
export interface LigneDuPanierEnVue { id: string; nom: string; qty: number; unitaire: Money | null; sousTotal: Money | null; oter: GesteDuNoyau }

/** Une possession d'un héros, vendable à l'échoppe : son uid, l'id du trapping dont elle dérive (`null` : objet custom),
 *  son gain, ce qui l'empêche de se vendre, si elle est au lot, et le geste qui l'y met ou l'en retire. */
export interface PossessionAVendre { uid: string; objet: string | null; nom: string; gain: Money; refus: string | null; auLot: boolean; basculer: GesteDuNoyau }

/** Les possessions d'un héros. */
export interface HerosVendeur { id: string; nom: PlayerText; possessions: PossessionAVendre[] }

/** L'échoppe ouverte : l'id d'entité du marchand, la bourse du groupe, l'étal, le panier et la vente. */
export interface MarchandEnVue {
  marchand: string;
  bourse: Money;
  etal: FamilleEnVue[];
  panier: { lignes: LigneDuPanierEnVue[]; total: Money; payer: GesteFermable };
  vente: { heros: HerosVendeur[]; total: Money; vendre: GesteFermable };
}

/** Le choix `axe` de l'échoppe à la valeur `valeur`. */
const choix = <A extends AxeDe<'marchand'>>(axe: A, valeur: ChoixDesFenetres['marchand'][A]): GesteDuNoyau => ({ verbe: VERBE_DE_CHOIX, args: ['marchand', axe, valeur] });

/** Le rang de rareté de l'article `id` : l'indice de sa Disponibilité dans le canon ordonné, après le dernier palier
 *  hors canon. */
export function rangDeRarete(id: string): number {
  const i = (AVAILABILITIES as readonly string[]).indexOf(catalogEntryOf(id)?.availability ?? '');
  return i < 0 ? AVAILABILITIES.length : i;
}

const FAMILLE_DES_UNITES = merchantFamilies.find((f) => f.match.unit)?.id;
const FAMILLE_DES_BOUCLIERS = merchantFamilies.find((f) => f.match.shield)?.id;
const FAMILLE_PAR_DEFAUT = garanti(merchantFamilies.find((f) => !f.match.categorie && !f.match.shield && !f.match.unit), 'divers', 'famille par défaut de l’étal').id;
const FAMILLE_PAR_CATEGORIE = new Map(merchantFamilies.flatMap((f) => (f.match.categorie ? [[f.match.categorie, f.id] as const] : [])));

/** La famille de l'article `id` : une unité (`catalogEntryOf`), puis un bouclier, puis la catégorie de l'objet,
 *  sinon la famille par défaut. */
export function familleDeLArticle(id: string): string {
  if (catalogEntryOf(id)?.unit) return FAMILLE_DES_UNITES ?? FAMILLE_PAR_DEFAUT;
  const objet = findTrappingById(id);
  if (!objet) return FAMILLE_PAR_DEFAUT;
  if (isShieldTrapping(id)) return FAMILLE_DES_BOUCLIERS ?? FAMILLE_PAR_DEFAUT;
  return FAMILLE_PAR_CATEGORIE.get(objet.categorie) ?? FAMILLE_PAR_DEFAUT;
}

/** L'étal de l'échoppe `m`, dans l'ordre de `merchantFamilies`. */
function etalDe(s: Jeu, m: MerchantState): FamilleEnVue[] {
  const lignes = lignesDAchat(s, m)
    .filter((l) => l.qty > 0 || l.demandeALaGuilde)
    .sort((a, b) => rangDeRarete(a.id) - rangDeRarete(b.id) || a.nom.localeCompare(b.nom));
  const article = (l: (typeof lignes)[number]): ArticleEnVue => ({
    id: l.id,
    nom: l.nom,
    stock: l.qty,
    prix: l.prix,
    auPanier: l.auPanier,
    recoursDeGuilde: !!l.demandeALaGuilde,
    ajouter: { geste: choix('ajouterAuPanier', l.id), refus: l.refus },
  });
  return merchantFamilies.flatMap((f): FamilleEnVue[] => {
    const siens = lignes.filter((l) => familleDeLArticle(l.id) === f.id);
    return siens.length ? [{ id: f.id, nom: f.label, articles: siens.map(article) }] : [];
  });
}

/** L'échoppe qui tient la main (`fenetreDuJeu`) ; `null` : elle ne tient pas la main. PUR. */
export function marchandEnVue(s: Jeu): MarchandEnVue | null {
  const m = fenetreDuJeu(s)?.cle === 'marchand' ? s.merchant : null;
  if (!m) return null;
  const devis = devisDuPanier(m, contexteDAchat(s, m));
  const resolveTrapping = objetDuNarratif(s.campaignNarratif);
  const vente = devisDeVente(m, s.party, resolveTrapping);
  const auLot = new Set((m.sellCart ?? []).map((c) => c.uid));
  return {
    marchand: m.entityId,
    bourse: totalDesBourses(s.party),
    etal: etalDe(s, m),
    panier: {
      lignes: devis.lignes.map((l) => ({ id: l.id, nom: catalogEntryOf(l.id)?.label ?? l.id, qty: l.qty, unitaire: l.unitaire, sousTotal: l.sousTotal, oter: choix('oterDuPanier', l.id) })),
      total: devis.total,
      payer: { geste: choix('payer', true), refus: devis.refus },
    },
    vente: {
      heros: s.party.map((h) => ({
        id: h.id, nom: garanti(nomEnVue(s, h.id), h.id, 'héros vendeur'),
        possessions: (h.items ?? []).map((it) => ({
          uid: it.uid, objet: it.trappingId ?? null, nom: it.label, gain: sellGain(it, m, resolveTrapping), refus: sellRefusal(it, resolveTrapping), auLot: auLot.has(it.uid),
          basculer: choix(auLot.has(it.uid) ? 'retirerDeLaVente' : 'ajouterALaVente', it.uid),
        })),
      })),
      total: vente.total,
      vendre: { geste: choix('vendre', true), refus: vente.refus },
    },
  };
}
