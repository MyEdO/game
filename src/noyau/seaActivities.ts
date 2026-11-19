/** MDG 15 l.266-272 */
import { activityById, activitiesFor, travelActivitySpec, type ActivityDef } from '../engine/activities';
import { appliquerIssueActivite } from './activityIssue';
import { pushStep } from './cascade';
import { peutTenter, refusNePeutTenter } from '../engine/skills';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { PlayerText } from '../i18n/playerText';
import { contexteDeNaissanceDObjet, itemFromTrappingById, recomputeLoadout, autoStowNewItem } from '../engine/items';
import { toBrass, fromBrass, formatMoney, PA_PER_CO } from '../engine/money';
import { payFromGroup, payWithAllocation, soloPayer, distributeCredit, refusDeGesteSurLeGroupe, totalDesBourses } from './bourseFlow';
import { currentPort, encLibreNominale, refusAQuai } from './portFlow';
import { refuserGeste } from './refusVisible';
import { cargoTotalEnc, removeCargo } from '../engine/cargo';
import { blessuresPayeesParLesPieces, piecesDeLaReparation } from '../engine/shipBuild';
import { REPARATION } from '../engine/seaNavigation';
import { ligneDeRegle } from '../engine/reglesChiffrees';
import { shipHasNavalTrait, vesselNavalTraits } from '../engine/navalTraits';
import type { ModLine } from '../engine/combat';
import { bourseOf } from '../engine/bourse';
import { OPPORTUNITE, opportunityTradePct } from '../engine/seaVoyage';
import { activityStakeRef, refLabel, dataLabel, findNavalPortById, findVehicleById, hasActivityStake } from '../data';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { TravelRecapDay } from './travelFlow';
import { toRecapLines } from './recapLine';
import type { Get, Set } from './flowTypes';
import type { CampaignVessel, Jeu } from './etat';
import type { CascadeStep } from './pendings';
import type { BuiltCascadeStep } from './stepBrand';
import {
  choiceStep, composeRollLabel, effectiveTarget, freeCons, idDansLaSequence, monoStep, openSequence, pousseSi, quantityStep, resultLines, type RollRequest,
} from './rollSeam';
import {
  blessuresDeCoqueARestaurer, coqueDuNavireDeCampagne, debiterPiecesDetachees, encDePiecesDetachees,
  noteSeaLine, openSeaHalt, patchSea, poserLesActivitesDuNavire, setVesselHull,
} from './seaVoyageFlow';
import { actorIn } from './monde/combatants';
import { garanti } from '../lib/garanti';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';

/** Choix d'un héros pour la semaine : une Activité du catalogue 'mer' (+ mise du Commerce d'opportunité). */
export interface SeaActivityPick {
  activityId: string;
  /** Commerce d'opportunité (l.276) : couronnes d'or investies. */
  investGold?: number;
  /** Planque gratuite lors de la Cartographie (l.292) : couronnes d'or cachées. */
  stashGold?: number;
}

export type PendingSeaActivities = {
  picks: Record<string, SeaActivityPick | null>;
  file?: string[];
  /** File des Tests étendus dans les parties sauvegardées avant l'Entretien. */
  opportunityQueue?: string[];
} & (
  | { day: TravelRecapDay; escale?: never }
  | { escale: string; day?: never }
);

export function activitesDuNavireEnResolution(pending: PendingSeaActivities | null): boolean {
  return pending?.file !== undefined || pending?.opportunityQueue !== undefined;
}

/** Les bourses du groupe, en CO, moins ce qu'y engagent déjà les choix de la semaine des héros autres que `pid` : leurs
 *  mises (MDG 15 l.276) et leurs planques (l.292). PUR. */
function boursesLibres(s: Pick<Jeu, 'party' | 'pendingSeaActivities'>, pid: string): number {
  const engage = Object.entries(s.pendingSeaActivities?.picks ?? {}).reduce((n, [id, p]) => (id === pid || !p ? n : n + (p.investGold ?? 0) + (p.stashGold ?? 0)), 0);
  return Math.floor(toBrass(totalDesBourses(s.party)) / PA_PER_CO) - engage;
}

/** Plafond de mise du Commerce d'opportunité du héros `pid`, en CO (MDG 15 l.276) : l'Enc libre non surchargé du navire
 *  (`encLibreNominale`), borné par les bourses du groupe que les autres choix de la semaine laissent libres. PUR. */
export function plafondDeMiseDOpportunite(s: Pick<Jeu, 'vessel' | 'party' | 'pendingSeaActivities'>, pid: string): number {
  return Math.max(0, Math.min(encLibreNominale(s.vessel), boursesLibres(s, pid)));
}

