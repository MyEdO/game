/**
 * L'INTERLUDE EN VUE (#3328) — ce qu'un hôte montre de l'interlude ouvert (« Entre deux aventures », LDB 22-23) : chaque
 * héros, ses Activités restantes et l'Événement de sa période, puis l'Activité qu'il compose, chacun de ses choix écrit
 * en choix de la fenêtre (`fenetreChoisir('interlude', …)`, `OUVERTS_DU_CHOIX`) et la pratique qui la conclut ; ses
 * Activités jouées par leur verbe (Commande, Faveurs dues, préparation de bataille), une par cible, fermées par le
 * verdict que leur verbe applique (`verdictsDInterlude.ts`) ; son dépôt en banque, en formulaire. Puis les dépôts en
 * banque et leur retrait. Lecteur PUR de données : coûts, bourses et montants en nombres et en `Money`, que l'hôte
 * compose (`Projection.interlude`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import { bankPayout, orderCatalog, type GenreDeDepot } from '../engine/activities';
import { bourseOf } from '../engine/bourse';
import { formatMoney, fromBrass, PA_PER_SC, toBrass, type Money } from '../engine/money';
import { interludeEventFor } from '../data/interludeEvents';
import { interludeCatalog, type BankDeposit } from './interludeFlow';
import { refusDePrepaDeBataille } from './massBattleFlow';
import {
  devisDeDepot, refusDAcquitterUneFaveur, refusDActivite, refusDeCommande, refusDeRetrait,
} from './verdictsDInterlude';
import { COUTS_DE_L_INTERLUDE, reglageDuChoixDeFenetre, type CoutDeLaValeur } from './choixDeFenetre';
import { CHOIX_DES_FENETRES, VERBE_DE_CHOIX, type AxeDe } from './choixDesFenetres';
import { fenetreDuJeu } from './combatAuto';
import { libelleDuChoix } from './libelles';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';
import { nomEnVue } from './visionDuGroupe';
import type { PlayerText } from '../i18n/playerText';

/** Un geste d'interlude : son nom, ce qu'il coûte (`null` : rien), le verbe qui le joue, et pourquoi il ne se joue pas
 *  maintenant (`null` s'il se joue). */
export interface GesteDInterlude { libelle: string; cout: CoutDeLaValeur | null; geste: GesteDuNoyau; refus: string | null }

/** Une Activité jouée par son verbe : son nom, ce qui la ferme toute (`refus`), et ses gestes, un seul sans cible, un par
 *  cible sinon (`cible` : elle en vise une). */
export interface ActiviteEnVue { id: string; libelle: string; refus: string | null; cible: boolean; gestes: GesteDInterlude[] }

/** Un choix de l'Activité que compose un héros : son axe, son nom, puis chaque valeur qu'il ouvre, ce qu'elle coûte
 *  (`null` : rien), le geste qui la prend, ce qui la ferme, et si c'est la sienne. */
export interface ChoixDInterlude {
  axe: AxeDe<'interlude'>; libelle: string;
  valeurs: { libelle: string; cout: CoutDeLaValeur | null; geste: GesteDuNoyau; refus: string | null; choisie: boolean }[];
}

/** Un dépôt en banque à faire : son verbe et le héros qu'il pose, ce qui le ferme, chaque genre de dépôt fermé par sa
 *  raison, et le montant que la bourse couvre au plus, en sous de cuivre, par pas d'une pistole. */
export interface DepotAFaire { geste: GesteDuNoyau; refus: string | null; genres: { valeur: GenreDeDepot; refus: string | null }[]; max: number; pas: number }

/** Un dépôt en banque : son héros, son genre, son montant, ce que rend un investissement et à quel Indice (`null` hors
 *  d'un investissement), le verbe qui le retire et ce qui ferme ce retrait. */
export interface DepotEnVue {
  uid: string; heros: { id: string; nom: PlayerText }; genre: GenreDeDepot; montant: Money;
  investissement: { indice: number; rendu: Money } | null; geste: GesteDuNoyau; refus: string | null;
}

