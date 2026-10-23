/**
 * ACTIVITÉS EN MER (MDG 15 l.266-306) — « Pour chaque semaine (8 jours) de voyage en mer, chaque
 * Personnage a l'occasion d'effectuer une Activité » (l.268). Le déclencheur hebdomadaire vit dans
 * `finishSeaDay` (8ᵉ journée révolue → `pendingSeaActivities`, la halte de nuit suit à la
 * confirmation) ; ici la RÉSOLUTION des choix — catalogue data-driven UNIQUE (`activities.json`,
 * contexte 'mer', `activitiesFor`), AUCUN second système d'Activités.
 *
 * RAW modélisé :
 *  - Commerce d'opportunité (l.274-286) : investissement ≤ min(bourse, Enc libre du navire en CO),
 *    Test étendu de Marchandage Complexe (−10), 10 DR en ≤ 3 tentatives → % récupéré
 *    (`opportunityTradePct`, table verbatim `sea-cargo.json`).
 *  - Cartographie (l.288-290) : Métier (Cartographe) Complexe (−10) → une Carte marine (trapping
 *    `carte-marine`, +2 DR d'Orientation via la règle `sea-chart-orientation-dr`) d'une valeur de DR CO
 *    (prix d'instance). Les deux ports désignés (l.290) exigeraient un graphe de ports : simplifiés en
 *    « toute route » par cette règle maison éditable.
 *  - Planque gratuite lors de la Cartographie (l.292) : dépôt optionnel (`pick.stashGold`) dans
 *    `bank` (kind `stash`, `chartSecured`), en sûreté tant que le dépositaire garde la carte-marine —
 *    sinon découverte sur un jet ≤ 50 (`bankWithdrawInner`).
 *  - Entraînement d'équipage (l.294-300) : GATE (MDG 14 l.39, l.296) — voir `seaActivityBlocked`.
 *  - Whitelist d'Activités TERRESTRES (l.270 : Apprentissage particulier, Artisanat, Entraînement,
 *    Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension + entraînements
 *    d'Aux Armes !) : « à condition que des installations et des instructeurs adaptés soient
 *    disponibles » — arbitrage sans-MJ : ni installations ni instructeurs sur le navire de campagne
 *    → non proposées en mer (le verbatim est affiché dans la modale, fiche `regles/activites-en-mer`).
 *  - Entretien du navire (l.302-306) : DÉJÀ câblé au Test d'équipage d'ENTRETIEN nocturne du voyage
 *    (MDG 14 l.116-124) — pas de doublon en Activité.
 *
 * SEAM DE JET (#273 Étape 2) : les 3 formes de résolveur (Cartographie mono, chemin générique
 * `travelActivitySpec`, Commerce d'opportunité étendu) sont des étapes de cascade construites en
 * UNE passe (`buildSeaActivitiesCascade`) — plus de bulk synchrone. Cartographie/générique sont POUSSÉES
 * à la porte de séquence, qui dérive la surface de leurs porteurs ; le Commerce d'opportunité SÉQUENCE un
 * Test étendu (`startExtendedTest`, `maxAttempts`+`outcome` #273 Étape 1) par héros à la fois (un seul
 * `pendingExtendedTest` actif) — `pendingSeaActivities.opportunityQueue` porte la file, vidée par
 * `continueSeaActivitiesAfterCascade` jusqu'à la halte de nuit.
 */
import { activityById, activitiesFor, travelActivitySpec, type ActivityDef } from '../engine/activities';
import { appliquerIssueActivite } from './activityIssue';
import { peutTenter, refusNePeutTenter } from '../engine/skills';
import type { PlayerText } from '../i18n/playerText';
import { itemFromTrappingById, recomputeLoadout, autoStowNewItem } from '../engine/items';
import { toBrass, fromBrass, formatMoney, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, payFromGroup, payWithAllocation, soloPayer, distributeCredit } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import { cargoTotalEnc, OPPORTUNITE, opportunityTradePct } from '../engine/seaVoyage';
import { findVehicleById, activityStakeRef, refLabel, dataLabel } from '../data';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { TravelRecapDay } from './travelFlow';
import { toRecapLines } from './recapLine';
import type { Get, Set } from './flowTypes';
import type { BuiltCascadeStep } from './stepBrand';
import { composeRollLabel, effectiveTarget, monoStep, openSequence, pousseSi, freeCons, resultLines, type RollRequest } from './rollSeam';
import { noteSeaLine, patchSea, openSeaHalt } from './seaVoyageFlow';
import { actorIn } from './monde/combatants';
import { garanti } from '../lib/garanti';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';
import { idNeuf } from './plateforme';