/** Plafond de la planque de Cartographie du héros `hero`, en CO (MDG 15 l.292) : sa bourse, bornée par les bourses du
 *  groupe que les autres choix de la semaine laissent libres. PUR. */
export function plafondDePlanque(s: Pick<Jeu, 'party' | 'pendingSeaActivities'>, hero: Combatant): number {
  return Math.max(0, Math.min(Math.floor(toBrass(bourseOf(hero)) / PA_PER_CO), boursesLibres(s, hero.id)));
}

/** Raison de BLOCAGE d'une Activité en mer pour un héros (affordance expliquée, jamais muette). PUR. */
export function seaActivityBlocked(s: Pick<Jeu, 'vessel'>, def: ActivityDef): string | null {
  if (def.resolver === 'shipMaintenance' && !findVehicleById(s.vessel?.vehicleId ?? '')?.ship) return t('sact.entretienSansNavire');
  if (def.resolver === 'crewTraining') {
    // MDG 14
    return t('sact.crewIsPlayers');
  }
  if (def.resolver === 'opportunityTrade' && encLibreNominale(s.vessel) <= 0) {
    return t('sact.noFreeEnc');
  }
  return null;
}

/** Test d'une Activité en mer à compétence FIXE (MDG 15 l.274-290) ; le chemin générique dérive la
 *  sienne du héros (`travelActivitySpec`). Spec par ID (#1341). */
function seaActivityTest(def: ActivityDef): { skill: RefDesignee } | undefined {
  if (def.resolver === 'seaChart') { const sk = def.tests?.[0]?.skill; return sk && { skill: sk }; }
  if (def.resolver === 'opportunityTrade') return { skill: OPPORTUNITE.test.skill };
  return undefined;
}

/** Refus NOMMÉ de CE héros pour une Activité en mer dont il ne peut pas tenter le Test (`peutTenter`) :
 *  l'Activité est un choix (MDG 15 l.268), offerte FERMÉE avec sa raison. LDB 09 l.30 ; #2588. PUR. */
export function seaActivityRefus(hero: Combatant, def: ActivityDef): PlayerText | undefined {
  if (def.resolver === 'crewTraining' || def.resolver === 'shipMaintenance') return undefined;
  const test = seaActivityTest(def);
  if (!test) return travelActivitySpec(hero, def)!.refus;
  return peutTenter(hero, test) ? undefined : refusNePeutTenter(hero, test);
}

/** L'Activité choisie de chaque héros de la semaine (`!dead`) : un choix que l'état ouvre encore, la validation de la
 *  semaine fermée sinon (`semaineAReprendre`). PUR. */
function eligibleSeaActivityPicks(get: Get, picks: Record<string, SeaActivityPick | null>): { hero: Combatant; pick: SeaActivityPick; def: ActivityDef }[] {
  const out: { hero: Combatant; pick: SeaActivityPick; def: ActivityDef }[] = [];
  for (const hero of get().party) {
    if (hero.dead || hero.outOfRencontre) continue;
    const pick = picks[hero.id];
    if (pick) out.push({ hero, pick, def: garanti(activityById(pick.activityId), pick.activityId, 'Activité en mer') });
  }
  return out;
}

/** Étape MONO « Cartographie » (l.288-290, `merActiviteCarte`) : Métier (Cartographe), Complexe (−10). */
function buildSeaChartStep(hero: Combatant, def: ActivityDef, pick: SeaActivityPick): BuiltCascadeStep | undefined {
  const chart = seaActivityTest(def)!;
  const test: RollRequest['test'] = chart;
  const difficulty = def.tests?.[0]?.difficulty ?? 'complexe';
  return monoStep({
    id: `merActiviteCarte-${hero.id}`, kind: 'merActiviteCarte', actor: hero,
    label: composeRollLabel(hero, dataLabel(def.label), test), difficulty, rollLabel: refLabel('skills', chart.skill),
    // L'enjeu d'une Activité EST l'Activité choisie : il vit sur SA fiche (`ActivityDef.stake`).
    stake: activityStakeRef(def.id),
    ligne: { test },
    meta: { stashGold: pick.stashGold ?? 0 },
  });
}

/** Étape MONO chemin GÉNÉRIQUE data-driven (`merActiviteGenerique`) : `travelActivitySpec` choisit la
 *  meilleure compétence TENTABLE de l'acteur, la porte lance le Test.
 *  `undefined` = Activité SANS Test (Récupérer…), appliquée d'office ici : aucune étape à jouer. La spec
 *  est toujours rendue : le schéma d'édition refuse `freeSkill` à une Activité de contexte 'mer'
 *  (`superRefine` de `data/schemas/defs/activities.ts`).
 *
 *  EXPORTÉE pour être mesurée SEULE : aucune entrée de contexte 'mer' d'`activities.json` n'emprunte
 *  ce résolveur au catalogue livré. Ses tests posent une Activité 'mer' dérivée d'une entrée réelle au
 *  catalogue par le seam `setDataset` (`activiteMer.testkit.ts`). */
