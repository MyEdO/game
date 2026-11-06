/**
 * L'INTERLUDE EN VUE (#3328) — ce qu'un hôte montre de l'interlude ouvert (« Entre deux aventures », LDB 22-23) : chaque
 * héros, ses Activités restantes et l'Événement de sa période, puis chacune de ses Activités écrite en verbe du noyau,
 * fermée par le verdict que son verbe applique (`verdictsDInterlude.ts`) ; une Activité qui vise une cible (un Talent,
 * un artefact, une option d'Entraînement, un objet à commander, une Faveur, une arme, un sort, un Trait psychologique)
 * offre un geste par cible ; l'ouvrage d'Artisanat qu'il peut engager et son dépôt en banque, en formulaires. Puis les
 * dépôts en banque et leur retrait. Lecteur PUR, lu par les hôtes du noyau
 * (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import { activityById, bankPayout, craftCatalog, entrainementOptions, learnableTalents, orderCatalog, qualitesDArtisanat, type ActivityDef, type CraftOption } from '../engine/activities';
import { describeQuality } from '../engine/qualities/describe';
import { libelleDePsy } from '../engine/psych/ciblage';
import { bourseOf } from '../engine/bourse';
import { formatMoney, fromBrass, PA_PER_SC, toBrass } from '../engine/money';
import { interludeCatalog } from './interludeFlow';
import { refusDePrepaDeBataille } from './massBattleFlow';
import {
  ciblesDActivite, devisDeDepot, eventLabelOf, refusDAcquitterUneFaveur, refusDActivite, refusDArtisanat, refusDeCommande, refusDEntrainement,
  refusDeRetrait, refusDOuvertureDActivite, type CiblesChoisies, type GenreDeDepot,
} from './verdictsDInterlude';
import { fenetreDuJeu } from './combatAuto';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';

/** Un geste d'interlude : son nom, le verbe qui le joue, et pourquoi il ne se joue pas maintenant (`null` s'il se joue). */
export interface GesteDInterlude { libelle: string; geste: GesteDuNoyau; refus: string | null }

/** Une Activité d'un héros : son nom, ce qui la ferme toute (`refus`), et ses gestes, un seul sans cible, un par cible
 *  sinon (`cible` : elle en vise une). */
export interface ActiviteEnVue { id: string; libelle: string; refus: string | null; cible: boolean; gestes: GesteDInterlude[] }

/** Une valeur qu'un formulaire d'interlude offre : ce qu'elle dit, ce qu'elle vaut, pourquoi elle est refusée. */
export interface ValeurDInterlude { libelle: string; valeur: string; refus: string | null }

/** Un ouvrage d'Artisanat à engager : son verbe et le héros qu'il pose, ce qui le ferme, puis chaque ouvrage du
 *  catalogue fermé par sa raison, et les Atouts et Défauts qu'il peut viser (vides quand il est fermé). */
export interface OuvrageAEngager { geste: GesteDuNoyau; refus: string | null; ouvrages: ValeurDInterlude[]; atouts: ValeurDInterlude[]; defauts: ValeurDInterlude[] }

/** Un dépôt en banque : son verbe et le héros qu'il pose, ce qui le ferme, chaque genre de dépôt fermé par sa raison,
 *  et le montant que la bourse couvre au plus, en sous de cuivre, par pas d'une pistole. */
export interface DepotAFaire { geste: GesteDuNoyau; refus: string | null; genres: ValeurDInterlude[]; max: number; pas: number }

/** Un héros de l'interlude : ses Activités restantes sur celles qu'il a reçues, l'Événement de sa période (`null` tant
 *  que son dé n'est pas tombé), ses Activités, l'ouvrage qu'il peut engager (`null` : le sien est en cours) et son
 *  dépôt en banque. */
export interface HerosDInterlude {
  id: string; nom: string; restantes: number; recues: number; evenement: string | null; activites: ActiviteEnVue[];
  ouvrage: OuvrageAEngager | null; depot: DepotAFaire;
}

/** L'interlude ouvert : sa durée en semaines, ses héros, ses dépôts en banque. */
export interface InterludeEnVue { semaines: number; heros: HerosDInterlude[]; depots: GesteDInterlude[] }

type Etat = Pick<Jeu, 'interlude' | 'party' | 'bank' | 'lieu' | 'massBattle' | 'favors'>;

const activite = (id: string): ActivityDef => garanti(activityById(id), id, 'Activité d’interlude');