/** Choix d'un héros pour la semaine : une Activité du catalogue 'mer' (+ mise du Commerce d'opportunité). */
export interface SeaActivityPick {
  activityId: string;
  /** Commerce d'opportunité (l.276) : couronnes d'or investies. */
  investGold?: number;
  /** Planque gratuite lors de la Cartographie (l.292) : couronnes d'or cachées. */
  stashGold?: number;
}

/** Modale hebdomadaire (8 jours en mer, l.268) — la halte de nuit attend la confirmation. */
export interface PendingSeaActivities {
  picks: Record<string, SeaActivityPick | null>;
  /** Recap du jour à livrer à la halte (les lignes d'Activités s'y ajoutent). */
  day: TravelRecapDay;
  /** Héros dont le Commerce d'opportunité reste à résoudre (Test étendu SÉQUENCÉ — un seul
   *  `pendingExtendedTest` actif à la fois), vidée par `continueSeaActivitiesAfterCascade`. */
  opportunityQueue?: string[];
}

/** Enc LIBRE du navire de campagne (Contenance − cargaison) — plafond du Commerce d'opportunité
 *  (l.276 : « jusqu'à l'équivalent de la valeur totale d'Encombrement disponible et non surchargé
 *  de votre bateau en couronnes d'or »). */
export function vesselFreeEnc(get: Get): number {
  const vessel = get().vessel;
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, capacity - cargoTotalEnc(vessel.cargo ?? []));
}

/** Raison de BLOCAGE d'une Activité en mer pour un héros (affordance expliquée, jamais muette). */
export function seaActivityBlocked(get: Get, def: ActivityDef): string | null {
  if (def.resolver === 'crewTraining') {
    return t('sact.crewIsPlayers');
  }
  if (def.resolver === 'opportunityTrade' && vesselFreeEnc(get) <= 0) {
    return t('sact.noFreeEnc');
  }
  return null;
}

/** Test d'une Activité en mer à compétence FIXE (MDG 15 l.274-290) ; le chemin générique dérive la
 *  sienne du héros (`travelActivitySpec`). Spec par ID (#1341). */
function seaActivityTest(def: ActivityDef): { skill: string; spec?: string } | undefined {
  if (def.resolver === 'seaChart') return { skill: 'metier', spec: 'cartographe' };
  if (def.resolver === 'opportunityTrade') return { skill: OPPORTUNITE.test.skill.id, ...(OPPORTUNITE.test.skill.spec ? { spec: OPPORTUNITE.test.skill.spec } : {}) };
  return undefined;
}

/** Refus NOMMÉ de CE héros pour une Activité en mer dont il ne peut pas tenter le Test (`peutTenter`) :
 *  l'Activité est un choix (MDG 15 l.268), offerte FERMÉE avec sa raison. LDB 09 l.30 ; #2588. PUR. */
export function seaActivityRefus(hero: Combatant, def: ActivityDef): PlayerText | undefined {
  if (def.resolver === 'crewTraining') return undefined;
  const test = seaActivityTest(def);
  if (!test) return travelActivitySpec(hero, def)!.refus;
  return peutTenter(hero, test.skill, test.spec) ? undefined : refusNePeutTenter(hero, { skill: test.skill, ...(test.spec ? { spec: test.spec } : {}) });
}

/** Une Activité de héros ÉLIGIBLE (`!dead`, pick valide, contexte 'mer', non bloquée). PUR. */
function eligibleSeaActivityPicks(get: Get, picks: Record<string, SeaActivityPick | null>): { hero: Combatant; pick: SeaActivityPick; def: ActivityDef }[] {
  const out: { hero: Combatant; pick: SeaActivityPick; def: ActivityDef }[] = [];
  for (const hero of get().party) {
    if (hero.dead || hero.outOfRencontre) continue;
    const pick = picks[hero.id];
    const def = pick ? activityById(pick.activityId) : undefined;
    if (!pick || !def || !def.contexts.includes('mer') || seaActivityBlocked(get, def)) continue;
    out.push({ hero, pick, def });
  }
  return out;
}

