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
 * `resolveTravelActivity`, Commerce d'opportunité étendu) sont des étapes de cascade construites en
 * UNE passe (`buildSeaActivitiesCascade`) — plus de bulk synchrone. Cartographie/générique sont POUSSÉES
 * à la porte de séquence, qui dérive la surface de leurs porteurs ; le Commerce d'opportunité SÉQUENCE un
 * Test étendu (`startExtendedTest`, `maxAttempts`+`outcome` #273 Étape 1) par héros à la fois (un seul
 * `pendingExtendedTest` actif) — `pendingSeaActivities.opportunityQueue` porte la file, vidée par
 * `continueSeaActivitiesAfterCascade` jusqu'à la halte de nuit.
 */
import { battleRng } from './battleRng';
import { openRest, placesOfKind } from './restFlow';
import { activityById, activitiesFor, travelActivitySpec, applyTravelActivityResult, type ActivityDef } from '../engine/activities';
import { applyOps } from '../engine/ops';
import { itemFromTrappingById, recomputeLoadout, autoStowNewItem } from '../engine/items';
import { toBrass, fromBrass, formatMoney, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, payFromGroup, payWithAllocation, soloPayer, distributeCredit, bourseOf } from './bourseFlow';
import { cargoTotalEnc, OPPORTUNITE, opportunityTradePct } from '../engine/seaVoyage';
import { findVehicleById, activityStakeRef, refLabel, dataLabel } from '../data';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { TravelRecapDay } from './travelFlow';
import { toRecapLines } from './recapLine';
import type { Get, Set } from './flowTypes';
import type { BuiltCascadeStep } from './stepBrand';
import { composeRollLabel, effectiveTarget, monoStep, openSequence, pousseSi, freeCons, type RollRequest } from './rollSeam';
import { registerCascadeApplier, registerExtendedTestOutcome } from './cascade';
import { noteSeaLine, patchSea } from './seaVoyageFlow';
import { actorIn, garanti } from './combatants';

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
  // Spec par ID (#1341) : `testValue` compare `s.spec === spec` à l'ID porté par l'instance — un
  // libellé ne matcherait aucun personnage et jaugerait le cartographe à sa carac nue.
  const test: RollRequest['test'] = { skill: 'metier', spec: 'cartographe' };
  const difficulty = def.difficulty ?? 'complexe';
  return monoStep({
    id: `sea-activity-chart-${hero.id}`, kind: 'sea-activity-chart', actor: hero,
    label: composeRollLabel(hero, dataLabel(def.label), test), difficulty, rollLabel: refLabel('skills', { id: 'metier', spec: 'cartographe' }),
    // L'enjeu d'une Activité EST l'Activité choisie : il vit sur SA fiche (`ActivityDef.stake`).
    stake: activityStakeRef(def.id),
    ligne: { test },
    meta: { stashGold: pick.stashGold ?? 0 },
  });
}

/** Étape MONO chemin GÉNÉRIQUE data-driven (`sea-activity-generic`) : `travelActivitySpec` choisit la
 *  MEILLEURE compétence de l'acteur (identique `resolveTravelActivity`), la porte lance le Test.
 *  `undefined` = Activité SANS Test (Récupérer…) — appliquée d'office ici, aucune étape à jouer.
 *
 *  EXPORTÉE pour être mesurée SEULE : aucune entrée de contexte 'mer' d'`activities.json` n'emprunte
 *  ce résolveur aujourd'hui (les trois sont `seaChart`, `opportunityTrade`, `crewTraining`), et le
 *  catalogue est un module partagé qu'un test ne peut pas peupler sans fuir (`isolate: false`). Le
 *  `def` étant un ARGUMENT, la fonction s'exerce telle quelle avec une Activité réelle. */
