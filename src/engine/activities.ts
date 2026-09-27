/**
 * Activités « Entre deux aventures » (LDB 23 + LDB 08) — calculs PURS, cités à la source :
 *
 *  - **Artisanat** (ch.23 l.65-92) : « Pour créer l'équipement, effectuez un Test étendu de
 *    Métier, dont la Difficulté est [fixée par] la Disponibilité de l'Équipement » (Commune
 *    Accessible +20 / Limitée Intermédiaire +0 / Rare Complexe −10 / Exotique Très difficile
 *    −30) ; « Le nombre nécessaire de DR » par prix courant (Bronze 5 / Argent 10 / Or 15+) ;
 *    « Chaque Défaut diminue de moitié le nombre de DR requis, et chaque Atout ajoute +5
 *    (ajouté après avoir appliqué les Défauts). »
 *  - **Apprentissage particulier** (ch.23 l.58-63) : « le prix pour apprendre le Talent est de
 *    2D10 pistoles d'argent par 100PX que coûte l'achat du Talent. »
 *  - **Opérations bancaires** (ch.23 l.154-165) : invest — « Lancez 1d100 : si le résultat est
 *    inférieur ou égal à votre Indice d'intérêts, l'entreprise a fait faillite » ; planque —
 *    « si le résultat est de 10 ou inférieur, votre planque a été découverte ».
 *  - **Revenus** = « Gagner de l'argent grâce au Statut » (LDB 08 l.105-120) : Bronze
 *    « 2d10 sous de cuivre » / Argent « 1d10 pistoles d'argent » / Or « 1 couronne d'or »
 *    PAR Standing ; « Sur un Échec, vous ne gagnez que la moitié de la somme. Sur un Échec
 *    Stupéfiant (-6) […] vous n'avez rien gagné. »
 */
import { RNG, defaultRNG, roll as rollDice } from './dice';
import { Money, fromBrass, toBrass, priceToMoney, PA_PER_SC, PA_PER_CO } from './money';
import type { Combatant, Difficulty, SkillInstance, Availability, StakeForm } from './types';
import { resolveFormula, type Formula, type GameOp } from './ops';
import { evalCondition, type Condition, type ConditionCtx } from './flowCore';
import { buildActorView } from './actorView';
import type { ModLine } from './combat';
import { resolveSkillBest, bestSkilledOption, testValue, type TestSpec } from './skills';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { DIFFICULTY_MODIFIERS } from './types';
import { easeDifficulty } from './tests';
import { trappings, talents, levelsForCareer, skills, specPoolOf, specCatalogOf, refLabel, findCareerById, type TrappingData } from '../data';
import { talentSlotsUpTo, designationsFor, talentMaxReached, skillSlots, availableChars } from './careerSlots';
import { talentCost, advanceCost, inCareerChar } from './advancement';
import { competenceEnCarriere, talentEnCarriere } from './talentEffects';
import { CHAR_KEYS, CHAR_LABELS } from './types';
import { isTradable } from './disponibilite';
import activitiesJson from '../data/activities.json';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CATALOGUE d'ACTIVITÉS data-driven (`src/data/activities.json`) — FOYER UNIQUE des Activités, tous
// contextes confondus : « Entre deux aventures » (LDB 23), « Activités de voyage » (EDOC 8),
// « Activités en mer » (MDG 15). Remplace l'énumération en dur (union `kind` + `switch`).
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Contexte où une Activité est proposable. `bataille` = Activité de PRÉPARATION avant la bataille de
 *  masse (ADE II 8 l.71-110 : Discours/Planification/Infiltration/Repérage/Sabotage/Rassembler des
 *  forces) ; `bataille-round` = Scène cinématique d'un Round de bataille (l.137-225 : Charge/Motivation/
 *  Ligne de mire/Survol/Duel/Tenez votre position/… + Rassemblement l.122) ; `auberge` = Activité jouée
 *  HORS voyage, au comptoir d'une auberge du hub de ville (#352 : `recueillir-informations` s'y ouvre
 *  à la demande, un jet indépendant d'une Étape). */
export type ActivityContext = 'interlude' | 'voyage' | 'mer' | 'bataille' | 'bataille-round' | 'auberge';

/** Camp visé par une issue de bataille (ADE II 8) : `ally` = l'armée des Personnages, `enemy` = l'armée
 *  adverse. */
export type BattleSide = 'ally' | 'enemy';

/** Cible d'une issue d'Activité/Scène de bataille (ADE II 8) qui porte sur l'ARMÉE, non sur le héros
 *  acteur : `might` = delta de Puissance COURANTE (heal/wounds sur le Combattant-armée, plafonné au
 *  départ, l.135) ; `startMight` = delta de Puissance de DÉPART (`wounds.max`, Rassembler l.96 / Sabotage
 *  l.106 : renfort/affaiblissement avant la bataille) ; `allyTestMod` = modificateur PERMANENT aux Tests
 *  de Puissance alliés (Planification +10/+20, l.81) ; `firstRoundBonus` = bonus au Test de Puissance du
 *  1er Round seul (Discours, l.71) ; `planningBonus` = bonus au Test de Planification à venir
 *  (Repérage/Infiltration, l.75/100). L'échelle suit `scale` : `fixed` (plat) ; `perDR`×DR (Motivation
 *  l.151) ; `perHit`×touches / `perKill`×ennemis neutralisés (Charge/Pluie de flèches, l.139/145). */
export type BattleOutcomeTarget = 'might' | 'startMight' | 'allyTestMod' | 'firstRoundBonus' | 'planningBonus';
/** Cibles d'issue qui sont des RÉSERVOIRS de modificateur de Test, donc CONSOMMABLES par le Test d'une
 *  Activité qui les déclare en `testModFrom` (les deltas de Puissance, eux, ne se dépensent pas). */
export type BattleTestModPool = Extract<BattleOutcomeTarget, 'allyTestMod' | 'firstRoundBonus' | 'planningBonus'>;
/** MESURE d'armée dont l'ÉCART (allié − ennemi) peut porter une difficulté dérivée (`difficultyFrom`).
 *  `armyMight` = Puissance courante des deux armées (ADE II 8 l.71). Une mesure de plus s'ajoute ici et
 *  dans son résolveur, jamais un mot-clef par Activité. */
export type BattleMeasure = 'armyMight';
/** Difficulté DÉRIVÉE : écart d'une mesure d'armée, arrondi au pas `roundTo` (10 = « à la dizaine la
 *  plus proche », l.71), lu comme un modificateur de Test (`difficultyFromModifier`). */
export interface BattleDifficultyFrom {
  gap: BattleMeasure;
  roundTo?: number;
}
export type BattleOutcomeScale = 'fixed' | 'perDR' | 'perHit' | 'perKill';
export interface BattleOutcome {
  /** `might`/`startMight` portent un `side` (armée visée) ; les modificateurs de Test sont toujours alliés. */
  side?: BattleSide;
  target: BattleOutcomeTarget;
  scale: BattleOutcomeScale;
  /** Montant SIGNÉ (gain +, réduction −). Pour `perDR`/`perHit`/`perKill`, multiplié par le compteur. */
  amount: number;
}

/** Issue de PORTÉE ÉTAPE (Activité de voyage EDOC 8 OU Rencontre EDOC) — effet qui ne porte PAS sur
 *  un seul Combatant (donc pas un `GameOp`) mais sur l'Étape/le groupe : interprété par la boucle de
 *  voyage. Vocabulaire ÉTENDU (≠ codé en dur par id). Activités (l.139-180) :
 *   - `suppressExposure` (Plein air, l.141) : pas de Test d'Exposition pour le groupe cette Étape ;
 *   - `gatherInfo` (Recueillir des informations, l.153) : DR questions au MJ (récit) ;
 *   - `noSurprise` (Rester aux aguets, l.157) : le groupe ne peut être surpris cette Étape ;
 *   - `mapMade` (Établir des cartes, l.161) : carte d'itinéraire → Orientation/Savoir Accessible ;
 *   - `rerollToken` (Pratiquer une Compétence, l.172) : un jeton de relance d'un Test futur ;
 *   - `countsAsRest` (Récupérer, l.176) : l'Étape compte comme un repos (guérison) ;
 *   - `campCare` (Monter un camp, l.180) : chaque DR retire un Exténué OU guérit un Personnage.
 *  Rencontres (l.186-233) :
 *   - `extraActivity` (Temps libre) : une Activité de voyage supplémentaire ;
 *   - `skipStage` (Raccourci) : sauter l'Étape suivante ;
 *   - `fullRecovery` (Voyage tranquille) : guérir toutes les Blessures + retirer tous les Exténué ;
 *   - `worsenWeather` (Très mauvais temps) : +40 au prochain jet de Météo. */
