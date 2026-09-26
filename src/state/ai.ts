/**
 * IA d'ennemi — couche de DÉCISION pure et testable.
 *
 * `chooseEnemyAction` ne mute rien et ne tire aucun dé : elle choisit l'action
 * d'un ennemi à partir de l'état tactique (positions, Blessures, armes, sorts).
 * La RÉSOLUTION (jets, dégâts, animations, timers) reste dans le store.
 *
 * Aucune règle inventée : le déplacement réutilise le BFS de `path.ts`, l'ESPÉRANCE de dégâts
 * (`expectedDamage`) réutilise les fonctions du moteur (`attackModifiers`/`combineMods`/`woundsFromHit`/
 * `missileDamage`), le positionnement réutilise la géométrie (`isFlankOrRear`/`lineOfSightCover`). Les
 * HEURISTIQUES de CHOIX (menace, positionnement) ne sont pas des règles canon (latitude permise), mais
 * chaque chiffre dérive d'une fonction du moteur — pas de constante magique « pifométrique » — et toute
 * action jouée passe par la résolution RAW (LoS LDB 13 l.114, bandes de portée appliquées au jet).
 *
 * Lot 3 — l'IA vise par MENACE (`targetThreat`, plus le « PV le plus bas »), achève proprement
 * (`killSecure`), ne s'acharne pas (`overkillPenalty`), valorise les États infligés (`CONDITION_THREAT`,
 * data-driven), couvre les paquets en ZdE et se POSITIONNE (flanc/dos, couvert, portée préférée —
 * `positionValue`).
 *
 * Lot 4 — CONTEXTE D'ESCOUADE (`squad` en entrée, OPTIONNEL : absent → comportement Lot 3 inchangé) :
 * FEU CONCENTRÉ via le surnombre RAW (`outnumberEnvMelee` réutilise `outnumberMod`/LDB 14 avec le MÊME
 * décompte que la résolution `combatFlow.ts:425` → l'IA converge sur une cible que ses alliés encadrent),
 * ÉVITEMENT du DANGER (`dangerAt` : danger-map des héros, l'ennemi fuit les cases exposées) et COHÉSION
 * légère (ne pas s'isoler de l'escouade). Aucun nouveau MODIFICATEUR de combat n'est inventé.
 */
import { Combatant, Weapon } from '../engine/types';
import { Scene, sceneMetresPerTile } from './scene';
import { reachable, flyReachable, manhattan, chebyshev, Pt, type TraverseCapability } from './path';
import { footprintChebyshev, footprintN, combatDistance } from './footprint';
import { verticalTiles } from './relief';
import { makeLosMemo, type LosMemo } from './lineOfSight';
import { COVER_ORDER } from '../engine/cover';
import { rangeBandModifier, outnumberMod, canFireWhileEngaged, type ModLine } from '../engine/combat';
import { effectiveWeaponRange } from '../engine/weaponDamage';
import { loadedAmmo } from '../engine/items';
import { weaponLoaded } from '../engine/weaponLoad';
import { structureImmune, structureAimCell } from '../engine/structures';
import { bonus, effectiveChar } from '../engine/characteristics';
import { finite, expectedDamage, isNeutralized, spellActionValue, spellIsOffensive, spellTargetHarm, opValue } from './aiSpellValue';
import { selfManeuversOf, selfManeuverApplicable } from '../engine/creatureAttacks';
import { spellEffectOps } from '../engine/flowCore';

/** Aversion au TIR AMI d'une ZdE : blesser/incapaciter un allié pèse FOIS-CECI un gain ennemi équivalent
 *  (>1 → l'IA ne nuke jamais son camp pour un gain marginal). Ressenti, latitude IA. */
const FRIENDLY_FIRE_AVERSION = 2;
import type { SpellData } from '../data';
import { hasCondition, canTakeAction, isActionLocked, restrictingConditions, COND } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { isEngaged, meleeReachTiles } from '../engine/engagement';
import { isFlankOrRear } from './combatGeometry';
import { facingToward, type Dir8 } from './dir8';
import { groupMatch } from '../engine/groups';
import { isBestial, isTerritorial, isMindless, isStupid } from '../engine/traits/dispatch';
import { creatureAttacks } from '../engine/creatureAttacks';
import { isFrenzied } from '../engine/psychology';

// === TRACE DE DÉCISION IA (DEV uniquement, GATÉE) ============================================
// Diagnostic dev : capture le CLASSEMENT des candidats (l'« intention ») du DERNIER appel à
// `chooseEnemyAction`. GATÉE par `AI_TRACE` (off par défaut) → quand off, `_lastRanking` n'est JAMAIS
// écrit ⇒ l'IA pure reste pure (zéro effet en prod ET dans les tests). Activée par les devtools (DEV).
let AI_TRACE = false;
export function setAiTrace(on: boolean) { AI_TRACE = on; }
export interface AiCandTrace { kind: string; spell?: string; targetId?: string; utility: number; }
let _lastRanking: AiCandTrace[] = [];
/** Récupère ET vide le classement du dernier choix (consommateur UNIQUE = `runEnemyAI`). */
export function consumeAiRanking(): AiCandTrace[] { const r = _lastRanking; _lastRanking = []; return r; }

/** UN sort connu de l'ennemi, RÉSOLU + enrichi de ses métadonnées impures (données, portée en cases,
 *  forme, fiabilité d'incantation, état de Focalisation, Unicité) par la couche impure (`buildAiInput`,
 *  combatFlow). L'énumération PURE en dérive des candidats `cast`/`castArea`/`focus` scorés par
 *  `spellActionValue`. `data` porte les `effects`/`opposed`/`range`/`target` lus par l'évaluateur. */
export interface CastableSpell {
  id: string;
  data: SpellData;
  /** Niveau d'Incantation (0 pour une Prière). */
  cn: number;
  /** Portée en CASES (`spellRangeTiles`) ; null = non chiffrable → pas de gate de portée. */
  range: number | null;
  /** `single` (mono-cible) / `self` (sur soi) / `{area}` (ZdE, rayon en cases). */
  shape: 'single' | 'self' | { area: { radius: number } };
  /** Probabilité (0..1) DÉTERMINISTE que l'incantation aboutisse (réussite ET DR≥NI) — `castLandProbability`. */
  landProb: number;
  /** Focalisation (LDB 46) : `ready` = sort focalisé et prêt (NI 0) ; `focusable` = arcane peu fiable
   *  qu'il vaut mieux focaliser que rater en boucle ; `none` = lançable d'un jet. */
  focusState: 'none' | 'ready' | 'focusable';
  /** Unicité RAW (LDB 46 l.116-121 / 40 l.16-19) : un effet/une invocation de CE sort est déjà actif. */
  active: boolean;
}

export type EnemyAction =
  | { kind: 'cast'; targetId: string; spell: string } // incantation offensive sur la cible
  | { kind: 'castArea'; spell: string; center: Pt } // sort de ZONE (ZdE) auto-posé sur un point couvrant ≥2 héros
  | { kind: 'focus'; spell: string } // Focalisation (LDB 46) d'un sort offensif infaisable en un seul jet
  | { kind: 'shoot'; targetId: string } // tir depuis la position courante (arme à distance)
  | { kind: 'reload' } // recharge une arme à Recharge déchargée (Test étendu de Projectiles, LDB 62 l.333)
  | { kind: 'melee'; targetId: string } // attaque de mêlée (cible adjacente)
  | { kind: 'move'; to: Pt; thenTargetId: string } // approche ; attaque après si adjacent
  | { kind: 'recover'; state: 'empetre' | 'en-flammes' } // se libérer / se rouler au sol (LDB 16 l.66/84)
  | { kind: 'spendResource'; resource: 'resolve'; via: 'removeCondition'; id: string } // dépense PROACTIVE de Détermination pour retirer un État verrouillant (Brisé) et se ressaisir (LDB 17 l.57-61)
  | { kind: 'grapple'; targetId: string; resolution: 'break' | 'test' } // Empoigné à son tour (LDB 14 l.161) : son Action EST le Test opposé de Force, OU « Briser » (Avantage supérieur) pour regagner sa liberté d'action puis re-décider
  | { kind: 'manPoste'; hullId: string; posteUid: string } // « Servir cette pièce » (MDG 12) : devenir chef d'un poste de siège NON servi adjacent (l'arme de siège est octroyée) — coûte l'Action
  | { kind: 'selfManeuver'; maneuverId: string } // capacité SUR SOI (forme de combat lycanthrope, op transform) — coûte l'Action (2ᵉ via loseTurn)
  | { kind: 'end' }; // rien à faire, passe la main