/** Étape MONO « Cartographie » (l.288-290, `sea-activity-chart`) : Métier (Cartographe), Complexe (−10). */
function buildSeaChartStep(hero: Combatant, def: ActivityDef, pick: SeaActivityPick): BuiltCascadeStep | undefined {
  const chart = seaActivityTest(def)!;
  const test: RollRequest['test'] = chart;
  const difficulty = def.difficulty ?? 'complexe';
  return monoStep({
    id: `sea-activity-chart-${hero.id}`, kind: 'sea-activity-chart', actor: hero,
    label: composeRollLabel(hero, dataLabel(def.label), test), difficulty, rollLabel: refLabel('skills', { id: chart.skill, ...(chart.spec ? { spec: chart.spec } : {}) }),
    // L'enjeu d'une Activité EST l'Activité choisie : il vit sur SA fiche (`ActivityDef.stake`).
    stake: activityStakeRef(def.id),
    ligne: { test, refus: seaActivityRefus(hero, def) },
    meta: { stashGold: pick.stashGold ?? 0 },
  });
}

/** Étape MONO chemin GÉNÉRIQUE data-driven (`sea-activity-generic`) : `travelActivitySpec` choisit la
 *  meilleure compétence TENTABLE de l'acteur, la porte lance le Test.
 *  `undefined` = Activité SANS Test (Récupérer…), appliquée d'office ici : aucune étape à jouer. La spec
 *  est toujours rendue : le schéma d'édition refuse `freeSkill` à une Activité de contexte 'mer'
 *  (`superRefine` de `data/schemas/defs/activities.ts`).
 *
 *  EXPORTÉE pour être mesurée SEULE : aucune entrée de contexte 'mer' d'`activities.json` n'emprunte
 *  ce résolveur aujourd'hui (les trois sont `seaChart`, `opportunityTrade`, `crewTraining`), mais la
 *  donnée est éditable au Compendium. Ses tests posent une Activité 'mer' dérivée d'une entrée réelle au
 *  catalogue par le seam `setDataset` (`activiteMer.testkit.ts`). */
export function buildSeaGenericStep(get: Get, set: Set, hero: Combatant, def: ActivityDef): BuiltCascadeStep | undefined {
  const spec = travelActivitySpec(hero, def)!;
  if (spec.target == null) {
    const { consequences } = appliquerIssueActivite(get, hero, def, spec, null);
    set({ party: [...get().party] });
    noteSeaLine(get, set, resultLines(consequences).map((l) => l.text));
    return undefined;
  }
  const difficulty = def.difficulty ?? 'intermediaire';
  const test: RollRequest['test'] = { skill: spec.used.id, spec: spec.used.spec };
  return monoStep({
    id: `sea-activity-generic-${hero.id}`, kind: 'sea-activity-generic', actor: hero,
    label: composeRollLabel(hero, def.label, test), difficulty, rollLabel: def.label,
    // Idem : l'enjeu descend à l'Activité jouée, quelle qu'elle soit (fail-closed si elle n'en a pas).
    stake: activityStakeRef(def.id),
    ligne: { test, refus: spec.refus },
    meta: { activityId: def.id },
  });
}

/** Résout les Activités MONO (Cartographie + générique) de la semaine en une CASCADE (#273 Étape 2).
 *  Le Commerce d'opportunité est mis de côté (`oppHeroIds`, Test étendu SÉQUENCÉ
 *  ailleurs — `openRoll` ne porte pas de multi-Round). */
function buildSeaActivitiesCascade(get: Get, set: Set, picks: Record<string, SeaActivityPick | null>): { steps: BuiltCascadeStep[]; oppHeroIds: string[] } {
  const steps: BuiltCascadeStep[] = [];
  const oppHeroIds: string[] = [];
  for (const { hero, pick, def } of eligibleSeaActivityPicks(get, picks)) {
    if (def.resolver === 'opportunityTrade') { oppHeroIds.push(hero.id); continue; }
    const step = def.resolver === 'seaChart' ? buildSeaChartStep(hero, def, pick) : buildSeaGenericStep(get, set, hero, def);
    pousseSi(steps, step);
  }
  return { steps, oppHeroIds };
}

