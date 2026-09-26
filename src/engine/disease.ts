/**
 * Maladies et infections — Livre de base, « Maladies et infections » (20-Maladies et infections.md).
 * Moteur PUR : on NE modélise QUE ce que la source quantifie. Les valeurs (Résistance) sont passées par
 * l'appelant ; `trauma.ts` lit `diseasePassiveOps` d'ici. N'importe `ops`
 * qu'en TYPE (`GameOp`), jamais `applyOps` — les conséquences `onFail` sont appliquées CÔTÉ STATE
 * (`restFlow`, via `applyOps`) → pas de cycle ops↔disease. Seule liaison croisée : `conditions.ts`
 * (pose d'État par la source unique `addCondition` ici, lecture de `symptomLockedUntilCured` là-bas) —
 * deux déclarations de fonction hissées, aucune évaluation croisée à l'initialisation des modules.
 *
 * Cycle de vie (l.10-24) : Contraction (Test raté) → Incubation → symptômes ACTIFS → Durée → résolution
 * (capacité `endTest` : Test de fin, sinon guérison naturelle). Incubation/durée RAW en jours, heures OU
 * minutes (`DiseaseTime`), décomptées en MINUTES écoulées (`tickDisease`) ; les Tests de cycle RAW
 * « par jour » (symptômes/gangrène) restent cadencés à la JOURNÉE pleine.
 *
 * SYMPTÔMES = DONNÉE (`symptoms.json`, éditable au Codex), pas un enum. La mécanique vit sur le symptôme
 * en 3 canaux (comme un trait/qualité) — ce module ne fait que les LIRE :
 *  - `passive`/`passiveBySeverity` (GameOp) : pénalités continues (fièvre −10, convulsions −10/−20) ET
 *    États PORTÉS (op `condition` — Fièvre (Grave) → Inconscient l.170, Malaise → Exténué l.188)
 *    → collectées par `diseasePassiveOps` → `passiveMods` (kind 'maladie', annulable par Détermination) ;
 *    les `condition` y sont MATÉRIALISÉES sur le porteur par `syncDerivedConditions` (engine/conditions).
 *  - `onTick` : cycle quotidien — soit une ÉPREUVE (`test`, le nœud `test` du Flow : jet + conséquence
 *    de la branche `fail`), DIFFÉRÉE en cascade influençable (`diseaseTick`) ; soit une conséquence
 *    CERTAINE (`ops`), appliquée sans jet.
 *  - `capabilities` (drapeaux irréductibles lus par la machinerie de CYCLE ci-dessous) : `blocksHealing`
 *    (Blessé/Gangrène), `amputation` (Gangrène), `contagious` (Toux),
 *    `nausea` (combat), `endTest` (Persistant).
 */
import { Combatant, Difficulty, UpkeepDeferTest, HitLocation, effectRef, type ConditionEmit, type ModLine, type TestIds } from './types';
import type { Duration } from './duration';
import { RNG, defaultRNG, roll, type DiceSpec, rollDice, formatDice } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { findTableEntry } from './tables';
import { spellOps, type FlowTestNode } from './flowCore';
import locJson from '../data/localisation.json';
// Table de Localisation CANONIQUE (`src/data/localisation.json`, humanoïde) via la primitive `findTableEntry`
// — MÊME source/lookup que `engine/combat.hitLocation`, réutilisée ici sans cycle (json + tables = feuilles).
const HUMANOID_LOC = (locJson as { personnage: { shapes: Record<string, { min: number; max: number; loc: HitLocation }[]> } }).personnage.shapes.humanoide;
const rollBlisterLocation = (rng: RNG): HitLocation => findTableEntry(HUMANOID_LOC, roll(1, 100, rng)).loc;
import { rollTest } from './tests';
import { maladies, diseaseLabel, findSymptomById, symptomLabel, conditionLabel, SYMPTOM_SEVERITIES, memoParVersion, type SymptomCapabilities } from '../data';
import type { GameOp, PassiveMod } from './ops';
import type { PsychTrait, PsychType } from './psychology';
import { t, type MsgKey } from '../i18n';
import { fateSaveOrDie } from './fortune';
import { addCondition } from './conditions';
import { sourceSuspended, suspendSource } from './suspension'; // module FEUILLE : suspension GÉNÉRALE d'une source passive
import type { CodexTarget } from './ruleRefs';

/** Unité d'un temps de maladie (incubation/durée). La base de calcul/stockage reste la MINUTE (`clock.ts`). */
export type TimeUnit = 'days' | 'hours' | 'minutes';
const UNIT_MINUTES: Record<TimeUnit, number> = { days: MINUTES_PER_DAY, hours: 60, minutes: 1 };

/** Incubation/durée d'une maladie : un jet de dés (`dice`) + son `unit`. Source UNIQUE (RAW « Incubation »/
 *  « Durée »), convertie en MINUTES par `rollDiseaseTime` → plus de perte « sous-journalier ≈ 0 jour ».
 *  Une valeur FIXE (Colique « 2 heures ») = `{ dice:{n:0,sides:0,plus:2}, unit:'hours' }` ; « instantanée »
 *  = `{ dice:{n:0,sides:0}, unit:'hours' }` (= 0). */
export interface DiseaseTime {
  dice: DiceSpec;
  unit: TimeUnit;
}
/** Tire un `DiseaseTime` → MINUTES (jet × facteur d'unité). PUR (RNG injecté). */
export const rollDiseaseTime = (t: DiseaseTime, rng: RNG = defaultRNG): number => rollDice(t.dice, rng) * UNIT_MINUTES[t.unit];
/** Écriture d'affichage : « 1d10 heures », « 3d10+10 jours », « 2 heures » (valeur fixe). */
export function formatDiseaseTime(time: DiseaseTime): string {
  const label = t(time.unit === 'days' ? 'dz.unitDays' : time.unit === 'hours' ? 'dz.unitHours' : 'dz.unitMinutes');
  const fixed = time.dice.n === 0 || time.dice.sides === 0; // pas de dé → valeur fixe (le seul `plus`)
  return `${fixed ? String(time.dice.plus ?? 0) : formatDice(time.dice)} ${label}`;
}

/** Restant d'une instance (base MINUTES) → libellé humain à l'échelle la plus parlante (j / h / min). */
export function formatRemaining(minutes: number): string {
  const m = Math.max(0, minutes);
  if (m >= MINUTES_PER_DAY) return t('dz.remainDays', { n: Math.round(m / MINUTES_PER_DAY) });
  if (m >= 60) return t('dz.remainHours', { n: Math.round(m / 60) });
  return t('dz.remainMinutes', { n: Math.round(m) });
}

/** Instance de symptôme sur une maladie : RÉFÉRENCE un symptôme de `symptoms.json` par `symptomId`,
 *  + `severity`/`difficulty` PAR-INSTANCE (Convulsions (Modéré) → `passiveBySeverity.moderee` ; Persistant
 *  (Accessible) → difficulté du Test de fin). La mécanique (passive/onTick/capabilities) vit sur la
 *  DONNÉE du symptôme, lue par les helpers ci-dessous — plus d'enum de kinds en dur. */
export interface DiseaseSymptom {
  symptomId: string;
  severity?: 'moderee' | 'grave';
  difficulty?: Difficulty;
  /** LOCALISATION/précision imprimée de l'instance (« Gonflement (Visage et tête) », Fièvre Cérébrale
   *  Pourpre — EDO 11 l.119) : affichage seul (convention `spec` des compétences/talents) — la mécanique
   *  par-localisation du symptôme vit dans sa `desc`. */
  spec?: string;
}