export interface EnemyTurnInput {
  /** L'ennemi qui agit (doit avoir `pos`). */
  enemy: Combatant;
  /** Héros encore en action (vivants), tous avec `pos`. */
  heroes: Combatant[];
  scene: Scene;
  /** Cases occupées par d'autres combattants (l'ennemi lui-même exclu) — bloquent le TRANSIT. */
  blocked: Set<string>;
  /** Cases TRAVERSABLES mais où l'ennemi ne peut pas FINIR son déplacement (créatures plus petites
   *  dégagées du chemin, LDB 85 l.373-374 — on ne s'arrête jamais sur une autre créature). ABSENT =
   *  aucune contrainte d'arrêt (tests purs). */
  noStop?: Set<string>;
  /** Mouvement effectif en cases (dérivé de l'Encombrement par l'appelant). */
  movement: number;
  /** TOUS les sorts connus de l'ennemi, RÉSOLUS + enrichis par l'appelant (couche impure qui a les
   *  données + le `battle`) : portée/forme/fiabilité/Focalisation/Unicité. L'énumération PURE en dérive
   *  des candidats `cast`/`castArea`/`focus` scorés par `spellActionValue`. Vide = aucun sort → aucun
   *  candidat de sort (comportement strictement inchangé pour les fixtures sans sort). */
  spells: CastableSpell[];
  /** Vol (LDB 85 l.433) : le déplacement ignore terrains/obstacles/personnages traversés. */
  flying?: boolean;
  /** Grimpant (LDB 85 l.160-162), patron de `flying` : capacité de traversée dérivée par l'appelant
   *  (`climbTraverseFor`, ai.ts est pur) — arêtes `WallSeg.climb` franchies au pas normal. ABSENT/undefined
   *  = aucune capacité (comportement historique, `reachable` inchangé). */
  traverse?: TraverseCapability;
  /** Cases enfumées (Souffle (Fumée)) qui bloquent la Ligne de Vue. */
  smoke?: Pt[];
  /** Vision RÉCIPROQUE : cases (`"x,y,0"`) que CET ennemi perçoit réellement (Ligne de Vue + lumière,
   *  vision nocturne incluse) — calculé par l'appelant via le moteur de vision. L'ennemi ne cible/poursuit
   *  que les héros sur ces cases (furtivité). ABSENT = pas de gate (comportement historique / tests purs). */
  perceived?: Set<string>;
  /** Orientation MONDE (`Dir8`) des combattants, lue de `get().facing` par l'appelant (couche impure :
   *  `ai.ts` est pur, sans store). Sert au bonus de FLANC/DOS du positionnement (`isFlankOrRear`, LDB 14
   *  l.91). ABSENT = aucun bonus de flanc (graceful : tests purs / scène sans orientation). */
  facing?: Record<string, Dir8>;
  /** ESCOUADE (Lot 4) : les ALLIÉS de l'ennemi encore en action et posés (l'ennemi lui-même EXCLU),
   *  résolus par l'appelant (couche impure qui a le `battle`). Sert au FEU CONCENTRÉ (surnombre RAW en
   *  mêlée, LDB 14 — même `outnumberMod` et même décompte que la résolution, cf. combatFlow.ts:425) et
   *  à la COHÉSION légère (ne pas s'isoler / ne pas bloquer l'allié). ABSENT = comportement Lot 3 STRICTEMENT
   *  inchangé (le golden et les fixtures sans escouade restent identiques). */
  squad?: Combatant[];
  /** Postes de siège NON servis à portée de SERVICE (emplacement/coque adjacent), surfacés par l'appelant
   *  impur (`servablePostes`, qui a la liste COMPLÈTE des combattants). Donnent un candidat `manPoste`
   *  KIND-AGNOSTIQUE. ABSENT/vide (toute fixture sans emplacement) → aucun candidat (parité golden). */
  servablePostes?: { hullId: string; posteUid: string }[];
  /** Structures destructibles encore debout (porte/mur, `isStructure`), surfacées par l'appelant impur.
   *  Une arme de SIÈGE les cible (`AA 10 l.138`) — l'Atout Siège (×2 aux structures, `woundsFromHit`) fait
   *  que la valeur d'une telle attaque est NATURELLEMENT élevée → une pièce de siège PRIORISE la porte.
   *  `structureImmune` écarte les armes qui ne l'abîment pas ; les autres restent candidates.
   *  ABSENT/vide (toute fixture sans structure) → aucun candidat (parité golden). */
  structures?: Combatant[];
  /** Cet ennemi sert un poste d'engin ACTIF (`crewPosteOf`, #196 : bélier, batterie de siège — le naval lie
   *  déjà son équipage autrement, `shipOfCrew`) — il TIENT SA FORMATION plutôt que de charger : c'est le
   *  MOUVEMENT DU POSTE (poussée du chef) qui le déplace, pas une décision individuelle. Implémenté en
   *  plafonnant son Mouvement effectif à 0 (aucune approche/charge générée) ; Engagé (ennemi déjà adjacent),
   *  il se défend/attaque normalement DEPUIS sa case (la mêlée sur cible adjacente n'exige aucun Mouvement).
   *  ABSENT/faux = comportement normal (parité golden). */
  holdsFormation?: boolean;
  /** Restriction d'armes à distance EFFECTIVE de la rencontre (#537, résolue par `banRangedActive(battle)`
   *  — SOURCE UNIQUE, `ai.ts` reste pur sans `battle`). Sous ban, l'IA ne considère PLUS ses armes à distance
   *  comme jouables (`hasRanged`) : elle bascule mêlée/approche au lieu de télégraphier un tir no-op
   *  (`resolveAttack` le refuserait silencieusement, combatFlow.ts:628-631). Ne touche PAS aux sorts offensifs
   *  (NADJ 06 l.181 : la restriction ne vise QUE les projectiles). ABSENT = comportement historique inchangé. */
  banRanged?: boolean;
  /** MÉMO de Ligne de Vue de la DÉCISION en cours (`makeLosMemo`, `lineOfSight.ts`). L'appelant impur
   *  (`buildAiInput`) en pose un par décision et `aiApproachPlan` le REPASSE à ses deux ré-énumérations
   *  (Charge, Course) : une case n'est donc évaluée qu'UNE fois pour toute la décision. ABSENT (tests
   *  purs) = un mémo local à l'appel est créé — mêmes verdicts, mémoïsation seulement moins large. */
  losMemo?: LosMemo;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// POIDS DES HEURISTIQUES (Lot 3) — centralisés et commentés pour régler le RESSENTI sans toucher au
// code. Chaque poids module une grandeur dérivée du moteur (Blessures espérées, États, géométrie) ;
// l'utilité finale d'un candidat est une SOMME pondérée (`scoreCandidate`). Plus le score est HAUT,
// meilleur le candidat (argmax = max). Les grandeurs de base sont en « Blessures espérées » (l'unité
// commune : ce qu'on retire de PB) ; les bonus de position/contrôle sont calibrés sur cette échelle.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const W = {
  /** Espérance de Blessures qu'on inflige À la cible ce tour (cœur offensif). Unité native → ×1. */
  damageDealt: 1,
  /** Menace de la cible (dégâts qu'ELLE peut nous infliger × atteignabilité × fragilité). On vise en
   *  priorité ce qui nous menace le plus tout en étant éliminable : pèse autant que nos propres dégâts. */
  threat: 1,
  /** Achever une cible (dégâts attendus ≥ PB restants) : prime forte — un mort ne riposte plus. */
  killSecure: 12,
  /** S'acharner sur une cible NEUTRALISÉE (à terre/inconsciente/0 PB) : malus FORT (anti-acharnement,
   *  Lot 1) — on ne la frappe qu'en dernier recours (aucune menace debout). */
  overkill: 100,
  /** Frapper au FLANC/DOS (hors champ de vision avant de la cible, LDB 14 l.62) : gratuit → bonus modéré. */
  flankRear: 4,
  /** Gain de COUVERT pour soi en se déplaçant (par cran de couvert gagné : imparfaite/moyenne/totale). */
  coverGain: 3,
  /** Respect de la portée PRÉFÉRÉE : un tireur/lanceur qui reste à distance de tir+LdV plutôt que d'entrer
   *  en mêlée ; un mêlée qui se met au contact. Bonus quand la case d'arrivée respecte la préférence. */
  preferredRange: 5,
  /** Pénalité de DISTANCE résiduelle à la cible après un `move` (par case) : à utilité égale, on choisit
   *  la case qui réduit le plus la distance (départage des approches, calibré faible). */
  approachDist: 0.2,
  // — Lot 4 (contexte d'escouade) ————————————————————————————————————————————————————————————————
  /** ÉVITEMENT du DANGER (danger-map) : pénalité par Blessure espérée que les héros nous infligeraient
   *  DEPUIS la case d'arrivée (Σ sur les héros, via `expectedDamage` réciproque). Calibré < 1 (l'unité
   *  est déjà en « Blessures espérées ») pour rester un DÉPARTAGE de cases d'approche, jamais un veto qui
   *  immobiliserait l'ennemi (l'utilité d'attaque, ×1..12, doit pouvoir l'emporter et faire avancer). */
  dangerAvoid: 0.5,
  /** COHÉSION : malus si la case d'arrivée ISOLE fortement l'ennemi de son escouade (aucun allié à
   *  portée de soutien). SOBRE et faible — un simple départage à utilité d'attaque égale, pour préférer
   *  rester en formation plutôt que de partir seul (n'inverse jamais un choix offensif/danger marqué). */
  cohesion: 1.5,
  // NB : le FEU CONCENTRÉ n'a PAS de poids ad hoc — il passe par le bonus de toucher `outnumberMod` (RAW,
  // LDB 14), injecté dans l'espérance de dégâts (mêlée). C'est un EFFET ÉMERGENT, pas une constante inventée.
  // La VALEUR d'un sort (dégâts/contrôle/soin/buff/invocation) vient de l'évaluateur op-driven
  // (`spellActionValue`/`opValue`, src/state/aiSpellValue.ts) — plus de poids par-catégorie ici.
} as const;

/** Jeu de poids EFFECTIF utilisé par le scoring. `W` (ci-dessus) est le DÉFAUT neutre ; une doctrine en
 *  est un override PARTIEL (cf. `DOCTRINES`). Toutes les clés sont muables ici (≠ `W` figé). */
type Weights = { -readonly [K in keyof typeof W]: number };

// ════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 5 — DOCTRINES TACTIQUES data-driven. « Un loup ≠ une bande de brigands ≠ une compagnie d'élite ».
// Une DOCTRINE = (a) un OVERRIDE PARTIEL des poids `W` du cœur discrétionnaire + (b) 1-2 micro-réglages
// de macro-comportement (`macro`). Elle est SÉLECTIONNÉE par des signaux DATA (traits/Intelligence/groups/
// sorts — `pickDoctrine`), JAMAIS par un nom de créature en dur. CONTRAINTE RAW ABSOLUE : une doctrine ne
// module QUE les poids du scoring discrétionnaire — elle ne touche JAMAIS une garde forcée (fuite Bestial
// <50 %, Frénésie, Brisé, Territorial, En flammes/Empêtré, filtre Animosité/Haine), qui restent EN AMONT,
// inchangées. Le surnombre reste `outnumberMod` (aucun nouveau modificateur de combat). Les valeurs sont
// du RESSENTI (latitude IA permise), pas des règles canon.
// ════════════════════════════════════════════════════════════════════════════════════════════════
export type DoctrineId = 'standard' | 'meute' | 'racaille' | 'soldats' | 'tirailleurs' | 'artillerie' | 'horde' | 'embuscade';

/** Macro-réglages LÉGERS d'une doctrine (au-delà des poids), appliqués DANS le cœur discrétionnaire sans
 *  jamais contredire une garde RAW. */
interface DoctrineMacro {
  /** REPLI « doctrine » (LATITUDE de moteur, aucune règle ne la porte) : un NON-Bestial très entamé (PB/PBmax < seuil) qui n'est PAS
   *  Engagé se replie comme un Bestial (réutilise `fleeMove`, aucun nouveau mécanisme). N'a d'effet QUE pour
   *  un combattant SANS garde de fuite RAW (un Bestial est déjà géré en amont, intouché). Absent ⇒ pas de repli. */
  retreatBelow?: number;
}

/** Une doctrine = override partiel des poids + macro optionnel. */
type Doctrine = Partial<Weights> & { macro?: DoctrineMacro };

/**
 * Les 7 doctrines (presets confirmés). Chaque entrée n'écrit QUE les poids qu'elle DÉVIE de `W` ; tout le
 * reste hérite du défaut neutre. `standard` est volontairement VIDE (= `W` à l'identique) → garantit que le
 * golden et les fixtures génériques (classées `standard`) gardent EXACTEMENT le comportement des Lots 1-4.
 */
const DOCTRINES: Record<DoctrineId, Doctrine> = {
  // DÉFAUT NEUTRE — aucun delta : les poids effectifs == `W`. Obligatoire pour la parité golden.
  standard: {},
  // MEUTE / prédateur (Bestial, Int basse, ni sorts ni tir) : se rue sur la proie ISOLÉE/blessée et la prend
  // à revers. ↑threat (la fragilité/atteignabilité dans `targetThreat` pèse plus → cible l'entamé) ; ↑flankRear
  // (encerclement). La FUITE <50 % PB est DÉJÀ la garde Bestial RAW (LDB 85) en amont — PAS réimplémentée ici.
  meute: { threat: 1.8, flankRear: 8 },
  // RACAILLE / opportuniste (humain, Int moyenne, aucun signal militaire) : tape le plus faible/sans défense
  // et se préserve. ↑threat (priorise la cible fragile/achevable, comme la meute mais sans le flanc de prédateur)
  // ↑killSecure (achève dès que possible) ↑dangerAvoid (esquive les cases dangereuses). MACRO : repli « doctrine »
  // léger sous 1/3 PB (LATITUDE — un non-Bestial n'a pas de fuite RAW, donc ce repli ne contredit aucune garde).
  racaille: { threat: 1.5, killSecure: 16, dangerAvoid: 0.9, macro: { retreatBelow: 1 / 3 } },
  // SOLDATS / tenir la ligne (groups militaire OU CC élevée, ni Bestial ni Stupide) : FEU CONCENTRÉ (le
  // surnombre `outnumberMod` est déjà dans l'espérance de dégâts en mêlée → on RENFORCE le poids de dégâts
  // pour que la cible encadrée par les alliés l'emporte plus nettement), tient le COUVERT (↑coverGain),
  // préfère le contact (↑preferredRange : tenir la ligne au corps-à-corps), cohésion plus marquée (formation).
  soldats: { damageDealt: 1.4, coverGain: 6, preferredRange: 8, cohesion: 3 },
  // TIRAILLEURS / kiting (arme à distance + Agilité haute, pas de préférence mêlée) : garde la DISTANCE,
  // recule devant l'approche, vise les casters. ↑preferredRange (rester à portée de tir+LdV est très valorisé),
  // ↑dangerAvoid (kiting : fuir les cases au contact), ↑threat (un caster dangereux monte en menace → ciblé).
  tirailleurs: { preferredRange: 12, dangerAvoid: 1.2, threat: 1.6 },
  // ARTILLERIE / lanceurs (possède des sorts, Int/FM hautes) : reste LOIN, à couvert, et arrose les paquets.
  // ↑dangerAvoid + ↑preferredRange (se tient hors de portée), ↑coverGain (se planque). La VALEUR des sorts
  // (ZdE/débuff/invocation) vient de l'évaluateur op-driven, plus d'un poids par-catégorie ici.
  artillerie: { dangerAvoid: 1.2, preferredRange: 10, coverGain: 6 },
  // HORDE / Insensible-Stupide (mort-vivant Fabriqué, Stupide) : AVANCE DROIT, sans auto-préservation ni
  // cohésion (aucune pensée de groupe). dangerAvoid=0 et cohesion=0 → elle ne contourne pas le danger et ne
  // se soucie pas de rester groupée ; le surnombre brut reste émergent via `outnumberMod`. Pas de repli (un
  // Insensible/Sans Peur ne fuit pas — et n'étant pas Bestial, aucune garde de fuite ne s'applique).
  horde: { dangerAvoid: 0, cohesion: 0 },
  // EMBUSCADE : « attaque-surprise sur l'isolé, pas de repli ». SÉLECTIONNÉE AUTO par `pickDoctrine` sur le
  // signal RÉEL de charge d'embuscade (État Surpris du camp adverse, LDB 16 l.131-139 — cf. `pickDoctrine`
  // ci-dessous), ou par l'override `aiDoctrine` (donnée) en secours/forçage manuel. DISTINCTE de la meute
  // (≠ identité nominale, cf. relecture L5) : l'embusqué a l'INITIATIVE et frappe pour TUER la cible isolée
  // d'entrée, prise à revers depuis sa cachette. ↑↑flankRear (frappe de dos depuis l'embuscade, plus marqué
  // que la meute) ; ↑↑killSecure (le coup d'ouverture cherche l'élimination — pas un harcèlement de meute) ;
  // ↑threat (priorise l'isolé fragile). Et SURTOUT : AUCUN `macro.retreatBelow` (l'embusqué a choisi son
  // moment, il ne recule pas — contraste avec la racaille).
  embuscade: { threat: 1.8, flankRear: 12, killSecure: 18 },
};