export type StageOutcome =
  | 'suppressExposure' | 'gatherInfo' | 'noSurprise' | 'mapMade' | 'rerollToken' | 'countsAsRest' | 'campCare'
  | 'extraActivity' | 'skipStage' | 'fullRecovery' | 'worsenWeather';

/**
 * VOCABULAIRE FERMÉ des résolveurs BESPOKE d'Activité. Chaque membre a un PROPRIÉTAIRE déclaré
 * (`RESOLVER_OWNER`) = la famille de flux qui le consomme ; c'est ce propriétaire, pas ce type, qui
 * dit où vit sa branche. Une Activité de plus à résolveur EXISTANT est une pure entrée de
 * `activities.json` ; un résolveur NOUVEAU = une ligne ici + une ligne dans `RESOLVER_OWNER` + sa
 * branche chez le propriétaire + la ligne miroir de `activityResolverSchema`
 * (`src/data/schemas/defs/activities.ts`). Garde de consommation :
 * `src/data/activity-resolver-dispatch.test.ts`.
 */
export type ActivityResolver =
  // Interlude — socle (LDB 23, ACE Annexe I)
  | 'income' | 'craftExtended' | 'learnTalent' | 'identify' | 'entrainement' | 'mecenat'
  // Interlude — bespoke
  | 'ritualFocus' | 'masterWeapon' | 'identifyByResearch' | 'memorizeDiscount' | 'combatTraining'
  | 'punchausen' | 'knowledgeResearch' | 'reputation' | 'wrathOfTheGods' | 'dissensionScout'
  | 'dissensionEmeute' | 'contremaitre'
  // Voyage (EDOC 8) · Mer (MDG)
  | 'forage' | 'seaChart' | 'opportunityTrade' | 'crewTraining';

/** Familles de flux qui POSSÈDENT des résolveurs — un propriétaire = un dispatch, un seul. Un
 *  contexte d'Activité sans famille ici (`bataille`, `bataille-round`, `auberge`) n'a AUCUN résolveur
 *  à offrir : c'est l'absence, pas une famille vide (`OWNERS_BY_CONTEXT`, `CodexEdit`). */
export type ResolverOwner = 'interlude' | 'mer' | 'voyage';

/**
 * PROPRIÉTAIRE de chaque résolveur, MESURÉ sur ses consommateurs (#1318 V6) :
 *  - `interlude` → `runActivityResolver`/`openCatalogActivity` (`src/state/interludeFlow.ts`) et les
 *    volets dédiés d'`InterludeScreen` (`entrainement`, `mecenat` : gate amont / volet, pas de branche
 *    dans le dispatch) ;
 *  - `mer` → `src/state/seaActivities.ts` (+ `SeaActivitiesModal`) ; `voyage` → `travelPostes.ts`.
 * La bataille de masse n'est PAS une famille : ses Scènes se résolvent par `sceneKind`
 * (`massBattleFlow.confirmBattleActivity`), le Rassemblement par `rallyHealAmount` (ADE II 8 l.122).
 * Table EXHAUSTIVE (`satisfies Record<ActivityResolver, …>`) : un résolveur ajouté sans propriétaire
 * ne compile pas.
 */
export const RESOLVER_OWNER = {
  income: 'interlude', craftExtended: 'interlude', learnTalent: 'interlude', identify: 'interlude',
  entrainement: 'interlude', mecenat: 'interlude', ritualFocus: 'interlude', masterWeapon: 'interlude',
  identifyByResearch: 'interlude', memorizeDiscount: 'interlude', combatTraining: 'interlude',
  punchausen: 'interlude', knowledgeResearch: 'interlude', reputation: 'interlude',
  wrathOfTheGods: 'interlude', dissensionScout: 'interlude', dissensionEmeute: 'interlude',
  contremaitre: 'interlude',
  seaChart: 'mer', opportunityTrade: 'mer', crewTraining: 'mer',
  forage: 'voyage',
} as const satisfies Record<ActivityResolver, ResolverOwner>;

/** Membres d'`ActivityResolver` possédés par une famille donnée (type). */
export type ResolverOf<O extends ResolverOwner> =
  { [K in ActivityResolver]: typeof RESOLVER_OWNER[K] extends O ? K : never }[ActivityResolver];

/** Les membres d'`ActivityResolver` à l'EXÉCUTION (listes déroulantes du Codex, gardes) — DÉRIVÉS de
 *  `RESOLVER_OWNER`, jamais une seconde liste à tenir à jour. */
export const ACTIVITY_RESOLVERS: readonly ActivityResolver[] = Object.keys(RESOLVER_OWNER) as ActivityResolver[];

/** Résolveurs d'une famille, à l'EXÉCUTION (sélecteur du Codex filtré par contexte, gardes). */
export const resolversOwnedBy = (owner: ResolverOwner): ActivityResolver[] =>
  ACTIVITY_RESOLVERS.filter((r) => RESOLVER_OWNER[r] === owner);

/** Bande d'ISSUE par Degrés de Réussite d'une Activité (tables « DR → résultat », ACE 12 l.31-65) :
 *  bornes de DR INCLUSIVES ; `on` distingue ±0 (« +0 à +1 » = succès / « −0 à −1 » = échec, comme les
 *  tables RAW) et porte la Maladresse ; `ops` = effet mécanique (GameOp, langue UNIQUE des effets) ;
 *  `resolver` = logique bespoke nommée (cf. dispatch d'interlude) ; `payoutPct` = rendu monétaire d'un
 *  retrait de dépôt (Mécénat : 120/100/50/0) ; `note` = texte de résultat VERBATIM de la source. */
export interface OutcomeBand {
  on?: 'success' | 'failure' | 'fumble';
  minSL?: number;
  maxSL?: number;
  ops?: GameOp[];
  resolver?: ActivityResolver;
  payoutPct?: number;
  note?: string;
  /** Issue(s) de BATAILLE (ADE II 8) portant sur l'ARMÉE (delta de Puissance / modificateur de Test),
   *  gated par `when` — appliquées par le résolveur `battle` de `runActivityResolver`. */
  battle?: BattleOutcome[];
  /** Condition SUPPLÉMENTAIRE (au-delà de `on`/`minSL`/`maxSL`) évaluée sur les compteurs de la résolution
   *  de bataille : `generalDown` (Succès Stupéfiant → le capitaine/général tombe, l.208/217) ;
   *  `intervention`/`noIntervention` (Duel l.225 : un AUTRE PJ a frappé, ou non) ; `combatWon`/`combatLost`
   *  (victoire / DÉFAITE d'une Scène de COMBAT — Percée l.175, Duel l.223). Absente = pas de gate en plus. */
  when?: BattleCond;
  /** Scène(s) IMPOSÉE(S) au Round suivant si cette bande matche (enchaînements l.169/175/208/217/225). */
  chains?: string[];
}

/** Condition d'issue de bataille évaluée sur la résolution d'une Scène/Activité (compteurs de combat +
 *  succès/DR). Voir `BattleResolution` (state/massBattleFlow). */
export type BattleCond =
  | 'generalDown' | 'intervention' | 'noIntervention' | 'combatWon' | 'combatLost';

/** Bandes d'issue applicables à un jet résolu. Maladresse : les bandes `on:'fumble'` REMPLACENT toute
 *  autre issue (« réalisez un Test sur le Tableau de la Colère des Dieux […] à la place », ACE 12 l.15) ;
 *  sans bande de Maladresse déclarée, la Maladresse reste un échec ordinaire. Une bande sans `on`
 *  matche par DR seul. PUR. */
export function matchOutcomes(def: ActivityDef, res: { success: boolean; sl: number; fumble?: boolean }): OutcomeBand[] {
  const bands = def.outcomes ?? [];
  if (res.fumble) {
    const fb = bands.filter((b) => b.on === 'fumble');
    if (fb.length) return fb;
  }
  const on = res.success ? 'success' : 'failure';
  return bands.filter((b) => b.on !== 'fumble' && (b.on == null || b.on === on)
    && (b.minSL == null || res.sl >= b.minSL) && (b.maxSL == null || res.sl <= b.maxSL));
}

/** Résolution d'une Scène/Activité de BATAILLE (ADE II 8) : issue du Test/Combat + compteurs qui
 *  alimentent les échelles (`perHit`/`perKill`/`perDR`) et les conditions (`when`). `hits`/`kills` =
 *  touches portées / ennemis neutralisés d'une Scène de COMBAT (l.139/145) ; `generalDown` = le
 *  capitaine/général ennemi est tombé (l.208/217) ; `intervention` = un AUTRE PJ a frappé (Duel l.225) ;
 *  `combat` = la résolution vient d'une Scène de COMBAT tactique (distingue `combatWon`/`combatLost`). */