export function buildSeaGenericStep(get: Get, set: Set, hero: Combatant, def: ActivityDef): BuiltCascadeStep | undefined {
  const spec = travelActivitySpec(hero, def)!;
  if (spec.target == null) {
    const { consequences } = appliquerIssueActivite(get, hero, def, spec, null);
    set({ party: [...get().party] });
    noteSeaLine(get, set, resultLines(consequences).map((l) => l.text));
    return undefined;
  }
  const difficulty = spec.difficulty;
  const test: RollRequest['test'] = spec.test;
  return monoStep({
    id: `merActiviteGenerique-${hero.id}`, kind: 'merActiviteGenerique', actor: hero,
    label: composeRollLabel(hero, def.label, test), difficulty, rollLabel: def.label,
    // Idem : l'enjeu descend à l'Activité jouée, quelle qu'elle soit (fail-closed si elle n'en a pas).
    stake: activityStakeRef(def.id),
    ligne: { test, surLaCible: spec.mods },
    meta: { activityId: def.id },
  });
}

function buildSeaActivitiesCascade(get: Get, set: Set, picks: Record<string, SeaActivityPick | null>): { steps: BuiltCascadeStep[]; file: string[] } {
  const steps: BuiltCascadeStep[] = [];
  const file: string[] = [];
  for (const { hero, pick, def } of eligibleSeaActivityPicks(get, picks)) {
    if (def.resolver === 'opportunityTrade' || def.resolver === 'shipMaintenance') {
      file.push(hero.id);
      continue;
    }
    const step = def.resolver === 'seaChart' ? buildSeaChartStep(hero, def, pick) : buildSeaGenericStep(get, set, hero, def);
    pousseSi(steps, step);
  }
  return { steps, file };
}

/** MDG 15 l.268 */
function validerLaSemaine(get: Get, set: Set): void {
  const pending = garanti(get().pendingSeaActivities, 'activitesEnMer', 'Activités du navire ouvertes');
  const { steps, file } = buildSeaActivitiesCascade(get, set, pending.picks);
  poserLesActivitesDuNavire(set, { ...pending, file });
  if (!steps.length || openSequence(get, set, { title: t('sact.weekTitle'), icon: 'voyage/ancre', purpose: 'seaActivities', steps })) {
    continueSeaActivitiesAfterCascade(get, set);
  }
}

function openNextOpportunityTrade(get: Get, set: Set, hero: Combatant, pick: SeaActivityPick, def: ActivityDef): void {
  const invest = pick.investGold ?? 0;
  if (invest <= 0) {
    noteSeaLine(get, set, [t('sact.tradeNoStake', { name: hero.label })]);
    continueSeaActivitiesAfterCascade(get, set);
    return;
  }
  payFromGroup(get, set, fromBrass(invest * PA_PER_CO), { purpose: 'commerce d’opportunité' });
  const test: RollRequest['test'] = seaActivityTest(def)!;
  get().ouvrirLeTestEtendu({
    actorId: hero.id, label: dataLabel(def.label), skillLabel: refLabel('skills', OPPORTUNITE.test.skill), skill: OPPORTUNITE.test.skill,
    target: effectiveTarget(hero, test, OPPORTUNITE.test.difficulty), drCible: OPPORTUNITE.drCible,
    tentativesMax: OPPORTUNITE.tentativesMax,
    outcome: { kind: 'merActiviteOpportunite', meta: { heroId: hero.id, investBrass: invest * PA_PER_CO } },
    stake: activityStakeRef(def.id),
  });
}

export function continueSeaActivitiesAfterCascade(get: Get, set: Set): void {
  const pending = get().pendingSeaActivities;
  if (!pending) return;
  const [pid, ...reste] = pending.file ?? pending.opportunityQueue ?? [];
  if (pid !== undefined) {
    poserLesActivitesDuNavire(set, { ...pending, file: reste });
    const hero = get().party.find((h) => h.id === pid && !h.dead && !h.outOfRencontre);
    const pick = pending.picks[pid];
    const def = pick ? activityById(pick.activityId) : undefined;
    if (hero && pick && def) {
      if (def.resolver === 'opportunityTrade') { openNextOpportunityTrade(get, set, hero, pick, def); return; }
      if (def.resolver === 'shipMaintenance') { ouvrirChoixEntretien(get, set, hero, def); return; }
    }
    continueSeaActivitiesAfterCascade(get, set);
    return;
  }
  poserLesActivitesDuNavire(set, null);
  if (!pending.day) return;
  const plan = get().travelPlan;
  const activityLines = plan?.sea?.lines ?? [];
  const day: TravelRecapDay = { ...pending.day, lines: [...pending.day.lines, ...toRecapLines(activityLines)] };
  if (plan?.sea) patchSea(get, set, { lines: [] });
  openSeaHalt(get, set, day);
}

