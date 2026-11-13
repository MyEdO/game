/**
 * L'ÉCHOPPE EN VUE (#3534) — ce qu'un hôte montre de l'échoppe qui tient la main : la bourse du groupe ; l'étal rangé
 * par famille (`merchantFamilies`), chaque article à son prix (`prixDeLigne`), sa quantité en stock et son ajout au
 * panier, fermé avec sa raison (`refusDAjout`) ; le panier (`devisDuPanier`), chaque ligne ôtée d'une unité, son total
 * et le paiement (`marchand.payer`) ; les possessions de chaque héros à vendre, leur gain (`sellGain`) et leur refus
 * (`sellRefusal`), puis le lot (`devisDeVente`), son total et la vente (`marchand.vendre`). Lecteur PUR, lu par les hôtes du
 * noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau, GesteFermable } from './actionsDuNoyau';
import { AVAILABILITIES } from '../engine/types';
import { formatMoney } from '../engine/money';
import { isShieldTrapping } from '../engine/items';
import { findTrappingById, merchantFamilies } from '../data/index';
import { catalogEntryOf, contexteDAchat, devisDeVente, devisDuPanier, prixDeLigne, refusDAjout, sellGain, sellRefusal, type MerchantState } from './merchantFlow';
import { totalDesBourses } from './bourseFlow';
import { fenetreDuJeu } from './combatAuto';
import { VERBE_DE_CHOIX, type AxeDe, type ChoixDesFenetres } from './choixDesFenetres';
import { garanti } from '../lib/garanti';
import { nomEnVue } from './visionDuGroupe';
import type { PlayerText } from '../i18n/playerText';

/** Un article de l'étal : son nom, sa quantité en stock, son prix dit (`null` : sans prix), ce que le panier en tient,
 *  et son ajout au panier. */
export interface ArticleEnVue { id: string; nom: string; stock: number; prix: string | null; auPanier: number; ajouter: GesteFermable }

/** Une famille de l'étal et ses articles, du plus courant au plus rare puis par nom. */
export interface FamilleEnVue { id: string; nom: string; articles: ArticleEnVue[] }

/** Une ligne du panier : l'article, sa quantité, son sous-total dit, et le geste qui en ôte une unité. */
export interface LigneDuPanierEnVue { id: string; nom: string; qty: number; sousTotal: string | null; oter: GesteDuNoyau }

/** Une possession d'un héros, vendable à l'échoppe : son gain dit, ce qui l'empêche de se vendre, si elle est au lot, et
 *  le geste qui l'y met ou l'en retire. */
export interface PossessionAVendre { uid: string; nom: string; gain: string; refus: string | null; auLot: boolean; basculer: GesteDuNoyau }

/** Les possessions d'un héros. */
export interface HerosVendeur { id: string; nom: PlayerText; possessions: PossessionAVendre[] }

/** L'échoppe ouverte. */
export interface MarchandEnVue {
  bourse: string;
  etal: FamilleEnVue[];
  panier: { lignes: LigneDuPanierEnVue[]; total: string; payer: GesteFermable };
  vente: { heros: HerosVendeur[]; total: string; vendre: GesteFermable };
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

/** L'étal de l'échoppe `m` : chaque famille qui a un article en stock, dans l'ordre de `merchantFamilies`. */
function etalDe(s: Jeu, m: MerchantState): FamilleEnVue[] {
  const contexte = contexteDAchat(s, m);
  const nom = (id: string) => catalogEntryOf(id)?.label ?? id;
  const lignes = m.stock.filter((l) => l.qty > 0).sort((a, b) => rangDeRarete(a.id) - rangDeRarete(b.id) || nom(a.id).localeCompare(nom(b.id)));
  const article = (l: { id: string; qty: number }): ArticleEnVue => {
    const prix = prixDeLigne(m, l.id, contexte.ent, contexte.party);
    return {
      id: l.id, nom: nom(l.id), stock: l.qty, prix: prix ? formatMoney(prix) : null, auPanier: m.cart.find((c) => c.id === l.id)?.qty ?? 0,
      ajouter: { geste: choix('ajouterAuPanier', l.id), refus: refusDAjout(m, l.id, contexte) },
    };
  };
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
  const vente = devisDeVente(m, s.party);
  const auLot = new Set((m.sellCart ?? []).map((c) => c.uid));
  return {
    bourse: formatMoney(totalDesBourses(s.party)),
    etal: etalDe(s, m),
    panier: {
      lignes: devis.lignes.map((l) => ({ id: l.id, nom: catalogEntryOf(l.id)?.label ?? l.id, qty: l.qty, sousTotal: l.sousTotal ? formatMoney(l.sousTotal) : null, oter: choix('oterDuPanier', l.id) })),
      total: formatMoney(devis.total),
      payer: { geste: choix('payer', true), refus: devis.refus },
    },
    vente: {
      heros: s.party.map((h) => ({
        id: h.id, nom: garanti(nomEnVue(s, h.id), h.id, 'héros vendeur'),
        possessions: (h.items ?? []).map((it) => ({
          uid: it.uid, nom: it.label, gain: formatMoney(sellGain(it, m)), refus: sellRefusal(it), auLot: auLot.has(it.uid),
          basculer: choix(auLot.has(it.uid) ? 'retirerDeLaVente' : 'ajouterALaVente', it.uid),
        })),
      })),
      total: formatMoney(vente.total),
      vendre: { geste: choix('vendre', true), refus: vente.refus },
    },
  };
}