export interface BattleResolution {
  success: boolean;
  sl: number;
  hits: number;
  kills: number;
  generalDown: boolean;
  intervention: boolean;
  combat: boolean;
}

/** Une condition SUPPLÉMENTAIRE `when` est-elle satisfaite par la résolution ? (les gates `on`/`minSL`/
 *  `maxSL` sont déjà appliqués par `matchOutcomes`). PURE. */
export function battleCondMet(cond: BattleCond | undefined, r: BattleResolution): boolean {
  switch (cond) {
    case undefined: return true;
    case 'generalDown': return r.generalDown;
    case 'intervention': return r.intervention;
    case 'noIntervention': return !r.intervention;
    case 'combatWon': return r.combat && r.success;
    case 'combatLost': return r.combat && !r.success;
  }
}

/** Montant SIGNÉ d'une issue de bataille pour une résolution (l'échelle multiplie le compteur adéquat). PURE. */
export function battleOutcomeAmount(o: BattleOutcome, r: BattleResolution): number {
  switch (o.scale) {
    case 'fixed': return o.amount;
    case 'perDR': return o.amount * Math.max(0, r.sl);
    case 'perHit': return o.amount * Math.max(0, r.hits);
    case 'perKill': return o.amount * Math.max(0, r.kills);
  }
}

/** Bandes d'issue de bataille applicables : `matchOutcomes` (gates `on`/DR) PUIS le gate `when` (compteurs
 *  de combat). PURE — le résolveur applique ensuite `battle`/`chains` des bandes retenues. */
export function matchBattleOutcomes(def: ActivityDef, r: BattleResolution): OutcomeBand[] {
  return matchOutcomes(def, r).filter((b) => battleCondMet(b.when, r));
}

/** UN modificateur de situation d'un Test d'Activité : une quantité (`Formula`) éventuellement GATÉE
 *  par une `Condition` évaluée sur l'ACTEUR du Test (`when` absent = toujours). `label` nomme la ligne
 *  quand plusieurs termes se cumulent ; à défaut, l'appelant nomme la ligne unique. */
export interface ActivityTestMod {
  when?: Condition;
  mod: Formula;
  label?: string;
}

/** UN dé de MONDE attaché à une Activité : un pourcentage d'auteur (`cible`, une `Formula` — donc un
 *  `{rule}` éditable), les `ops` appliquées à l'acteur quand le dé PASSE sous la cible, et une
 *  `unless` qui EXEMPTE l'acteur du tirage (« à moins qu'ils n'aient déjà une Carrière de Mendiant, ou
 *  une autre Carrière sans ressources », LDB 09 l.99 — exprimée par un prédicat GÉNÉRAL sur le Statut,
 *  jamais par un id de carrière). Le dé passe par la PORTE (`worldStep`), comme tout dé de monde. */
export interface ActivityWorldRoll {
  id: string;
  label: string;
  cible: Formula;
  ops: GameOp[];
  unless?: Condition;
}

/**
 * CONTEXTE d'évaluation des `Condition` d'une Activité (gates `testMods.when`, `worldRolls.unless`) :
 * l'acteur du Test, vu DEUX fois par la MÊME projection — comme acteur de Flow (`buildActorView`, pour
 * `compare`/`has`/`visiblePassive`) ET comme groupe d'UN pour les Conditions party-level
 * (`status`/`career`/`species`/`skill`).
 *
 * Le membre de groupe est présenté au NIVEAU 1 de sa carrière : ce que le RAW qualifie est la CARRIÈRE
 * (« à moins qu'ils n'aient déjà une Carrière de Mendiant, ou une autre Carrière sans ressources »,
 * LDB 09 l.99), pas l'avancement du personnage — le Statut d'ENTRÉE est la propriété de la carrière.
 * PURE.
 */
export function activityConditionCtx(actor: Combatant): ConditionCtx {
  const vue = buildActorView(actor);
  return {
    flags: {}, gameTime: 0, target: vue, caster: vue,
    party: [{ career: actor.career, species: actor.species, careerLevel: 1, skills: actor.skills }],
  };
}

/** TOTAL des `testMods` d'une Activité pour un acteur donné, et le LIBELLÉ de la ligne : les termes
 *  gatés sont évalués contre la vue d'acteur (`buildActorView`, la MÊME que les Flows et les verrous
 *  d'État — aucune 2ᵉ projection). PURE. Sans `testMods`, ou tous les gates faux : `mod` 0. */
export function activityTestMod(def: Pick<ActivityDef, 'testMods'>, actor: Combatant): { mod: number; label?: string } {
  const ctx = activityConditionCtx(actor);
  let mod = 0;
  const labels: string[] = [];
  for (const m of def.testMods ?? []) {
    if (m.when != null && !evalCondition(m.when, ctx)) continue;
    const valeur = resolveFormula(m.mod, actor);
    mod += valeur;
    if (m.label && valeur !== 0) labels.push(m.label);
  }
  return { mod, ...(labels.length ? { label: labels.join(' + ') } : {}) };
}

/** Gate GÉOGRAPHIQUE : l'Activité est-elle proposable au lieu courant (`MapPlace.id`, null = hors carte) ?
 *  Sans `where`, partout ; avec, il faut ÊTRE au lieu (les Activités d'ACE Annexe I sont « à Altdorf »). */
export function activityAvailableAt(def: ActivityDef, placeId: string | null): boolean {
  return !def.where?.length || (placeId != null && def.where.includes(placeId));
}

/**
 * Définition d'une Activité (donnée éditable). Un Test (compétence(s) + Difficulté, éventuellement
 * ÉTENDU) dont l'issue s'exprime, par ordre de préférence, en vocabulaire EXISTANT :
 *  - `onSuccess: GameOp[]` pour tout effet mécanique sur les Personnages (heal/removeCondition/giveTrapping…) ;
 *  - `outcomes: OutcomeBand[]` pour les tables « DR → résultat » (bandes, Maladresse, verbatim) ;
 *  - `stageOutcome` pour les effets de portée Étape (voyage) que `GameOp` n'exprime pas ;
 *  - `resolver` (nom) pour réutiliser une logique existante (`'forage'`, `'masterWeapon'`, `'mecenat'`…).
 */