export function buildSeaGenericStep(get: Get, set: Set, hero: Combatant, def: ActivityDef): BuiltCascadeStep | undefined {
  const spec = travelActivitySpec(hero, def);
  if (spec.target == null) {
    const out = applyTravelActivityResult(spec, def, null);
    if (out.ops.length) {
      const opLines = applyOps(hero, out.ops, { label: def.label, rng: battleRng(), now: get().gameTime, source: { kind: 'activity', id: def.id } });
      set({ party: [...get().party] });
      noteSeaLine(get, set, opLines);
    }
    return undefined;
  }
  const difficulty = def.difficulty ?? 'intermediaire';
  const test: RollRequest['test'] = { skill: spec.used?.id, spec: spec.used?.spec };
  return monoStep({
    id: `sea-activity-generic-${hero.id}`, kind: 'sea-activity-generic', actor: hero,
    label: composeRollLabel(hero, def.label, test), difficulty, rollLabel: def.label,
    // Idem : l'enjeu descend à l'Activité jouée, quelle qu'elle soit (fail-closed si elle n'en a pas).
    stake: activityStakeRef(def.id),
    ligne: { test },
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
  if (!hero || !pick) { continueSeaActivitiesAfterCascade(get, set); return; }
  const capGold = Math.min(vesselFreeEnc(get), Math.floor(toBrass(partyMoneyTotal(get)) / PA_PER_CO));
  const invest = Math.max(0, Math.min(Math.floor(pick.investGold ?? 0), capGold));
  if (invest <= 0) {
    noteSeaLine(get, set, [t('sact.tradeNoStake', { name: hero.label })]);
    continueSeaActivitiesAfterCascade(get, set);
    return;
  }
  payFromGroup(get, set, fromBrass(invest * PA_PER_CO), { purpose: 'commerce d’opportunité' });
  const test: RollRequest['test'] = { skill: OPPORTUNITE.test.skill.id, spec: OPPORTUNITE.test.skill.spec };
  get().startExtendedTest({
    actorId: hero.id, label: dataLabel(activityById(pick.activityId)?.label ?? pick.activityId), skillLabel: refLabel('skills', OPPORTUNITE.test.skill),
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
  // Halte de nuit (machinerie EXISTANTE) — le recap du jour, Activités comprises, s'y lit. En mer, on
  // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.
  openRest(get, set, { places: get().vessel ? { bord: true } : placesOfKind('camp'), travelHalt: true, travelDay: day });
}

/** Catalogue 'mer' (source UNIQUE `activities.json`) — pour la modale. */
export function seaActivitiesCatalog(): ActivityDef[] {
  return activitiesFor('mer');
}

// ── Seam de jet (#273 Étape 2) — appliers des étapes migrées vers la cascade ──────────────────────

/** Cartographie (l.288-290, `sea-activity-chart`) : réussite → Carte marine (valeur = DR en CO, +2 DR
 *  d'Orientation) + Planque optionnelle (l.292). */
registerCascadeApplier('sea-activity-chart', (get, set, step, hero) => {
  if (!step.result || !hero) return;
  const stashGold = typeof step.meta?.stashGold === 'number' ? step.meta.stashGold : 0;
  const j: string[] = [];
  if (step.result.success) {
    const it = itemFromTrappingById('carte-marine');
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
});

/** Chemin GÉNÉRIQUE data-driven (`sea-activity-generic`) : recompose `travelActivitySpec` (déterministe,
 *  pas de RNG) depuis `meta.activityId` pour appliquer `onSuccess` (GameOp, langue UNIQUE des effets)
 *  au jet DÉJÀ résolu (`applyTravelActivityResult`, jumeau PUR de `resolveTravelActivity`). */
registerCascadeApplier('sea-activity-generic', (get, set, step, hero) => {
  if (!step.result || !hero) return;
  const def = typeof step.meta?.activityId === 'string' ? activityById(step.meta.activityId) : undefined;
  if (!def) return;
  const spec = travelActivitySpec(hero, def);
  const out = applyTravelActivityResult(spec, def, step.result);
  if (!out.ops.length) return { consequences: freeCons([]) };
  const opLines = applyOps(hero, out.ops, { label: def.label, rng: battleRng(), now: get().gameTime, source: { kind: 'activity', id: def.id } });
  set({ party: [...get().party] });
  return { consequences: freeCons(opLines) };
});

/** Issue de DOMAINE du Commerce d'opportunité (#273 Étape 1, Test étendu 3 tentatives max) : % récupéré
 *  par la table verbatim (`opportunityTradePct`), qu'il ait atteint 10 DR ou buté sur `maxAttempts`. */
registerExtendedTestOutcome('sea-activity-opportunity', (get, set, p, total) => {
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
});
