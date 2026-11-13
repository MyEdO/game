/**
 * L'INTERLUDE EN VUE (#3328) — ce qu'un hôte montre de l'interlude ouvert (« Entre deux aventures », LDB 22-23) : chaque
 * héros, ses Activités restantes et l'Événement de sa période, puis l'Activité qu'il compose, chacun de ses choix écrit
 * en choix de la fenêtre (`fenetreChoisir('interlude', …)`, `OUVERTS_DU_CHOIX`) et la pratique qui la conclut ; ses
 * Activités jouées par leur verbe (Commande, Faveurs dues, préparation de bataille), une par cible, fermées par le
 * verdict que leur verbe applique (`verdictsDInterlude.ts`) ; son dépôt en banque, en formulaire. Puis les dépôts en
 * banque et leur retrait. Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import { bankPayout, orderCatalog, type GenreDeDepot } from '../engine/activities';
import { bourseOf } from '../engine/bourse';
import { formatMoney, fromBrass, PA_PER_SC, toBrass } from '../engine/money';
import { interludeCatalog } from './interludeFlow';
import { refusDePrepaDeBataille } from './massBattleFlow';
import {
  devisDeDepot, eventLabelOf, refusDAcquitterUneFaveur, refusDActivite, refusDeCommande, refusDeRetrait,
} from './verdictsDInterlude';
import { auPrix, reglageDuChoixDeFenetre } from './choixDeFenetre';
import { CHOIX_DES_FENETRES, VERBE_DE_CHOIX, type AxeDe } from './choixDesFenetres';
import { fenetreDuJeu } from './combatAuto';
import { libelleDuChoix } from './libelles';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';
import { nomEnVue } from './visionDuGroupe';

/** Un geste d'interlude : son nom, le verbe qui le joue, et pourquoi il ne se joue pas maintenant (`null` s'il se joue). */
export interface GesteDInterlude { libelle: string; geste: GesteDuNoyau; refus: string | null }

/** Une Activité jouée par son verbe : son nom, ce qui la ferme toute (`refus`), et ses gestes, un seul sans cible, un par
 *  cible sinon (`cible` : elle en vise une). */
export interface ActiviteEnVue { id: string; libelle: string; refus: string | null; cible: boolean; gestes: GesteDInterlude[] }

/** Un choix de l'Activité que compose un héros : son axe, son nom, puis chaque valeur qu'il ouvre, le geste qui la prend,
 *  ce qui la ferme, et si c'est la sienne. */
export interface ChoixDInterlude {
  axe: AxeDe<'interlude'>; libelle: string;
  valeurs: { libelle: string; geste: GesteDuNoyau; refus: string | null; choisie: boolean }[];
}

/** Une valeur qu'un formulaire d'interlude offre : ce qu'elle dit, ce qu'elle vaut, pourquoi elle est refusée. */
export interface ValeurDInterlude { libelle: string; valeur: string; refus: string | null }

/** Un dépôt en banque : son verbe et le héros qu'il pose, ce qui le ferme, chaque genre de dépôt fermé par sa raison,
 *  et le montant que la bourse couvre au plus, en sous de cuivre, par pas d'une pistole. */
export interface DepotAFaire { geste: GesteDuNoyau; refus: string | null; genres: ValeurDInterlude[]; max: number; pas: number }

/** Un héros de l'interlude : ses Activités restantes sur celles qu'il a reçues, ses PX et sa bourse, que coûtent ses
 *  cibles, l'Événement de sa période (`null` tant que son dé n'est pas tombé), les choix de l'Activité qu'il compose et
 *  sa pratique (`null` : il n'en compose aucune), ses Activités jouées par leur verbe, et son dépôt en banque. */
export interface HerosDInterlude {
  id: string; nom: string; restantes: number; recues: number; px: number; bourse: string; evenement: string | null;
  composition: ChoixDInterlude[]; pratiquer: GesteDInterlude | null; activites: ActiviteEnVue[]; depot: DepotAFaire;
}

/** L'interlude ouvert : sa durée en semaines, ses héros, ses dépôts en banque. */
export interface InterludeEnVue { semaines: number; heros: HerosDInterlude[]; depots: GesteDInterlude[] }

type Etat = Pick<Jeu, 'interlude' | 'party' | 'bank' | 'lieu' | 'massBattle' | 'favors'>;