export interface ActivityDef extends TestSpec {
  /** id STABLE (slug). */
  id: string;
  label: string;
  /** Icône du registre (`src/ui/icons`, id `famille/nom`) — affichée par les volets/boutons
   *  d'Activité. REQUIS ; icône ∈ registre validé par `data-wellformed.test.ts`. */
  icon: string;
  contexts: ActivityContext[];
  source: { book: string; page: number };
  /** `skills?` (au choix), `char?`, `difficulty?` viennent de `TestSpec`. Absent = Activité SANS Test. */
  /** Compétence LIBRE choisie par le joueur (Pratiquer une Compétence, EDOC 8 l.172). */
  freeSkill?: boolean;
  /** Test ÉTENDU (LDB 12) : DR requis = `drPerStage` × nombre d'Étapes (Établir des cartes, EDOC 8 l.161). */
  extended?: { drPerStage: number };
  /** RAW EDOC 8 l.133 : échouer le Test d'une Activité octroie un État Exténué. */
  failExtenue?: boolean;
  /** Modificateurs de SITUATION du Test de cette Activité, en DONNÉE — chaque entrée est une `Formula`
   *  (donc un `{rule}` éditable pour ce que le livre ne chiffre pas) éventuellement GATÉE par une
   *  `Condition` évaluée sur l'acteur (`activityTestMod`). Mendier (LDB 09 l.97) : « la Difficulté est
   *  modifiée par le discours choisi pour mendier et à quel point votre apparence peut susciter la
   *  sympathie » — un terme inconditionnel (le discours) et un terme gaté (`visiblePassive`). Absent =
   *  aucun modificateur ; le TOTAL forme UNE seule ligne de mod à l'écran (`activityModLines`). */
  testMods?: ActivityTestMod[];
  /** Modificateur météo PAR météo (id de `Weather`) au Test de l'Activité — DONNÉE (fini le `def.id ===`
   *  en dur) : Plein air « -10 par degré de temps éloigné de Beau temps » (EDOC 8 l.141), Approvisionnement
   *  « -10 par temps sec » (l.56). Absent/météo non listée = 0. */
  weatherMod?: Record<string, number>;
  /** Résolveur BESPOKE nommé (réutilise une logique existante plutôt que de la dupliquer). */
  resolver?: ActivityResolver;
  /** Effet mécanique de réussite, en `GameOp` (langue UNIQUE des effets, appliquée par `applyOps`). */
  onSuccess?: GameOp[];
  /** Description VERBATIM (Markdown) de la source — rendue par `<Prose>` (règle 5, jamais de paraphrase). */
  desc?: string;
  /** DÉS de MONDE déclenchés APRÈS la résolution du Test de l'Activité — forme GÉNÉRALE en donnée
   *  (« être surpris à mendier par ses pairs », LDB 09 l.99) : le pourcentage vit dans une règle
   *  optionnelle, l'issue en `GameOp`, et l'exemption en `Condition` sur l'acteur. */
  worldRolls?: ActivityWorldRoll[];
  /** Table d'issues par bande de DR (« RÉSULTATS DU TEST DE… », ACE Annexe I) — prime sur `onSuccess`. */
  outcomes?: OutcomeBand[];
  /** Gate GÉOGRAPHIQUE : ids de lieux de la carte du monde (`MapPlace.id`) où l'Activité est proposable
   *  (ACE Annexe I = « à Altdorf »). Absent = partout — résolu par `activityAvailableAt`. */
  where?: string[];
  /** Mise MINIMALE d'un dépôt bancaire de cette Activité (Mécénat : « au moins 5 CO », ACE 12 l.49). */
  minInvest?: Partial<Money>;
  /** Issue de portée Étape (voyage). */
  stageOutcome?: StageOutcome;
  /** Indisponible si le héros porte un État Exténué cette Étape (Récupérer, EDOC 8 l.176). */
  unavailableIfExtenue?: boolean;
  // ── Activités & Scènes de BATAILLE (ADE II 8, contextes 'bataille'/'bataille-round') ──
  /** Test COMBINÉ (LDB 12 l.202-206) : UN jet confronté aux DEUX premières `skills` (Infiltration Discrétion+
   *  Perception l.75 ; Repérage Chevaucher+Perception l.102). RÉUSSIT si les deux cibles sont atteintes. */
  combined?: boolean;
  /** Test à SOUTIEN multi-PJ (LDB 12 l.187-200) : le meneur lance, les assistants CAPABLES ajoutent +10
   *  (plafonné). SEULE Activité de préparation soutenable = Planification (l.81). Les Scènes de Test/Tenue
   *  d'un Round sont AUSSI multi-PJ (l.116-118). Incompatible avec `combined` (le RAW n'octroie d'aide à
   *  aucun Test combiné). */
  assisted?: boolean;
  /** Prérequis (flags de préparation) à satisfaire pour proposer l'Activité : Infiltration ⇐ 'planned'
   *  (Planification réussie, l.73) ; Sabotage ⇐ 'scouted' (Repérage réussi, l.104). */
  requires?: string[];
  /** Flag de préparation OCTROYÉ sur réussite (débloque une Activité dépendante) : Planification → 'planned' ;
   *  Repérage → 'scouted'. */
  grantsFlag?: string;
  /** RÉSERVOIR de modificateur que le Test de CETTE Activité consomme — le pendant LECTEUR d'un
   *  `BattleOutcome.target` accumulé par d'autres issues : Repérage (+10, l.100) et Infiltration
   *  (+20, l.75) créditent `planningBonus`, que le Test de Planification dépense. Absent = Test
   *  sans modificateur d'armée. */
  testModFrom?: BattleTestModPool;
  /** Difficulté DÉRIVÉE de l'état des armées au lieu de la `difficulty` fixe (Discours inspirant,
   *  ADE II 8 l.71 : « une Difficulté déterminée par la différence de Puissance entre les armées,
   *  arrondie à la dizaine la plus proche »). L'ÉCART (`gap`) est une mesure NOMMÉE de la bataille,
   *  arrondi au pas `roundTo`, puis converti en Difficulté par `difficultyFromModifier` — un écart
   *  favorable facilite le Test. */
  difficultyFrom?: BattleDifficultyFrom;
  /** Genre d'une Scène de Round ('bataille-round') : `test` (Test de Compétence des PJ, delta de Puissance
   *  par l'issue) ; `combat` (rencontre tactique — `startCombat` — touches/kills nourrissent le delta) ;
   *  `threat` (Scène MENACE qui s'IMPOSE et pénalise les autres Scènes tant qu'elle vit, Intrus l.219) ;
   *  `hold` (Tenez votre position l.161 : Test OPPOSÉ récurrent, Point de rupture entre Rounds) ;
   *  `rally` (Rassemblement l.122 : Test de Résistance qui soigne les héros). Absent = Activité ordinaire. */
  sceneKind?: 'test' | 'combat' | 'threat' | 'hold' | 'rally';
  /** Scène 'combat'/'threat' : id de rencontre de la scène à démarrer (`startCombat`). */
  encounter?: string;
  /** Durée max en Rounds de Combat (indicatif narratif, l.139/157/175…). */
  rounds?: number;
  /** Paramètre d'une Scène « Tenez votre position » (sceneKind 'hold', l.161) : seuil du Point de rupture
   *  (10 RAW), Rounds max avant écrasement (5 RAW), bonus cumulatif d'opposition par Round tenu (+10). */
  hold?: { breakpoint: number; maxRounds: number; enemyBonusPerHold: number };
  /** Pénalité d'une Scène MENACE (sceneKind 'threat', Intrus l.219) infligée aux Tests des autres Scènes. */
  threat?: { penalty: number };
  /** Condition de chute du général/capitaine ennemi (`generalDown`) pour CETTE Scène : 'success' = sur un
   *  simple Succès (Ligne de mire, ADE II 8 l.208) ; 'stupefying' = Succès Stupéfiant (DR ≥ 6) requis
   *  pour se rapprocher au Corps à corps (Survol, l.217). Absent = pas de général à faire tomber. */
  generalDownOn?: 'success' | 'stupefying';
  /** Gate de CLASSE : « N'importe quel Personnage peut entreprendre n'importe quelle Activité […], mais
   *  si vous n'appartenez pas à la Classe spécifiée […] tous les Tests que vous faites sont plus durs
   *  d'un Niveau de Difficulté » — `classes` = ids de `ClassData` couvrant l'Activité ; `outsidePenalty`
   *  = crans (sens `easeDifficulty`, positif = DURCIT). `scope` distingue le VERBE de la source :
   *  `'current'` (LDB 23 l.197 « appartenez ») = Classe COURANTE du héros ; `'ever'` (AA 12 l.5 « n'a
   *  JAMAIS appartenu ») = Classe d'une Carrière un jour PORTÉE (`everBelongedClasses`). Défaut
   *  `'current'`. Appliqué par le chemin UNIQUE `classGatedDifficulty`, jamais par-activité. */
  classGate?: { classes: string[]; outsidePenalty: number; scope?: 'current' | 'ever' };
  /** Dette BLOQUANTE : le sous-système qui porterait l'issue de cette Activité n'est pas modélisé,
   *  donc aucune bande d'issue ne s'écrit fidèlement. `activitiesFor` (porte UNIQUE des catalogues
   *  jouables) la retire de tous les contextes : elle n'est ni proposée ni consommatrice de créneau.
   *  L'entrée reste au catalogue (Codex/Compendium, `desc` verbatim, éditable) et redevient jouable
   *  par le SEUL retrait de ce champ, une fois `ticket` soldé et l'issue écrite. */
  blocked?: { ticket: string; raison: string };
  /** Note MAISON (règle stricte 7 : contextuel/« au MJ » → donnée taguée, jamais un nombre nu
   *  silencieux) — porte la trace éditable d'une valeur mécanique absente LITTÉRALEMENT du texte RAW.
   *  Ex. Semer la dissension — Émeute (LDB 23 l.242) : Difficulté « déterminée par la façon dont la
   *  cible peut être mal vue », sans table de résolution → `difficulty:'intermediaire'` est le repli.
   *  DISPLAY/DOC only, jamais lu pour de la mécanique (comme `criticals.ts` `maison`, #195). */
  maison?: string;
  /** ENJEU du jet (#1117) : ce que le Test de CETTE Activité met en jeu, en descripteur MÉCANIQUE
   *  (ce que le résolveur applique) et/ou verbatim court. Donnée ÉDITABLE au Codex, jamais un texte
   *  écrit au call-site — les surfaces (volet d'Activité, modale de jet) le résolvent par la porte
   *  unique `resolveStake` (`src/data/index.ts`, dataset `activity`). */
  stake?: string;
  /** FORME DÉCLARÉE du `stake` — même contrat que `night-stakes`/`flow-stakes` (garde de forme). */
  stakeForm?: StakeForm;
  /** FOYER de la règle derrière le jet : id de l'ENTITÉ qui la porte. Absent = l'Activité elle-même
   *  (sa `desc` verbatim, catégorie Codex `activities`) — jamais une fiche `regles.json` doublon. */
  rule?: string;
  /** Catégorie Codex du foyer (`'regles'`, `'skills'`, `'etats'`…), exigée avec `rule`. */
  ruleCategory?: string;
}