/** Les gestes d'une Activité du catalogue sur ses cibles (`ciblesDActivite`), la première sorte de cible qu'elle offre ;
 *  un seul geste sans cible. */
function gestesDuCatalogue(s: Etat, h: Combatant, def: ActivityDef): { cible: boolean; gestes: GesteDInterlude[] } {
  const { armes, artefacts, sorts, traitsPsy } = ciblesDActivite(h, def);
  const parCible: { libelle: string; opts: CiblesChoisies }[] = [
    ...[...armes, ...artefacts].map((i) => ({ libelle: i.label, opts: { itemUid: i.uid } })),
    ...sorts.map((x) => ({ libelle: x.spell.label, opts: { spellId: x.spell.id } })),
    ...traitsPsy.map((x) => ({ libelle: libelleDePsy(x.trait.type, x.trait.cible), opts: { traitPsy: x.vise } })),
  ];
  const geste = (libelle: string, opts?: CiblesChoisies): GesteDInterlude =>
    ({ libelle, geste: { verbe: 'interludeActivity', args: opts ? [h.id, def.id, opts] : [h.id, def.id] }, refus: refusDOuvertureDActivite(s, h.id, def, opts) });
  return parCible.length ? { cible: true, gestes: parCible.map((c) => geste(c.libelle, c.opts)) } : { cible: false, gestes: [geste(def.label)] };
}

/** Les Activités du héros `h` : Revenus, l'ouvrage d'Artisanat en cours, Apprentissage, Commande, Identification,
 *  Entraînement, Faveurs dues, puis les autres Activités du catalogue de ce lieu, préparation de bataille comprise. */
function activitesDuHeros(s: Etat, h: Combatant): ActiviteEnVue[] {
  const ferme = refusDActivite(s, h.id);
  const simple = (id: string, libelle: string, geste: GesteDuNoyau, refus: string | null): ActiviteEnVue =>
    ({ id, libelle, refus, cible: false, gestes: [{ libelle, geste, refus }] });
  const parCible = (id: string, libelle: string, gestes: GesteDInterlude[]): ActiviteEnVue => ({ id, libelle, refus: gestes.length ? ferme : ferme ?? t('interlude.sansCible'), cible: true, gestes });
  const revenus = activite('revenus');
  const learn = activite('learn');
  const identify = activite('identify');
  const favors = (s.favors ?? []).filter((f) => f.heroId === h.id);
  return [
    simple(revenus.id, revenus.label, { verbe: 'interludeActivity', args: [h.id, revenus.id] }, refusDOuvertureDActivite(s, h.id, revenus)),
    ...(h.craft ? [simple('craft', activite('craft').label, { verbe: 'interludeActivity', args: [h.id, 'craft'] }, refusDOuvertureDActivite(s, h.id, activite('craft')))] : []),
    parCible(learn.id, learn.label, learnableTalents(h).map((o) => ({
      libelle: o.label, geste: { verbe: 'interludeActivity', args: [h.id, learn.id, { talentId: o.id }] }, refus: refusDOuvertureDActivite(s, h.id, learn, { talentId: o.id }),
    }))),
    parCible('order', t('interlude.commande'), orderCatalog().map((o) => ({
      libelle: o.label, geste: { verbe: 'interludeOrder', args: [h.id, o.id] }, refus: refusDeCommande(s, h.id, o.id),
    }))),
    { id: identify.id, libelle: identify.label, refus: ferme, ...gestesDuCatalogue(s, h, identify) },
    parCible('entrainement', activite('entrainement').label, entrainementOptions(h).map((o) => ({
      libelle: o.label, geste: { verbe: 'interludeEntrainement', args: o.spec === undefined ? [h.id, o.kind, o.id] : [h.id, o.kind, o.id, o.spec] }, refus: refusDEntrainement(s, h.id, o.kind, o.id, o.spec),
    }))),
    ...(favors.length ? [parCible('faveur', t('interlude.faveur'), favors.map((f) => ({
      libelle: f.owedTo, geste: { verbe: 'favorSettle', args: [h.id, f.id] }, refus: refusDAcquitterUneFaveur(s, h.id, f.id),
    })))] : []),
    ...interludeCatalog(s).filter((d) => !d.resolver || !RESOLVEURS_A_PART.has(d.resolver)).map((def): ActiviteEnVue => (def.contexts.includes('bataille')
      ? simple(def.id, def.label, { verbe: 'massBattleActivity', args: [def.id, h.id] }, ferme ?? refusDePrepaDeBataille(s.massBattle!, h, def))
      : { id: def.id, libelle: def.label, refus: ferme, ...gestesDuCatalogue(s, h, def) })),
  ];
}