export interface DiseaseDef {
  /** id STABLE (slug du nom) — clé de `maladies.json`, cible de `Disease.name` et des refs. */
  id: string;
  type: 'maladies';
  /** Libellé d'affichage (français) — résolu via `diseaseLabel` ; ≠ id. Convention `label` des catalogues. */
  label: string;
  /** Description VERBATIM (LDB 20) — affichage seul (jamais lue par le moteur), comme toute entité. */
  desc: string;
  /** Difficulté du Test de Contraction (pour mémoire/journal — la contraction est déclenchée par l'appelant). */
  contractDifficulty: Difficulty;
  /** Incubation RAW (jours/heures/minutes) — tirée en minutes à la contraction. */
  incubation: DiseaseTime;
  /** Durée active RAW (jours/heures/minutes) — tirée en minutes à la contraction. */
  duration: DiseaseTime;
  symptoms: DiseaseSymptom[];
  /** Vérole Urticante (l.97) : « vous ne pouvez pas l'attraper une seconde fois » — immunité après guérison. */
  immuneAfterCure?: boolean;
  /** Passifs actifs pendant toute l'INFECTION (incubation ET phase active — Vers du Reik : « −5 à tous les
   *  Tests de Résistance permettant de résister aux maladies » pour chaque période complète de 30 jours
   *  d'infection, MSRC 16 l.138). Un op `diseaseTestMod` y est RAMPÉ par tranche de 30 jours écoulés depuis
   *  la contraction (`activeDiseaseTestMod`), puis DÉCROÎT de 1/jour après la fin (résidu). Éditable au Codex. */
  infectionPassive?: GameOp[];
  /** Un porteur ACTIF qui boit à un tonneau d'eau risque de le rendre contagieux pour quiconque y boit
   *  ensuite (MDG 14 l.209). Drapeau DÉCLARATIF lu par `buildBarrelSteps` (`state/seaVoyageFlow`). */
  contaminatesWaterBarrel?: boolean;
  /** Test de cycle quotidien porté par la MALADIE elle-même (≠ par un de ses symptômes) — EDOC 08
   *  l.104-108. `test` est le nœud `test` du Flow : il porte le jet ET sa conséquence (branche `fail`),
   *  appliquée par le MÊME canal différé/influençable que les `onTick` de symptôme (`diseaseTick`).
   *  `symptomId` NOMME le symptôme que le Test met en jeu (libellé d'étape + réf d'enjeu). CADENCE
   *  RÉELLE : chaque JOUR D'ENTRETIEN — écart mesuré à la condition de déclenchement de `EDOC 08 l.104`,
   *  consigné au site de roulage (#674, `tickDisease`). */
  dailyTest?: { test: FlowTestNode; symptomId: string };
  /** MUE en une autre maladie au-delà de `afterDays` jours de phase ACTIVE — EDOC 08 l.122.
   *  `into` = id d'une entrée de `maladies.json`. */
  mutation?: { afterDays: number; into: string };
  /** RÉ-EXPOSITION à la cause de contraction alors que la maladie est DÉJÀ portée — EDOC 08 l.122 :
   *  `prolonge` (même graphie que `incubation`/`duration`) est tiré et allonge la durée en cours.
   *  Absent = une ré-exposition ne fait rien. */
  reExposition?: { prolonge: DiseaseTime };
}

/** Instance de maladie portée par un personnage. */
export interface Disease {
  /** id de la maladie (`maladies.json`) — ≠ libellé (résolu à l'affichage via `diseaseLabel`). #598 */
  id: string;
  symptoms: DiseaseSymptom[];
  phase: 'incubation' | 'active';
  /** MINUTES restantes dans la phase courante (incubation, puis durée active). Base = la minute
   *  (`clock.ts`) → une incubation/durée sous-journalière (heures/minutes) est décomptée fidèlement. */
  minutesLeft: number;
  /** Durée active EN MINUTES (mémorisée pendant l'incubation pour la basculer une fois l'incubation finie). */
  durationMinutes: number;
  /** Difficulté du Test « persistant » de fin de durée (dérivée des symptômes). */
  persistDifficulty?: Difficulty;
  /** Gangrène (l.135+) : échecs cumulés du Test journalier — au-delà du BE, la Localisation est perdue. */
  gangreneFails?: number;
  /** Gangrène : la Localisation est devenue inutilisable (Amputation requise — journalisé). */
  gangreneLost?: boolean;
  /** Bénédiction de Convalescence reçue (LDB 41 : « une fois par maladie et par personne » — le champ
   *  vit sur l'instance de Disease, qui appartient à un seul Combatant). */
  convalescenceBlessed?: boolean;
  /** Cascade de nuit : le Test « persistant » de fin de durée est DIFFÉRÉ (étape influençable) ; la
   *  maladie reste en attente de résolution jusqu'à la validation de l'étape (`applyDiseasePersist`). */
  endTestPending?: boolean;
  /** Jours pleins écoulés en PHASE ACTIVE — cadence les cycles `onTick.afterDays`/`once` (Vers de carie
   *  J+7, Vers du Reik éclatement au 7ᵉ jour, MSRC 16). Incrémenté à chaque journée pleine active. */
  activeDaysElapsed?: number;
  /** MINUTES totales écoulées depuis la CONTRACTION (toutes phases) — base de la rampe « −5 par période
   *  complète de 30 jours d'infection » des passifs d'infection (Vers du Reik, MSRC 16 l.138). */
  infectedMinutes?: number;
  /** Localisation de la lésion (cloque du Vers du Reik) TIRÉE à l'entrée en phase active (jet de
   *  Localisation canonique) — gate les `visiblePassive` d'un symptôme (−10 Soc si visible, MSRC 16 l.140). */
  blisterLocation?: import('./types').HitLocation;
}


// Registre des maladies CÂBLÉES — DÉRIVÉ de `maladies.json` (data app-owned, éditable au Codex), keyé
// par `id`. Les valeurs verbatim (LDB 20) vivent dans la donnée ; le COMPORTEMENT (cycle,
// symptômes) reste ici. Ajouter une maladie = une entrée dans `maladies.json`.
export const diseaseDefs = memoParVersion('maladies', (): Record<string, DiseaseDef> => Object.fromEntries(
  (maladies as DiseaseDef[]).map((m) => [m.id, m]),
));
/** ids des maladies CANONIQUES (LDB 20) référencées par le moteur (cascade persistant, contagions). Pas de
 *  chaîne magique. Garde-fou de synchro `DISEASES`⇄`maladies.json` : `refs-migrated.test`. */
export const DISEASES = {
  infectionMineure: 'infection-mineure', blessurePurulente: 'blessure-purulente', infectionDuSang: 'infection-du-sang',
  couranteGalopante: 'courante-galopante', fievreDuRongeur: 'fievre-du-rongeur', fluxSanglant: 'flux-sanglant',
  pesteNoire: 'peste-noire', veroleDuTanneur: 'verole-du-tanneur', veroleUrticante: 'verole-urticante',
} as const;

/** Construit une instance de maladie (tire incubation/durée → MINUTES). `opts.incubation`/`opts.duration`
 *  figent les jets EN JOURS (tests, ou contraction « instantanée » depuis un autre symptôme — l.32 :
 *  `{ incubation: 0 }`). Renvoie `null` si inconnue. */