/** Résolveurs qui DÉRIVENT leur compétence du héros au moment d'ouvrir le jet (`openCatalogActivity`,
 *  `src/state/interludeFlow.ts`) : leur Activité n'a donc pas de `skills` en donnée, mais elle LANCE.
 *  SOURCE UNIQUE consommée par `activityRolls` — une Activité de plus dans ce cas = une ligne ici. */
const SKILL_DERIVING_RESOLVERS = new Set<ActivityResolver>(['income', 'craftExtended', 'learnTalent', 'reputation', 'ritualFocus']);

/** L'Activité LANCE-t-elle un Test ? `skills`/`char`/`freeSkill` déclarés, ou résolveur qui dérive sa
 *  compétence du héros. Une Activité sans Test (Récupérer, Entraînement, Scènes de COMBAT tactique
 *  d'une bataille) n'a rien à mettre en jeu — pas de zone d'enjeu muette. PURE. */
export function activityRolls(def: Pick<ActivityDef, 'skills' | 'char' | 'freeSkill' | 'resolver'>): boolean {
  return !!(def.skills?.length || def.char || def.freeSkill || (def.resolver && SKILL_DERIVING_RESOLVERS.has(def.resolver)));
}

/** Ligne de mod du modificateur de SITUATION d'un Test d'Activité (Menace `ADE II 8 l.219`,
 *  Planification l.75) — SOURCE UNIQUE, partagée par le CALCUL de la cible (`massBattleFlow`,
 *  `rollFlowSpecs`) et par son RENDU (`ui/ActivityModal.tsx`) : trois littéraux du même fait
 *  divergeaient sinon. Aucun mod ⇒ aucune ligne (jamais un « Modificateur +0 » inventé). PURE. */
export function activityModLines(mod: number | undefined, modLabel: string | undefined): ModLine[] {
  return mod ? [{ label: modLabel ?? 'Modificateur', value: mod, famille: 'jet' as const }] : [];
}

/** Carrières JAMAIS PERDUES d'un héros (`Combatant.careerHistory`, cumulé — absent = `[career]`) →
 *  Classes correspondantes (ids de `ClassData`, via `findCareerById`). PURE. Sert le gate `scope:'ever'`
 *  (AA 12 l.5 « n'a jamais appartenu »), distinct de la Classe COURANTE (LDB 23 l.197). */
export function everBelongedClasses(h: Pick<Combatant, 'career' | 'careerHistory'>): Set<string> {
  const ids = h.careerHistory ?? (h.career ? [h.career] : []);
  const out = new Set<string>();
  for (const id of ids) {
    const cls = findCareerById(id)?.class;
    if (cls) out.add(cls);
  }
  return out;
}

/** Difficulté EFFECTIVE d'une Activité pour le héros — gate de Classe GÉNÉRIQUE : hors les Classes
 *  couvertes (au sens du `scope` déclaré, cf. `ActivityDef.classGate`), la Difficulté durcit de
 *  `classGate.outsidePenalty` crans (sens `easeDifficulty` : négatif = plus dur). Sans `classGate`
 *  (ou Classe couverte), la Difficulté déclarée (`base`) reste inchangée. PURE. */
export function classGatedDifficulty(
  def: { difficulty?: Difficulty; classGate?: { classes: string[]; outsidePenalty: number; scope?: 'current' | 'ever' } },
  hero: Pick<Combatant, 'career' | 'careerHistory'>,
): Difficulty {
  const base = def.difficulty ?? 'intermediaire';
  const gate = def.classGate;
  if (!gate) return base;
  const covered = gate.scope === 'ever'
    ? [...gate.classes].some((c) => everBelongedClasses(hero).has(c))
    : gate.classes.includes(findCareerById(hero.career ?? '')?.class ?? '');
  if (covered) return base;
  return easeDifficulty(base, -gate.outsidePenalty);
}

/** Plafond des revenus d'une semaine par Statut (« le maximum de vos revenus standards », Réputation
 *  LDB 23 l.228-234) — MÊME grille que `statusIncome` (LDB 08 l.105-120), bornes hautes des dés (2d10 →
 *  20, 1d10 → 10), sans tirage. PURE. */
export function statusIncomeMax(tier: PriceTier, standing: number): Money {
  const n = Math.max(0, standing);
  if (tier === 'bronze') return fromBrass(n * 20);
  if (tier === 'argent') return fromBrass(n * 10 * PA_PER_SC);
  return fromBrass(n * PA_PER_CO);
}

/** Catalogue app-owned des Activités (data-driven, éditable). */
export const ACTIVITIES = activitiesJson as ActivityDef[];
/** Activité par `id` STABLE. */
export const activityById = (id: string): ActivityDef | undefined => ACTIVITIES.find((a) => a.id === id);
/** Activités proposables dans un contexte donné (interlude / voyage / mer) — porte UNIQUE des
 *  catalogues jouables : les Activités à dette `blocked` en sont retirées. */
export function activitiesFor(context: ActivityContext): ActivityDef[] {
  return ACTIVITIES.filter((a) => a.contexts.includes(context) && !a.blocked);
}

/** Issue STRUCTURÉE d'une Activité de voyage résolue — PURE (l'appelant applique `ops`/`stageOutcome`/
 *  `extenue` au state). Le résolveur ne mute rien : pour l'acteur DÉSIGNÉ au poste, il lance le Test et
 *  déclare l'effet. RAW EDOC 8 l.131 : « chaque Personnage bénéficie d'une Activité par Étape » →
 *  un héros par poste ; la boucle appelle ce résolveur PAR héros. */
export interface TravelActivityResult {
  activityId: string;
  /** Héros qui tient le poste (toujours l'acteur désigné). */
  actorId: string;
  /** Valeur de compétence (base, avant Difficulté/mod) — pour la ligne de jet du bilan. */
  value?: number;
  roll?: number;
  target?: number;
  sl: number;
  success: boolean;
  /** Effets mécaniques de réussite (GameOp) à passer à `applyOps`. */
  ops: GameOp[];
  /** Issue de portée Étape, interprétée par la boucle de voyage. */
  stageOutcome?: StageOutcome;
  /** Échec du Test d'Activité → État Exténué pour CET acteur (EDOC 8 l.133). */
  extenue: boolean;
  /** Résolveur BESPOKE à invoquer côté appelant (ex. `'forage'` → `forageYield`). */
  resolver?: ActivityResolver;
  /** Cible de DR d'un Test ÉTENDU (Établir des cartes : `drPerStage` × Étapes). */
  drTarget?: number;
}

/**
 * Résout l'Activité tenue par l'acteur DÉSIGNÉ au poste (EDOC 8 : un héros par Activité/Étape).
 * Parmi les compétences « au choix » (Cartographe/Dessin ; plus tard Voile/Ramer), prend la MEILLEURE
 * de CET acteur (spec-aware), lance le Test (modifié par `skillMod` — ex. météo) et déclare l'effet :
 * `ops` (GameOp de `onSuccess`) sur réussite, `stageOutcome`, et `extenue` sur échec (l.133). PUR / seedé.
 * `freeSkill` fournit la compétence pour les Activités à compétence libre (Pratiquer une Compétence) ;
 * la DÉSIGNATION de l'acteur (assignation joueur, ou `partyBest` par défaut pour un poste de groupe)
 * est faite par l'appelant, jamais ici.
 */