/** L'ouvrage d'Artisanat que `h` peut engager sur `catalogue` : chaque ouvrage dit ses matériaux, fermé par
 *  `refusDArtisanat` ; `null` quand le sien est en cours. LDB 23 l.74-78 */
function ouvrageDuHeros(s: Etat, h: Combatant, catalogue: readonly CraftOption[]): OuvrageAEngager | null {
  if (h.craft) return null;
  const refus = refusDArtisanat(s, h.id);
  const qualite = (id: string): ValeurDInterlude => ({ libelle: garanti(describeQuality({ id }), id, 'qualité d’artisanat').label, valeur: id, refus: null });
  const { atouts, defauts } = qualitesDArtisanat();
  return {
    geste: { verbe: 'interludeCraftStart', args: [h.id] }, refus,
    ouvrages: refus ? [] : catalogue.map((o) => ({ libelle: t('interlude.ouvrage', { label: o.label, materiaux: formatMoney(fromBrass(o.materialsBrass)) }), valeur: o.id, refus: refusDArtisanat(s, h.id, o.id) })),
    atouts: refus ? [] : atouts.map(qualite),
    defauts: refus ? [] : defauts.map(qualite),
  };
}

/** Les genres d'un dépôt en banque. LDB 23 l.164-170, ACE 12 l.45-49 */
const GENRES_DE_DEPOT: readonly GenreDeDepot[] = ['invest', 'stash', 'mecenat'];

/** Le dépôt en banque de `h` : chaque genre fermé par son devis au plus que la bourse couvre (`devisDeDepot`), le
 *  dépôt fermé par le devis d'une planque, qui ne porte que les refus communs. LDB 23 l.164-170 */
function depotDuHeros(s: Etat, h: Combatant): DepotAFaire {
  const max = Math.floor(toBrass(bourseOf(h)) / PA_PER_SC) * PA_PER_SC;
  return {
    geste: { verbe: 'interludeBank', args: [h.id] },
    refus: devisDeDepot(s, h.id, 'stash', max).refus,
    genres: GENRES_DE_DEPOT.map((g) => ({ libelle: t(`interlude.genre.${g}`), valeur: g, refus: devisDeDepot(s, h.id, g, max).refus })),
    max, pas: PA_PER_SC,
  };
}

/** Les résolveurs des Activités que `activitesDuHeros` offre à part : Revenus, Artisanat, Apprentissage, Identification,
 *  Entraînement, et le Mécénat, un dépôt en banque. */
const RESOLVEURS_A_PART = new Set(['income', 'craftExtended', 'learnTalent', 'identify', 'entrainement', 'mecenat']);

/** Le libellé d'un dépôt : son héros, son genre et son montant, et ce que rend un investissement. */
function libelleDuDepot(s: Etat, d: NonNullable<Etat['bank']>[number]): string {
  const heros = garanti(s.party.find((h) => h.id === d.heroId), d.heroId, 'héros du dépôt').label;
  const montant = formatMoney(fromBrass(d.brass));
  return d.kind === 'invest'
    ? t('interlude.depot.invest', { heros, montant, rendu: formatMoney(fromBrass(bankPayout('invest', d.brass, d.rate))), indice: d.rate })
    : t(`interlude.depot.${d.kind}`, { heros, montant });
}

/** L'interlude qui tient la main (`fenetreDuJeu`) ; `null` hors interlude, ou quand une autre fenêtre tient la main (le
 *  jet d'une Activité). PUR. */
export function interludeEnVue(s: Jeu): InterludeEnVue | null {
  const itl = s.interlude;
  if (!itl || fenetreDuJeu(s)?.cle !== 'interlude') return null;
  const catalogue = craftCatalog();
  return {
    semaines: itl.weeks,
    heros: s.party.filter((h) => !h.dead && itl.perHero[h.id]).map((h) => {
      const st = itl.perHero[h.id];
      return {
        id: h.id, nom: h.label, restantes: st.left, recues: st.granted, evenement: st.eventRoll == null ? null : eventLabelOf(st), activites: activitesDuHeros(s, h),
        ouvrage: ouvrageDuHeros(s, h, catalogue), depot: depotDuHeros(s, h),
      };
    }),
    depots: (s.bank ?? []).map((d, i) => ({ libelle: libelleDuDepot(s, d), geste: { verbe: 'interludeWithdraw', args: [i] }, refus: refusDeRetrait(s, i) })),
  };
}