/**
 * Choisit la DOCTRINE d'un ennemi à partir de signaux ROBUSTES & data-driven (PURE, déterministe — aucun
 * dé, aucun store). Priorité : (1) OVERRIDE `enemy.aiDoctrine` (donnée Codex/éditeur) s'il est VALIDE →
 * renvoyé tel quel ; (2) SIGNAL D'EMBUSCADE (État Surpris du camp adverse, cf. ci-dessous) ; (3) sinon
 * classification par traits/Intelligence/groups/équipement. DÉFAUT NEUTRE `standard` dès qu'aucun signal
 * n'est franc (garantit l'inchangé des tests/golden). AUCUN nom de créature/carrière en dur : on lit des
 * capacités (`isBestial`…), une Caractéristique (`Int`), des `groups` et un État (`Surpris`).
 *
 * @param enemy l'ennemi qui agit (traits/characteristics/groups/spells/weapons/conditions).
 * @param squad ses alliés (réservé à de futurs signaux d'escouade — non requis par les règles actuelles).
 * @param heroes les héros de la rencontre (non filtrés par perception — `chooseEnemyAction` passe
 *  `input.heroes`) : sert UNIQUEMENT au signal d'embuscade ci-dessous. ABSENT ⇒ aucun signal (comportement
 *  historique des appels directs à `pickDoctrine` sans 3ᵉ argument, ex. la majorité d'`ai-doctrine.test.ts`).
 */
export function pickDoctrine(enemy: Combatant, _squad: Combatant[] = [], heroes: Combatant[] = []): DoctrineId {
  // (1) OVERRIDE EN DONNÉE prioritaire : si l'auteur a figé une doctrine valide, on la respecte TELLE QUELLE.
  const forced = enemy.aiDoctrine;
  if (forced && forced in DOCTRINES) return forced as DoctrineId;

  // (2) SIGNAL RÉEL DE CHARGE D'EMBUSCADE (#127) : `applySurprise` (LDB 13 l.52-81) pose l'État Surpris
  // (LDB 16 l.131-139) SEULEMENT sur le camp PRIS en embuscade, JAMAIS sur l'embusqueur, et l'État est
  // retiré en fin de Round (etats.json `surpris.effects[0]` onRoundEnd) — le signal est donc borné au(x)
  // Round(s) où l'embuscade est encore active. Un héros Surpris ET cet ennemi lui-même NON Surpris (il subit
  // sinon, il ne mène pas l'embuscade) ⇒ CET ennemi a l'initiative de la frappe d'ouverture.
  if (heroes.some((h) => hasCondition(h, COND.surpris)) && !hasCondition(enemy, COND.surpris)) return 'embuscade';

  const traits = enemy.traits;
  const bestial = isBestial(traits);
  const mindless = isMindless(traits);
  const stupid = isStupid(traits);
  // Intelligence effective (garde NaN : caractéristiques absentes sur un combattant de test → on traite
  // comme « non chiffrable », donc aucun signal Int — la classification tombe sur les autres signaux/standard).
  const int = finite(effectiveChar(enemy, 'intelligence'), NaN);
  const hasInt = Number.isFinite(int);
  const hasSpells = (enemy.spells?.length ?? 0) > 0;
  const hasRangedWeapon = enemy.weapons.some((w) => w.type === 'ranged');
  const ag = finite(effectiveChar(enemy, 'agilite'), NaN);
  // SIGNAL « groupe » data-driven (≠ folder.includes fragile, ≠ nom en dur) : on matche les `groups`
  // (ids auto-dérivés en donnée : racial, carrière, catégorie bestiaire) contre des CATÉGORIES d'id, via
  // `groupMatch` (appartenance STRICTE par id). Un combattant martial appartient à un groupe militaire ;
  // un humanoïde « racaille » à un groupe racial/criminel. ABSENCE de groupe ⇒ pas de signal (fixtures
  // génériques → standard).
  const groups = enemy.groups ?? [];
  const inGroup = (cats: string[]) => cats.some((cat) => groupMatch(cat, groups));
  // Signaux MILITAIRE et RACAILLE — UNIQUEMENT des ids qui matchent VRAIMENT un Groupe émis par
  // `groupsFor` (`engine/groups.ts`), pour une classification HONNÊTE (relecture L6). Deux familles de
  // signaux réels :
  //  • Catégories de Groupe DÉCLARÉES par l'entrée du bestiaire (`CreatureData.grantGroups`) : `cultiste`, `peau-verte`, `skaven`.
  //  • Carrières PRÉCISES poussées par `groupsFor` (CAREER_RULES) : `soldat`, `garde`, `chevalier` sont de
  //    vraies carrières (`careers.json`) — PAS la classe `guerriers` entière (trop large : Cavalier,
  //    Gladiateur, Archer, Tueur… n'en font pas partie). `criminel` est auto-dérivé de la CLASSE
  //    `roublards` (Hors-la-loi, Voleur, Receleur, Pilleur de tombes…) → couvre toute la racaille criminelle.
  // RETIRÉ comme ENTRÉES MORTES (aucune dérivation correspondante, cf. relecture) : `Militaire` et
  // `Mercenaire` (pas de carrière/catégorie de ce nom) côté militaire ; `Bandit` côté racaille (« Bandit »
  // est un NIVEAU de la carrière Hors-la-loi, pas un libellé de carrière poussé en Groupe — déjà couvert
  // par `Criminel`). Le levier fin reste l'override `aiDoctrine` (et les `extras` manuels de l'éditeur).
  const MILITARY = ['soldat', 'garde', 'chevalier'];
  const RABBLE = ['criminel', 'cultiste', 'peau-verte', 'skaven'];
  const isMilitary = inGroup(MILITARY);
  const isRabble = inGroup(RABBLE);

  // (2) Classification par signaux, du plus DISCRIMINANT au plus général (ordre = priorité). Tous les
  // prédicats reposent sur des SIGNAUX FRANCS (trait/sort/Agilité/groupe) qu'une fixture GÉNÉRIQUE (sans
  // groups, sans trait spécial, Ag moyenne, sans sort) NE possède PAS → elle tombe en `standard` (parité).
  // HORDE : un esprit absent/Stupide (mort-vivant Fabriqué, créature Stupide) avance droit sans se préserver.
  if (mindless || stupid) return 'horde';
  // ARTILLERIE : un LANCEUR (possède des sorts) à l'esprit vif (Int haute) reste loin et arrose les paquets.
  if (hasSpells && hasInt && int >= 30) return 'artillerie';
  // MEUTE : prédateur Bestial à l'esprit animal (Int basse/non chiffrable), SANS sorts ni arme à distance.
  if (bestial && (!hasInt || int < 25) && !hasSpells && !hasRangedWeapon) return 'meute';
  // TIRAILLEURS : tireur AGILE (Ag franche) qui n'est pas un pur mêlée → kiting (garde la distance, vise les casters).
  if (hasRangedWeapon && Number.isFinite(ag) && ag >= 40) return 'tirailleurs';
  // SOLDATS : appartient à un groupe MILITAIRE (entraîné/organisé), ni Bestial ni Stupide → tient la ligne, feu concentré.
  if (isMilitary && !bestial) return 'soldats';
  // RACAILLE : humanoïde d'un groupe racaille/criminel (sans signal militaire/magique) → opportuniste, tape le faible.
  if (isRabble && !bestial) return 'racaille';
  // DÉFAUT NEUTRE : aucun signal franc (fixtures génériques, caractéristiques absentes…) → comportement Lots 1-4.
  return 'standard';
}

/** Poids EFFECTIFS d'une doctrine : `W` (défaut neutre) + override partiel. Le `macro` n'est PAS un poids
 *  (lu séparément). Une clé absente de l'override garde sa valeur `W`. PUR. */
function doctrineWeights(id: DoctrineId): Weights {
  const d = DOCTRINES[id];
  const w: Weights = { ...W };
  for (const k of Object.keys(W) as (keyof typeof W)[]) {
    const v = d[k];
    if (typeof v === 'number') w[k] = v;
  }
  return w;
}

/**
 * MENACE d'un héros pour l'ennemi (Lot 3 — REMPLACE le « PV le plus bas » comme critère de cible) :
 *  menace = (dégâts qu'il peut nous infliger) × ATTEIGNABILITÉ (proche = menace immédiate) × FRAGILITÉ
 *  (PB bas = plus facile à éliminer, donc cible prioritaire pour neutraliser sa menace).
 * - dégâts du héros : espérance de son MEILLEUR coup contre l'ennemi (mêlée ou tir) — réutilise
 *   `expectedDamage` (symétrie attaquant/défenseur). Plancher 1 (tout adversaire armé reste une menace).
 * - atteignabilité : décroît avec la distance (1 au contact → ~0,3 au loin) — un archer lointain menace
 *   moins qu'un bretteur au contact.
 * - fragilité : (1 + (PBmax − PBcourant)/PBmax) → un héros entamé est ~2× plus « intéressant » (on
 *   sécurise l'élimination, LDB tactique). PUR. NaN-garde sur les dégâts (Caractéristiques absentes).
 */
function targetThreat(enemy: Combatant, hero: Combatant, mpt = 2): number {
  const dist = chebyshev(enemy.pos!, hero.pos!);
  const reachability = 1 / (1 + 0.15 * dist); // 1 au contact, décroissance douce
  const maxW = Math.max(1, hero.wounds.max);
  const fragility = 1 + Math.max(0, maxW - hero.wounds.current) / maxW; // 1 (intact) → 2 (presque mort)
  // Danger brut du héros = meilleure espérance de SON coup contre l'ennemi (réciprocité).
  const meleeW = hero.weapons?.find((w) => w.type === 'melee');
  const rangedW = hero.weapons?.find((w) => w.type === 'ranged');
  const dmgMelee = meleeW ? finite(expectedDamage(hero, enemy, meleeW, 'melee'), NaN) : NaN;
  const dmgRanged = rangedW ? finite(expectedDamage(hero, enemy, rangedW, 'ranged', dist, undefined, mpt), NaN) : NaN;
  const cand = [dmgMelee, dmgRanged].filter((d) => Number.isFinite(d)) as number[];
  const danger = cand.length ? Math.max(...cand) : 1; // pas de Caractéristiques chiffrables → danger neutre (1)
  return Math.max(1, danger) * reachability * fragility;
}