export function resolveTravelActivity(
  actor: Combatant,
  def: ActivityDef,
  rng: RNG = defaultRNG,
  opts: { skillMod?: number; stages?: number; freeSkill?: RefDesignee } = {},
): TravelActivityResult {
  const out: TravelActivityResult = {
    activityId: def.id, actorId: actor.id, sl: 0, success: true, ops: [], extenue: false,
    stageOutcome: def.stageOutcome, resolver: def.resolver,
  };
  if (def.extended && opts.stages != null) out.drTarget = def.extended.drPerStage * opts.stages;

  const skillRefs = def.freeSkill ? (opts.freeSkill ? [opts.freeSkill] : []) : (def.skills ?? []);
  // Activité SANS Test (Récupérer) : l'issue s'applique directement à l'acteur.
  if (!skillRefs.length) { out.ops = def.onSuccess ?? []; return out; }

  // « Au choix » : la MEILLEURE compétence de l'acteur (spec-aware) l'emporte — primitive NEUTRE partagée.
  const res = resolveSkillBest(actor, skillRefs, def.difficulty ?? 'intermediaire', rng, opts.skillMod ?? 0);
  out.value = res.value;
  out.roll = res.roll;
  out.target = res.target;
  out.sl = res.sl;
  out.success = res.success;
  out.ops = res.success ? (def.onSuccess ?? []) : [];
  out.extenue = !res.success && !!def.failExtenue;
  return out;
}

/** SPEC influençable d'une Activité de voyage tenue par un acteur, SANS lancer le dé : la compétence
 *  retenue (meilleure de l'acteur), sa valeur brute et la CIBLE effective (Difficulté + `skillMod` déjà
 *  appliqués, bornée 1..99 — comme `rollTest`). Sert à bâtir une ÉTAPE de cascade influençable ; la
 *  résolution du dé (RNG ou influence) vit dans la cascade, l'issue s'obtient ensuite par
 *  `applyTravelActivityResult`. Une Activité SANS Test (Récupérer) renvoie `target: null`. PUR. */
export interface TravelActivitySpec {
  activityId: string;
  actorId: string;
  used?: RefDesignee;
  value: number;
  /** Cible effective (Difficulté + mod, bornée) — `null` pour une Activité sans Test. */
  target: number | null;
  skillMod: number;
  drTarget?: number;
}

export function travelActivitySpec(
  actor: Combatant,
  def: ActivityDef,
  opts: { skillMod?: number; stages?: number; freeSkill?: RefDesignee } = {},
): TravelActivitySpec {
  const skillRefs = def.freeSkill ? (opts.freeSkill ? [opts.freeSkill] : []) : (def.skills ?? []);
  const drTarget = def.extended && opts.stages != null ? def.extended.drPerStage * opts.stages : undefined;
  // Activité SANS Test (Récupérer) : pas d'étape-jet.
  if (!skillRefs.length) return { activityId: def.id, actorId: actor.id, value: 0, target: null, skillMod: opts.skillMod ?? 0, drTarget };
  // MÊME choix que `resolveSkillBest` : meilleure valeur de l'acteur (first-max), Difficulté + mod bornés.
  let bestVal = -Infinity;
  let used: RefDesignee | undefined;
  for (const ref of skillRefs) {
    const v = testValue(actor, ref.id, undefined, ref.spec);
    if (v > bestVal) { bestVal = v; used = ref; }
  }
  const value = Number.isFinite(bestVal) ? bestVal : 0;
  const target = Math.max(1, Math.min(99, value + DIFFICULTY_MODIFIERS[def.difficulty ?? 'intermediaire'] + (opts.skillMod ?? 0)));
  return { activityId: def.id, actorId: actor.id, used, value, target, skillMod: opts.skillMod ?? 0, drTarget };
}

/** Issue d'une Activité de voyage à partir d'un JET DÉJÀ résolu (cascade influençable) — jumeau PUR de
 *  `resolveTravelActivity` mais sans RNG : `success`/`sl` viennent de l'étape. `roll==null` (Activité sans
 *  Test) → issue directe (Récupérer). Même déclaration d'effets (`ops`/`stageOutcome`/`extenue`). PUR. */
export function applyTravelActivityResult(
  spec: TravelActivitySpec,
  def: ActivityDef,
  roll: { roll: number; target: number; sl: number; success: boolean } | null,
): TravelActivityResult {
  const out: TravelActivityResult = {
    activityId: def.id, actorId: spec.actorId, sl: 0, success: true, ops: [], extenue: false,
    stageOutcome: def.stageOutcome, resolver: def.resolver, drTarget: spec.drTarget,
  };
  if (!roll) { out.ops = def.onSuccess ?? []; return out; } // Activité sans Test
  out.value = spec.value;
  out.roll = roll.roll;
  out.target = roll.target;
  out.sl = roll.sl;
  out.success = roll.success;
  out.ops = roll.success ? (def.onSuccess ?? []) : [];
  out.extenue = !roll.success && !!def.failExtenue;
  return out;
}

// ── Postes d'une Étape : héros → 1 Activité (jamais deux) ; un poste a 0..N titulaires ──────────

/** Agrégation d'une issue d'Activité quand 0..N héros tiennent le poste (EDOC 8 l.131) :
 *  - `gate` : un SEUL succès suffit à dispenser/protéger tout le groupe (Plein air, Aux aguets) ;
 *  - `stack` : les DR des succès s'ADDITIONNENT (Monter le camp ; carte en Test étendu) ;
 *  - `self` : l'effet revient à CHAQUE titulaire qui réussit (Récupérer, Pratiquer, Recueillir infos). */
export type StageOutcomeAgg = 'gate' | 'stack' | 'self';

/** Classification (DONNÉE) des issues d'ACTIVITÉ par mode d'agrégation. Les issues de RENCONTRE
 *  (`extraActivity`/`skipStage`/`fullRecovery`/`worsenWeather`) sont de portée Étape (appliquées une
 *  fois), hors de cette agrégation par héros. */
export const STAGE_OUTCOME_AGG: Partial<Record<StageOutcome, StageOutcomeAgg>> = {
  suppressExposure: 'gate',
  noSurprise: 'gate',
  campCare: 'stack',
  mapMade: 'stack',
  countsAsRest: 'self',
  rerollToken: 'self',
  gatherInfo: 'self',
};

/** Poste tenu par un héros pour une Étape : l'Activité + (pour Pratiquer une Compétence) la compétence libre. */
export interface StagePosting { activityId: string; freeSkill?: RefDesignee }

/** Résout TOUS les postes d'une Étape : itère les héros ASSIGNÉS (un poste max chacun) et résout
 *  l'Activité de chacun via `resolveTravelActivity`. PUR / seedé ; ordre = ordre du groupe. Un héros
 *  sans poste (ou un poste d'`activityId` inconnu) est ignoré. */
export function resolveStageActivities(
  party: Combatant[],
  assignment: Record<string, StagePosting>,
  rng: RNG = defaultRNG,
  opts: { skillMod?: (def: ActivityDef) => number; stages?: number } = {},
): TravelActivityResult[] {
  const results: TravelActivityResult[] = [];
  for (const hero of party) {
    const posting = assignment[hero.id];
    if (!posting) continue;
    const def = activityById(posting.activityId);
    if (!def) continue;
    // Le modificateur (météo) est PAR activité (Plein air / Approvisionnement modifiés, les autres non).
    results.push(resolveTravelActivity(hero, def, rng, { skillMod: opts.skillMod?.(def), stages: opts.stages, freeSkill: posting.freeSkill }));
  }
  return results;
}

/** Issues d'Étape agrégées (l'appelant APPLIQUE : portes au groupe, cumuls répartis, individuels par héros). */
export interface StageAggregation {
  /** Portes OUVERTES (≥ 1 succès) — ex. `suppressExposure`, `noSurprise`. */
  gates: StageOutcome[];
  /** Cumul des DR des succès par issue — ex. `campCare`, `mapMade`. */
  stacks: Partial<Record<StageOutcome, number>>;
  /** Issues INDIVIDUELLES par héros (succès) — ex. `countsAsRest`, `rerollToken`. */
  selfByHero: Record<string, StageOutcome[]>;
}

/** Agrège les issues des Activités d'une Étape selon `STAGE_OUTCOME_AGG`. Un échec n'apporte pas
 *  l'issue (mais a déjà donné l'Exténué via `result.extenue`). PUR. */
export function aggregateActivityOutcomes(results: TravelActivityResult[]): StageAggregation {
  const gates = new Set<StageOutcome>();
  const stacks: Partial<Record<StageOutcome, number>> = {};
  const selfByHero: Record<string, StageOutcome[]> = {};
  for (const r of results) {
    if (!r.success || !r.stageOutcome) continue;
    switch (STAGE_OUTCOME_AGG[r.stageOutcome]) {
      case 'gate': gates.add(r.stageOutcome); break;
      case 'stack': stacks[r.stageOutcome] = (stacks[r.stageOutcome] ?? 0) + Math.max(0, r.sl); break;
      case 'self': (selfByHero[r.actorId] ??= []).push(r.stageOutcome); break;
    }
  }
  return { gates: [...gates], stacks, selfByHero };
}