export function contractDisease(
  id: string,
  rng: RNG = defaultRNG,
  opts?: { incubation?: number; duration?: number },
): Disease | null {
  const def = diseaseDefs()[id];
  if (!def) return null;
  const incub = Math.max(0, opts?.incubation != null ? opts.incubation * MINUTES_PER_DAY : rollDiseaseTime(def.incubation, rng));
  const dur = Math.max(1, opts?.duration != null ? opts.duration * MINUTES_PER_DAY : rollDiseaseTime(def.duration, rng));
  const persist = def.symptoms.find((s) => symptomHasCapability(s.symptomId, 'endTest'))?.difficulty;
  return {
    id,
    // COPIE par instance : l'aggravation d'un symptôme (`aggravateSymptom`) mute l'INSTANCE, jamais
    // le catalogue partagé `diseaseDefs()` — et deux instances de la même maladie ne partagent aucun
    // objet de symptôme.
    symptoms: def.symptoms.map((s) => ({ ...s })),
    phase: incub > 0 ? 'incubation' : 'active',
    minutesLeft: incub > 0 ? incub : dur,
    durationMinutes: dur,
    persistDifficulty: persist,
  };
}

/** GameOp PASSIFS d'une instance de symptôme : `passive` PLUS la liste de CHAQUE palier ATTEINT
 *  (échelle `SYMPTOM_SEVERITIES`, moderee → grave). Lookup PAR CLÉ, zéro branche par palier.
 *  Les listes s'AJOUTENT ; la MAGNITUDE portée par un palier est ABSOLUE (LDB 20 l.157), et c'est le
 *  pool « pire pénalité » d'`effectiveChar` (`engine/characteristics.ts`) qui la fait l'emporter sur
 *  celle de base — les deux ops coexistent, aucune ne s'efface. Un palier n'a donc à déclarer que ce
 *  qu'il change : l.170 n'ajoute qu'un État, les −10 de base tiennent sans être recopiés.
 *  `severity` explicite = la sévérité EFFECTIVE (atténuation l.159) ; défaut = celle de l'instance.
 *  Lus par `passiveMods` (pénalités) et `syncDerivedConditions` (États portés). */
export function symptomPassive(inst: DiseaseSymptom, severity: 'moderee' | 'grave' | undefined = inst.severity): GameOp[] {
  const s = findSymptomById(inst.symptomId);
  if (!s) return [];
  const out: GameOp[] = [...(s.passive ?? [])];
  if (!severity) return out;
  for (const palier of SYMPTOM_SEVERITIES) {
    out.push(...(s.passiveBySeverity?.[palier] ?? []));
    if (palier === severity) break;
  }
  return out;
}
/** Identité Codex d'un symptôme — forme SOURCE du mécanisme général de suspension. */
const srcSymptome = (symptomId: string): CodexTarget => ({ category: 'symptoms', id: symptomId });

/** Le symptôme `symptomId` est-il SUSPENDU chez `c` ? SPÉCIALISATION mince de `sourceSuspended`
 *  (`engine/suspension.ts`) : ses canaux `passive`/`onTick` sont ignorés tant que l'effet dure ;
 *  restitués d'office à l'expiration (l'effet quitte la liste). */
export function symptomSuppressed(c: Combatant, symptomId: string): boolean {
  return sourceSuspended(c, srcSymptome(symptomId));
}
/** SPÉCIALISATION du poseur unique (`suspendSource`) pour l'op `suppressSymptom` — Racine de terre,
 *  LDB 72 l.28. */
export function suspendSymptom(c: Combatant, symptomId: string, duration: Duration, label: string, effectId?: string): void {
  suspendSource(c, srcSymptome(symptomId), duration, label, effectId);
}
/** Bonus/malus NOMMÉS d'effets ACTIFS aux Tests liés à la maladie `diseaseName` (op `diseaseTestMod` —
 *  Fleur de lune +30 vs Peste noire, Racine de terre +10, Tonique digestif +20), plus la rampe
 *  d'infection et le résidu (MSRC 16 l.138). Chacun voyage en `ModLine` (étiquette + renvoi Codex)
 *  jusqu'à la ligne de jet de la porte : la valeur d'un Test de maladie n'en absorbe plus aucune. */
export function diseaseTestModLines(c: Combatant, diseaseName: string): ModLine[] {
  const lignes: ModLine[] = [];
  for (const e of c.activeEffects ?? []) {
    const m = e.diseaseTestMod;
    if (!m || (m.diseases && !m.diseases.includes(diseaseName)) || !m.amount) continue;
    // Renvoi Codex : l'entité SOURCE de l'effet quand elle est propagée, sinon la MALADIE que ce
    // modificateur vise — jamais une chip nue.
    lignes.push({ label: e.label, famille: 'jet', value: m.amount, ref: effectRef(e) ?? { category: 'maladies', id: diseaseName } });
  }
  // Passifs d'INFECTION (Vers du Reik « −5 aux Tests de Résistance par période complète de 30 jours
  // d'infection », MSRC 16 l.138) : rampés par le nombre de tranches de 30 jours écoulées depuis la
  // contraction — sur TOUTE l'infection (incubation ET phase active, l.138 « d'infection »).
  const PERIOD = 30 * MINUTES_PER_DAY; // MSRC 16 l.138 (« période complète de 30 jours »)
  for (const dz of c.diseases ?? []) {
    const periods = Math.floor((dz.infectedMinutes ?? 0) / PERIOD);
    if (periods <= 0) continue;
    for (const op of diseaseDefs()[dz.id]?.infectionPassive ?? []) {
      if (op.op === 'diseaseTestMod' && (!op.diseases || op.diseases.includes(diseaseName)) && op.amount) {
        lignes.push({ label: diseaseLabel(dz.id), famille: 'jet', value: op.amount * periods, ref: { category: 'maladies', id: dz.id } });
      }
    }
  }
  // Résidu POST-fin qui décroît de 1/jour (Vers du Reik « réduite de 1 point par jour après la mort du
  // ver », MSRC 16 l.138) : magnitude ≥ 0 stockée sur le porteur, retranchée aux Tests (pénalité négative).
  if (c.residualDiseaseTestMod) lignes.push({ label: t('dz.residualMod'), famille: 'jet', value: -c.residualDiseaseTestMod, ref: { category: 'maladies', id: diseaseName } });
  return lignes;
}
/** Σ des lignes ci-dessus — la VALEUR seule, pour les sites qui n'affichent pas de ligne (Test de
 *  CONTRACTION roulé au moteur, `rollContraction`). Dérivée, jamais recalculée en parallèle. */
export function activeDiseaseTestMod(c: Combatant, diseaseName: string): number {
  return diseaseTestModLines(c, diseaseName).reduce((s, m) => s + m.value, 0);
}
/** Fige le RÉSIDU post-fin d'une maladie à `infectionPassive` (Vers du Reik) : la pénalité accumulée
 *  (magnitude × tranches de 30 jours) reste sur le porteur et décroît de 1/jour (MSRC 16 l.138). */
function snapshotInfectionResidual(c: Combatant, dz: Disease): void {
  const periods = Math.floor((dz.infectedMinutes ?? 0) / (30 * MINUTES_PER_DAY));
  if (periods <= 0) return;
  let mag = 0;
  for (const op of diseaseDefs()[dz.id]?.infectionPassive ?? []) if (op.op === 'diseaseTestMod') mag += Math.abs(op.amount) * periods;
  if (mag > 0) c.residualDiseaseTestMod = (c.residualDiseaseTestMod ?? 0) + mag;
}
/** Instances de symptôme ACTIVES et NON suspendues du porteur (maladies en phase `active`, hors
 *  `suppressSymptom`) — ACCESSEUR CANONIQUE unique. Base commune de `diseasePassiveOps` (canal passif)
 *  et des `effects` DÉCLENCHÉS des symptômes (source du dispatcher, `state/triggeredEffects`). */