/**
 * Meilleur CENTRE d'un sort de ZONE (ZdE, LDB 47 l.28) couvrant le plus de héros : on essaie chaque
 * case occupée par un héros comme centre candidat (déterministe, suffisant pour « un paquet ») et on
 * compte les héros dans le rayon (Chebyshev, comme `castCommitZone`). Un centre VALIDE doit respecter
 * la portée du sort (Chebyshev depuis le lanceur) et la Ligne de Vue (LDB 46 l.121). Renvoie le centre
 * couvrant le plus de héros (≥2) ou null. Tie-break déterministe : couverture ↓, puis coordonnées ↑.
 */
function bestAreaCenter(
  enemyPos: Pt,
  heroes: Combatant[],
  radius: number,
  range: number | null,
  losAt: (pt: Pt) => boolean,
): { center: Pt; covered: number } | null {
  let best: { center: Pt; covered: number } | null = null;
  for (const h of heroes) {
    const center = h.pos!;
    if (range != null && chebyshev(enemyPos, center) > range) continue;
    if (!losAt(center)) continue;
    const covered = heroes.filter((o) => chebyshev(center, o.pos!) <= radius).length;
    if (
      !best || covered > best.covered ||
      (covered === best.covered && (center.x < best.center.x || (center.x === best.center.x && center.y < best.center.y)))
    ) {
      best = { center, covered };
    }
  }
  return best && best.covered >= 2 ? best : null;
}

/** Frénésie (LDB 21 l.33) : le frénétique vise IMPÉRATIVEMENT l'ennemi le plus PROCHE de sa Ligne de
 *  Vue (pas le plus faible) ; à distance égale, le plus blessé (tri stable, déterministe). */
function nearest(enemyPos: Pt, heroes: Combatant[]): Combatant {
  return [...heroes].sort((a, b) => {
    const da = manhattan(enemyPos, a.pos!), db = manhattan(enemyPos, b.pos!);
    if (da !== db) return da - db;
    return a.wounds.current - b.wounds.current;
  })[0];
}

/**
 * Un CANDIDAT d'action discrétionnaire (Lot 3 — moteur Utility à score pondéré).
 * `kind` = type d'action (sert au BIAIS de palier dans le départage : à utilité égale, on garde l'ordre
 * castArea < focus < cast < reload < shoot < melee < move — la cascade historique comme tie-break stable,
 * PAS comme priorité absolue : une utilité supérieure renverse le palier). `utility` = somme
 * pondérée des heuristiques (plus HAUT = mieux). `targetId`/`coord` = départage déterministe final.
 */
interface Candidate {
  action: EnemyAction;
  kind: keyof typeof TIER;
  /** Utilité pondérée (Lot 3) — somme des heuristiques. Plus HAUT = meilleur. */
  utility: number;
  /** id de la cible visée (départage, stable) — vide si l'action n'en a pas. */
  targetId: string;
  /** coordonnées de destination/centre (départage) — null si l'action n'en a pas. */
  coord: Pt | null;
}

// Paliers d'action (cascade historique, du plus prioritaire au moins). Au Lot 3 ils ne servent plus de
// PRIORITÉ absolue (l'utilité prime) mais de BIAIS de départage stable à utilité égale (parité golden).
const TIER = {
  castArea: 0, // ZdE couvrant ≥2 héros (LDB 47 l.28)
  focus: 1, // Focalisation d'un sort infaisable d'un jet (LDB 46)
  selfManeuver: 2, // capacité SUR SOI (forme de combat lycanthrope) — self-buff, prioritaire comme un cast
  cast: 2, // sort offensif mono-cible
  reload: 3, // recharge d'une arme à Recharge
  shoot: 4, // tir à distance
  melee: 5, // attaque de mêlée
  move: 6, // approche / repositionnement
  manPoste: 7, // servir une pièce de siège (préparation : l'arme tire au tour suivant) — faute de mieux
} as const;

/**
 * argmax déterministe (Lot 3) : meilleur candidat par UTILITÉ décroissante. Tie-break STABLE à utilité
 * égale (départage lexicographique) : palier d'action (cascade historique) ↑, puis id de cible ↑, puis
 * coordonnées (x,y) ↑, puis index d'énumération (ultime garde-fou). Les égalités d'utilité sont gérées
 * proprement par cette chaîne — déterministe, sans dé.
 */
function argmax(cands: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  let bi = -1;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (best == null) { best = c; bi = i; continue; }
    // Comparaison : utilité DÉCROISSANTE d'abord ; à égalité (à epsilon près), tie-break lexicographique.
    const du = c.utility - best.utility;
    let better: boolean;
    if (Math.abs(du) > 1e-9) better = du > 0;
    else if (TIER[c.kind] !== TIER[best.kind]) better = TIER[c.kind] < TIER[best.kind];
    else if (c.targetId !== best.targetId) better = c.targetId < best.targetId;
    else if ((c.coord?.x ?? 0) !== (best.coord?.x ?? 0)) better = (c.coord?.x ?? 0) < (best.coord?.x ?? 0);
    else if ((c.coord?.y ?? 0) !== (best.coord?.y ?? 0)) better = (c.coord?.y ?? 0) < (best.coord?.y ?? 0);
    else better = i < bi; // parfaitement égaux → ordre d'énumération (ne survient pas en pratique)
    if (better) { best = c; bi = i; }
  }
  return best;
}

