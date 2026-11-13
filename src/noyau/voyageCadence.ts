/**
 * CADENCE de VOYAGE — couche PARTAGÉE terre (`travelFlow`) ⇄ mer (`seaVoyageFlow`) ⇄ fluvial (`riverVoyageFlow`) :
 * ordres permanents fixés au départ, où ils ont un effet (`cadenceAUnEffet`), la porte d'un jet ouvert hors du
 * pilote du jour (`KINDS_SOUS_ORDRES`), la brique d'entrée du PROCÈS-VERBAL du jour et son seul écrivain
 * (`noterAuProcesVerbal`, `TravelPlan.procesVerbal`). Elle ne possède NI la boucle de jours NI la résolution des
 * jets — seulement le régime (auto vs modale par jet) et le compte rendu du jour en cours.
 *
 * Doctrine : « aucun jet silencieux ». La route COMMANDÉE ne supprime pas des TRACES, seulement des
 * INTERRUPTIONS — chaque jet auto-résolu laisse sa ligne (l'auto-pilote pilote LE MÊME flux de jet, jamais un
 * `rollTest` inline). Décision requise = modale/cascade ; routine = sa ligne, au journal (au PV pour les bandes d'un
 * jour de mer).
 */
import type { IconId } from '../data/icons';
import type { NightEntry } from './restFlow';
import type { RollBreakdown } from '../engine/combat';
import { findCrewRoleById, refLabel, type StakeRef } from '../data';
import { estJete } from '../engine/tests';
import { crewTestSuccess } from '../engine/crewMorale';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import type { CascadeStep } from './pendings';
import type { GenreDeCascade } from './tablesPosees';

/** COMMANDÉE : le pilote du jour joue tout jet d'office (sa ligne au journal) ; seul ce qui ouvre arrête le jour.
 *  JOUR-PAR-JOUR : chaque jet ouvre sa modale. */
export type VoyageCadence = 'commande' | 'jourParJour';

/** Ordres permanents d'une traversée, fixés au départ et persistés avec le `TravelPlan`. */
export interface VoyageOrders {
  cadence: VoyageCadence;
}

/** Ordres par DÉFAUT d'un `TravelPlan` construit sans cadence explicite — SOURCE UNIQUE, consommée par les plans
 *  de terre, de mer et de fleuve (`travelFlow`, `buildSeaPlan`, `buildRiverPlan`), `fixerLaCadence`, l'ordre des
 *  cadences offertes (`CADENCES_AU_CHOIX`) et le sélecteur de départ de `WorldMapView` (aucune copie en dur du
 *  littéral ailleurs). */
export const DEFAULT_VOYAGE_ORDERS: VoyageOrders = { cadence: 'commande' };

/** Chaque cadence, une fois. */
const CADENCES: Record<VoyageCadence, true> = { commande: true, jourParJour: true };

/** Les cadences dans l'ordre où l'écran les offre : celle de `DEFAULT_VOYAGE_ORDERS` en premier. */
export const CADENCES_AU_CHOIX: readonly VoyageCadence[] = (Object.keys(CADENCES) as VoyageCadence[])
  .sort((a, b) => Number(b === DEFAULT_VOYAGE_ORDERS.cadence) - Number(a === DEFAULT_VOYAGE_ORDERS.cadence));

/**
 * Tests de ROUTE qu'une traversée sous ordres (`resoluSousOrdres`) résout d'office à la PORTE d'un jet ouvert hors
 * du pilote du jour (`rollSeam.surfaceDesTenus`, son seul lecteur) — LISTE FERMÉE (par `voyage.kind`, en kebab
 * français préfixé de sa route). Le pilote du jour (`cascade.jouerLaJournee`), lui, ne la lit pas : sous ordres, il
 * joue tout jet de la journée, terre, fleuve ou mer, et seul ce qui ouvre (une interruption, un combat, une scène)
 * l'arrête. En mer, seuls les jours de pure routine (`seaVoyageFlow.seaDayAllRoutine`) se jouent sous ordres.
 * Mer : MDG 13 l.111, MDG 13 l.203-225, 14 l.206-234. Fleuve : MSRC 16 l.5-13.
 * L'Exposition y entre par le `kind` PROPRE à sa route (`merExposition`, `fleuveExposition`) : un ordre
 * de traversée ne commande ni la nuit de camp (`exposition-nocturne`) ni un Effet de scène (`waterExposure`).
 * Attendu validé en recette #1426 « Traversée commandée sans fenêtre » (#1479).
 *
 * Hors liste, un jet ouvert à la porte garde sa fenêtre : les CRISES (`equipage-poursuite`, `equipage-tourbillon`),
 * le Test d'équipage d'un Flow (`testDEquipage`), `equipage-extermination`, `equipage-embuscade` ancrée,
 * `equipage-voyage-rapide`. Les urgences (`pendingSteamSave`), les événements de bord à choix, le conseil de bord,
 * l'atterrage et le combat sont des surfaces PROPRES : ils suspendent la boucle par eux-mêmes.
 */
export const KINDS_SOUS_ORDRES: ReadonlySet<GenreDeCascade> = new Set<GenreDeCascade>([
  'equipage-progression', 'equipage-affaler', 'equipage-phare', 'equipage-orientation', 'equipage-entretien',
  'mer-tonneau-expose', 'mer-tonneau-contamine', 'mer-mal-de-mer', 'mer-scorbut', 'merExposition', 'mer-epuisement',
  'fleuveExpositionTirage', 'fleuveExposition',
]);

/** Ce que la politique d'ordres lit de l'état — sa signature la plus ÉTROITE. */
export type EtatDeTraversee = Pick<Jeu, 'net' | 'travelPlan'>;