export function activeSymptoms(c: Combatant): DiseaseSymptom[] {
  return (c.diseases ?? [])
    .filter((d) => d.phase === 'active')
    .flatMap((d) => d.symptoms.filter((s) => !symptomSuppressed(c, s.symptomId)));
}
/** Passifs de TOUTES les maladies ACTIVES (collecte unifiée, reprise telle quelle par `passiveMods`).
 *  Un symptôme SUSPENDU (`suppressSymptom`) n'émet rien. Les `visiblePassive` (Vers du Reik −10 Soc) ne
 *  s'émettent que si la lésion tirée (`blisterLocation`) est dans les `visibleLocations` `maison` du symptôme.
 *  Chaque op sort emballée en `PassiveMod` kind `maladie`, `src` = le SYMPTÔME émetteur : c'est lui qui
 *  nomme la pénalité à l'écran (« −20 Crampes abdominales »), jamais un « Maladie » générique. */
export function diseasePassiveOps(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const dz of (c.diseases ?? []).filter((d) => d.phase === 'active')) {
    for (const inst of dz.symptoms) {
      if (symptomSuppressed(c, inst.symptomId)) continue;
      const src = { category: 'symptoms', id: inst.symptomId };
      for (const op of symptomPassive(inst, severiteEffective(c, dz.id, inst))) out.push({ op, kind: 'maladie', src });
      const sd = findSymptomById(inst.symptomId);
      if (sd?.visiblePassive?.length && dz.blisterLocation && (sd.visibleLocations ?? []).includes(dz.blisterLocation)) {
        for (const op of sd.visiblePassive) out.push({ op, kind: 'maladie', src, visible: true });
      }
    }
  }
  return out;
}
/** Traits PSYCHOLOGIQUES conférés par les symptômes ACTIFS — op `grantPsychTrait` du MÊME canal `passive`
 *  que les pénalités continues (Rage meurtrière → Haine (toutes les choses vivantes) + Frénésie,
 *  Middenheim p.131). DÉRIVÉS, pas attachés : présents tant que la maladie est active (filtre de
 *  `diseasePassiveOps`), retirés d'office à la guérison — comme tout passif, ce module ne fait que LIRE le
 *  symptôme (jamais de mutation de `c.psychTraits` ni d'`applyOps`, donc aucun bookkeeping attache/détache).
 *  Fusionnés aux Traits STOCKÉS par `effectivePsychTraits` (psychology), seul POINT DE LECTURE. */
export function diseasePsychTraits(c: Combatant): PsychTrait[] {
  const out: PsychTrait[] = [];
  for (const { op } of diseasePassiveOps(c)) {
    if (op.op === 'grantPsychTrait') out.push({ type: op.psychType as PsychType, ...(op.cible ? { cible: op.cible } : {}) });
  }
  return out;
}
/**
 * Cycle quotidien d'une instance de symptôme, en DEUX formes exclusives : une ÉPREUVE (Difficulté ET
 * ids de ce qui est testé — l'un ne va pas sans l'autre, le schéma le refuse) ou une conséquence
 * CERTAINE (ni jet, ni ids). Le type porte l'exclusivité : un site ne peut pas différer un jet sans
 * dire ce qu'il teste (#1657 B3-3).
 */
export type CycleQuotidien =
  | { difficulty: Difficulty; test: TestIds; onFail: GameOp[]; afterDays?: number; once?: boolean }
  | { difficulty?: undefined; test?: undefined; onFail: GameOp[]; afterDays?: number; once?: boolean };

/**
 * Cycle quotidien d'une instance de symptôme (Blessé/Toxine/Vers) — lecture PURE de la donnée : les
 * ops de la branche `fail` du nœud sont extraites par `spellOps` (`flowCore`), comme `resolveCritique`.
 * `difficulty` ABSENTE = cycle SANS jet : la conséquence `ops` du porteur est certaine. Sinon la
 * Difficulté est celle du nœud, INDEXÉE sur la sévérité EFFECTIVE de l'instance quand le symptôme le
 * prévoit (`difficultyBySeverity` — Toxine, LDB 20 l.215 : Modéré→Facile, Grave→Accessible) : le
 * paramètre `severite` la porte (`severiteEffective` — LDB 20 l.159, une atténuation en cours
 * transforme le cycle comme elle transforme les passifs), à défaut celle que l'instance PORTE.
 * `afterDays`/`once` cadencent le cycle sur la phase active (Vers de carie / Vers du Reik, MSRC 16).
 */
export function symptomOnTick(inst: DiseaseSymptom, severite: 'moderee' | 'grave' | undefined = inst.severity): CycleQuotidien | undefined {
  const tick = findSymptomById(inst.symptomId)?.onTick;
  if (!tick) return undefined;
  const cadence = {
    ...(tick.afterDays !== undefined ? { afterDays: tick.afterDays } : {}),
    ...(tick.once !== undefined ? { once: tick.once } : {}),
  };
  if (!tick.test) return { onFail: tick.ops ?? [], ...cadence };
  const bySeverity = severite && tick.difficultyBySeverity?.[severite];
  // `difficulty` REQUISE au schéma du cycle (`noeudTest(…, { difficulteRequise: true })`, defs/symptoms) —
  // `FlowTest` la laisse optionnelle pour les jets dont elle vient d'ailleurs.
  const difficulty = bySeverity || tick.test.test.difficulty!;
  return { difficulty, test: idsDuNoeud(tick.test), onFail: opsDeLEchec(tick.test), ...cadence };
}

/** Ce que testent les deux jets du cycle que la DONNÉE ne porte pas en nœud (la machinerie stateful les
 *  fabrique) : la Gangrène (`LDB 20 l.176`) et la fin de Durée d'une infection persistante
 *  (`LDB 20 l.200`) — tous deux « Test de Résistance ». */
const TEST_RESISTANCE: TestIds = { skill: 'resistance' };

/** Ce que le nœud NOMME comme testé — la forme que le producteur DIT à la porte (`UpkeepDeferTest.test`),
 *  qui en tire la valeur (`testValue`). MSRC 16 l.90 : le ver de carie teste l'Endurance NUE, LDB 20
 *  l.145/l.212 : Blessé et Toxine testent la Compétence Résistance. */
function idsDuNoeud(node: FlowTestNode): TestIds {
  const { skill, characteristic } = node.test;
  if (skill) return { skill: skill.id, ...(characteristic ? { char: characteristic } : {}), ...(skill.spec ? { spec: skill.spec } : {}) };
  if (characteristic) return { char: characteristic };
  // Inatteignable en donnée : le schéma REFUSE un nœud sans ids (`flowTestSchema`, refine #1657 B3-3).
  // Le dire ici plutôt que rendre `{}` : un nœud forgé en mémoire ne se joue pas sur une valeur de 0.
  throw new Error(`nœud \`test\` sans compétence ni caractéristique : ${JSON.stringify(node.test)}`);
}

/** Ops de la branche `fail` d'un nœud `test` de maladie — le canal différé `diseaseTick` n'applique QUE
 *  l'échec (`state/restFlow.ts`), la branche `success` est du bruit authoré vide (contrat vérifié). */