export function seaActivitiesCatalog(escale?: string): ActivityDef[] {
  const catalogue = activitiesFor('mer');
  return escale === undefined ? catalogue : catalogue.filter((def) => def.resolver === 'shipMaintenance');
}

export function creerActionsDesActivitesEnMer(get: Get, set: Set) {
  return {
    ouvrirEntretienDuNavire: () => {
      const s = get();
      const port = currentPort(get);
      const refus = refusDeGesteSurLeGroupe(s) ?? refusAQuai(s);
      if (refus || !port) { refuserGeste(get, set, refus ?? t('sact.entretienSansPort')); return; }
      if (s.pendingSeaActivities || s.pendingCascade || s.mode !== 'exploration') { refuserGeste(get, set, t('barre.mainTenue')); return; }
      poserLesActivitesDuNavire(set, { picks: {}, escale: port.placeId });
    },
  };
}

// ── Seam de jet (#273 Étape 2) — appliers des étapes migrées vers la cascade ──────────────────────

/** Les choix de la semaine (`CorpsDesChoix`, MDG 15 l.268), chacun pour le héros `pid`, parmi les valeurs que l'état
 *  ouvre (`OUVERTS_DU_CHOIX`) : l'Activité, qui efface la mise et la planque de la précédente, la mise du Commerce
 *  d'opportunité (l.276), la planque de la Cartographie (l.292). */