/**
 * La cadence a-t-elle un effet ? — SOURCE UNIQUE, lue par `traverseeCommandee`, par les vues qui l'offrent
 * (`carteEnVue.trajetsDepuis`, `voyageEnVue`) et par le sélecteur de départ du web. La résolution sans fenêtre est
 * un bloc HÔTE-SEUL (`docs/architecture.md`, « Coop en ligne — limitations connues ») : hors mode local, une
 * traversée se joue jour par jour quels que soient ses ordres.
 */
export function cadenceAUnEffet(s: Pick<Jeu, 'net'>): boolean {
  return s.net.mode === 'local';
}

/**
 * La traversée se résout-elle SOUS ORDRES ? — SOURCE UNIQUE de « commandée là où la cadence a un effet », lue par
 * la porte d'un jet (`rollSeam.surfaceDesTenus`, via `resoluSousOrdres`), par le pilote du jour de chaque route
 * (`travelFlow`, `riverVoyageFlow.resolveRiverDay`, `seaVoyageFlow`) et par la vue du trajet (`voyageEnVue`). Un
 * plan sans `orders` se joue jour par jour.
 */
export function traverseeCommandee(s: EtatDeTraversee): boolean {
  return cadenceAUnEffet(s) && s.travelPlan?.orders?.cadence === 'commande';
}

/** Un Test de route de `kind` se résout-il d'office ? (traversée sous ordres + `kind` couvert). */
export function resoluSousOrdres(s: EtatDeTraversee, kind: GenreDeCascade): boolean {
  return traverseeCommandee(s) && KINDS_SOUS_ORDRES.has(kind);
}

/** Brique d'ENTRÉE du PV du jour (une ligne du procès-verbal, rendue par `MultiRollList`). */
function voyageDayEntry(opts: {
  id: string;
  actorId?: string;
  label: string;
  icon?: IconId;
  d?: RollBreakdown;
  text?: string;
  tone?: NightEntry['tone'];
  /** Rubrique commune des lignes d'une même étape (rendue en UNE bande par `MultiRollList`). */
  group?: string;
  /** ENJEU de l'ÉTAPE dont la ligne est issue (`CascadeStep.stake`) — recopié TEL QUEL, jamais
   *  reconstruit : le PV dit ce que le jet mettait en jeu, sans que l'auteur du PV l'écrive. */
  stake?: StakeRef;
}): NightEntry {
  return { id: opts.id, actorId: opts.actorId, label: opts.label, icon: opts.icon, d: opts.d, text: opts.text, tone: opts.tone, group: opts.group, ...(opts.stake ? { stake: opts.stake } : {}) };
}

/** Les entrées d'une BANDE commise : une par contributeur résolu, rendue par `MultiRollList`. Une étape MONO n'en
 *  a pas. */
function dayEntriesFromStep(get: Get, step: CascadeStep): NightEntry[] {
  if (!step.participants) return [];
  const pool = get().party;
  return step.participants.flatMap((part, i) => {
    const actor = pool.find((c) => c.id === part.id);
    const res = part.result;
    if (!actor || !res) return [];
    return [voyageDayEntry({
      id: `mer-${step.kind}-${get().travelPlan?.sea?.daysAtSea ?? 0}-${part.id}-${i}`,
      actorId: part.id, icon: 'voyage/ancre', group: step.label,
      // L'ENJEU est celui de l'ÉTAPE (#1117 L1b) : recopié tel quel, rendu UNE fois par bande.
      ...(step.stake ? { stake: step.stake } : {}),
      label: `${(part.roleId ? findCrewRoleById(part.roleId)?.label : undefined) ?? part.label ?? actor.label}${part.essential ? ' ★' : ''}`,
      // Z5 : la ligne NOMME la COMPÉTENCE lancée (couture id→label du catalogue) ; le RÔLE tenu est
      // la provenance, porté par le libellé d'entrée. La Difficulté posée à la construction voyage
      // avec la ligne (#1112) au lieu d'être jetée. Une ligne non tentable n'a pas de dé : son refus.
      ...(estJete(res) ? { d: {
        label: part.skill ? refLabel('skills', part.skill) : (part.label ?? actor.label),
        base: part.base, modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl,
        ...(part.difficulty ? { difficulty: part.difficulty } : {}),
      } } : { text: part.refus }),
      tone: res.success ? 'reussite' : 'echec',
    })];
  });
}

/**
 * SEUL ÉCRIVAIN du compte rendu du jour en cours (`TravelPlan.procesVerbal`), appelé par `cascade.commitStep` pour
 * chaque bande commise sous `rowSurface: 'pv'` : ses entrées au trajet et, quand la bande porte un résultat agrégé,
 * son résumé DR au journal et aux lignes du jour de mer (`sea.lines`). « Aucun jet silencieux ».
 */
export function noterAuProcesVerbal(get: Get, set: Set, step: CascadeStep): void {
  const plan = get().travelPlan;
  if (!plan) return;
  const entrees = dayEntriesFromStep(get, step);
  const dr = step.participants ? step.result?.sl : undefined;
  // MDG 14 l.13
  const resume = dr === undefined ? [] : [t('sv.crewTestSummary', { label: String(step.label), dr: dr >= 0 ? `+${dr}` : dr, issue: crewTestSuccess(dr) ? t('sv.success') : t('sv.failure') })];
  if (!entrees.length && !resume.length) return;
  if (resume.length) get().ecrireAuJournal(resume);
  set({ travelPlan: {
    ...plan,
    ...(entrees.length ? { procesVerbal: [...(plan.procesVerbal ?? []), ...entrees] } : {}),
    ...(plan.sea && resume.length ? { sea: { ...plan.sea, lines: [...plan.sea.lines, ...resume] } } : {}),
  } });
}