function opsDeLEchec(node: FlowTestNode): GameOp[] {
  return spellOps(node.fail, 'target');
}
/** Interprète INLINE le sous-ensemble d'ops `onFail`/inconditionnelles que le cycle de maladie peut
 *  appliquer SANS `applyOps` (contrainte sans-cycle ops↔disease de l'en-tête) : contraction, mort (Destin,
 *  MSRC 16 l.101), Blessure directe + État (éclatement du Vers du Reik, l.142). Les ops RICHES à dés/table
 *  (`rollTable`/`charDamage` — table du Vers de carie, l.90) passent par la voie DIFFÉRÉE (`diseaseTick`
 *  → `applyOps` côté state, vocabulaire complet) ; elles sont IGNORÉES ici (jamais roulées à l'aveugle). */
function applyOnFailInline(c: Combatant, onFail: GameOp[], contractOnce: (name: string) => boolean, log: string[], emit?: ConditionEmit): void {
  for (const op of onFail) {
    if (op.op === 'aggravateSymptom') {
      const r = aggravateDiseaseSymptom(c, op.disease, op.symptomId, op.severity);
      log.push(...r.log);
      if (r.etat === 'deja' && op.otherwise?.length) applyOnFailInline(c, op.otherwise, contractOnce, log, emit);
    } else if (op.op === 'grantSymptom') log.push(...grantDiseaseSymptom(c, op.disease, op.symptomId, op.severity));
    else if (op.op === 'contractDisease') contractOnce(op.disease);
    else if (op.op === 'kill') log.push(fateSaveOrDie(c) ? t('op.kill.fateSaved', { name: c.label }) : t('op.kill', { name: c.label }));
    else if (op.op === 'wounds') {
      const n = typeof op.amount === 'number' ? op.amount : 0; // burst = 1 Blessure directe (littéral) ; formules → voie différée
      if (n > 0) { c.wounds.current = Math.max(0, c.wounds.current - n); log.push(t('op.wounds', { name: c.label, n, mitig: '' })); }
    } else if (op.op === 'condition') {
      // Pose par la SOURCE UNIQUE (LDB 16 l.115 non-cumul, l.7 perte d'Avantage, déclencheur de gain).
      const valeur = typeof op.value === 'number' ? op.value : 1;
      addCondition(c, op.id, valeur);
      log.push(t('op.cond', { name: c.label, v: c.conditions.find((x) => x.id === op.id)?.value ?? valeur, cond: conditionLabel(op.id) }));
      emit?.({ stateId: op.id, change: 'gain', targetId: c.id });
    }
  }
}

/** Issue d'un changement d'ÉCHELON de sévérité (aggravation EDOC 08 l.104, atténuation LDB 20 l.159) —
 *  TROIS états distincts, jamais un booléen : `aggrave` (l'échelon vient de bouger), `deja` (le symptôme
 *  EST là, mais l'échelon visé est déjà le sien), `absent` (la maladie ou le symptôme n'est pas porté).
 *  `deja` et `absent` ne se confondent pas : seul `deja` ouvre l'échelon suivant (EDOC 08 l.106-108). */
export type IssueAggravation = 'aggrave' | 'deja' | 'absent';

/** Porte la SÉVÉRITÉ `severity` sur l'instance de symptôme `symptomId` de la maladie `diseaseId`
 *  portée par `c` (EDOC 08 l.104). SOURCE UNIQUE de cette mutation — l'op `aggravateSymptom`
 *  (`applyOps`) et le chemin inline du cycle passent par ici. */
export function aggravateDiseaseSymptom(
  c: Combatant,
  diseaseId: string,
  symptomId: string,
  severity: 'moderee' | 'grave',
): { etat: IssueAggravation; log: string[] } {
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseId);
  const inst = dz?.symptoms.find((s) => s.symptomId === symptomId);
  if (!dz || !inst) return { etat: 'absent', log: [] };
  if (inst.severity === severity) return { etat: 'deja', log: [] };
  dz.symptoms = dz.symptoms.map((s) => (s === inst ? { ...s, severity } : s));
  return { etat: 'aggrave', log: [t('dz.symptomAggravated', { name: c.label, symptom: symptomLabel(symptomId), disease: diseaseLabel(diseaseId) })] };
}

/** Fait REDESCENDRE d'un échelon la sévérité de l'instance de symptôme `symptomId` de `diseaseId`,
 *  À DURÉE — LDB 20 l.159 : « certaines herbes rares et autres mélanges alchimiques permettent
 *  d'atténuer les symptômes pendant une journée, transformant Grave en Modéré et Modéré en convulsions
 *  normales ». L'instance n'est PAS mutée : un `ActiveEffect` `attenuatedSymptom` porte l'échelon, et
 *  l'échelon revient à l'expiration (miroir exact de `suspendSource`/`suppressedSource`). Même issue à
 *  TROIS états qu'`aggravateDiseaseSymptom` — `deja` = plus rien à atténuer (le symptôme est déjà à son
 *  échelon de base, atténuations en cours comprises). UNE DOSE ACTIVE À LA FOIS par (maladie, symptôme) :
 *  la source ne cadre qu'une dose, une seconde REMPLACE la première. SOURCE UNIQUE (op `attenuateSymptom`). */
const ECHELON_INFERIEUR: Record<'moderee' | 'grave', 'moderee' | undefined> = { grave: 'moderee', moderee: undefined };
export function attenuateDiseaseSymptom(
  c: Combatant,
  diseaseId: string,
  symptomId: string,
  duration: Duration,
  label: string,
): { etat: IssueAggravation; log: string[] } {
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseId);
  const inst = dz?.symptoms.find((s) => s.symptomId === symptomId);
  if (!dz || !inst) return { etat: 'absent', log: [] };
  if (!severiteEffective(c, diseaseId, inst)) return { etat: 'deja', log: [] };
  // UNE dose active à la fois (l.159) : une 2ᵉ REMPLACE la précédente, elle ne s'y empile pas.
  c.activeEffects = [
    ...(c.activeEffects ?? []).filter((e) => !(e.attenuatedSymptom?.disease === diseaseId && e.attenuatedSymptom?.symptomId === symptomId)),
    { label, bonus: 0, duration, attenuatedSymptom: { disease: diseaseId, symptomId } },
  ];
  return { etat: 'aggrave', log: [t('dz.symptomAttenuated', { name: c.label, symptom: symptomLabel(symptomId), disease: diseaseLabel(diseaseId) })] };
}

/** Nombre d'ÉCHELONS d'atténuation ACTIFS sur l'instance `symptomId` de `diseaseId` — un par effet
 *  `attenuatedSymptom` en cours (op `attenuateSymptom`, dose UNIQUE : 0 ou 1). Miroir de `symptomSuppressed`. */
export function attenuationEchelons(c: Combatant, diseaseId: string, symptomId: string): number {
  return (c.activeEffects ?? []).filter((e) => !!e.attenuatedSymptom && e.attenuatedSymptom.disease === diseaseId && e.attenuatedSymptom.symptomId === symptomId).length;
}
/** SÉVÉRITÉ EFFECTIVE d'une instance de symptôme : celle qu'elle PORTE, redescendue d'un échelon par
 *  atténuation ACTIVE (LDB 20 l.159 : « permettent d'atténuer les symptômes pendant une journée,
 *  transformant Grave en Modéré et Modéré en convulsions normales »). L'instance n'est JAMAIS mutée :
 *  l'échelon revient de lui-même quand l'effet expire. SOURCE UNIQUE lue par `symptomPassive`. */
export function severiteEffective(c: Combatant, diseaseId: string, inst: DiseaseSymptom): 'moderee' | 'grave' | undefined {
  let sev = inst.severity;
  for (let n = attenuationEchelons(c, diseaseId, inst.symptomId); n > 0 && sev; n--) sev = ECHELON_INFERIEUR[sev];
  return sev;
}