/** Résout les Activités de la semaine (une par héros, l.268) puis rend la main à la halte de nuit —
 *  seam de jet (#273 Étape 2) : les jets deviennent des étapes de cascade influençables ; le
 *  Commerce d'opportunité (Test étendu) est SÉQUENCÉ ensuite,
 *  `continueSeaActivitiesAfterCascade` enchaîne. */
export function seaActivitiesConfirm(get: Get, set: Set, picks: Record<string, SeaActivityPick | null>): void {
  const pending = get().pendingSeaActivities;
  if (!pending) return;
  const { steps, oppHeroIds } = buildSeaActivitiesCascade(get, set, picks);
  set({ pendingSeaActivities: { ...pending, picks, opportunityQueue: oppHeroIds } });
  if (!steps.length) { continueSeaActivitiesAfterCascade(get, set); return; }
  // La semaine d'Activités est UNE séquence, pas deux lots : la surface se dérive de ses porteurs
  // (`openSequence` → `surfaceDesEtapes`, #1479). Un seul héros tenu par un humain suffit à ouvrir la
  // fenêtre, et les rangées que personne ne tient s'y résolvent d'office, VISIBLES au bilan.
  if (openSequence(get, set, { title: t('sact.weekTitle'), icon: 'travel/anchor', purpose: 'seaActivities', steps })) {
    continueSeaActivitiesAfterCascade(get, set);
  }
}

/** Ouvre le Commerce d'opportunité (Test étendu, #273 Étape 1) du PROCHAIN héros de la file — mise
 *  plafonnée (Enc libre en CO, bourse) débitée d'office (comme l'ancien bulk synchrone) ; l'ISSUE
 *  (% récupéré) est résolue par l'applier `sea-activity-opportunity` (`meta` sérialisable, coop). */
function openNextOpportunityTrade(get: Get, set: Set): void {
  const pending = get().pendingSeaActivities;
  const heroId = pending?.opportunityQueue?.[0];
  if (!pending || !heroId) { continueSeaActivitiesAfterCascade(get, set); return; }
  const rest = pending.opportunityQueue!.slice(1);
  set({ pendingSeaActivities: { ...pending, opportunityQueue: rest } });
  const hero = get().party.find((h) => h.id === heroId);
  const pick = pending.picks[heroId];
  const def = pick ? activityById(pick.activityId) : undefined;
  if (!hero || !pick || !def) { continueSeaActivitiesAfterCascade(get, set); return; }
  // Choix non tentable (LDB 09 l.30 ; #2588) : aucune mise, aucun Test, le refus nommé au journal.
  const refus = seaActivityRefus(hero, def);
  if (refus) {
    noteSeaLine(get, set, [refus]);
    continueSeaActivitiesAfterCascade(get, set);
    return;
  }
  const capGold = Math.min(vesselFreeEnc(get), Math.floor(toBrass(partyMoneyTotal(get)) / PA_PER_CO));
  const invest = Math.max(0, Math.min(Math.floor(pick.investGold ?? 0), capGold));
  if (invest <= 0) {
    noteSeaLine(get, set, [t('sact.tradeNoStake', { name: hero.label })]);
    continueSeaActivitiesAfterCascade(get, set);
    return;
  }
  payFromGroup(get, set, fromBrass(invest * PA_PER_CO), { purpose: 'commerce d’opportunité' });
  const test: RollRequest['test'] = seaActivityTest(def)!;
  get().startExtendedTest({
    actorId: hero.id, label: dataLabel(def.label), skillLabel: refLabel('skills', OPPORTUNITE.test.skill),
    target: effectiveTarget(hero, test, OPPORTUNITE.test.difficulty), targetDR: OPPORTUNITE.test.totalDR,
    maxAttempts: OPPORTUNITE.test.maxAttempts,
    outcome: { kind: 'sea-activity-opportunity', meta: { heroId: hero.id, investBrass: invest * PA_PER_CO } },
  });
}