export function choixDeLaSemaineEnMer(get: Get, set: Set) {
  const choisir = (pid: string, pick: SeaActivityPick | null) => {
    const pending = garanti(get().pendingSeaActivities, 'activitesEnMer', 'semaine en mer ouverte');
    poserLesActivitesDuNavire(set, { ...pending, picks: { ...pending.picks, [pid]: pick } });
  };
  const choisie = (pid: string): SeaActivityPick => garanti(get().pendingSeaActivities?.picks[pid], pid, 'Activité choisie');
  return {
    activitesEnMer: {
      activite: (activite, pid) => choisir(pid, activite === null ? null : { activityId: activite }),
      investir: (investGold, pid) => choisir(pid, { ...choisie(pid), investGold }),
      cacher: (stashGold, pid) => choisir(pid, { ...choisie(pid), stashGold }),
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** La validation de la semaine (`ValidationsDeFenetre`). */
export function validationsDeLaSemaineEnMer(get: Get, set: Set) {
  return { activitesEnMer: () => validerLaSemaine(get, set) } satisfies Partial<ValidationsDeFenetre>;
}

const BOIS_DE_REPARATION = 'bois-mer';
const ICONE_ENTRETIEN = 'voyage/reparer';

interface EtatDEntretien {
  vessel: CampaignVessel;
  taille: number;
  courant: number;
  maximum: number;
  manquantes: number;
  usure: number;
  mod: ModLine[];
  lissage: boolean;
  pieces: number;
  bois: number;
}

function etatDEntretien(get: Get): EtatDEntretien | PlayerText {
  const s = get();
  const vessel = s.vessel;
  const profil = vessel && findVehicleById(vessel.vehicleId);
  if (!vessel || !profil?.ship || !profil.hull) return t('sact.entretienSansNavire');
  const pending = s.pendingSeaActivities;
  if (!pending) return t('sact.entretienIndisponible');

  let mod: ModLine[] = [];
  if (pending.escale !== undefined) {
    const port = currentPort(get);
    if (refusAQuai(s) || port?.placeId !== pending.escale) return t('port.pasAQuai');
    if (port.ref && findNavalPortById(port.ref)?.chantierNavalSpecialise) {
      mod = [ligneDeRegle('lieu-de-l-entretien-du-navire', 'chantier-specialise')];
    }
  } else {
    if (!s.travelPlan?.sea || !coqueDuNavireDeCampagne(s.travelPlan, vessel)) return t('sact.entretienSansNavire');
    mod = [ligneDeRegle('lieu-de-l-entretien-du-navire', 'en-mer')];
  }

  const { current: courant, max: maximum, missing: manquantes } = blessuresDeCoqueARestaurer(vessel);
  return {
    vessel, taille: profil.ship.lengthM, courant, maximum, manquantes, mod,
    usure: Math.min(manquantes, vessel.usure ?? 0),
    lissage: shipHasNavalTrait(vesselNavalTraits(vessel), 'lissage'),
    pieces: encDePiecesDetachees(vessel, s.party),
    bois: cargoTotalEnc(vessel.cargo ?? [], BOIS_DE_REPARATION),
  };
}

function plafondDesBlessures(etat: EtatDEntretien): number {
  return Math.min(etat.manquantes, blessuresPayeesParLesPieces(etat.pieces, etat.lissage));
}

function ventilationDuCritique({ taille, bois, pieces }: EtatDEntretien): { min: number; max: number } {
  return { min: Math.max(1, Math.ceil(taille - bois)), max: Math.min(taille - 1, Math.floor(pieces)) };
}

function refusDeLUsure(etat: EtatDEntretien): PlayerText | undefined {
  if (etat.usure <= 0) return t('sact.entretienSansUsure');
  if (etat.pieces < etat.taille) return t('sact.entretienSansPieces', { enc: etat.taille });
}

function refusDuCritique(etat: EtatDEntretien): PlayerText | undefined {
  const { min, max } = ventilationDuCritique(etat);
  if (min > max) return t('sact.entretienSansMateriaux', { enc: etat.taille });
}

interface SuiteDEntretien {
  activityId: string;
  usureTentee?: boolean;
  blessuresTraitees?: boolean;
  critiquesTentes?: string[];
}

function suiteDEntretien(step: CascadeStep): SuiteDEntretien | undefined {
  const meta = step.meta;
  if (typeof meta?.activityId !== 'string') return undefined;
  return {
    activityId: meta.activityId,
    usureTentee: meta.usureTentee === true,
    blessuresTraitees: meta.blessuresTraitees === true,
    critiquesTentes: Array.isArray(meta.critiquesTentes) ? meta.critiquesTentes.map(String) : [],
  };
}

function refusDesTestsDEntretien(hero: Combatant, def: ActivityDef): PlayerText | undefined {
  const spec = travelActivitySpec(hero, def);
  return spec?.refus ?? (spec?.target == null || !hasActivityStake(def.id) ? t('sact.entretienIndisponible') : undefined);
}

function choixDEntretien(get: Get, hero: Combatant, def: ActivityDef, suite: SuiteDEntretien): BuiltCascadeStep | PlayerText | undefined {
  const etat = etatDEntretien(get);
  if (typeof etat === 'string') return etat;
  const refusMetier = refusDesTestsDEntretien(hero, def);
  const refusDesBlessures = etat.manquantes <= 0 ? t('sv.aucuneBlessureARestaurer')
    : plafondDesBlessures(etat) <= 0 ? t('sact.entretienSansPieces', { enc: piecesDeLaReparation(1, etat.lissage) }) : undefined;
  const critiques = etat.vessel.criticals ?? [];
  return choiceStep({
    id: idDansLaSequence(get, 'merEntretienChoix', 'seaActivities'), kind: 'merEntretienChoix',
    label: dataLabel(def.label), icon: ICONE_ENTRETIEN, actorId: hero.id,
    options: [
      ...(!suite.usureTentee ? [{
        key: 'usure', label: t('sact.entretienUsure'), detail: t('sact.entretienCoutPieces', { enc: etat.taille }),
        refus: refusDeLUsure(etat) ?? refusMetier,
      }] : []),
      ...(!suite.blessuresTraitees ? [{
        key: 'blessures', label: t('sact.entretienBlessures'),
        detail: t('sact.entretienBareme', { enc: piecesDeLaReparation(1, etat.lissage), n: REPARATION.piecesBlessuresParTranche }),
        refus: refusDesBlessures,
      }] : []),
      ...critiques.flatMap((note, index) => suite.critiquesTentes?.includes(String(index)) ? [] : [{
        key: String(index), label: t('sact.entretienCritique', { note }), detail: t('sact.entretienCoutMateriaux', { enc: etat.taille }),
        refus: refusDuCritique(etat) ?? refusMetier,
      }]),
      { key: 'terminer', label: t('sact.entretienTerminer') },
    ],
    defaultChoice: 'terminer',
    meta: { ...suite, critiques },
  });
}

function ouvrirChoixEntretien(get: Get, set: Set, hero: Combatant, def: ActivityDef): void {
  const step = choixDEntretien(get, hero, def, { activityId: def.id });
  if (typeof step === 'string') {
    refuserGeste(get, set, step);
    continueSeaActivitiesAfterCascade(get, set);
    return;
  }
  if (!step || openSequence(get, set, { title: dataLabel(def.label), icon: ICONE_ENTRETIEN, purpose: 'seaActivities', steps: [step] })) {
    continueSeaActivitiesAfterCascade(get, set);
  }
}

function repriseDEntretien(get: Get, set: Set, hero: Combatant, def: ActivityDef, suite: SuiteDEntretien, message?: string) {
  const choix = choixDEntretien(get, hero, def, suite);
  const raison = message ?? (typeof choix === 'string' ? choix : undefined);
  if (choix && typeof choix !== 'string') pushStep(set, () => choix, 'seaActivities');
  return raison ? { consequences: freeCons([raison]) } : undefined;
}

function testDEntretien(
  get: Get, hero: Combatant, def: ActivityDef, kind: 'merEntretienUsure' | 'merEntretienCritique',
  etat: EtatDEntretien, meta: CascadeStep['meta'],
): BuiltCascadeStep | undefined {
  const spec = travelActivitySpec(hero, def, { mods: etat.mod });
  if (!spec || spec.target == null || spec.refus) return undefined;
  const label = kind === 'merEntretienUsure'
    ? t('sact.entretienUsure') : t('sact.entretienCritique', { note: String(meta?.cibleCritique) });
  return monoStep({
    id: idDansLaSequence(get, kind, 'seaActivities'), kind, actor: hero, icon: ICONE_ENTRETIEN,
    label: composeRollLabel(hero, label, spec.test),
    difficulty: kind === 'merEntretienCritique' ? 'difficile' : spec.difficulty,
    ligne: { test: spec.test, surLaCible: spec.mods },
    stake: activityStakeRef(def.id),
    meta,
  });
}

function critiqueVise(step: CascadeStep, etat: EtatDEntretien, index: number): string | undefined {
  const snapshot = step.meta?.critiques;
  const critiques = etat.vessel.criticals ?? [];
  return Array.isArray(snapshot) && snapshot.length === critiques.length && critiques.every((note, i) => note === snapshot[i])
    ? critiques[index] : undefined;
}

function preparerTravaux(get: Get, set: Set, step: CascadeStep, hero: Combatant, def: ActivityDef, suite: SuiteDEntretien) {
  const choix = step.chosen;
  if (!choix || choix === 'terminer') return;
  const etat = etatDEntretien(get);
  if (typeof etat === 'string') return { consequences: freeCons([etat]) };
  const refusMetier = refusDesTestsDEntretien(hero, def);
  let suivant: BuiltCascadeStep | undefined;
  let refus: string | undefined;

  if (choix === 'usure') {
    refus = refusDeLUsure(etat) ?? refusMetier;
    if (!refus) suivant = testDEntretien(get, hero, def, 'merEntretienUsure', etat, { ...suite, usureTentee: true });
  } else if (choix === 'blessures') {
    const max = plafondDesBlessures(etat);
    if (max <= 0) refus = t('sact.entretienTravauxCaducs');
    else suivant = quantityStep({
      id: idDansLaSequence(get, 'merEntretienBlessures', 'seaActivities'), kind: 'merEntretienBlessures',
      actorId: hero.id, icon: ICONE_ENTRETIEN, label: t('sact.entretienBlessures'),
      min: 1, max, unit: t('sact.entretienUniteBlessures'), meta: { ...suite, blessuresTraitees: true },
    });
  } else {
    const index = Number(choix);
    const note = critiqueVise(step, etat, index);
    refus = note === undefined ? t('sact.entretienTravauxCaducs') : refusDuCritique(etat) ?? refusMetier;
    if (!refus) suivant = quantityStep({
      id: idDansLaSequence(get, 'merEntretienMateriaux', 'seaActivities'), kind: 'merEntretienMateriaux',
      actorId: hero.id, icon: ICONE_ENTRETIEN, label: t('sact.entretienVentilation', { enc: etat.taille }),
      ...ventilationDuCritique(etat), unit: t('sact.entretienUnitePieces'),
      meta: {
        ...suite, cibleCritique: note, indexCritique: index, critiques: [...(etat.vessel.criticals ?? [])],
        critiquesTentes: [...(suite.critiquesTentes ?? []), choix],
      },
    });
  }
  if (suivant) {
    pushStep(set, () => suivant, 'seaActivities');
    return;
  }
  return repriseDEntretien(get, set, hero, def, suite, refus);
}

function soinDUsure(get: Get, set: Set, etat: EtatDEntretien): string {
  const refus = refusDeLUsure(etat);
  if (refus) return refus;
  const debit = debiterPiecesDetachees(etat.vessel, get().party, etat.taille);
  if (!debit) return t('sact.entretienSansPieces', { enc: etat.taille });
  // MDG 15 l.304
  set({ party: debit.party, vessel: { ...debit.vessel, usure: undefined } });
  setVesselHull(get, set, etat.courant + etat.usure, etat.maximum);
  return t('sact.entretienUsureReparee', { n: etat.usure, enc: etat.taille });
}

function soinDesBlessures(get: Get, set: Set, etat: EtatDEntretien, n: number): string {
  if (n < 1 || n > plafondDesBlessures(etat)) return t('sact.entretienTravauxCaducs');
  const enc = piecesDeLaReparation(n, etat.lissage);
  const debit = debiterPiecesDetachees(etat.vessel, get().party, enc);
  if (!debit) return t('sact.entretienSansPieces', { enc });
  // MDG 15 l.306
  set(debit);
  setVesselHull(get, set, etat.courant + n, etat.maximum);
  return t('sact.entretienBlessuresReparees', { n, enc });
}

function devisDuCritique(step: CascadeStep, etat: EtatDEntretien, pieces: number) {
  const index = Number(step.meta?.indexCritique);
  const note = critiqueVise(step, etat, index);
  const { min, max } = ventilationDuCritique(etat);
  if (note === undefined) return t('sact.entretienTravauxCaducs');
  if (!(pieces >= min && pieces <= max)) return t('sact.entretienSansMateriaux', { enc: etat.taille });
  return { index, note, pieces, bois: etat.taille - pieces };
}

function soinDuCritique(
  get: Get, set: Set, etat: EtatDEntretien, devis: Exclude<ReturnType<typeof devisDuCritique>, string>, suite: SuiteDEntretien,
): string {
  const { index, note, pieces, bois } = devis;
  const debit = debiterPiecesDetachees(etat.vessel, get().party, pieces);
  if (!debit) return t('sact.entretienSansMateriaux', { enc: etat.taille });
  const cale = removeCargo(debit.vessel.cargo ?? [], BOIS_DE_REPARATION, bois);
  if (cale.removed !== bois) return t('sact.entretienSansMateriaux', { enc: etat.taille });
  // MDG 15 l.306
  const critiques = (etat.vessel.criticals ?? []).filter((_, i) => i !== index);
  set({ party: debit.party, vessel: { ...debit.vessel, criticals: critiques, cargo: cale.lots } });
  suite.critiquesTentes = (suite.critiquesTentes ?? []).map(Number).filter((i) => i !== index)
    .map((i) => String(i > index ? i - 1 : i));
  return t('sact.entretienCritiqueRepare', { note, pieces, bois });
}

function appliquerEntretien(get: Get, set: Set, step: CascadeStep, hero: Combatant | undefined) {
  const suite = suiteDEntretien(step);
  const def = suite && activityById(suite.activityId);
  if (!hero || hero.dead || hero.outOfRencontre || !suite) return;
  if (def?.resolver !== 'shipMaintenance') return { consequences: freeCons([t('sact.entretienIndisponible')]) };
  if (step.kind === 'merEntretienChoix') return preparerTravaux(get, set, step, hero, def, suite);
  const etat = etatDEntretien(get);
  if (typeof etat === 'string') return { consequences: freeCons([etat]) };

  if (step.kind === 'merEntretienBlessures') {
    return repriseDEntretien(get, set, hero, def, suite, soinDesBlessures(get, set, etat, step.amount ?? 0));
  }
  if (step.kind === 'merEntretienMateriaux') {
    const pieces = step.amount ?? 0;
    const devis = devisDuCritique(step, etat, pieces);
    const refus = typeof devis === 'string' ? devis : refusDesTestsDEntretien(hero, def);
    if (refus) return repriseDEntretien(get, set, hero, def, suite, refus);
    const test = testDEntretien(get, hero, def, 'merEntretienCritique', etat, { ...step.meta, piecesCritique: pieces });
    if (test) {
      pushStep(set, () => test, 'seaActivities');
      return;
    }
    return repriseDEntretien(get, set, hero, def, suite);
  }
  if (!step.result?.success) return repriseDEntretien(get, set, hero, def, suite, t('sact.entretienEchec'));
  if (step.skill && !peutTenter(hero, { skill: step.skill })) {
    return repriseDEntretien(get, set, hero, def, suite, refusNePeutTenter(hero, { skill: step.skill }));
  }
  if (step.kind === 'merEntretienUsure') {
    return repriseDEntretien(get, set, hero, def, suite, soinDUsure(get, set, etat));
  }
  const devis = devisDuCritique(step, etat, Number(step.meta?.piecesCritique));
  const message = typeof devis === 'string' ? devis : soinDuCritique(get, set, etat, devis, suite);
  return repriseDEntretien(get, set, hero, def, suite, message);
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  'merActiviteCarte', 'merActiviteGenerique', 'merEntretienChoix', 'merEntretienUsure', 'merEntretienBlessures',
  'merEntretienMateriaux', 'merEntretienCritique',
] as const;
/** Les issues de Test étendu que ce module déclare (table `issuesDeTestEtendu`). */
export const ISSUES_DE_TEST_ETENDU = ['merActiviteOpportunite'] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    merEntretienChoix: appliquerEntretien,
    merEntretienUsure: appliquerEntretien,
    merEntretienBlessures: appliquerEntretien,
    merEntretienMateriaux: appliquerEntretien,
    merEntretienCritique: appliquerEntretien,
    /** Cartographie (l.288-290, `merActiviteCarte`) : réussite → Carte marine (valeur = DR en CO, +2 DR
     *  d'Orientation) + Planque optionnelle (l.292). */
    'merActiviteCarte': (get, set, step, hero) => {
      if (!step.result || !hero) return;
      const stashGold = typeof step.meta?.stashGold === 'number' ? step.meta.stashGold : 0;
      const j: string[] = [];
      if (step.result.success) {
        const it = itemFromTrappingById('carte-marine', get().forgerUnId, undefined, contexteDeNaissanceDObjet(hero));
        if (it) {
          it.price = { gold: Math.max(0, step.result.sl), silver: 0, brass: 0 };
          hero.items = [...(hero.items ?? []), it];
          autoStowNewItem(hero, it); // #204 : rangement par défaut
          recomputeLoadout(hero);
        }
        // MDG 15
        j.push(t('sact.chartOk', { name: hero.label, gold: Math.max(0, step.result.sl) }));
        if (stashGold > 0) {
          const stashBrass = stashGold * PA_PER_CO;
          payWithAllocation(get, set, { debits: soloPayer(hero.id, fromBrass(stashBrass)), recipient: hero.id, purpose: 'planque cartographie' });
          set({ bank: [...get().bank, { uid: get().forgerUnId('it'), heroId: hero.id, kind: 'planque', brass: stashBrass, rate: 50, chartSecured: true }] });
          // MDG 15 l.292
          j.push(t('sact.stash', { name: hero.label, money: formatMoney(fromBrass(stashBrass)) }));
        }
      } else {
        j.push(t('sact.chartKo', { name: hero.label }));
      }
      set({ party: [...get().party] });
      return { consequences: freeCons(j) };
    },
    /** Chemin GÉNÉRIQUE data-driven (`merActiviteGenerique`) : recompose `travelActivitySpec` (déterministe,
     *  pas de RNG) depuis `meta.activityId` et applique l'issue de l'Activité au jet DÉJÀ résolu
     *  (`appliquerIssueActivite`, source unique terre et mer). */
    'merActiviteGenerique': (get, set, step, hero) => {
      if (!step.result || !hero) return;
      const def = typeof step.meta?.activityId === 'string' ? activityById(step.meta.activityId) : undefined;
      const spec = def ? travelActivitySpec(hero, def) : null;
      if (!def || !spec) return;
      const { consequences } = appliquerIssueActivite(get, hero, def, spec, step.result);
      set({ party: [...get().party] });
      return { consequences };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  issuesDeTestEtendu: {
    /** Issue de DOMAINE du Commerce d'opportunité (#273 Étape 1, Test étendu 3 tentatives max) : % récupéré
     *  par la table verbatim (`opportunityTradePct`), qu'il ait atteint 10 DR ou buté sur `tentativesMax`. */
    'merActiviteOpportunite': (get, set, p, total) => {
      const meta = p.outcome?.meta;
      const heroId = String(meta?.heroId);
      const investBrass = typeof meta?.investBrass === 'number' ? meta.investBrass : 0;
      const hero = garanti(actorIn(get(), heroId), heroId, 'investisseur');
      const pct = opportunityTradePct(total);
      const back = Math.floor((investBrass * pct) / 100);
      distributeCredit(get, set, fromBrass(back));
      const line = t('sact.tradeDone', { name: hero.label, stake: formatMoney(fromBrass(investBrass)), back: formatMoney(fromBrass(back)), pct });
      noteSeaLine(get, set, [line]);
      continueSeaActivitiesAfterCascade(get, set);
      return { consequences: freeCons([line]) };
    },
  } satisfies PartDeTable<'issuesDeTestEtendu', typeof ISSUES_DE_TEST_ETENDU>,
} satisfies FragmentDeTables;