/** Ajoute une instance de symptôme à une maladie DÉJÀ portée (EDOC 08 l.106-108). No-op si la
 *  maladie n'est pas portée ou si le symptôme y figure déjà. SOURCE UNIQUE (op `grantSymptom`). */
export function grantDiseaseSymptom(
  c: Combatant,
  diseaseId: string,
  symptomId: string,
  severity?: 'moderee' | 'grave',
): string[] {
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseId);
  if (!dz || dz.symptoms.some((s) => s.symptomId === symptomId)) return [];
  dz.symptoms = [...dz.symptoms, { symptomId, ...(severity ? { severity } : {}) }];
  return [t('dz.symptomGained', { name: c.label, symptom: symptomLabel(symptomId), disease: diseaseLabel(diseaseId) })];
}

/** Un symptôme (par id) porte-t-il la capacité `cap` (lue sur sa donnée) ? */
function symptomHasCapability(symptomId: string, cap: keyof SymptomCapabilities): boolean {
  return !!findSymptomById(symptomId)?.capabilities?.[cap];
}
/** Une maladie porte-t-elle un symptôme à la capacité `cap` ? */
export function diseaseHasCapability(dz: Disease, cap: keyof SymptomCapabilities): boolean {
  return dz.symptoms.some((s) => symptomHasCapability(s.symptomId, cap));
}
/** Le combattant a-t-il une maladie ACTIVE portant la capacité `cap` ? (Nausée, Contagion…) */
export function hasActiveCapability(c: Combatant, cap: keyof SymptomCapabilities): boolean {
  return (c.diseases ?? []).some((d) => d.phase === 'active' && diseaseHasCapability(d, cap));
}

/**
 * Test de CONTRACTION d'une maladie (LDB 20) : un Test de Résistance `difficulty` raté la fait contracter
 * (dédoublonnée par nom). `resistVal` = Résistance effective, passée par l'appelant (cycle évité). Mute
 * `c.diseases`, renvoie le journal. Sert au post-critique (Très Facile +60, l.72) ET à la Chirurgie
 * (Accessible +20, talent Chirurgie / l.365). Réussite ou maladie déjà présente → rien.
 */
/** Un Test de Contraction de `diseaseName` tomberait-il pour `c` ? (Non si déjà porteur ou immunisé.)
 *  Sépare la DÉCISION du jet (pour différer en cascade) de sa résolution. */
export function contractionDue(c: Combatant, diseaseName: string): boolean {
  if ((c.diseases ?? []).some((d) => d.id === diseaseName)) return false;
  return !(c.diseaseImmunities ?? []).includes(diseaseName); // Vérole Urticante (l.97) : pas deux fois
}

/** Applique le RÉSULTAT d'un Test de Contraction DIFFÉRÉ : échec → contracte la maladie. Mute `c.diseases`.
 *  `opts.instant` (Contagieux (Type), EDO App.2 l.230 : « son incubation est changée en “Instantanée” ») :
 *  la maladie contractée démarre ACTIVE (incubation 0). */
export function applyContraction(c: Combatant, diseaseName: string, success: boolean, rng: RNG = defaultRNG, opts?: { instant?: boolean }): string[] {
  if (success || !contractionDue(c, diseaseName)) return [];
  const dz = contractDisease(diseaseName, rng, opts?.instant ? { incubation: 0 } : undefined);
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [t('dz.contract', { name: c.label, disease: diseaseLabel(diseaseName) })];
}

/**
 * Test de CONTRACTION d'une maladie (LDB 20) : un Test de Résistance `difficulty` raté la fait contracter
 * (dédoublonnée par nom). `resistVal` = Résistance effective, passée par l'appelant (cycle évité). Mute
 * `c.diseases`, renvoie le journal. Sert au post-critique (Très Facile +60, l.72) ET à la Chirurgie
 * (Accessible +20, talent Chirurgie / l.365). Réussite ou maladie déjà présente → rien.
 */
export function rollContraction(
  c: Combatant,
  diseaseName: string,
  resistVal: number,
  difficulty: Difficulty,
  rng: RNG = defaultRNG,
): string[] {
  if (!contractionDue(c, diseaseName)) return [];
  // Bonus d'effets actifs aux Tests liés à CETTE maladie (Fleur de lune +30 vs Peste noire…).
  return applyContraction(c, diseaseName, rollTest(resistVal + activeDiseaseTestMod(c, diseaseName), difficulty, rng).success, rng);
}

/** Nombre de maladies actives bloquant la guérison d'1 PB (capacité `blocksHealing` — Blessé + Gangrène). */
export function diseaseBlesseCount(c: Combatant): number {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && diseaseHasCapability(d, 'blocksHealing')).length;
}

/** Maladies ACTIVES contagieuses (capacité `contagious` — Toux & éternuements, l.206) — contagion au repos. */
export function contagiousDiseases(c: Combatant): Disease[] {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && diseaseHasCapability(d, 'contagious'));
}

/** Exposition d'un personnage à une maladie. Mute `c.diseases` directement (appelé HORS itération —
 *  par les applicateurs de cascade). SAIN → contraction ; DÉJÀ PORTEUR → ré-exposition, la durée se
 *  prolonge du temps authoré `reExposition.prolonge` (EDOC 08 l.122) — sans ce champ, rien.
 *  Trois paramètres, aucun savoir de site :
 *  - `incubation` : `'instantanee'` (défaut, l.32 — contraction depuis un autre symptôme) ou `'raw'`
 *    (l'incubation authorée de `maladies.json` est TIRÉE) ;
 *  - `message` : clé de journal de l'appelant (défaut `dz.develop`), interpolée `{name, disease}` ;
 *  - `contraction` : `false` n'ouvre QUE la ré-exposition (l'appelant sait que la condition de
 *    contraction neuve n'est pas réunie — saison de l'Exposition de voyage). */
export function contractDiseaseOnce(
  c: Combatant,
  name: string,
  rng: RNG = defaultRNG,
  opts?: { incubation?: 'instantanee' | 'raw'; message?: MsgKey; contraction?: boolean },
): string[] {
  if ((c.diseases ?? []).some((d) => d.id === name)) {
    const re = diseaseDefs()[name]?.reExposition;
    if (!re) return [];
    const days = rollDiseaseTime(re.prolonge, rng) / MINUTES_PER_DAY;
    return prolongDisease(c, name, days) ? [t('dz.reExposed', { name: c.label, disease: diseaseLabel(name), days })] : [];
  }
  if (opts?.contraction === false) return [];
  const dz = contractDisease(name, rng, opts?.incubation === 'raw' ? undefined : { incubation: 0 });
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [t(opts?.message ?? 'dz.develop', { name: c.label, disease: diseaseLabel(name) })];
}

/** Bascule une maladie de l'INCUBATION à sa phase ACTIVE : la durée authorée prend la place du reste
 *  d'incubation et la Localisation de lésion (MSRC 16 l.140) est tirée si un symptôme la gate.
 *  SOURCE UNIQUE de cette bascule — `tickDisease` (incubation épuisée) et la Phase d'arrivée d'un
 *  voyage (EDOC 09 l.21) passent par ici. No-op sur une maladie déjà active. */
export function declareDisease(c: Combatant, dz: Disease, rng: RNG = defaultRNG): string[] {
  if (dz.phase !== 'incubation') return [];
  dz.phase = 'active';
  dz.minutesLeft = dz.durationMinutes;
  if (dz.symptoms.some((s) => findSymptomById(s.symptomId)?.visiblePassive?.length)) dz.blisterLocation = rollBlisterLocation(rng);
  return [t('dz.symptomsOnset', { name: c.label, disease: diseaseLabel(dz.id) })];
}