/** Clôture de la CASCADE mono (#273 Étape 2, `purpose:'seaActivities'`) : enchaîne le Commerce
 *  d'opportunité (SÉQUENCÉ) puis la halte de nuit. Appelée aussi directement quand aucune étape mono
 *  n'a été construite, et par l'issue du Test étendu d'opportunité (héros suivant de la file). */
export function continueSeaActivitiesAfterCascade(get: Get, set: Set): void {
  const pending = get().pendingSeaActivities;
  if (!pending) return;
  if (pending.opportunityQueue?.length) { openNextOpportunityTrade(get, set); return; }
  // Toutes les Activités sont résolues (leurs lignes vivent dans `sea.lines`, canal durable partagé —
  // `noteSeaLine`/`commitStep`) : les rapatrier dans le recap du jour puis purger l'accumulateur.
  const plan = get().travelPlan;
  const activityLines = plan?.sea?.lines ?? [];
  const day: TravelRecapDay = { ...pending.day, lines: [...pending.day.lines, ...toRecapLines(activityLines)] };
  if (plan?.sea) patchSea(get, set, { lines: [] });
  set({ pendingSeaActivities: null });
  openSeaHalt(get, set, day); // le recap du jour, Activités comprises, s'y lit
}

/** Catalogue 'mer' (source UNIQUE `activities.json`) — pour la modale. */
export function seaActivitiesCatalog(): ActivityDef[] {
  return activitiesFor('mer');
}

// ── Seam de jet (#273 Étape 2) — appliers des étapes migrées vers la cascade ──────────────────────

export function creerActionsDesActivitesEnMer(get: Get, set: Set) {
  return {
    seaActivitiesConfirm: (picks) => seaActivitiesConfirm(get, set, picks),
  } satisfies Partial<ActionsDuNoyau>;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = ['sea-activity-chart', 'sea-activity-generic'] as const;
/** Les issues de Test étendu que ce module déclare (table `issuesDeTestEtendu`). */
export const ISSUES_DE_TEST_ETENDU = ['sea-activity-opportunity'] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    /** Cartographie (l.288-290, `sea-activity-chart`) : réussite → Carte marine (valeur = DR en CO, +2 DR
     *  d'Orientation) + Planque optionnelle (l.292). */
    'sea-activity-chart': (get, set, step, hero) => {
      if (!step.result || !hero) return;
      const stashGold = typeof step.meta?.stashGold === 'number' ? step.meta.stashGold : 0;
      const j: string[] = [];
      if (step.result.success) {
        const it = itemFromTrappingById('carte-marine', idNeuf);
        if (it) {
          it.price = { gold: Math.max(0, step.result.sl), silver: 0, brass: 0 };
          hero.items = [...(hero.items ?? []), it];
          autoStowNewItem(hero, it); // #204 : rangement par défaut
          recomputeLoadout(hero);
        }
        j.push(t('sact.chartOk', { name: hero.label, gold: Math.max(0, step.result.sl) }));
        const stashCO = Math.max(0, Math.min(stashGold, Math.floor(toBrass(bourseOf(hero)) / PA_PER_CO)));
        if (stashCO > 0) {
          const stashBrass = stashCO * PA_PER_CO;
          payWithAllocation(get, set, { debits: soloPayer(hero.id, fromBrass(stashBrass)), recipient: hero.id, purpose: 'planque cartographie' });
          set({ bank: [...get().bank, { heroId: hero.id, kind: 'stash', brass: stashBrass, rate: 50, chartSecured: true }] });
          j.push(t('sact.stash', { name: hero.label, money: formatMoney(fromBrass(stashBrass)) }));
        }
      } else {
        j.push(t('sact.chartKo', { name: hero.label }));
      }
      set({ party: [...get().party] });
      return { consequences: freeCons(j) };
    },
    /** Chemin GÉNÉRIQUE data-driven (`sea-activity-generic`) : recompose `travelActivitySpec` (déterministe,
     *  pas de RNG) depuis `meta.activityId` et applique l'issue de l'Activité au jet DÉJÀ résolu
     *  (`appliquerIssueActivite`, source unique terre et mer). */
    'sea-activity-generic': (get, set, step, hero) => {
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
     *  par la table verbatim (`opportunityTradePct`), qu'il ait atteint 10 DR ou buté sur `maxAttempts`. */
    'sea-activity-opportunity': (get, set, p, total) => {
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