/** Un héros de l'interlude : ses Activités restantes sur celles qu'il a reçues, ses PX et sa bourse, l'Événement de sa
 *  période (`null` tant que son dé n'est pas tombé), les choix de l'Activité qu'il compose et sa pratique (`null` : il
 *  n'en compose aucune), ses Activités jouées par leur verbe, et son dépôt en banque. */
export interface HerosDInterlude {
  id: string; nom: PlayerText; restantes: number; recues: number; px: number; bourse: Money; evenement: { id: string; nom: string } | null;
  composition: ChoixDInterlude[]; pratiquer: GesteDInterlude | null; activites: ActiviteEnVue[]; depot: DepotAFaire;
}

/** L'interlude ouvert : sa durée en semaines, ses héros, ses dépôts en banque. */
export interface InterludeEnVue { semaines: number; heros: HerosDInterlude[]; depots: DepotEnVue[] }

type Etat = Pick<Jeu, 'interlude' | 'party' | 'bank' | 'lieu' | 'massBattle' | 'favors'>;

/** Le choix `axe` de l'Activité que compose `h`, parmi ce que l'interlude lui ouvre (`OUVERTS_DU_CHOIX`). */
function choix(s: Jeu, h: Combatant, axe: AxeDe<'interlude'>): ChoixDInterlude {
  const r = reglageDuChoixDeFenetre(s, 'interlude', axe, h.id);
  const couts = COUTS_DE_L_INTERLUDE[axe]?.(s, h.id);
  return {
    axe, libelle: libelleDuChoix('interlude', axe),
    valeurs: (r.valeurs ?? []).map((v) => ({
      libelle: v.libelle, cout: couts?.get(String(v.valeur)) ?? null, geste: { verbe: VERBE_DE_CHOIX, args: ['interlude', axe, v.valeur, h.id] }, refus: v.refus, choisie: v.valeur === r.courant,
    })),
  };
}

/** Les axes qui composent une Activité, hors de sa pratique. */
const AXES_DE_COMPOSITION = (Object.keys(CHOIX_DES_FENETRES.interlude) as AxeDe<'interlude'>[]).filter((axe) => axe !== 'pratiquer');

/** Les choix ouverts de l'Activité que compose `h`, et sa pratique. LDB 23 l.5 */
function compositionDuHeros(s: Jeu, h: Combatant): Pick<HerosDInterlude, 'composition' | 'pratiquer'> {
  const [pratique] = choix(s, h, 'pratiquer').valeurs;
  return {
    composition: AXES_DE_COMPOSITION.map((axe) => choix(s, h, axe)).filter((c) => c.valeurs.length > 0),
    pratiquer: pratique ? { libelle: pratique.libelle, cout: null, geste: pratique.geste, refus: pratique.refus } : null,
  };
}

/** Les Activités de `h` que joue leur verbe : Commande, Faveurs dues, puis la préparation de bataille de ce lieu. */
function activitesDuHeros(s: Etat, h: Combatant): ActiviteEnVue[] {
  const ferme = refusDActivite(s, h.id);
  const parCible = (id: string, libelle: string, gestes: GesteDInterlude[]): ActiviteEnVue => ({ id, libelle, refus: gestes.length ? ferme : ferme ?? t('interlude.sansCible'), cible: true, gestes });
  const favors = (s.favors ?? []).filter((f) => f.heroId === h.id);
  return [
    parCible('order', t('interlude.commande'), orderCatalog().map((o) => ({
      libelle: o.label, cout: { prix: fromBrass(o.priceBrass) }, geste: { verbe: 'commanderLObjet', args: [h.id, o.id] }, refus: refusDeCommande(s, h.id, o.id),
    }))),
    ...(favors.length ? [parCible('faveur', t('interlude.faveur'), favors.map((f) => ({
      libelle: f.owedTo, cout: null, geste: { verbe: 'solderLaFaveur', args: [h.id, f.id] }, refus: refusDAcquitterUneFaveur(s, h.id, f.id),
    })))] : []),
    ...interludeCatalog(s).filter((d) => d.contexts.includes('bataille')).map((def): ActiviteEnVue => {
      const refus = ferme ?? refusDePrepaDeBataille(garanti(s.massBattle, def.id, 'bataille à préparer'), h, def);
      return { id: def.id, libelle: def.label, refus, cible: false, gestes: [{ libelle: def.label, cout: null, geste: { verbe: 'menerLActionDeBataille', args: [h.id, def.id] }, refus }] };
    }),
  ];
}