/** Prolonge la DURÉE d'une maladie EN COURS de `days` jours. La durée active porte l'allonge ; si la
 *  maladie est encore en incubation, seul le capital de durée grossit (le décompte d'incubation, lui,
 *  reste celui qui a été tiré). Renvoie `false` si la maladie n'est pas portée. */
export function prolongDisease(c: Combatant, name: string, days: number): boolean {
  const dz = (c.diseases ?? []).find((d) => d.id === name);
  if (!dz || days <= 0) return false;
  const extra = days * MINUTES_PER_DAY;
  dz.durationMinutes += extra;
  if (dz.phase === 'active') dz.minutesLeft += extra;
  return true;
}

/** Conséquence d'un Test de Gangrène DIFFÉRÉ (l.135+) : échec → +1 échec ; au-delà du BE → Localisation perdue. */
export function applyDiseaseGangrene(c: Combatant, diseaseName: string, success: boolean, be: number): string[] {
  if (success) return [];
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseName && d.phase === 'active');
  if (!dz) return [];
  dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
  if (dz.gangreneFails > be) {
    dz.gangreneLost = true;
    return [t('dz.gangreneLost', { name: c.label })];
  }
  return [t('dz.gangreneProgress', { name: c.label, fails: dz.gangreneFails })];
}

/** Conséquence du Test « persistant » de fin de durée DIFFÉRÉ (l.162) : réussite → guérison ;
 *  DR ≤ −6 → Infection du Sang ; ≤ −2 → Blessure Purulente ; sinon → +1d10 jours. La maladie en
 *  attente (`endTestPending`) est retirée (ou prolongée). Mute `c.diseases`. */
export function applyDiseasePersist(c: Combatant, diseaseName: string, success: boolean, sl: number, rng: RNG = defaultRNG): string[] {
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseName && d.endTestPending);
  if (!dz) return [];
  dz.endTestPending = undefined;
  const log: string[] = [];
  const remove = () => { c.diseases = (c.diseases ?? []).filter((d) => d !== dz); };
  const cure = () => { remove(); log.push(t('dz.cured', { name: c.label, disease: diseaseLabel(dz.id) })); if (diseaseDefs()[dz.id]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.id]; };
  if (success) cure();
  else if (sl <= -6) { remove(); log.push(t('dz.degenerate', { name: c.label, disease: diseaseLabel(dz.id) })); log.push(...contractDiseaseOnce(c, 'infection-du-sang', rng)); }
  else if (sl <= -2) { remove(); log.push(t('dz.infects', { name: c.label, disease: diseaseLabel(dz.id) })); log.push(...contractDiseaseOnce(c, 'blessure-purulente', rng)); }
  else { const extra = roll(1, 10, rng); dz.minutesLeft = extra * MINUTES_PER_DAY; log.push(t('dz.persists', { name: c.label, disease: diseaseLabel(dz.id), days: extra })); }
  return log;
}

/**
 * Décompte de `minutes` de maladie écoulées pour `c` (l'entretien quotidien feed `MINUTES_PER_DAY` par
 * journée calendaire ; les tests peuvent passer un délai sous-journalier). Mute `c.diseases`, renvoie le
 * journal. `beForGangrene` = Bonus d'Endurance (seuil de Gangrène, l.176), passé par l'appelant (cycle
 * évité). AUCUNE valeur de Test n'entre ici : le nœud NOMME ce qu'il teste, la porte le calcule.
 *
 * Le délai est découpé en PAS : autant de JOURNÉES PLEINES (`MINUTES_PER_DAY`) que possible, puis un
 * reliquat sous-journalier. Par pas :
 *  - incubation : −`pas` minutes ; à ≤0 → symptômes ACTIFS (durée mémorisée → `durationMinutes`) ;
 *  - active : sur une JOURNÉE PLEINE seulement (Tests RAW « par jour »), symptômes à `onTick` (Blessé,
 *             Toxine) → Test de cycle quotidien, et capacité `amputation` (Gangrène) → Test journalier ;
 *             puis −`pas` minutes ; à ≤0 → résolution (capacité `endTest`/`persistDifficulty`, l.162),
 *             sinon guérison. Une durée sous-journalière (heures/minutes) s'épuise donc DANS la journée,
 *             sans déclencher de Test « quotidien ».
 *
 * `defer` (#1657 B3-3) : TOUT Test du cycle (`onTick` de symptôme, `dailyTest` de maladie, gangrène,
 * fin de Durée) est COLLECTÉ — le moteur n'en roule AUCUN. Il DIT ce qui est testé (`test`, ids lus au
 * nœud) et ses modificateurs NOMMÉS (`mods`) ; la porte calcule la valeur (`testValue`), ouvre la
 * fenêtre et applique. L'état avance ici (incubation/durée), la maladie en fin de durée reste
 * `endTestPending` jusqu'à la validation de son étape. La conséquence d'un `onTick` (GameOp `onFail`)
 * est appliquée par l'applier `diseaseTick` côté state (restFlow) ; gangrène/persistant par
 * `applyDiseaseGangrene/Persist`.
 */