/** Choisit l'action d'un ennemi pour son tour. Pure et déterministe. */
export function chooseEnemyAction(input: EnemyTurnInput): EnemyAction {
  const { enemy, scene, blocked, smoke, flying, facing, traverse } = input;
  // Tenue de formation (#196) : Mouvement effectif plafonné à 0 → tout le reste de la fonction (approche,
  // repositionnement/kiting, fallback anti-immobilisme) énumère seulement la case courante — un ennemi déjà
  // adjacent (`inMelee`/`withinMelee`, testés sur `pos` SANS passer par `reach`) reste attaquable normalement.
  const movement = input.holdsFormation ? 0 : input.movement;
  const spells = input.spells ?? []; // absent (tests purs / fixtures sans sort) → aucun candidat de sort
  // Escouade (Lot 4) : alliés posés encore en action (l'ennemi exclu par l'appelant). Absent → [] →
  // surnombre/cohésion/danger-map neutres = comportement Lot 3 strictement inchangé.
  const squad = input.squad ?? [];
  // Vision réciproque : l'ennemi ne cible/poursuit que les héros qu'il PERÇOIT (LoS + lumière, comme le
  // groupe). `perceived` absent = aucun gate (comportement historique / tests purs).
  const heroes = input.perceived
    ? input.heroes.filter((h) => h.pos && input.perceived!.has(`${h.pos.x},${h.pos.y},0`))
    : input.heroes;
  // Gardes FORCÉES (psychologie/RAW, hors scoring) : la trace = action forcée, classement VIDE.
  const forced = (a: EnemyAction): EnemyAction => { if (AI_TRACE) _lastRanking = []; return a; };
  if (input.heroes.length === 0) return forced({ kind: 'end' }); // plus AUCUN adversaire (combat fini) → passe la main
  if (!canTakeAction(enemy) && effectiveMovement(enemy) === 0) return forced({ kind: 'end' }); // ni Action ni Mouvement (Surpris LDB 16 l.135…) → passe la main (gating data-driven, plus de nom en dur)
  // En flammes (LDB 16 l.84) : un ennemi NON frénétique se roule au sol pour éteindre le feu (1d10/Round
  // est mortel). Un frénétique ignore le danger et continue d'attaquer (Frénésie, LDB 21 l.33).
  if (hasCondition(enemy, 'en-flammes') && !isFrenzied(enemy)) return forced({ kind: 'recover', state: 'en-flammes' });
  const pos = enemy.pos!;
  // Ligne de Vue de CE tour : toutes les questions `from → to` de la décision passent par le mémo (le
  // positionnement en pose des dizaines de milliers, cf. `makeLosMemo`). Verdicts IDENTIQUES à l'appel direct.
  const los = input.losMemo ?? makeLosMemo(scene, smoke ?? []);
  // Portée de mêlée = Allonge de l'arme (RAW-3, LDB 62 l.163/164) ; 1 case par défaut. Diagonale incluse
  // (Chebyshev). Source unique partagée avec le héros et la résolution → symétrie héros/ennemi.
  const mr = meleeReachTiles(enemy.weapons);
  const mpt = sceneMetresPerTile(scene); // m/case de la scène (échelle RAW, défaut 2) → convertit la hauteur en cases
  // Z-AWARE (relief métrique) : la séparation VERTICALE réelle (Δhauteur ÷ m/case, `verticalTiles`) borne la
  // portée par le bas — un ennemi au sol ne frappe pas un héros sur la muraille même 2D-adjacent. La hauteur de
  // l'ennemi (`pos.h`) vaut pour la case candidate `a` (sur SA surface) ; `b` (une cible posée) porte la sienne.
  // Même décompte vertical que `combatDistance`.
  const withinMelee = (a: Pt, b: Pt & { h?: number }) =>
    Math.max(chebyshev(a, b), verticalTiles(pos.h ?? 0, b.h ?? 0, mpt)) <= mr;
  // Au CONTACT par empreinte (LDB 15 l.12) : un grand ennemi touche depuis n'importe quelle de ses tuiles.
  // `combatDistance` plie empreinte ET Δhauteur (même `mpt`) → s'aligne sur la grille d'engagement de la résolution.
  const inMelee = (h: Combatant) => combatDistance(enemy, h, mpt) <= mr;

  // Possède-t-il un sort OFFENSIF jouable (data-driven : Projectile ou op de dégât/contrôle hostile) ? Si
  // oui, il LANCE plutôt que de tirer (parité avec l'ancien `offensiveSpell == null` du gate de tir).
  const hasAnyOffensiveSpell = spells.some((sp) => !sp.active && spellIsOffensive(sp.data));
  // #537 : `banRanged` (duel judiciaire, NADJ 06 l.181) ne vise QUE les armes, jamais les sorts offensifs.
  const hasRanged = !hasAnyOffensiveSpell && !input.banRanged && enemy.weapons.some((w) => w.type === 'ranged');
  const hasMeleeWeapon = enemy.weapons.some((w) => w.type === 'melee');
  // Rechargement (LDB 62 l.333) : une arme à Recharge DÉCHARGÉE ne peut pas tirer → il faut recharger d'abord
  // (Test étendu de Projectiles). Cycle `loaded` unifié héros/ennemi (spawn chargé, tir → déchargé).
  const rangedW = enemy.weapons.find((w) => w.type === 'ranged');
  const reloadNeeded = hasRanged && !!rangedW && (rangedW.reload ?? 0) > 0 && !weaponLoaded(enemy, rangedW);

  // Un ennemi sans AUCUN moyen d'agir (aucun sort jouable NI arme) passe la main : un sort (offensif OU
  // soutien) compte comme une capacité d'action → un lanceur de pur soutien DOIT pouvoir agir. Servir une
  // pièce de siège adjacente (`servablePostes`) compte AUSSI comme un moyen d'agir (un servant désarmé prend
  // sa pièce) → on ne passe pas la main s'il y en a une à portée.
  const hasAnyMagic = spells.some((sp) => !sp.active);
  const canServePoste = (input.servablePostes?.length ?? 0) > 0;
  if (!hasAnyMagic && enemy.weapons.length === 0 && !canServePoste) return forced({ kind: 'end' });

  // Adversaires au Combat rapproché (au contact). Avec une arme de mêlée, on les frappe plutôt que
  // de tirer : une arme à distance sans Atout Pistolet ne tire pas en mêlée (LDB Armes l.297-298).
  const adjacentFoes = heroes.filter(inMelee);
  // Ligne de Vue (LDB 13 l.114) : on ne vise au tir/sort qu'une cible visible. Occupants ignorés
  // ici (une créature ne BLOQUE pas la vue — elle ne donne qu'un couvert imparfait, géré au jet).
  const visible = (h: Combatant): boolean => los.clear(pos, h.pos!);
  const shootableHeroes = heroes.filter(visible);
  // PORTÉE (parité avec le gate pré-clic du héros) : un tireur ne vise pas au-delà de la bande
  // Extrême (Portée ×3 — rangeBandModifier null), un lanceur pas au-delà de la portée du sort.
  // Sans portée chiffrée (arme sans `range`, sort spécial) : pas de gate (stubs/exotiques).
  const fpDist = (h: Combatant) => footprintChebyshev(pos, footprintN(enemy), h.pos!, footprintN(h));
  const ebf = () => bonus(effectiveChar(enemy, 'force')); // BF du tireur → résout les Portées de jet `{bf}` (paresseux : ignoré pour une portée fixe)
  const maxWeaponRange = enemy.weapons.reduce((m, w) => { const r = w.type === 'ranged' ? effectiveWeaponRange(w, loadedAmmo(enemy, w)?.ammoRangeMod, ebf) : null; return r != null ? Math.max(m, r) : m; }, 0);
  const shootPool = maxWeaponRange > 0 ? shootableHeroes.filter((h) => rangeBandModifier(fpDist(h), maxWeaponRange, mpt) != null) : shootableHeroes;
  // Frénésie (LDB 21 l.33) : la seule Action est un Test de Capacité de Combat / Athlétisme — ni tir ni sort.
  const frenzied = isFrenzied(enemy);
  // LdV vers un point (centre de ZdE) — réutilisé par le gate `canCast` et l'énumération de zone.
  const losAt = (pt: Pt): boolean => los.clear(pos, pt);
  // Peut-il LANCER un sort offensif ce tour ? (mono-cible en portée+LdV, OU ZdE couvrant ≥2 héros.) Gate
  // le bonus de portée préférée et le sous-bloc de REPOSITION (un lanceur kite). Les ZdE offensives comptent
  // ici (le lanceur a de quoi agir → il ne fonce pas bêtement au contact).
  const canCast = !frenzied && spells.some((sp) => !sp.active && sp.focusState !== 'focusable' && spellIsOffensive(sp.data) && (
    sp.shape === 'single' ? shootableHeroes.some((h) => sp.range == null || fpDist(h) <= sp.range)
      : sp.shape === 'self' ? false
        : !!bestAreaCenter(pos, shootableHeroes, sp.shape.area.radius, sp.range, losAt)));
  // Portée OFFENSIVE de référence (max des portées des sorts offensifs non-soi) → portée préférée du kiting.
  let castRange: number | null = 0;
  for (const sp of spells) {
    if (sp.active || sp.focusState === 'focusable' || sp.shape === 'self' || !spellIsOffensive(sp.data)) continue;
    if (sp.range == null) { castRange = null; break; }
    castRange = Math.max(castRange ?? 0, sp.range);
  }
  // Tir en étant *Engagé* : IMPOSSIBLE sauf Atout d'arme Pistolet (`LDB 14 l.41`) — veto de RÈGLE, à côté
  // de la préférence tactique « une arme de mêlée en main et un adversaire adjacent → on frappe ». MÊME
  // porte que la voie joueur (`firedAttackBlock`, combatFlow).
  const engagedNoFire = isEngaged(enemy) && !!rangedW && !canFireWhileEngaged(rangedW);
  const canShoot = !frenzied && hasRanged && !reloadNeeded && !engagedNoFire && !(adjacentFoes.length > 0 && hasMeleeWeapon) && shootPool.length > 0;

  // Cases atteignables ce tour (inclut la case de départ à distance 0). Vol (LDB 85 l.433) :
  // ligne directe, seules les cases d'atterrissage doivent être praticables et libres.
  const reach = (flying ? flyReachable : reachable)(scene, pos, movement, { blocked, foot: footprintN(enemy), noStop: input.noStop, traverse });

  // ANTI-IMMOBILISME (combat ENGAGÉ, fidélité LDB 13 l.114) : si la perception ne montre AUCUNE cible
  // (lumière/Ligne de Vue) mais que des adversaires EXISTENT, l'ennemi avance d'un cran vers le plus
  // proche NON perçu — il ne tire/lance PAS dessus (pas de vue), il se RAPPROCHE seulement (mouvement
  // seul), au lieu de passer son tour planté. Pur : aucune cible non perçue n'est jamais visée.
  // EXCEPTION (AA 10 l.138) : une pièce de siège peut n'avoir QUE la STRUCTURE en vue (défenseurs cachés
  // derrière le parapet) — elle a alors un vrai coup jouable (brécher la porte), on ne la fait pas errer.
  const shootableStructureInView = hasRanged && !reloadNeeded
    && (input.structures ?? []).some((st) => st.pos && los.clear(pos, { ...structureAimCell(pos, st), z: pos.z }));
  if (heroes.length === 0 && !shootableStructureInView) {
    const closest = [...input.heroes].filter((h) => h.pos).sort((a, b) => manhattan(pos, a.pos!) - manhattan(pos, b.pos!))[0];
    if (!closest) return forced({ kind: 'end' });
    let to: Pt | null = null;
    let bestD: number | null = null;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue;
      const d = manhattan({ x, y }, closest.pos!);
      if (bestD == null || d < bestD) { bestD = d; to = { x, y }; }
    }
    return forced(to ? { kind: 'move', to, thenTargetId: closest.id } : { kind: 'end' });
  }

  // Fuite (Brisé / Bestial blessé). `preferHidden` (Brisé, LDB 16 l.52 « hors de vue de l'ennemi ») :
  // gagner une CACHETTE (case hors de vue de tout héros) prime sur la distance ; sinon, la plus éloignée.
  const fleeMove = (preferHidden = false): EnemyAction => {
    const tiles = [...reach.keys()].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y } as Pt; });
    const distOf = (t: Pt) => Math.min(...heroes.map((h) => chebyshev(t, h.pos!)));
    const vuePar = (t: Pt): boolean => heroes.some((h) => h.pos && los.clear(h.pos, t));
    const hidden = preferHidden ? tiles.filter((t) => !vuePar(t)) : [];
    let best = pos;
    let bestDist = distOf(pos);
    // Actuellement à découvert mais une cachette est atteignable → toute cachette vaut mieux que rester vu.
    if (hidden.length && vuePar(pos)) { best = hidden[0]; bestDist = -1; }
    for (const t of (hidden.length ? hidden : tiles)) {
      const d = distOf(t);
      if (d > bestDist) { bestDist = d; best = t; }
    }
    return best.x === pos.x && best.y === pos.y ? { kind: 'end' } : { kind: 'move', to: best, thenTargetId: heroes[0].id };
  };
  // Dépense PROACTIVE de Détermination (LDB 17 l.57-61) pour se RESSAISIR : un acteur VERROUILLÉ
  // (`restrictsAction`, ex. Brisé) peut dépenser 1 Détermination/pion pour RETIRER l'État (sans Test, même
  // Engagé) au lieu de fuir/subir tout le combat. On ne le propose QUE si (a) la Détermination disponible
  // suffit à NETTOYER ENTIÈREMENT l'État (anti-gaspi : un clear partiel laisse l'Action verrouillée) ET
  // (b) agir a de la valeur (un adversaire est Engagé / au contact / atteignable en mêlée ce tour / en vue).
  // Sinon, fuir/se cacher reste meilleur → null. DÉTERMINISTE (aucun RNG) ; ne touche QUE la Détermination.
  const planProactiveSpend = (): EnemyAction | null => {
    const resolve = enemy.resolve ?? 0;
    if (resolve <= 0) return null;
    const clearable = restrictingConditions(enemy).find((rc) => rc.stacks <= resolve);
    if (!clearable) return null;
    const reachableFoe = adjacentFoes.length > 0 || shootableHeroes.length > 0
      || [...reach.keys()].some((k) => { const [x, y] = k.split(',').map(Number); return heroes.some((h) => withinMelee({ x, y }, h.pos!)); });
    if (!isEngaged(enemy) && !reachableFoe) return null; // ni Engagé ni cible joignable → se cacher vaut mieux
    return { kind: 'spendResource', resource: 'resolve', via: 'removeCondition', id: clearable.id };
  };
  // Verrouillage d'Action data-driven (`restrictsAction`, ex. Brisé LDB 16 l.52) : Mouvement + Action doivent
  // servir à fuir/se cacher. AVANT de fuir, l'IA tente de se RESSAISIR par la Détermination ; sinon, fuir si
  // NON Engagé (un Brisé Engagé ne peut PAS récupérer par Test, LDB 16 l.54 → il retombe dans le scoring et se
  // bat à −10). PLUS de nom d'État en dur.
  if (isActionLocked(enemy)) {
    const spend = planProactiveSpend();
    if (spend) return forced(spend);
    if (!isEngaged(enemy)) return forced(fleeMove(true)); // fuir hors de vue (cachette prioritaire)
  }
  // Bestial (LDB 85 l.59) : « Si elle perd plus de la moitié de ses Blessures, elle tente de fuir »
  // — sauf Territorial (combat jusqu'à la mort) ou acculée/Engagée (elle reste — Frénésie gérée par
  // le drapeau frenzied de l'appelant).
  if (isBestial(enemy.traits) && !isTerritorial(enemy.traits) && !isFrenzied(enemy)
      && enemy.wounds.current < enemy.wounds.max / 2 && !isEngaged(enemy)) return forced(fleeMove());

  // === DOCTRINE TACTIQUE (Lot 5) ===========================================================
  // La doctrine (déduite des signaux DATA ou forcée par `enemy.aiDoctrine`) module les POIDS du cœur
  // discrétionnaire ci-dessous (`Weff` = `W` + override partiel). Elle est choisie APRÈS toutes les gardes
  // forcées (fin de combat, En flammes, Brisé, Bestial, anti-immobilisme) — qu'elle ne touche JAMAIS — et
  // AVANT le scoring. Un éventuel REPLI « doctrine » (`macro.retreatBelow`, latitude de moteur, aucune règle ne la porte) ne s'applique
  // qu'à un combattant SANS garde de fuite RAW (Bestial déjà géré en amont) et non Engagé.
  const doctrine = pickDoctrine(enemy, squad, input.heroes);
  const Weff = doctrineWeights(doctrine);
  const macro = DOCTRINES[doctrine].macro;
  // GARDE Empêtré (LDB 16 l.64/66) : un Empêtré a un Mouvement NUL → `fleeMove` ne trouverait aucune
  // case d'évasion et renverrait `end` (tour gâché). On NE déclenche donc PAS le repli « doctrine » pour
  // un Empêtré : le cœur discrétionnaire ne produira aucun candidat (Mouvement 0) et le fallback final
  // l'enverra sur `recover empetre` (se libérer) — le bon comportement, plutôt que passer son tour.
  if (macro?.retreatBelow != null && !isBestial(enemy.traits) && !isFrenzied(enemy) && !isEngaged(enemy)
      && !hasCondition(enemy, 'empetre')
      && enemy.wounds.current < enemy.wounds.max * macro.retreatBelow) {
    return forced(fleeMove());
  }

  // Un héros est « frappable ce tour » en mêlée s'il est déjà adjacent OU si une
  // case atteignable lui est adjacente.
  const meleeReachableNow = (h: Combatant): boolean => {
    if (withinMelee(pos, h.pos!)) return true;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (withinMelee({ x, y }, h.pos!)) return true;
    }
    return false;
  };

  // === CŒUR DISCRÉTIONNAIRE — moteur Utility (Lot 3 : score pondéré) =======================
  // Tout ce qui précède (gardes RAW/psychologie : fin de combat, En flammes, Brisé, Bestial, fuite,
  // anti-immobilisme…) reste FORCÉ et n'entre PAS dans le scoring. Ici on ÉNUMÈRE PLUSIEURS candidats
  // par type (un par cible atteignable, plusieurs cases d'approche), on les SCORE par UTILITÉ pondérée
  // (menace, dégâts attendus, killSecure/overkill, contrôle, couverture, positionnement) et on prend
  // l'argmax. Aucune règle inventée : gardes de validité (portée, LdV, canCast/canShoot/inMelee, ZdE,
  // focalisable) IDENTIQUES ; chaque heuristique dérive d'une fonction du moteur.

  // Animosité/Haine ACTIVE (LDB 21 l.21/41) : filtre de VIVIER appliqué AVANT le choix de cible — on
  // s'en prend en priorité au groupe haï présent dans le vivier considéré (sinon vivier brut).
  const hatedCibles = (enemy.psychState ?? [])
    .filter((p) => (p.type === 'animosite' || p.type === 'haine') && p.active && p.cible)
    .map((p) => p.cible!);
  const hatedOf = (pool: Combatant[]) =>
    hatedCibles.length ? pool.filter((h) => hatedCibles.some((cb) => groupMatch(cb, h.groups ?? []))) : [];
  /** Restreint un vivier au groupe haï s'il y en a un présent, sinon le vivier brut. */
  const restrict = (pool: Combatant[]): Combatant[] => { const hp = hatedOf(pool); return hp.length ? hp : pool; };
  /** En Frénésie, la cible est IMPÉRATIVEMENT le plus proche en LdV (LDB 21 l.33) — on contraint le vivier
   *  d'énumération à ce seul héros (le scoring ne peut donc choisir personne d'autre). */
  const frenzyPick = (): Combatant | null => {
    if (!frenzied) return null;
    const visibleFoes = shootableHeroes.length ? shootableHeroes : heroes;
    return visibleFoes.length ? nearest(pos, visibleFoes) : null;
  };

  // --- HEURISTIQUES de SCORE (Lot 3 + escouade Lot 4) -----------------------
  /** FEU CONCENTRÉ via SURNOMBRE (RAW, LDB 14) — MÊME `outnumberMod` et MÊME décompte que la résolution
   *  (`src/state/combatFlow.ts:425`) : N = (alliés de l'escouade à `combatDistance ≤ 1` de la cible) + 1
   *  (l'attaquant lui-même, qui SERA au contact en frappant). Renvoie le `ModLine` du bonus de toucher
   *  (+20 à 2c1, +40 à 3+c1) sous forme d'`env` injecté DANS `expectedDamage` (mêlée UNIQUEMENT — le
   *  surnombre RAW est mêlée-only, cf. combatFlow:425 qui ne sert que `attackEnv` de mêlée). Aucun
   *  modificateur inventé : on réutilise la fonction du moteur. Squad vide → null (pas d'env). */
  const outnumberEnvMelee = (target: Combatant): ModLine[] | undefined => {
    if (squad.length === 0) return undefined;
    const adj = squad.filter((c) => c.pos && combatDistance(c, target) <= 1).length;
    const onm = outnumberMod(adj + 1); // +1 = l'attaquant courant (parité exacte avec combatFlow:425)
    return onm ? [onm] : undefined;
  };

  /** Utilité tactique d'une ATTAQUE (mêlée/tir/sort) sur `target` : valeur de l'effet + menace de la cible
   *  + killSecure − overkill. Pour un SORT, la valeur EST `spellActionValue` (déjà = dégâts + contrôle ×
   *  fiabilité × opposition), passée précalculée ; le contrôle n'est PLUS ajouté à part (il est dedans).
   *  En MÊLÉE, le bonus de toucher de SURNOMBRE (feu concentré, Lot 4) est injecté dans l'espérance. */
  const attackUtility = (
    target: Combatant,
    src: { kind: 'melee'; weapon: Weapon } | { kind: 'ranged'; weapon: Weapon; dist: number } | { kind: 'spell'; value: number },
  ): number => {
    const dmg = src.kind === 'spell'
      ? src.value
      : src.kind === 'ranged'
        ? finite(expectedDamage(enemy, target, src.weapon, 'ranged', src.dist, undefined, mpt), 0)
        : finite(expectedDamage(enemy, target, src.weapon, 'melee', undefined, outnumberEnvMelee(target)), 0);
    const threat = finite(targetThreat(enemy, target, mpt), 0);
    const securesKill = dmg >= target.wounds.current && target.wounds.current > 0 ? Weff.killSecure : 0;
    const overkill = isNeutralized(target) ? Weff.overkill : 0;
    return Weff.damageDealt * dmg + Weff.threat * threat + securesKill - overkill;
  };

  /** DANGER-MAP (Lot 4) : Blessures que les HÉROS nous infligeraient si l'on se tenait sur `to` — Σ sur
   *  les héros de l'espérance de LEUR meilleur coup (mêlée/tir) contre l'ennemi POSÉ sur `to` (réutilise
   *  `expectedDamage`, réciprocité, PUR). Un ennemi évite donc les cases exposées (et, blessé, d'autant
   *  plus, puisque la pénalité s'ajoute à un score offensif moindre). Coût borné aux cases candidates ;
   *  les armes des héros sont mémoïsées hors boucle. Squad/heroes vides → 0 (neutre). */
  const heroThreatWeapons = heroes.map((h) => ({
    h, melee: h.weapons?.find((w) => w.type === 'melee'), ranged: h.weapons?.find((w) => w.type === 'ranged'),
  }));
  // Clé de CASE des mémos de position (`dangerAt`, `coverRank`) : ces deux grandeurs ne dépendent QUE
  // de la case d'arrivée — les héros, l'escouade et la scène ne bougent pas pendant la décision. Elles
  // étaient recalculées pour CHAQUE cible : l'énumération d'approche les redemande une fois par cible
  // (668 structures ciblables sur La Diligence) et `aiApproachPlan` rejoue le tout à trois budgets.
  const cleCase = (t: Pt): string => `${t.x},${t.y},${t.z ?? 0}`;
  const memoDanger = new Map<string, number>();
  const memoCover = new Map<string, number>();
  const dangerAt = (to: Pt): number => {
    const k = cleCase(to);
    const vu = memoDanger.get(k);
    if (vu !== undefined) return vu;
    const v = dangerBrut(to);
    memoDanger.set(k, v);
    return v;
  };
  const dangerBrut = (to: Pt): number => {
    const here = { ...enemy, pos: to } as Combatant;
    let total = 0;
    for (const { h, melee, ranged } of heroThreatWeapons) {
      if (!h.pos) continue;
      const dist = chebyshev(to, h.pos);
      const dm = melee ? finite(expectedDamage(h, here, melee, 'melee'), 0) : 0;
      const dr = ranged ? finite(expectedDamage(h, here, ranged, 'ranged', dist, undefined, mpt), 0) : 0;
      total += Math.max(dm, dr); // le héros joue SON meilleur coup contre nous depuis cette case
    }
    return total;
  };

  /** Bonus de POSITIONNEMENT d'une case d'arrivée `to` pour attaquer `target` (Lot 3) : flanc/dos +
   *  gain de couvert pour soi + respect de la portée préférée (tireur/lanceur reste à distance+LdV ;
   *  mêlée au contact). Lot 4 : − danger-map (cases exposées) + cohésion (ne pas s'isoler de l'escouade). PUR. */
  // Un combattant qui PORTE une arme à distance (ou un sort offensif) se positionne en TIREUR : il vise sa
  // PORTÉE de tir, pas le contact — même s'il garde une arme de mêlée de secours. L'ancien `&& !hasMeleeWeapon`
  // déclassait à tort les HYBRIDES (chasseur fronde+dague, arbalétrier+épée) en mêleeurs dès qu'ils étaient
  // hors de portée de tir → ils CHARGEAIENT au contact au lieu de s'approcher à distance de tir (retour
  // playtest 2026-06-27 : « le chasseur charge à l'arme simple alors qu'il a une fronde »). La mêlée au
  // contact (cible adjacente) et le tir en portée restent gérés par `canShoot`/le candidat mêlée direct ;
  // seule l'APPROCHE/REPOSITION d'un hybride hors de portée change (il vise sa distance de tir).
  const isShooterOrCaster = canCast || canShoot || hasAnyOffensiveSpell || hasRanged;
  // Empoignade (LDB 14 l.161) : Empoigné au DÉBUT de son tour, son Action EST le Test opposé de Force — une
  // créature Empoignée ne peut PAS prendre d'action normale (cast/tir/mêlée), son tour est VERROUILLÉ sur la
  // lutte. Préempte donc le scoring (comme `isActionLocked`). « Briser » (Avantage STRICTEMENT supérieur,
  // gratuit) n'est BÉNÉFIQUE qu'à un tireur/lanceur (il veut sa distance) : un mêleeur GAGNE à rester Empoigné
  // (Dégâts BF+DR ignorant les PA + il fixe l'adversaire au sol). La décision break/test est PURE ; le
  // résolveur impur (`runEnemyAI`) exécute « break » par re-décision (comme `spendResource`) ou le Test opposé.
  // EXCEPTION Tentacules (LDB 85 l.405) UNIQUEMENT : « Si un tentacule est en Empoignade, vous pouvez utiliser
  // une Action d'Attaque GRATUITE pour résoudre l'Empoignade AU LIEU de l'Action de la créature » — le tentacule
  // tient pendant que le CORPS garde son Action normale (résolution gratuite dans aiCreatureFreeAttacks). La
  // Langue préhensile (p.340) n'a PAS cette dérogation : « le démarrage d'une Empoignade (voir page 163) » → règle
  // GÉNÉRALE → la créature est VERROUILLÉE comme tout grappleur (LOT B ; un Langue tireur à Avantage supérieur y
  // « laisse partir la cible » via le Break). Seule la VICTIME (sans trait de tentacule) reste toujours verrouillée.
  const holdsViaLimb = creatureAttacks(enemy.traits ?? []).some((a) => a.kind === 'tentacules');
  {
    const partner = enemy.grapplingWith?.find((id) => heroes.some((h) => h.id === id));
    if (partner && !holdsViaLimb) {
      const foe = heroes.find((h) => h.id === partner)!;
      const resolution: 'break' | 'test' = enemy.advantage > foe.advantage && isShooterOrCaster ? 'break' : 'test';
      return forced({ kind: 'grapple', targetId: partner, resolution });
    }
  }
  // Meilleur cran de couvert dont la case `from` bénéficie face aux héros (échelle UNIQUE `engine/cover.ts`).
  const coverRank = (from: Pt): number => {
    const k = cleCase(from);
    const vu = memoCover.get(k);
    if (vu !== undefined) return vu;
    let meilleur = 0;
    for (const h of heroes) {
      const c = los.cover(h.pos!, from);
      const rang = COVER_ORDER.indexOf(c.cover);
      if (rang > meilleur) meilleur = rang;
    }
    memoCover.set(k, meilleur);
    return meilleur;
  };
  // Couvert de la case COURANTE : référence commune à toutes les cases candidates (`pos` ne bouge pas
  // pendant la décision) — calculée une fois, jamais par candidat.
  const coverRankIci = coverRank(pos);
  const positionValue = (to: Pt, target: Combatant): number => {
    let v = 0;
    // Flanc/dos (LDB 14 l.62) : frapper hors du champ de vision avant de la cible (gratuit). Nécessite
    // l'orientation de la cible (lue de `facing`) ; absente → 0 (graceful).
    const tFacing = facing?.[target.id];
    if (tFacing) {
      const dirToAttacker = facingToward(target.pos!, to);
      if (isFlankOrRear(tFacing, dirToAttacker)) v += Weff.flankRear;
    }
    // Gain de couvert POUR SOI face à la menace la plus proche : un couvert imparfait/moyen/total à
    // l'arrivée réduit les tirs adverses (lineOfSightCover, direction héros→case). Cran gagné vs case actuelle.
    const coverDelta = coverRank(to) - coverRankIci;
    if (coverDelta > 0) v += Weff.coverGain * coverDelta;
    // Portée préférée : un tireur/lanceur valorise une case d'où il TIRE (cible visible + à portée) sans
    // être au contact ; un combattant de mêlée valorise le contact. Réutilise les gates de portée/LdV.
    const d = chebyshev(to, target.pos!);
    const seesFrom = los.clear(to, target.pos!);
    if (isShooterOrCaster) {
      const inShootRange = canCast
        ? (castRange == null || d <= castRange)
        : (maxWeaponRange === 0 || rangeBandModifier(d, maxWeaponRange, mpt) != null);
      if (d > mr && seesFrom && inShootRange) v += Weff.preferredRange; // garde la distance ET la ligne de tir
    } else if (withinMelee(to, target.pos!)) {
      v += Weff.preferredRange; // mêlée : au contact
    }
    // ÉVITEMENT du DANGER (Lot 4) : pénalise une case exposée à la menace des héros (danger-map). Calibré
    // < 1 → départage de cases, jamais un veto (l'utilité d'attaque, ×1..12, peut l'emporter et faire avancer).
    if (squad.length || heroes.length) v -= Weff.dangerAvoid * dangerAt(to);
    // COHÉSION légère (Lot 4, SOBRE) : malus si la case isole l'ennemi de TOUTE son escouade (aucun allié
    // à portée de soutien ≤ 3 cases) — préfère rester en formation, à utilité d'attaque égale. Si l'escouade
    // est vide, pas de cohésion (un solitaire ne « s'isole » de personne).
    if (squad.length && !squad.some((c) => c.pos && chebyshev(to, c.pos) <= 3)) v -= Weff.cohesion;
    return v;
  };

  // Meilleure case d'APPROCHE vers une cible — énumère PLUSIEURS cases pertinentes (adjacentes à la
  // cible, et la case qui réduit le plus la distance) plutôt qu'une seule (Lot 3 : laisse le scoring
  // arbitrer position vs distance). Renvoie une liste de candidats `(to, utilité de position)`.
  const approachCandidates = (target: Combatant): { to: Pt; posV: number }[] => {
    const out: { to: Pt; posV: number }[] = [];
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue; // ne pas « bouger » sur place
      const to = { x, y };
      out.push({ to, posV: positionValue(to, target) });
    }
    return out;
  };

  // --- ÉNUMÉRATION des candidats JOUABLES (Lot 3 : multi-cibles, multi-cases) ----------------
  const candidates: Candidate[] = [];
  const fpick = frenzyPick();

  // refEnemy : le héros le plus MENAÇANT visible (cible des buffs offensifs + opposition des Sorts de
  // Contact). Null si aucun héros visible → bénéfice marginal contre un mannequin neutre (aiSpellValue).
  const HORIZON = 3; // K ≈ 3 Rounds : horizon de bénéfice d'un buff (borne le bénéfice marginal).
  const refEnemy: Combatant | null = shootableHeroes.length
    ? [...shootableHeroes].sort((a, b) => finite(targetThreat(enemy, b, mpt), 0) - finite(targetThreat(enemy, a, mpt), 0))[0]
    : (heroes[0] ?? null);
  // `committingPrep` : une action de PRÉPARATION (Focalisation/Recharge) est CHOISIE → on ne lui oppose pas
  // une APPROCHE de mêlée (le lanceur/tireur reste en place). MÊLÉE reste possible (un acculé se défend).
  let committingPrep = false;

  // === FORME DE COMBAT (op `transform`) — capacité SUR SOI octroyée par un trait (Métamorphose lycanthrope,
  // Middenheim p.116). La forme alternative est un buff PERSISTANT : utilité = Σ `opValue` de ses ops (le
  // `transform` mesure le gain de combat réel du clone transformé). Le gate d'applicabilité (déjà dans la
  // forme) empêche le spam ; l'argmax décide vs frapper. Data-driven, aucun nom d'entité en dur.
  for (const def of selfManeuversOf(enemy)) {
    if (!selfManeuverApplicable(enemy, def)) continue;
    let v = 0;
    for (const e of def.effects ?? []) for (const o of spellEffectOps(e.flow)) v += opValue(o, enemy, enemy, { refEnemy, horizon: HORIZON });
    if (v > 0) candidates.push({ action: { kind: 'selfManeuver', maneuverId: def.id }, kind: 'selfManeuver', utility: v, targetId: enemy.id, coord: pos });
  }

  // === SORTS (énumération UNIFIÉE, op-driven) — un évaluateur unique, aucun planner par-catégorie ====
  // Pour CHAQUE sort connu NON déjà actif (Unicité RAW, LDB 46 l.116-121 / 40 l.16-19), on dérive des
  // candidats `cast`/`castArea`/`focus` scorés par `spellActionValue` (Σ valeur des GameOp × fiabilité ×
  // opposition). La POLARITÉ (offensif/bénéfique) et la valeur viennent des OPS, jamais d'un nom de sort
  // ni d'une catégorie. Un FRÉNÉTIQUE ne lance AUCUN sort (Frénésie LDB 21 l.33) → on saute le bloc.
  if (!frenzied) {
    // Existe-t-il un sort OFFENSIF lançable IMMÉDIATEMENT (en un jet, cible en portée) ? Si oui, FOCALISER
    // (qui ne produit RIEN ce tour) n'a pas de sens — on frappe maintenant (gate du candidat `focus` plus bas).
    const hasImmediateOffensive = spells.some((o) => !o.active && (o.focusState === 'none' || o.focusState === 'ready')
      && spellIsOffensive(o.data) && shootableHeroes.some((h) => o.range == null || fpDist(h) <= o.range));
    for (const sp of spells) {
      if (sp.active) continue; // Unicité : un effet/une invocation de CE sort est déjà actif → on ne le relance pas
      const ctx = { landProb: sp.landProb, refEnemy, horizon: HORIZON };
      if (sp.shape === 'self') {
        // Sur soi (auto-buff / invocation centrée / auto-soin) : gardé par valeur > 0 (anti-spam naturel).
        if (sp.focusState !== 'focusable') {
          const v = spellActionValue(enemy, sp.data, { kind: 'self' }, ctx);
          if (v > 0) candidates.push({ action: { kind: 'cast', targetId: enemy.id, spell: sp.id }, kind: 'cast', utility: v, targetId: enemy.id, coord: pos });
        }
      } else if (typeof sp.shape === 'object') {
        // ZdE : on choisit le CENTRE au meilleur NET. Une AoE pleut sur TOUS dans le rayon (indiscriminée,
        // RAW) → un sort OFFENSIF marque `Σ dégâts ENNEMIS − Σ TIR AMI` (alliés/soi pris dans le rayon) ;
        // un sort BÉNÉFIQUE (buff/soin de ZONE, ex. Prouesses Martiales) marque `Σ valeur aux ALLIÉS
        // couverts`. Pas de cast si net ≤ 0 (anti tir-ami suicidaire / buff qui ne couvre personne d'utile).
        if (sp.focusState !== 'focusable') {
          const radius = sp.shape.area.radius;
          const offensiveZde = spellIsOffensive(sp.data);
          const allies = [enemy, ...squad].filter((a) => a.pos);
          const inRadius = (center: Pt, p: Pt) => chebyshev(center, p) <= radius;
          let best: { center: Pt; net: number } | null = null;
          for (const cand of offensiveZde ? shootableHeroes : allies) {
            const center = cand.pos!;
            if (sp.range != null && chebyshev(pos, center) > sp.range) continue;
            if (!losAt(center)) continue;
            let net: number;
            if (offensiveZde) {
              const foesIn = shootableHeroes.filter((e) => inRadius(center, e.pos!));
              // TIR AMI : on évalue le MAL fait aux alliés couverts comme aux ennemis (dégâts ET États hostiles,
              // via `spellTargetHarm` — l'ancien calcul ne comptait QUE les dégâts → une ZdE de contrôle KO les
              // alliés sans pénalité). AVERSION ×2 : blesser/incapaciter un allié coûte deux fois un gain ennemi
              // équivalent — un lanceur ne nuke pas son propre camp pour un gain marginal (retour playtest 2026-06-27).
              const allyHarm = allies.reduce((s, a) => inRadius(center, a.pos!) ? s + sp.landProb * finite(spellTargetHarm(enemy, a, sp.data), 0) : s, 0);
              net = spellActionValue(enemy, sp.data, { kind: 'area', covered: foesIn }, ctx) - FRIENDLY_FIRE_AVERSION * allyHarm;
            } else {
              net = spellActionValue(enemy, sp.data, { kind: 'area', covered: allies.filter((a) => inRadius(center, a.pos!)) }, ctx);
            }
            if (!best || net > best.net) best = { center, net };
          }
          if (best && best.net > 0) candidates.push({ action: { kind: 'castArea', spell: sp.id, center: best.center }, kind: 'castArea', utility: best.net, targetId: '', coord: best.center });
        }
      } else if (sp.focusState === 'focusable') {
        // Focalisation (LDB 46) : on n'y consacre le tour QUE faute de mieux — si AUCUN sort offensif n'est
        // lançable d'un jet (sinon on frappe MAINTENANT : focaliser ne produit RIEN ce tour), et pas menacé au
        // contact avec un repli (risque d'interruption l.193). La valeur est escomptée par la SURVIE : investir
        // dans un payoff DIFFÉRÉ n'a de sens que si on a des chances d'être encore là (danger entrant vs PB).
        const contactFallback = adjacentFoes.length > 0 && (hasMeleeWeapon || canShoot);
        if (!hasImmediateOffensive && !contactFallback && refEnemy) {
          const full = spellActionValue(enemy, sp.data, { kind: 'unit', subject: refEnemy }, { landProb: 1, refEnemy, horizon: HORIZON });
          const survival = Math.max(0.1, Math.min(1, 1 - dangerAt(pos) / Math.max(1, enemy.wounds.current)));
          candidates.push({ action: { kind: 'focus', spell: sp.id }, kind: 'focus', utility: Math.max(0, 0.5 * full * survival), targetId: '', coord: null });
          committingPrep = true;
        }
      } else if (spellIsOffensive(sp.data)) {
        // OFFENSIF mono-cible (none/ready) : UN candidat par cible visible + à portée. Le sort passe par
        // `attackUtility` (sa valeur + menace de la cible + killSecure − overkill, comme un tir/une mêlée).
        for (const t of restrict(shootableHeroes).filter((h) => sp.range == null || fpDist(h) <= sp.range)) {
          const v = spellActionValue(enemy, sp.data, { kind: 'unit', subject: t }, ctx);
          candidates.push({ action: { kind: 'cast', targetId: t.id, spell: sp.id }, kind: 'cast', utility: attackUtility(t, { kind: 'spell', value: v }), targetId: t.id, coord: t.pos ?? null });
        }
      } else {
        // BÉNÉFIQUE mono-cible (soin/buff sur un allié) : soi + escouade en portée + LdV ; gardé par valeur > 0.
        for (const f of [enemy, ...squad]) {
          if (!f.pos) continue;
          if (f.id !== enemy.id && (!(sp.range == null || fpDist(f) <= sp.range) || !losAt(f.pos))) continue;
          const v = spellActionValue(enemy, sp.data, { kind: 'unit', subject: f }, ctx);
          if (v > 0) candidates.push({ action: { kind: 'cast', targetId: f.id, spell: sp.id }, kind: 'cast', utility: v, targetId: f.id, coord: f.pos });
        }
      }
    }
  }

  // Recharger (LDB 62 l.333) : arme à Recharge déchargée + cible en vue/portée, sauf attaque de mêlée
  // justifiée. Utilité neutre (préparation) — préféré seulement faute de tir/mêlée meilleurs. Un
  // frénétique NE recharge PAS (Frénésie LDB 21 l.33 : seule Action = Test de CC/Athlétisme → mêlée).
  if (!frenzied && reloadNeeded && shootPool.length > 0 && !(adjacentFoes.length > 0 && hasMeleeWeapon)) {
    candidates.push({ action: { kind: 'reload' }, kind: 'reload', utility: 0, targetId: '', coord: null });
    committingPrep = true; // un tireur recharge sur place plutôt que de foncer en mêlée
  }
  // Tir (hors Combat rapproché, cible visible) : UN candidat PAR cible tirable (Lot 3 — multi-cibles).
  if (canShoot && rangedW) {
    const pool = restrict(fpick ? [fpick].filter((h) => shootPool.includes(h)) : shootPool);
    for (const t of pool) {
      candidates.push({ action: { kind: 'shoot', targetId: t.id }, kind: 'shoot', utility: attackUtility(t, { kind: 'ranged', weapon: rangedW, dist: fpDist(t) }), targetId: t.id, coord: t.pos ?? null });
    }
  }
  // === MÊLÉE / APPROCHE / REPOSITION =================================================================
  // Aucun gate `!canCast && !canShoot` : un lanceur/tireur peut AUSSI frapper au contact (acculé) ou se
  // REPOSITIONNER (kiting/repli). Le biais `TIER` (cast < shoot < melee < move) garantit qu'un coup jouable
  // prime à utilité comparable.
  const meleeWeapon = enemy.weapons.find((w) => w.type === 'melee') ?? enemy.weapons[0];
  // Sorts OFFENSIFS mono-cible lançables d'un jet — pour savoir si une cible est « frappable sur place ».
  const offensiveSingles = spells.filter((sp) => !sp.active && sp.shape === 'single' && sp.focusState !== 'focusable' && spellIsOffensive(sp.data));
  // Une cible est ATTAQUABLE ce tour (mêlée au contact, tir, ou sort offensif en portée) → on ne s'en
  // APPROCHE pas (on la frappe sur place) — c'est ce qui fait kiter un tireur/lanceur (il n'avance que vers
  // l'inatteignable).
  const attackableNow = (t: Combatant): boolean =>
    (hasMeleeWeapon && !!meleeWeapon && inMelee(t))
    || (canShoot && shootPool.includes(t))
    || (canCast && shootableHeroes.includes(t) && offensiveSingles.some((sp) => sp.range == null || fpDist(t) <= sp.range));

  // MÊLÉE + APPROCHE — UN vivier hate-restreint (LDB 21) ; MÊLÉE pour les cibles au contact, APPROCHE
  // (suspendue en PRÉPARATION) pour les cibles non attaquables ce tour.
  const heldInMelee = hasRanged && adjacentFoes.length > 0;
  const here = heldInMelee ? adjacentFoes : heroes.filter(meleeReachableNow);
  const baseVivier = here.length ? here : heroes;
  const vivier = restrict(fpick ? [fpick] : baseVivier);
  // Estimation d'attaque pour scorer une cible (utilité d'arme de mêlée si on en a une, sinon menace seule
  // — un caster hors de portée qui s'approche n'a pas de dégât d'arme mais score la menace/fragilité).
  const targetUtility = (t: Combatant): number =>
    meleeWeapon ? attackUtility(t, { kind: 'melee', weapon: meleeWeapon }) : (Weff.threat * finite(targetThreat(enemy, t, mpt), 0) - (isNeutralized(t) ? Weff.overkill : 0));
  for (const t of vivier) {
    if (hasMeleeWeapon && meleeWeapon && inMelee(t)) {
      // Cible déjà au contact → frappe (position déjà acquise, pas de bonus de déplacement).
      candidates.push({ action: { kind: 'melee', targetId: t.id }, kind: 'melee', utility: attackUtility(t, { kind: 'melee', weapon: meleeWeapon }), targetId: t.id, coord: t.pos ?? null });
    } else if (!committingPrep && !attackableNow(t)) {
      // Cible non attaquable ce tour → candidats d'APPROCHE : utilité d'attaque + positionnement − distance.
      const atk = targetUtility(t);
      for (const { to, posV } of approachCandidates(t)) {
        const u = atk + posV - Weff.approachDist * manhattan(to, t.pos!);
        candidates.push({ action: { kind: 'move', to, thenTargetId: t.id }, kind: 'move', utility: u, targetId: t.id, coord: to });
      }
    }
  }

  // === SIÈGE : cibler les STRUCTURES destructibles (porte/mur) ======================================
  // Vivier fourni par l'APPELANT (`buildAiInput`) : non vide seulement en rencontre de siège déclarée et
  // côté ennemi — `ai.ts` ignore le drapeau. L'Atout Siège (×2 aux structures, `siegeMultiplier` appliqué
  // dans `woundsFromHit`, `ADE II 08 l.292`) donne à une pièce de siège une utilité d'attaque élevée sur la
  // porte. `structureImmune` écarte les armes qui ne l'abîment pas (Impénétrable / Résistant, `ADE II 08
  // l.296-300`) ; les autres restent candidates, leur utilité étant amortie par le Bonus d'Endurance compté
  // une fois de plus par catégorie de Taille (`AA 10 l.98`, `structureEnduranceMult`). Indépendant du vivier
  // héros : une pièce peut n'avoir QUE la porte en vue (≠ `canShoot`, qui
  // exige un héros tirable). Vide → aucun candidat.
  const structureTargets = (input.structures ?? []).filter((st) => st.pos);
  const canFireStruct = !frenzied && hasRanged && !!rangedW && !reloadNeeded && !(adjacentFoes.length > 0 && hasMeleeWeapon);
  for (const st of structureTargets) {
    // On vise la FACE exposée de la structure (côté tireur) : c'est par là que la LdV n'est pas coupée par
    // l'arête de la structure elle-même (un canon voit la face de la porte, pas la case derrière elle).
    const stSeen = los.clear(pos, { ...structureAimCell(pos, st), z: pos.z });
    // TIR (pièce de siège qui brèche la porte) — face visible, en portée, et que l'arme peut ABÎMER.
    if (canFireStruct && stSeen && !structureImmune(rangedW!, st)
        && (maxWeaponRange <= 0 || rangeBandModifier(fpDist(st), maxWeaponRange, mpt) != null)) {
      candidates.push({ action: { kind: 'shoot', targetId: st.id }, kind: 'shoot', utility: attackUtility(st, { kind: 'ranged', weapon: rangedW!, dist: fpDist(st) }), targetId: st.id, coord: st.pos! });
    }
    // MÊLÉE / APPROCHE (bélier ou arme abîmant une porte non-Impénétrable) — auto-touche, pas de défense.
    if (hasMeleeWeapon && meleeWeapon && !structureImmune(meleeWeapon, st)) {
      // Utilité d'attaque de CETTE structure : elle ne dépend pas de la case d'arrivée — une seule fois par cible.
      const atkSt = attackUtility(st, { kind: 'melee', weapon: meleeWeapon });
      if (inMelee(st)) candidates.push({ action: { kind: 'melee', targetId: st.id }, kind: 'melee', utility: atkSt, targetId: st.id, coord: st.pos! });
      else if (!committingPrep) for (const { to, posV } of approachCandidates(st)) {
        const u = atkSt + posV - Weff.approachDist * manhattan(to, st.pos!);
        candidates.push({ action: { kind: 'move', to, thenTargetId: st.id }, kind: 'move', utility: u, targetId: st.id, coord: to });
      }
    }
  }

  // REPOSITION (kiting/repli, NOUVEAU) : un lanceur/tireur se replace pour une MEILLEURE ligne de tir, un
  // couvert, ou pour fuir le danger (LDB 15-Dépl). Candidat émis SEULEMENT si amélioration STRICTE de
  // position (`posV > 0`) — en scène neutre il n'y a rien à gagner → aucun candidat (parité golden).
  // GARDE « un coup jouable prime » (plan §6) : la REPOSITION est un REPLI — elle ne fait FEU sur RIEN ce
  // tour. Son utilité est une échelle de POSITION (couvert/danger), incommensurable avec l'échelle Blessures
  // d'une attaque ; le seul biais `TIER` ne suffit pas (il ne départage qu'à utilité ÉGALE). On ne l'émet
  // donc QUE si AUCUNE attaque jouable (cast/castArea/tir/mêlée d'utilité > 0) n'existe ce tour — sinon le
  // lanceur tire son coup (même peu fiable : un Carreau à 29 % vaut mieux qu'un repli pour un cran de couvert).
  // C'est exactement le cas (e) du plan : « caster exposé SANS bon sort se replie ».
  const hasPlayableAttack = candidates.some(
    (c) => (c.kind === 'cast' || c.kind === 'castArea' || c.kind === 'shoot' || c.kind === 'melee') && c.utility > 0,
  );
  if ((canCast || canShoot) && !committingPrep && !frenzied && !hasPlayableAttack && refEnemy) {
    // AMÉLIORATION STRICTE vs rester sur place : `positionValue` mêle de l'absolu (portée préférée, flanc)
    // et du delta (couvert, déjà relatif à `pos`) ; le DELTA `to − pos` annule l'absolu commun → 0 en scène
    // neutre (rien à gagner) ⇒ aucun candidat (parité golden), positif seulement si `to` gagne couvert/
    // portée/sécurité. C'est ce gain net qui fait kiter/se replier un lanceur exposé.
    const posHere = positionValue(pos, refEnemy);
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue;
      const to = { x, y };
      const gain = positionValue(to, refEnemy) - posHere;
      if (gain > 0) candidates.push({ action: { kind: 'move', to, thenTargetId: refEnemy.id }, kind: 'move', utility: gain, targetId: refEnemy.id, coord: to });
    }
  }

  // SERVIR UNE PIÈCE DE SIÈGE (MDG 12) : un combattant adjacent à un emplacement/coque portant un poste NON
  // servi peut en devenir le chef (l'arme de siège lui est octroyée, elle tirera au tour SUIVANT). La liste des
  // postes servables est surfacée par l'appelant impur (`servablePostes`, KIND-AGNOSTIQUE) ; absente/vide (toute
  // fixture sans emplacement) → aucun candidat (parité golden). Utilité NEUTRE (0) : c'est une PRÉPARATION (comme
  // Recharger), choisie SEULEMENT faute d'attaque/approche jouable ce tour. Les tactiques fines (QUAND servir)
  // sont hors scope : ceci garantit la seule DISPONIBILITÉ kind-agnostique. Un frénétique ne sert pas (LDB 21 l.33).
  if (!frenzied) for (const sp of input.servablePostes ?? [])
    candidates.push({ action: { kind: 'manPoste', hullId: sp.hullId, posteUid: sp.posteUid }, kind: 'manPoste', utility: 0, targetId: sp.hullId, coord: null });

  // --- ARGMAX : meilleur candidat (utilité pondérée + tie-break déterministe) ----------------
  // TRACE (DEV gated) : classement des candidats (top 8 par utilité décroissante) = l'« intention » du tour.
  if (AI_TRACE) _lastRanking = [...candidates].sort((a, b) => b.utility - a.utility).slice(0, 8).map((c) => ({ kind: c.kind, spell: (c.action as { spell?: string }).spell, targetId: c.targetId || undefined, utility: Math.round(c.utility * 100) / 100 }));
  const chosen = argmax(candidates);
  if (chosen) return chosen.action;

  // Aucun candidat jouable : un Empêtré (Mouvement nul, LDB 16 l.64) se libère plutôt que perdre son
  // tour (Test opposé de Force contre la source, l.66). Sinon, passe la main.
  if (hasCondition(enemy, 'empetre')) return { kind: 'recover', state: 'empetre' };
  return { kind: 'end' };
}