/** Le choix `axe` de l'Activité que compose `h`, parmi ce que l'interlude lui ouvre (`OUVERTS_DU_CHOIX`). */
function choix(s: Jeu, h: Combatant, axe: AxeDe<'interlude'>): ChoixDInterlude {
  const r = reglageDuChoixDeFenetre(s, 'interlude', axe, h.id);
  return {
    axe, libelle: libelleDuChoix('interlude', axe),
    valeurs: (r.valeurs ?? []).map((v) => ({ libelle: v.libelle, geste: { verbe: VERBE_DE_CHOIX, args: ['interlude', axe, v.valeur, h.id] }, refus: v.refus, choisie: v.valeur === r.courant })),
  };
}

/** Les axes qui composent une Activité, hors de sa pratique. */
const AXES_DE_COMPOSITION = (Object.keys(CHOIX_DES_FENETRES.interlude) as AxeDe<'interlude'>[]).filter((axe) => axe !== 'pratiquer');

/** Les choix ouverts de l'Activité que compose `h`, et sa pratique. LDB 23 l.5 */
function compositionDuHeros(s: Jeu, h: Combatant): Pick<HerosDInterlude, 'composition' | 'pratiquer'> {
  const [pratique] = choix(s, h, 'pratiquer').valeurs;
  return {
    composition: AXES_DE_COMPOSITION.map((axe) => choix(s, h, axe)).filter((c) => c.valeurs.length > 0),
    pratiquer: pratique ? { libelle: pratique.libelle, geste: pratique.geste, refus: pratique.refus } : null,
  };
}

/** Les Activités de `h` que joue leur verbe : Commande, Faveurs dues, puis la préparation de bataille de ce lieu. */
function activitesDuHeros(s: Etat, h: Combatant): ActiviteEnVue[] {
  const ferme = refusDActivite(s, h.id);
  const parCible = (id: string, libelle: string, gestes: GesteDInterlude[]): ActiviteEnVue => ({ id, libelle, refus: gestes.length ? ferme : ferme ?? t('interlude.sansCible'), cible: true, gestes });
  const favors = (s.favors ?? []).filter((f) => f.heroId === h.id);
  return [
    parCible('order', t('interlude.commande'), orderCatalog().map((o) => ({
      libelle: auPrix(o.label, formatMoney(fromBrass(o.priceBrass))), geste: { verbe: 'commanderLObjet', args: [h.id, o.id] }, refus: refusDeCommande(s, h.id, o.id),
    }))),
    ...(favors.length ? [parCible('faveur', t('interlude.faveur'), favors.map((f) => ({
      libelle: f.owedTo, geste: { verbe: 'solderLaFaveur', args: [h.id, f.id] }, refus: refusDAcquitterUneFaveur(s, h.id, f.id),
    })))] : []),
    ...interludeCatalog(s).filter((d) => d.contexts.includes('bataille')).map((def): ActiviteEnVue => {
      const refus = ferme ?? refusDePrepaDeBataille(garanti(s.massBattle, def.id, 'bataille à préparer'), h, def);
      return { id: def.id, libelle: def.label, refus, cible: false, gestes: [{ libelle: def.label, geste: { verbe: 'menerLActionDeBataille', args: [h.id, def.id] }, refus }] };
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
    genres: GENRES_DE_DEPOT.map((g) => ({ libelle: t(`interlude.genre.${g}`), valeur: g, refus: devisDeDepot(s, h.id, g, max).refus })),
    max, pas: PA_PER_SC,
  };
}

/** Le libellé d'un dépôt : son héros, son genre et son montant, et ce que rend un investissement. */
export function libelleDuDepot(s: Jeu, d: NonNullable<Etat['bank']>[number]): string {
  const heros = garanti(nomEnVue(s, d.heroId), d.heroId, 'héros du dépôt');
  const montant = formatMoney(fromBrass(d.brass));
  return d.kind === 'investir'
    ? t('interlude.depot.investir', { heros, montant, rendu: formatMoney(fromBrass(bankPayout('investir', d.brass, d.rate))), indice: d.rate })
    : t(`interlude.depot.${d.kind}`, { heros, montant });
}

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
        id: h.id, nom: h.label, restantes: st.left, recues: st.granted, px: h.xp ?? 0, bourse: formatMoney(bourseOf(h)), evenement: st.eventRoll == null ? null : eventLabelOf(st),
        ...compositionDuHeros(s, h), activites: activitesDuHeros(s, h), depot: depotDuHeros(s, h),
      };
    }),
    depots: (s.bank ?? []).map((d) => ({ libelle: libelleDuDepot(s, d), geste: { verbe: 'retirerDeLaBanque', args: [d.uid] }, refus: refusDeRetrait(s, d.uid) })),
  };
}