export function tickDisease(c: Combatant, minutes: number, rng: RNG, defer: UpkeepDeferTest, beForGangrene = 0, emit?: ConditionEmit): string[] {
  if (minutes <= 0) return [];
  // Décroissance du RÉSIDU post-infection : −1 par jour plein (Vers du Reik « réduite de 1 point par jour
  // après la mort du ver », MSRC 16 l.138) — indépendante de toute maladie en cours.
  const fullDaysAll = Math.floor(minutes / MINUTES_PER_DAY);
  if (c.residualDiseaseTestMod && fullDaysAll > 0) c.residualDiseaseTestMod = Math.max(0, c.residualDiseaseTestMod - fullDaysAll) || undefined;
  if (!c.diseases?.length) return [];
  const log: string[] = [];
  // On boucle par PAS (journées pleines + reliquat) ; les nouvelles maladies (Blessure Purulente /
  // Infection du Sang) sont accumulées puis ajoutées en fin de tick (elles n'évoluent qu'aux pas suivants).
  const contracted: Disease[] = [];
  const contractOnce = (name: string) => {
    if (c.diseases!.some((d) => d.id === name) || contracted.some((d) => d.id === name)) return false;
    const dz = contractDisease(name, rng, { incubation: 0 }); // « instantanée » depuis un autre symptôme (l.32)
    if (dz) {
      contracted.push(dz);
      log.push(t('dz.develop', { name: c.label, disease: diseaseLabel(name) }));
    }
    return true;
  };

  // Pas d'avancement : N journées pleines (cycle de Tests RAW « par jour ») + reliquat sous-journalier.
  const fullDays = Math.floor(minutes / MINUTES_PER_DAY);
  const remainder = minutes - fullDays * MINUTES_PER_DAY;
  const steps: number[] = [];
  for (let i = 0; i < fullDays; i++) steps.push(MINUTES_PER_DAY);
  if (remainder > 0) steps.push(remainder);

  for (const stepMin of steps) {
    const isFullDay = stepMin === MINUTES_PER_DAY; // Tests de cycle RAW « par jour » : journée pleine uniquement
    const survivors: Disease[] = [];
    for (const dz of c.diseases) {
      dz.infectedMinutes = (dz.infectedMinutes ?? 0) + stepMin; // temps depuis la contraction (rampe d'incubation, l.138)
      // Bonus/malus d'effets scopés à CETTE maladie (op `diseaseTestMod` — Fleur de lune +30 vs Peste
      // noire, Tonique digestif +20) : lignes NOMMÉES remises à la porte, qui les pose sur la cible.
      const mods = diseaseTestModLines(c, dz.id);
      if (dz.phase === 'incubation') {
        dz.minutesLeft -= stepMin;
        if (dz.minutesLeft <= 0) log.push(...declareDisease(c, dz, rng));
        survivors.push(dz);
        continue;
      }
      // active — symptômes à cycle quotidien (`onTick` : Blessé, Toxine). DONNÉE-DRIVEN : `symptomOnTick`
      // lit le nœud `test` du symptôme (ce qu'il teste, sa Difficulté, les ops de sa branche d'ÉCHEC) ou
      // ses `ops` certaines. Le jet part à la porte (`defer`), qui l'ouvre et passe l'échec à `applyOps`.
      // Cadence RAW « par jour » → uniquement sur une JOURNÉE PLEINE (une durée sous-journalière
      // s'épuise sans Test « quotidien »).
      if (isFullDay) {
        dz.activeDaysElapsed = (dz.activeDaysElapsed ?? 0) + 1; // Jᵉ jour de phase active (MSRC 16 : cadence des Vers)
        const activeDay = dz.activeDaysElapsed;
        for (const inst of dz.symptoms) {
          if (symptomSuppressed(c, inst.symptomId)) continue; // symptôme suspendu (Racine de terre) : pas de Test de cycle
          const tick = symptomOnTick(inst, severiteEffective(c, dz.id, inst));
          if (!tick) continue;
          // Cadence de phase active : `afterDays` = ne démarre qu'au Jᵉ jour ; `once` = uniquement CE jour-là
          // (Vers du Reik éclate au 7ᵉ ; Vers de carie teste chaque jour ≥ J+7 — MSRC 16 l.90/142).
          if (tick.afterDays != null && activeDay < tick.afterDays) continue;
          if (tick.once && activeDay !== tick.afterDays) continue;
          if (tick.difficulty == null) {
            // Conséquence INCONDITIONNELLE (pas de jet — éclatement du Vers du Reik, issue invariante,
            // MSRC 16 l.142) : appliquée DIRECTEMENT ici, via l'interprète inline restreint.
            applyOnFailInline(c, tick.onFail, contractOnce, log, emit);
          } else {
            defer({ kind: 'diseaseTick', label: t('step.sujetPrecision', { sujet: symptomLabel(inst.symptomId), precision: diseaseLabel(dz.id) }), test: tick.test, difficulty: tick.difficulty, ...(mods.length ? { mods } : {}), meta: { diseaseName: dz.id, symptomId: inst.symptomId, onFail: tick.onFail } });
          }
        }
        // Gangrène (l.176) : capacité `amputation` — Test de Résistance Accessible (+20) journalier ; plus
        // d'échecs que le Bonus d'Endurance → la Localisation est PERDUE (Amputation). Machinerie stateful.
        if (diseaseHasCapability(dz, 'amputation') && !dz.gangreneLost) {
          defer({ kind: 'diseaseGangrene', label: symptomLabel('gangrene'), test: TEST_RESISTANCE, difficulty: 'accessible', ...(mods.length ? { mods } : {}), meta: { diseaseName: dz.id, symptomId: 'gangrene', be: beForGangrene } });
        }
        // Test de cycle quotidien porté par la MALADIE (EDOC 08 l.104-108) — même canal différé que les
        // `onTick` de symptôme (`diseaseTick`), donc influençable.
        // ÉCART MESURÉ à `EDOC 08 l.104`, #674 (2026-08-31) : la condition de déclenchement citée là-bas
        // porte sur les journées d'EFFORT, signal que le moteur n'a pas — `effortRounds`
        // (`engine/types.ts:1507`) compte des ROUNDS de combat, pas des journées d'activité. Faute de ce
        // signal, le Test tombe à CHAQUE journée d'entretien : régime plus dur que celui de la source.
        // La suspension du symptôme NOMMÉ gate ce Test comme elle gate les `onTick` (l.565) — arbitrage
        // d'ingénierie #674, hors source (`LDB 72 l.28` ne porte que sur les effets du symptôme).
        const daily = diseaseDefs()[dz.id]?.dailyTest;
        if (daily && !symptomSuppressed(c, daily.symptomId)) {
          // `difficulty` REQUISE au schéma du porteur (`noeudTest(…, { difficulteRequise: true })`,
          // `defs/maladies.ts`) — `FlowTest` la laisse optionnelle pour les jets dont elle vient d'ailleurs.
          const difficulty = daily.test.test.difficulty!;
          const onFail = opsDeLEchec(daily.test);
          defer({ kind: 'diseaseTick', label: t('step.sujetPrecision', { sujet: symptomLabel(daily.symptomId), precision: diseaseLabel(dz.id) }), test: idsDuNoeud(daily.test), difficulty, ...(mods.length ? { mods } : {}), meta: { diseaseName: dz.id, symptomId: daily.symptomId, onFail } });
        }
        // MUE (EDOC 08 l.122) : au-delà de `afterDays` jours de phase active, la maladie CÈDE la place
        // à `into` — propriété de la DONNÉE, aucun id codé ici.
        const mut = diseaseDefs()[dz.id]?.mutation;
        if (mut && (dz.activeDaysElapsed ?? 0) > mut.afterDays) {
          // La maladie muée quitte la liste dans les DEUX cas (pas de `survivors.push`) ; seule change la
          // ligne de journal : `into` déjà portée → rien n'apparaît, la porteuse cède simplement la place.
          log.push(contractOnce(mut.into)
            ? t('dz.mutates', { name: c.label, from: diseaseLabel(dz.id), to: diseaseLabel(mut.into) })
            : t('dz.mutatesAbsorbed', { name: c.label, from: diseaseLabel(dz.id), to: diseaseLabel(mut.into) }));
          continue;
        }
      }
      dz.minutesLeft -= stepMin;
      if (dz.minutesLeft > 0) {
        survivors.push(dz);
        continue;
      }
      // Phase active PERSISTANTE (Vers de carie, MSRC 16 l.90-101) : la dégénérescence quotidienne ne cesse
      // JAMAIS de mort naturelle — la maladie ne guérit pas à l'épuisement de la « Durée » (installation),
      // elle reste active (seule la Mort de la table, ou un retrait joueur, la termine).
      if (diseaseHasCapability(dz, 'persistentActive')) {
        dz.minutesLeft = dz.durationMinutes;
        survivors.push(dz);
        continue;
      }
      // Fin de Durée — résolution (DIFFÉRÉE en cascade : la maladie reste en attente).
      if (dz.persistDifficulty) {
        dz.endTestPending = true;
        defer({ kind: 'diseasePersist', label: t('dz.endStep', { disease: diseaseLabel(dz.id) }), test: TEST_RESISTANCE, difficulty: dz.persistDifficulty, ...(mods.length ? { mods } : {}), meta: { diseaseName: dz.id, symptomId: 'persistant' } });
        survivors.push(dz);
      } else {
        log.push(t('dz.cured', { name: c.label, disease: diseaseLabel(dz.id) }));
        snapshotInfectionResidual(c, dz); // Vers du Reik : la pénalité de Résistance survit et décroît −1/jour (l.138)
        if (diseaseDefs()[dz.id]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.id]; // Vérole Urticante (l.97)
      }
    }
    c.diseases = survivors;
  }
  c.diseases = [...c.diseases, ...contracted];
  return log;
}