// ── Rôle de marche PERSISTANT : « les mêmes tiennent toujours le même poste » ────────────────────

/** Rôle de marche INFÉRÉ d'un héros : parmi les Activités de voyage à Test fixe (hors compétence libre
 *  / sans Test), celle où SA meilleure compétence pertinente est la plus haute. Défaut quand le joueur
 *  n'a pas épinglé de `travelRole`. `null` si aucune Activité testable (catalogue vide). PUR. */
export function defaultTravelRole(hero: Combatant): string | null {
  // Activités de voyage à Test fixe seulement (hors compétence libre / sans Test) → celle où la meilleure
  // compétence du héros est la plus haute (`bestSkilledOption`, first-max sur le catalogue). PUR.
  return bestSkilledOption(hero, activitiesFor('voyage').filter((d) => !d.freeSkill && d.skills?.length))?.option.id ?? null;
}

/** Assignation d'Étape initialisée depuis les RÔLES persistants : chaque héros tient son `travelRole`
 *  (ou son rôle inféré). C'est la copie de départ d'un trajet (surchargeable par poste/par Étape) —
 *  un voyage normal = 0 clic d'assignation. PUR. */
export function stageAssignmentFromRoles(party: Combatant[]): Record<string, StagePosting> {
  const out: Record<string, StagePosting> = {};
  for (const hero of party) {
    const role = hero.travelRole ?? defaultTravelRole(hero);
    if (role) out[hero.id] = { activityId: role };
  }
  return out;
}

export type PriceTier = 'bronze' | 'argent' | 'or';

const CRAFT_BASE_DR: Record<PriceTier, number> = { bronze: 5, argent: 10, or: 15 };
const CRAFT_DIFFICULTY: Record<Availability, Difficulty> = {
  Commune: 'accessible',
  Limitée: 'intermediaire',
  Rare: 'complexe',
  Exotique: 'tresDifficile',
};

/** Cible d'un Test étendu d'Artisanat : DR requis + Difficulté (ch.23 l.68-85). */
export function craftTarget(tier: PriceTier, avail: Availability, atouts: number, defauts: number): { dr: number; difficulty: Difficulty } {
  let dr = CRAFT_BASE_DR[tier];
  for (let i = 0; i < Math.max(0, defauts); i++) dr = Math.ceil(dr / 2); // « chaque Défaut diminue de moitié »
  dr += Math.max(0, atouts) * 5; // « chaque Atout ajoute +5 (après les Défauts) »
  return { dr: Math.max(1, dr), difficulty: CRAFT_DIFFICULTY[avail] };
}

/** Coût du tuteur d'Apprentissage particulier : 2d10 pa PAR tranche de 100 PX (ch.23 l.63). */
export function apprenticeshipTutorCost(talentXpCost: number, rng: RNG = defaultRNG): Money {
  const tranches = Math.max(1, Math.ceil(talentXpCost / 100));
  let pa = 0;
  for (let i = 0; i < tranches; i++) pa += rollDice(2, 10, rng);
  return fromBrass(pa * PA_PER_SC);
}

/** Coût du tuteur d'Entraînement (ch.23 l.132-136) : « PX + 1D10 sous de cuivre, où PX est le coût
 *  d'achat en PX de l'Augmentation. Le tutorat pour les Compétences Avancées coûte le double de ce
 *  montant. » Le double porte sur la part MONÉTAIRE (« ce montant » = le paiement du tuteur — le
 *  coût en PX, lui, est le coût normal de l'Augmentation, déjà doublé hors carrière par `advanceCost`). */
export function entrainementTutorCost(advanced: boolean, rng: RNG = defaultRNG): Money {
  const sc = rollDice(1, 10, rng) * (advanced ? 2 : 1);
  return fromBrass(sc);
}

/** Fourchette du prix du tuteur d'Entraînement (1d10 sc, doublé pour les Compétences Avancées) —
 *  pour afficher le risque AVANT de s'engager (le tirage réel reste `entrainementTutorCost`). */
export function entrainementTutorRange(advanced: boolean): { minBrass: number; maxBrass: number } {
  return advanced ? { minBrass: 2, maxBrass: 20 } : { minBrass: 1, maxBrass: 10 };
}

export interface EntrainementOption {
  kind: 'skill' | 'characteristic';
  /** `id` STABLE de la Compétence ou clé `CharKey` de la Caractéristique. */
  id: string;
  spec?: string;
  label: string;
  /** Compétence Avancée (ch.23 l.135 : « le tutorat […] coûte le double ») — toujours false pour une Caractéristique. */
  advanced: boolean;
  /** Augmentations déjà acquises (0 si la Compétence n'est pas encore connue). */
  advances: number;
  /** Coût en PX de la PROCHAINE Augmentation, coût hors carrière (LDB 07 l.91, déjà doublé). */
  xpCost: number;
  tutorMinBrass: number;
  tutorMaxBrass: number;
}

/** Options d'Entraînement (ch.23 l.130-136) : Compétences et Caractéristiques HORS carrière
 *  seulement — celles DE carrière s'achètent par l'Avancement normal (`buySkillAdvance`/
 *  `buyCharAdvance`), sans tuteur à payer. Une Compétence à Spécialisations liste UNE option par
 *  spec (LDB 09 l.42 : chaque Spécialisation est une Compétence distincte). */
export function entrainementOptions(hero: Combatant): EntrainementOption[] {
  const career = hero.career ?? '';
  const levels = levelsForCareer(career);
  const level = hero.careerLevel ?? 1;
  const sSlots = skillSlots(levels, level);
  const careerChars = availableChars(levels, level);
  const designations = designationsFor(hero, career);

  const chars: EntrainementOption[] = CHAR_KEYS
    .filter((k) => !inCareerChar(careerChars, k))
    .map((k) => {
      const advances = hero.charAdvances?.[k] ?? 0;
      const range = entrainementTutorRange(false);
      return {
        kind: 'characteristic' as const, id: k, label: CHAR_LABELS[k], advanced: false, advances,
        xpCost: advanceCost(advances, 'characteristic', false),
        tutorMinBrass: range.minBrass, tutorMaxBrass: range.maxBrass,
      };
    });

  const skillOptions: EntrainementOption[] = [];
  for (const s of skills) {
    const specs = specPoolOf(s); // options OFFERTES au joueur (Entraînement)
    for (const spec of specs.length ? specs : [undefined]) {
      if (competenceEnCarriere(hero, sSlots, designations, s.id, spec).statut != null) continue; // de carrière → Avancement normal
      const known = hero.skills.find((k) => k.id === s.id && (k.spec ?? '') === (spec ?? ''));
      const advances = known?.advances ?? 0;
      const advanced = s.acces === 'avancee';
      const range = entrainementTutorRange(advanced);
      skillOptions.push({
        kind: 'skill' as const, id: s.id, spec, label: refLabel('skills', { id: s.id, spec }), advanced, advances,
        xpCost: advanceCost(advances, 'skill', false),
        tutorMinBrass: range.minBrass, tutorMaxBrass: range.maxBrass,
      });
    }
  }
  return [...chars, ...skillOptions.sort((a, b) => a.label.localeCompare(b.label))];
}

/** Retrait bancaire (ch.23 l.157-159) : `roll` = le 1d100 du retrait. Planque : seuil de découverte
 *  fixe à 10 (ch.23 l.170), sauf `rate` positionné (MDG 15 l.292 : 50 pour la Planque liée à une
 *  Carte marine). */
export function bankWithdrawOutcome(kind: 'invest' | 'stash', rate: number, roll: number): 'ok' | 'lost' {
  if (kind === 'invest') return roll <= Math.max(1, Math.min(10, rate)) ? 'lost' : 'ok';
  return roll <= (rate > 0 ? rate : 10) ? 'lost' : 'ok';
}

/** Somme d'un dépôt récupéré avec intérêts (« les fonds de départ, plus les intérêts générés »,
 *  l.157 — taux = Indice %). La planque ne rapporte jamais d'intérêts (l.159). */
export function bankPayout(kind: 'invest' | 'stash', amountBrass: number, rate: number): number {
  if (kind === 'stash') return amountBrass;
  return amountBrass + Math.floor((amountBrass * Math.max(1, Math.min(10, rate))) / 100);
}

// ── Catalogues des Activités (pour des sélecteurs UI alimentés par la DONNÉE — fini la saisie
//    du libellé exact). Tout reste cité ; les arbitrages « jeu sans MJ » sont documentés. ──────

/** Compétence Métier (≥ 1 avance) du héros — porte d'entrée RAW de l'Artisanat (ch.23 l.66 :
 *  « si vous possédez les Compétences Métier appropriées »). */