/** Les genres d'un dépôt en banque. LDB 23 l.164-170, ACE 12 l.45-49 */
const GENRES_DE_DEPOT: readonly GenreDeDepot[] = ['investir', 'planque', 'mecenat'];

/** Le dépôt en banque de `h` : chaque genre fermé par son devis au plus que la bourse couvre (`devisDeDepot`), le
 *  dépôt fermé par le devis d'une planque, qui ne porte que les refus communs. LDB 23 l.164-170 */
function depotDuHeros(s: Etat, h: Combatant): DepotAFaire {
  const max = Math.floor(toBrass(bourseOf(h)) / PA_PER_SC) * PA_PER_SC;
  return {
    geste: { verbe: 'deposerALaBanque', args: [h.id] },
    refus: devisDeDepot(s, h.id, 'planque', max).refus,
    genres: GENRES_DE_DEPOT.map((g) => ({ valeur: g, refus: devisDeDepot(s, h.id, g, max).refus })),
    max, pas: PA_PER_SC,
  };
}

/** Le dépôt `d` en vue : son héros nommé (`nomEnVue`), son montant, ce que rend un investissement. LDB 23 l.157-159 */
export function depotEnVue(s: Jeu, d: BankDeposit): DepotEnVue {
  return {
    uid: d.uid, heros: { id: d.heroId, nom: garanti(nomEnVue(s, d.heroId), d.heroId, 'héros du dépôt') }, genre: d.kind, montant: fromBrass(d.brass),
    investissement: d.kind === 'investir' ? { indice: d.rate, rendu: fromBrass(bankPayout('investir', d.brass, d.rate)) } : null,
    geste: { verbe: 'retirerDeLaBanque', args: [d.uid] }, refus: refusDeRetrait(s, d.uid),
  };
}

/** Le libellé d'un dépôt : son héros, son genre et son montant, et ce que rend un investissement. */
export function libelleDuDepot(d: DepotEnVue): string {
  const heros = d.heros.nom;
  const montant = formatMoney(d.montant);
  return d.investissement
    ? t('interlude.depot.investir', { heros, montant, rendu: formatMoney(d.investissement.rendu), indice: d.investissement.indice })
    : t(`interlude.depot.${d.genre}`, { heros, montant });
}

/** L'Événement de la période que tire le dé `jet`. LDB 22 l.5 */
const evenementDe = (jet: number): { id: string; nom: string } => {
  const e = interludeEventFor(jet);
  return { id: e.id, nom: e.label };
};

/** L'interlude qui tient la main (`fenetreDuJeu`) ; `null` hors interlude, ou quand une autre fenêtre tient la main (le
 *  jet d'une Activité). PUR. */
export function interludeEnVue(s: Jeu): InterludeEnVue | null {
  const itl = s.interlude;
  if (!itl || fenetreDuJeu(s)?.cle !== 'interlude') return null;
  return {
    semaines: itl.weeks,
    heros: s.party.filter((h) => !h.dead && itl.perHero[h.id]).map((h) => {
      const st = itl.perHero[h.id];
      return {
        id: h.id, nom: garanti(nomEnVue(s, h.id), h.id, 'héros de l’interlude'), restantes: st.left, recues: st.granted, px: h.xp ?? 0, bourse: bourseOf(h), evenement: st.eventRoll == null ? null : evenementDe(st.eventRoll),
        ...compositionDuHeros(s, h), activites: activitesDuHeros(s, h), depot: depotDuHeros(s, h),
      };
    }),
    depots: (s.bank ?? []).map((d) => depotEnVue(s, d)),
  };
}