export function metierOf(c: Combatant): SkillInstance | undefined {
  return c.skills.find((s) => s.id === 'metier' && (s.advances ?? 0) > 0);
}

/** Prix listé en sous de cuivre (`priceToMoney` = SOURCE UNIQUE de la conversion, marques comprises). */
const listedBrass = (p: TrappingData['price']): number => toBrass(priceToMoney(p));

/** Dérivation Artisanat d'un équipement : gamme de prix, Disponibilité jouable et matériaux
 *  (« un quart du prix de l'équipement », ch.23 l.66). `null` = objet NON FABRICABLE : sans
 *  Disponibilité, `craftTarget` n'a pas de Difficulté à dériver et le RAW ne fournit aucune classe de
 *  repli (LDB 59 l.15, `isTradable`) — l'appelant refuse en le disant, il ne devine pas. */
export function craftSpecOf(t: Pick<TrappingData, 'price' | 'availability'>): {
  tier: PriceTier; avail: Availability; priceBrass: number; materialsBrass: number;
} | null {
  const avail = t.availability;
  if (!isTradable(avail)) return null;
  const price = priceToMoney(t.price);
  const priceBrass = toBrass(price);
  return {
    tier: price.gold > 0 ? 'or' : price.silver > 0 ? 'argent' : 'bronze',
    avail,
    priceBrass,
    materialsBrass: Math.max(1, Math.floor(priceBrass / 4)),
  };
}

export interface CraftOption {
  /** `id` du trapping (`TrappingData.id`) — réf passée à `craftStart`/`orderItem`. */
  id: string;
  label: string;
  /** CATÉGORIE de catalogue (`TrappingData.categorie` : melee/ranged/armor/trapping…) — groupe le sélecteur. */
  categorie: string;
  tier: PriceTier;
  avail: Availability;
  priceBrass: number;
  materialsBrass: number;
  /** Cible du Test étendu SANS Atout/Défaut (la cible réelle se recalcule au choix). */
  dr: number;
  difficulty: Difficulty;
}

/** Catalogue d'Artisanat : « créer de l'équipement du Chapitre 11 » (ch.23 l.66) = tout
 *  équipement de la base à prix chiffré ET dans le commerce ordinaire (`craftSpecOf` → null sinon).
 *  La source exige seulement « les Compétences Métier appropriées » (ch.23 l.66), sans table
 *  d'adéquation Métier→objet — jeu sans MJ : catalogue non restreint (le Métier reste requis), point
 *  ouvert tranché en donnée. Trié par famille puis prix croissant. */
export function craftCatalog(): CraftOption[] {
  return trappings
    .filter((t) => listedBrass(t.price) > 0)
    .flatMap((t) => {
      const spec = craftSpecOf(t);
      if (!spec) return [];
      const target = craftTarget(spec.tier, spec.avail, 0, 0);
      return [{ id: t.id, label: t.label, categorie: t.categorie, ...spec, dr: target.dr, difficulty: target.difficulty }];
    })
    .sort((a, b) => (a.categorie === b.categorie ? a.priceBrass - b.priceBrass : a.categorie.localeCompare(b.categorie)));
}

/** Fourchette du prix du tuteur (« 2D10 pistoles d'argent par 100PX », ch.23 l.63) — pour
 *  afficher le risque AVANT de s'engager (le tirage réel reste 2d10/tranche). */
export function tutorCostRange(talentXpCost: number): { minBrass: number; maxBrass: number } {
  const tranches = Math.max(1, Math.ceil(talentXpCost / 100));
  return { minBrass: tranches * 2 * PA_PER_SC, maxBrass: tranches * 20 * PA_PER_SC };
}

export interface LearnOption {
  /** `id` STABLE du Talent — clé de `learnFails` et `opts.talentId` d'`interludeActivity('learn')`. */
  id: string;
  label: string;
  /** Coût PX de la PROCHAINE acquisition (talentCost × fois déjà prises). */
  xpCost: number;
  tutorMinBrass: number;
  tutorMaxBrass: number;
}

/** Talents apprenables par Apprentissage particulier : « apprendre un Talent en dehors de
 *  votre Carrière » (ch.23 l.59) → exclut les talents offerts par la Carrière courante
 *  (jusqu'au Niveau atteint — eux s'achètent par l'Avancement), ceux au Maxi (LDB 10), et ceux
 *  à spécialisation (`specCatalogOf(t).length > 0`) : le catalogue n'a aucun sélecteur de spec
 *  (`LearnOption` n'en porte pas), l'achat via cette Activité ne peut donc pas produire une
 *  identité `(talentId, spec)` cohérente — le gate `arcaneDomainGate` (`careerSlots.ts`) et le
 *  Maxi par spécialisation resteraient contournables sinon. */
export function learnableTalents(hero: Combatant): LearnOption[] {
  const levels = levelsForCareer(hero.career ?? '');
  const slots = talentSlotsUpTo(levels, hero.careerLevel ?? 1);
  const desig = designationsFor(hero, hero.career ?? '');
  return talents
    .filter((t) => {
      if (specCatalogOf(t).length > 0) return false; // pas de sélecteur de spec dans ce catalogue
      if (talentEnCarriere(hero, slots, desig, t.id, undefined) != null) return false; // de carrière → Avancement
      if (talentMaxReached(hero, t.id)) return false;
      return true;
    })
    .map((t) => {
      const xpCost = talentCost(hero.talents.find((k) => k.talentId === t.id)?.times ?? 0);
      const { minBrass, maxBrass } = tutorCostRange(xpCost);
      return { id: t.id, label: t.label, xpCost, tutorMinBrass: minBrass, tutorMaxBrass: maxBrass };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Ce qui interdit « Passer commande » sur un équipement, ou `null` s'il est commandable. Porte
 *  d'entrée = la MARCHANDISE CHIFFRÉE que le commerce ordinaire ne tient pas : l'Activité sert à
 *  « acquérir des objets peu communs ou hautement spécialisés qui ne sont jamais simplement “en
 *  stock” dans les boutiques de l'Empire » (ch.23 l.180).
 *  - `'sans-prix'` : rien à payer à la commande, donc rien à commander (« Les licences de Guilde ne
 *    s'achètent pas », LDB 68 l.25) ;
 *  - `'stock-ordinaire'` : Commune/Limitée/Rare — celles-là se tiennent en stock (LDB 59 l.17-19),
 *    elles passent par le marchand.
 *  Restent donc les Exotiques (« seulement disponibles si le MJ le dit, ou si vous passez commande »,
 *  LDB 59 l.21) ET les objets chiffrés hors des quatre classes, que `isTradable` exclut justement du
 *  stock ordinaire — cas imprimé : le bâton enchanté, qui « nécessite l'Activité Passer commande et
 *  coûte 15 CO » (VDM 12 l.42) sans porter de Disponibilité. */
export function orderBlockOf(t: Pick<TrappingData, 'price' | 'availability'>): 'sans-prix' | 'stock-ordinaire' | null {
  if (listedBrass(t.price) <= 0) return 'sans-prix';
  if (isTradable(t.availability) && t.availability !== 'Exotique') return 'stock-ordinaire';
  return null;
}

/** Catalogue de « Passer commande » (ch.23 l.167-172), payé à la commande — porte d'entrée
 *  `orderBlockOf` (partagée avec `orderItem`). */
export function orderCatalog(): { id: string; label: string; categorie: string; priceBrass: number }[] {
  return trappings
    .filter((t) => orderBlockOf(t) === null)
    .map((t) => ({ id: t.id, label: t.label, categorie: t.categorie, priceBrass: listedBrass(t.price) }))
    .sort((a, b) => a.priceBrass - b.priceBrass);
}

/** Revenus d'une semaine de travail par Statut (LDB 08 l.105-120). */
export function statusIncome(
  tier: PriceTier,
  standing: number,
  rng: RNG = defaultRNG,
  outcome: 'success' | 'fail' | 'astoundingFail' = 'success',
): Money {
  if (outcome === 'astoundingFail') return fromBrass(0);
  let brass = 0;
  for (let i = 0; i < Math.max(0, standing); i++) {
    if (tier === 'bronze') brass += rollDice(2, 10, rng); // 2d10 sous de cuivre
    else if (tier === 'argent') brass += rollDice(1, 10, rng) * PA_PER_SC; // 1d10 pistoles
    else brass += PA_PER_CO; // 1 couronne d'or
  }
  if (outcome === 'fail') brass = Math.floor(brass / 2); // « la moitié de la somme »
  return fromBrass(brass);
}
