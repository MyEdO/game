/**
 * FLOW CORE — le NOYAU PUR (engine) de la couche de LOGIQUE authorée du jeu : conditions → effets →
 * branches, façon liste de blocs imbriqués (RPG Maker / ink), pas de graphe à fils. UNE structure
 * récursive, sérialisation STABLE (c'est le contrat édité dans l'éditeur ET sauvegardé dans les
 * scènes/sorts). Elle subsume, à terme, `Effect[]` (la séquence), les branches `test`/dialogue, et les
 * conditions de trigger — source UNIQUE de la logique de contenu (triggers, dialogues, interactions,
 * pièges, sorts custom).
 *
 * POURQUOI EN `engine/` (règle 3 — le moteur reste PUR) : la feuille `effet` est GÉNÉRIQUE (`Flow<E>`).
 * Le défaut `EffectOp` (appliquer des `GameOp`) ne dépend QUE du moteur ; la couche `state` instancie
 * `Flow<Effect>` (la feuille devient l'union `Effect` complète : transition/dialogue/combat…, qui EST
 * state). Le moteur (ops/miscast/domainAttributes/types/magic/weaponDamage) ne référence que ce noyau.
 *
 * Discipline (briques stables, pas de DSL ouvert) :
 *  - ENSEMBLE CLOS de Conditions et de nœuds — la puissance vient de la COMPOSITION, pas de la
 *    croissance de l'ensemble. Ajouter un nœud « juste pour un sort » = échec.
 *  - PAS de boucle (arbre, jamais cyclique) : ni `while`, ni saut arrière → contenu raisonnable,
 *    pas de risque de boucle infinie.
 *  - Les Conditions sont PURES (lisent l'état, ne le mutent pas) ; les effets sont les feuilles `effet`.
 *
 * Ce module porte le MODÈLE, l'évaluation PURE des Conditions (remplace `condMet` +
 * `temporalConditionMet`) et la MARCHE d'exécution (`executerFlow` : `sequence` et `si`). Ce que la marche
 * délègue (appliquer une feuille, ouvrir une modale de Test, suspendre, reprendre) vit chez ses hôtes
 * du noyau (`runFlow`, `runCombatFlow`…).
 */
import type { z } from 'zod';
import type { IconId } from '../data/icons';
import type { effectTargetingSchema, effectTriggerSchema, triggeredEffectSchema } from '../data/schemas/grammaire/mecanique';
import { toDate } from './clock';
import type { CharKey, Difficulty, EffectSource, HitLocation } from './types';
import { relationBetween, type Camp, type Relation } from './relations';
import { groupMatch } from './groups';
import {
  estOpDAttaquesSubies,
  estOpDeLaBourseDuGroupe,
  estOpDuMarche,
  estOpDuNavire,
  opDemandeUnDe,
  valeurNonLiee,
  type Formula,
  type GameOp,
  type PairedSense,
} from './ops';
import type { CibleEnVue } from './psychology';
import { refCouvre, type Id, type RefDesignee } from '../data/schemas/grammaire/ref';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';
// Type SEUL (effacé à la compilation — aucun cycle runtime) : `StakeRef` est la forme canonique de la
// zone d'enjeu, et la redéclarer ici serait la 2ᵉ source du même vocabulaire que #1117 combat.
import type { StakeRef } from '../data';
import { actorStatus, statusMeets, type PorteurDeStatut } from './social';
import { gelerLaConstante } from '../lib/gelerProfond';
import type { MenaceId } from './menace';
import { estObjet } from '../lib/objet.mjs';

/** Fenêtre horaire d'un trigger/Condition (heure-du-jour, `before` EXCLUSIF). Champs absents = borne
 *  ouverte ; objet vide = toujours vrai. Aucune dépendance — type structurel pur. */
export interface TemporalCondition {
  afterHour?: number;
  afterMinute?: number;
  beforeHour?: number;
  beforeMinute?: number;
}

/** EFFECTOP — la feuille PURE (engine) d'un `Flow` : applique des `GameOp` (Blessures/soin/État/charMod/
 *  Corruption/buffs… — vocabulaire PARTAGÉ avec les sorts, `engine/ops`) à une cible. C'est le DÉFAUT de
 *  la feuille générique `Flow<E>` ; la couche `state` élargit `E` à son union `Effect` (transition/
 *  dialogue/combat…). `on` = qui : `party`/`hero`/`navire` (scène, défaut `party` ; `navire` = le navire de
 *  campagne, `noyau/navireOps.ts`) ou `caster`/`target` (contexte d'incantation, résolu par le flux de sort). */
export interface EffectOp {
  type: 'ops';
  ops: GameOp[];
  on?: 'groupe' | 'heros' | 'navire' | 'membreAuHasard' | 'caster' | 'target' | CibleDeRole | CibleDeVolontaires;
  heroId?: string;
  /** Échéance d'HORLOGE (minute `gameTime`) des effets DURABLES posés par ces ops — BAKÉE sur la feuille
   *  (durée d'un consommable résolue AU BOIRE, `bakeConsumableFlow`) pour SURVIVRE aux suspensions (une
   *  branche de `test` voyage sérialisée dans un pending/meta, jamais une closure). Lue par `leafOpsCtx`
   *  à CHAQUE point d'application d'un EffectOp → `ctx.defaultUntilTime`. Absente = durée du contexte. */
  untilTime?: number;
  /** Libellé de SOURCE des ActiveEffect posés (nom du consommable) — baké avec `untilTime` (même raison). */
  label?: string;
  /** DURÉE en jours des effets durables, TIRÉE une fois à l'application de la feuille puis bakée en
   *  `untilTime` (exclusive de lui) par l'exécuteur qui la résout (handler de scène `ops`). MDG 15 l.211-212, l.233-234 */
  pendantJours?: Formula;
}

/** Cible d'une feuille de SCÈNE : le ou les marins ÉPINGLÉS au rôle d'équipage `role` (`Combatant.shipRole`),
 *  forme de `crewTargetSchema`. MDG 15 l.233 */
export interface CibleDeRole { role: { id: Id<'crewRole'> } }

/** Cible d'une feuille de SCÈNE : les héros qui choisissent d'en être, chacun à son siège, sous `volontaires`
 *  (la question posée). MDG 15 l.196 */
export interface CibleDeVolontaires { volontaires: string }

/** OpsCtx d'une FEUILLE EffectOp : le contexte de l'appelant SURCHARGÉ par les champs bakés de la feuille
 *  (`untilTime` → durée d'horloge, `label` → source). SOURCE UNIQUE — tous les exécuteurs d'EffectOp
 *  (handler de scène `ops`, `runCombatFlow`, `runPureFlowLines`, runner de consommable) DOIVENT l'appliquer,
 *  sinon une branche suspendue perdrait sa durée (charMod permanent au lieu de « 2d10 minutes »). */
export function leafOpsCtx<C extends { defaultUntilTime?: number; label?: string }>(base: C, e: EffectOp): C {
  if (e.pendantJours != null) throw new Error(`EffectOp${e.label ? ` « ${e.label} »` : ''} : \`pendantJours\` non résolu — seul le handler de scène \`ops\` le tire et le bake en \`untilTime\`.`);
  if (e.untilTime == null && e.label == null) return base;
  return {
    ...base,
    ...(e.untilTime != null ? { defaultUntilTime: e.untilTime } : {}),
    ...(e.label != null ? { label: e.label } : {}),
  };
}

/** Algèbre CLOSE de Conditions (sérialisation-stable). `flag`/`time` reprennent la sémantique des
 *  anciens `condMet`/`temporalConditionMet` ; `all`/`any` composent ; `not` nie. Aucune condition
 *  qui MUTE l'état — purement interrogative. */
/** Bourse (sous-ensemble de `Money`) — comparée en sous de cuivre (1 CO = 240 sc, 1 pistole = 12 sc). */
export interface Purse { gold?: number; silver?: number; brass?: number }
/** Le seuil d'une Condition `money` : un montant, ou le nom de la valeur liée qu'il relit. */
export function seuilDeBourse(atLeast: Extract<Condition, { kind: 'money' }>['atLeast']): { montant: Purse } | { lie: string } {
  return typeof atLeast.brass === 'object' ? { lie: atLeast.brass.tire } : { montant: atLeast as Purse };
}

const brassValue = (m: Purse): number => (m.gold ?? 0) * 240 + (m.silver ?? 0) * 12 + (m.brass ?? 0);

/** Applique un opérateur de comparaison — SOURCE UNIQUE pour les Conditions `compare` et `woundsDealt`. */
const applyCompareOp = (a: number, op: CompareOp, b: number): boolean =>
  op === '>=' ? a >= b : op === '<=' ? a <= b : op === '==' ? a === b : op === '<' ? a < b : a > b;

/** Acteur d'un Flow visé par une comparaison : la CIBLE (l'unité affectée) ou le LANCEUR/porteur. */
export type ActorRef = 'target' | 'caster';
/** Donnée numérique fixe d'un acteur (`size` = ordinal de Taille SIZE_ORDER ; `advantage` = Avantage). */
export type ActorField = 'woundsCurrent' | 'woundsMax' | 'size' | 'advantage';
/** Référence à UNE Caractéristique EFFECTIVE d'un acteur (`bonus:true` → son Bonus). Toutes les
 *  Caractéristiques sont exposées (pas de champ ad hoc) — lues par les seuils relatifs, ex. Voie d'eau
 *  « coule à Endurance » ⇔ `{who:'target', characteristic:'endurance'}` (MDG 13). */
export type CharRef = { who: ActorRef; characteristic: CharKey; bonus?: boolean };
/** SUJET d'une comparaison `compare` : `who` (cible/lanceur) × (une donnée fixe, la valeur/stacks d'un
 *  État nommé, ou une Caractéristique — 0 si absent → « la cible a l'État X » ⇔ `{who:'target', condition:X} >= 1`). */
export type CompareSubject = { who: ActorRef; field: ActorField } | { who: ActorRef; condition: string } | CharRef;
/** Opérateur de comparaison (Condition `compare`). */
export type CompareOp = '>=' | '<=' | '==' | '<' | '>';
/** Vue d'un acteur lue par les Conditions d'acteur (`compare`/`relation`/`has`) : id + PB + Taille/
 *  Avantage + camp + appartenances (Groupes/Talents/Traits) + valeur d'États par nom. */
export interface ActorView {
  id: string; woundsCurrent: number; woundsMax: number; size: number; advantage: number; camp: Camp;
  groups: string[]; talents: { id: string; spec?: string }[]; traits: string[];
  /** Types de Dégâts dont l'acteur est immunisé (`immunityTypes` — Immunité (Type), LDB 85 l.174), lus par
   *  `has what:'immunity'`. Absent → aucune Immunité. */
  immunities?: string[];
  conditions: Record<string, number>;
  /** États PSYCHOLOGIQUES actifs portés (`psychState` — types dont l'affliction n'est pas résistée) —
   *  lus par `has what:'psych'` (gate « porteur en Frénésie » du Contrôle de la Frénésie, LDB 10). */
  psych?: string[];
  /** Caractéristiques EFFECTIVES (toutes), lues par la Condition `compare` via `{who, characteristic}` (+ `bonus`). */
  chars: Record<CharKey, number>;
  /** Niveau des CAPACITÉS de combat (`CombatFeature` agrégées) — lu par la Condition `capability`
   *  (Cœur vaillant `braveheart`…). Absent → toute capacité vaut 0. */
  capabilities?: Record<string, number>;
  /** Domaine du Chaos de l'acteur (`chaosDomainOf` — spec du Talent Magie du Chaos, EDOC 13) — lu par la
   *  Condition `casterChaosDomain`. Absent = non porteur du Talent Magie du Chaos. */
  chaosDomain?: string;
  /** L'acteur porte-t-il un passif VISIBLE (`aPassifVisible` — lésion apparente d'une maladie active) ?
   *  Lu par la Condition `visiblePassive`. */
  visiblePassive?: boolean;
}

/** SÉLECTEUR de héros d'une Condition de groupe : un héros au moins (`any`), tout le groupe (`all`), ou
 *  le héros que DÉSIGNE l'état de campagne `etat` (forme `heros`, `GameState.etats`) — EDO 02 l.91.
 *  Référence non désignée → le prédicat sélectionné est faux. */
export type PartySelector = 'any' | 'all' | { etat: string };

export type Condition =
  | { kind: 'always' }
  /** ET de drapeaux avec négation : « v1,!v2 » ⇔ flags.v1 && !flags.v2 (sémantique `condMet`). */
  | { kind: 'flag'; expr: string }
  /** Fenêtre horaire (heure-du-jour, `before` exclusif) — sémantique `temporalConditionMet`. */
  | { kind: 'time'; window: TemporalCondition }
  /** Le GROUPE possède au moins `count` (défaut 1) exemplaire(s) de l'objet d'`id` `trappingId` (réf de
   *  catalogue stable). Repli sur le NOM pour les objets CUSTOM (hors-base, sans `trappingId`). */
  | { kind: 'hasItem'; trappingId: string; count?: number }
  /** La bourse du groupe vaut AU MOINS le seuil `atLeast` (comparaison en sous de cuivre) : un montant, ou une
   *  valeur LIÉE du Flow en sous de cuivre (`{brass: {tire}}`, substituée par `lierLesTirages`) — « la bourse
   *  couvre la rançon tirée » (MDG 15 l.245-247). */
  | { kind: 'money'; atLeast: Purse | { brass: { tire: string } } }
  /** État vital du groupe : `any` = au moins un héros mort, `all` = tous morts, `{etat}` = le héros désigné
   *  est mort. */
  | { kind: 'partyDead'; who: PartySelector }
  /** ÉTAT DE CAMPAGNE `etat` (registre `narratif.etats`, valeur `GameState.etats`) : sans `value`, « est
   *  défini » ; avec `value`, égal à cette valeur — EDO 02 l.27. */
  | { kind: 'etat'; etat: string; value?: string }
  /** Un héros du groupe (`any`) OU tous (`all`, défaut `any`) possède la Compétence `id` (`spec` éventuel)
   *  avec au moins `advances` avances (défaut 0 = simple possession) — #711, gate de dialogue party-level. */
  | { kind: 'skill'; id: string; spec?: string; advances?: number; who?: PartySelector }
  /** Un héros du groupe (`any`/`all`) exerce la carrière `id` (`Combatant.career`) — #711. */
  | { kind: 'career'; id: string; who?: PartySelector }
  /** Un héros du groupe (`any`/`all`) porte le Talent `id` (`spec` éventuelle : Béni (Manann)) — gate
   *  « un Prêtre ou une Nonne de Manann à bord » (MDG 15 l.197-198, l.230-232). */
  | { kind: 'talent'; id: string; spec?: string; who?: PartySelector }
  /** Un héros du groupe (`any`/`all`) est de l'espèce `id` (`Combatant.species`) — #711. */
  | { kind: 'species'; id: string; who?: PartySelector }
  /** Un héros du groupe (`any`/`all`) a un Statut (LDB 08, `actorStatus`) au moins `atLeast`
   *  (« Argent 2 », `parseStatus`) — #711. */
  | { kind: 'status'; atLeast: string; who?: PartySelector }
  /** COMPARAISON sur un ACTEUR du Flow (cible OU lanceur) — UNIQUE Condition « données d'acteur » :
   *  `subject` (`who` × donnée fixe OU valeur d'un État) · `op` (≥ ≤ = < >) · `value`. `value` est une
   *  CONSTANTE ou le champ d'un AUTRE acteur (« cible plus petite que l'attaquant » ⇔
   *  `{who:'target',field:'size'} '<' {who:'caster',field:'size'}`). Régénération « PB > 0 » ⇔
   *  `{who:'target',field:'woundsCurrent'} >= 1`. Acteur absent → false. `factor` met à l'échelle la valeur
   *  référencée (« la MOITIÉ de l'Endurance » ⇔ `{who:'target',characteristic:'endurance',factor:0.5}`, Voie d'eau). */
  | { kind: 'compare'; subject: CompareSubject; op: CompareOp; value: number | (CompareSubject & { factor?: number }) }
  /** Seuil de MARGE / DR du contexte (`ctx.sl`) : vrai si `sl ≥ atLeast`. Permet d'authorer les issues
   *  échelonnées d'une manœuvre (Regard pétrifiant : « si la marge atteint 6 DR → Pétrifié », LDB 85
   *  l.238) en GameOp Flow — `if slThreshold(6) → … else if slThreshold(2) → …`. Hors contexte = 0. */
  | { kind: 'slThreshold'; op: CompareOp; value: number }
  /** Localisation touchée par l'attaque courante (`ctx.location`, dé inversé) — Assommante : « si vous
   *  touchez la Tête… ». Hors contexte d'attaque (location absente) = jamais vrai. */
  | { kind: 'location'; is: HitLocation }
  /** KIND de l'attaque courante (`ctx.attackKind` : 'morsure'/'cornes'/'caudale'/… cf. `creatureAttackKind`)
   *  — gate « seulement quand l'attaque est une Morsure » (Vampirique). Hors contexte = jamais vrai. */
  | { kind: 'attackKind'; is: string }
  /** CAUSE d'un effarouchement courant (`ctx.startleCause` : 'noise' bruits forts / 'magic' présence de
   *  magie — LDB 85 l.197 Nerveux) — gate l'exemption Dressé (Guerre ignore les bruits, Magie ignore la
   *  magie, LDB 85 l.110). Hors contexte d'effarouchement = jamais vrai. */
  | { kind: 'startleCause'; is: 'noise' | 'magic' }
  /** Blessures infligées par l'attaque/lancement courant (`ctx.woundsDealt`), comparées par `op` à
   *  `value` (Venin : `> 0` → Empoisonné ; un rider « coup lourd » : `>= 3`). Hors contexte = 0. */
  | { kind: 'woundsDealt'; op: CompareOp; value: number }
  /** Écart d'Avantage avec les adversaires Engagés (`ctx.engagedAdvantageGap`), comparé par `op` à `value`
   *  (Instable : `> 0` → la créature est repoussée et perd des PB, LDB 85 l.177). Hors combat = 0. */
  | { kind: 'engagedAdvantageGap'; op: CompareOp; value: number }
  /** AVANCE d'Avantage sur TOUS les adversaires Engagés (`ctx.engagedAdvantageLead` = son Avantage − le
   *  meilleur Avantage ennemi engagé), SIGNÉE et non bornée, comparée par `op` à `value`. C'est l'INVERSE
   *  non-clampé de `engagedAdvantageGap` (qui mesure de combien un ennemi DÉPASSE le porteur, ≥ 0) : `> 0`
   *  = le porteur a un Avantage STRICTEMENT supérieur à TOUS ses adversaires engagés (Absorption « si la
   *  créature a un Avantage plus élevé que tous les adversaires engagés », EDO 11 l.222). Hors combat / sans
   *  foe engagé = 0. */
  | { kind: 'engagedAdvantageLead'; op: CompareOp; value: number }
  /** Y a-t-il un adversaire VIVANT dans la Ligne de Vue de `target` (`ctx.foeInLoS`) ? Géométrie d'arène
   *  emballée en donnée (au-dessus de `lineOfSightCover`) : sortie de Frénésie « plus d'ennemi en vue → fin »
   *  (LDB 21 l.35), fuite/récupération du Brisé « hors de vue de l'ennemi » (LDB 16 l.52). Hors combat = false. */
  | { kind: 'foeInLoS' }
  /** La Cible de l'affliction psychologique qui porte l'effet a-t-elle encore un membre dans la Ligne de Vue du
   *  porteur (`ctx.cibleEnVue`, précalculé) ? `hostiles` : un membre qui ne s'est pas calmé. Réservée aux
   *  `effects` de `psychology.json` (régime de famille `condition.cibleEnVue`). LDB 21 l.19, l.39, l.48 ; #3045 */
  | { kind: 'cibleEnVue'; hostiles?: true }
  /** Aucun adversaire VIVANT ne voit l'acteur (sens foe→acteur, ≠ `foeInLoS` acteur→foe) — « caché hors de
   *  vue de l'ennemi » (Brisé, LDB 16 l.54/56 : retrait sans Test + difficulté Accessible). Précalculé sur
   *  la battle (`ctx.hiddenFromFoes`). Hors combat = false. */
  | { kind: 'hiddenFromFoes' }
  /** L'acteur est-il ENGAGÉ avec un adversaire (LDB 13 l.159) ? Gate de récupération du Brisé (LDB 16 l.54 :
   *  aucun Test si Engagé). Précalculé (`ctx.engaged`). Hors combat = false. */
  | { kind: 'engaged' }
  /** Le Test courant est-il un TEST D'ÉQUIPAGE à bord (MDG 14) ? Gate du bonus « Commandant émérite »
   *  (MDG 09 l.54 : « à bord de votre bateau ou impliquant votre équipage »). Hors Test d'équipage = false. */
  | { kind: 'crewTest' }
  /** Le Test courant se joue-t-il pendant un Round de combat (`ctx.roundDeCombat`) ? Ligne « Tests : » de
   *  Pansement de fortune et de Chirurgie (LDB 10 l.182, l.897). Hors contexte = false. */
  | { kind: 'roundDeCombat' }
  /** Distance (cases) à l'adversaire VIVANT le plus proche, comparée par `op` à `value` (Brisé,
   *  LDB 16 l.54). Précalculée (`ctx.nearestFoeDist`). Aucun adversaire / hors combat = +∞. */
  | { kind: 'nearestFoe'; op: CompareOp; value: number }
  /** Niveau d'une CAPACITÉ de combat (`CombatFeature`) de l'acteur `who`, comparé par `op` (défaut `>=`) à
   *  `value` (défaut 1) — Cœur vaillant (`braveheart`) octroyable par talent OU effet. Acteur absent = 0. */
  | { kind: 'capability'; who: ActorRef; id: string; op?: CompareOp; value?: number }
  /** Camp / RELATION d'un acteur (`who`) — gate « seulement les ennemis / les alliés / les neutres »
   *  (riders de domaine offensifs : `who:'target', is:'adversaire'`). `allie`/`adversaire` sont RELATIFS à
   *  l'autre acteur (même camp / camp différent) ; `groupe`/`neutre`/`hostile` sont ABSOLUS (le `kind`).
   *  Acteur(s) absent(s) = false. */
  | { kind: 'relation'; who: ActorRef; is: Relation | Camp }
  /** L'acteur (`who`) POSSÈDE un élément : appartenance à un **Groupe** (faction, via `groupMatch`),
   *  un **Talent** (par id, `spec` éventuel — « Magie des Arcanes (Feu) »), un **Trait** (par id), ou
   *  un **état psychologique** actif (par type — `psych`, ex. 'frenesie' : gate du Contrôle de la
   *  Frénésie, LDB 10), ou une **Immunité** à un Type de Dégâts (par id — Immunité (Poison) : Venin sans
   *  effet ; gate d'un Test de poison). Généralise la gate op-level `onlyGroups`. Acteur absent = false. */
  | { kind: 'has'; who: ActorRef; what: 'talent'; value: string; spec?: string }
  | { kind: 'has'; who: ActorRef; what: 'group' | 'trait' | 'psych' | 'immunity'; value: string }
  /** Le Domaine du Chaos du LANCEUR (`ctx.caster.chaosDomain`, `chaosDomainOf`) est-il `is` ? Gate
   *  GÉNÉRIQUE de tout Sort d'Arcanes du Chaos « se manifestant selon le Domaine spécifique » (EDOC 13
   *  l.264-266) — la branche du Flow sélectionne sa colonne (Allure démoniaque : Nurgle/Slaanesh/Tzeentch/
   *  Indivisible). Lanceur sans Domaine résolu → toutes les branches sont fausses (bug de données côté
   *  authoring : un Sort d'Arcanes du Chaos exige le Talent Magie du Chaos). */
  | { kind: 'casterChaosDomain'; is: string }
  /** L'acteur (`who`) montre-t-il un passif VISIBLE (`ActorView.visiblePassive` — une lésion apparente,
   *  émise `visible` par sa source) ? Gate d'apparence : « à quel point votre apparence peut susciter la
   *  sympathie » (LDB 09 l.97). Acteur absent = false. */
  | { kind: 'visiblePassive'; who: ActorRef }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

/** Contexte d'évaluation d'une Condition (lecture seule) — ensemble CLOS : drapeaux, horloge, et état
 *  VIVANT du groupe (mort/inventaire/bourse). `party`/`money` absents → les conditions d'état sont false. */
export interface ConditionCtx {
  flags: Record<string, boolean>;
  gameTime: number;
  party?: { id?: string; dead?: boolean; items?: { label: string; trappingId?: string }[];
    /** Compétences possédées (#711 `skill`) — instances brutes, comme `Combatant.skills`. */
    skills?: { id: string; spec?: string; advances?: number }[];
    /** Talents possédés (`talent`) — instances brutes, comme `Combatant.talents`. */
    talents?: readonly { talentId: string; spec?: string }[];
    /** Carrière/espèce/niveau de carrière courants (#711 `career`/`species`/`status`) — bruts,
     *  comme `Combatant.career`/`species`/`careerLevel`. */
    career?: string; species?: string; careerLevel?: number;
    /** Effets actifs (`statusMod` : Standing temporaire lu par `actorStatus`). */
    activeEffects?: PorteurDeStatut['activeEffects'] }[];
  money?: Purse;
  /** ÉTATS DE CAMPAGNE posés (`GameState.etats` : id d'état → id de héros ou de valeur) — lus par la
   *  Condition `etat` et le sélecteur `{etat}`. Absent → aucun état n'est défini. */
  etats?: Record<string, string>;
  /** Acteurs du Flow lus par la Condition `compare` (`conditions` = stacks par nom d'État, 0 si absent).
   *  `target` = l'unité affectée (la « cible » du sous-Flow) ; `caster` = le lanceur/porteur. */
  target?: ActorView;
  caster?: ActorView;
  /** Marge / DR du contexte (jet d'incantation, opposition de manœuvre) — lu par `slThreshold`. */
  sl?: number;
  /** Localisation de la touche courante (dé inversé) — lue par la Condition `location`. */
  location?: HitLocation;
  /** Blessures infligées par l'attaque courante — lue par la Condition `woundsDealt`. */
  woundsDealt?: number;
  /** Écart d'Avantage avec les adversaires Engagés — lu par la Condition `engagedAdvantageGap` (Instable). */
  engagedAdvantageGap?: number;
  /** Avance d'Avantage SIGNÉE sur tous les adversaires Engagés (son Avantage − le meilleur ennemi engagé) —
   *  lue par la Condition `engagedAdvantageLead` (Absorption : `> 0` = strictement supérieur à tous). */
  engagedAdvantageLead?: number;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — lu par la Condition `attackKind`. */
  attackKind?: string;
  /** CAUSE de l'effarouchement courant ('noise'/'magic') — lue par la Condition `startleCause` (exemption Dressé). */
  startleCause?: 'noise' | 'magic';
  /** Un adversaire vivant est-il dans la Ligne de Vue du porteur — lu par la Condition `foeInLoS`
   *  (sortie de Frénésie, fuite/récupération du Brisé). Précalculé sur la `battle` par l'appelant. */
  foeInLoS?: boolean;
  /** Verdict de l'affliction qui porte l'effet sur sa Cible en vue — lu par `cibleEnVue`. Absent = rien en vue. */
  cibleEnVue?: CibleEnVue;
  /** Aucun adversaire vivant ne voit l'acteur (sens foe→acteur) — lu par `hiddenFromFoes` (Brisé caché). */
  hiddenFromFoes?: boolean;
  /** L'acteur est-il Engagé avec un adversaire — lu par `engaged` (gate de récupération du Brisé). */
  engaged?: boolean;
  /** Distance (cases) à l'adversaire vivant le plus proche — lue par `nearestFoe`. +∞ si aucun. */
  nearestFoeDist?: number;
  /** Le Test courant est-il un TEST D'ÉQUIPAGE à bord (MDG 14) — lu par la Condition `crewTest`
   *  (Commandant émérite : « à bord de votre bateau ou impliquant votre équipage », MDG 09 l.54). */
  crewTest?: boolean;
  /** Le Test courant se joue-t-il pendant un Round de combat — lu par la Condition `roundDeCombat`. */
  roundDeCombat?: boolean;
}

/** Évalue une Condition — SOURCE UNIQUE de l'évaluation des conditions (triggers, choix de dialogue,
 *  nœuds `si`). PURE. `flag` : ET de drapeaux avec négation (« v1,!v2 », tolère les espaces) ; `time` :
 *  fenêtre horaire (heure-du-jour, `before` EXCLUSIF). */
type MembreDuGroupe = NonNullable<ConditionCtx['party']>[number];

/** Le membre du groupe que désigne l'état `etat`, mort ou vif — `undefined` si la référence n'est pas
 *  désignée ou ne résout aucun membre. */
function membreDesigne(ctx: ConditionCtx, etat: string): MembreDuGroupe | undefined {
  const id = ctx.etats?.[etat];
  return id === undefined ? undefined : (ctx.party ?? []).find((m) => m.id === id);
}

/** Un membre VIVANT du groupe (`any`), TOUS les vivants (`all`, aucun vivant → false) ou le héros VIVANT
 *  que désigne l'état `{etat}` satisfont `pred` — helper commun des Conditions party-level (#711 :
 *  `skill`/`career`/`species`/`status`). Un héros TOMBÉ ne prête pas sa compétence/carrière/espèce/statut
 *  à un choix (gate sur les vivants). */
function matchParty(ctx: ConditionCtx, who: PartySelector, pred: (m: MembreDuGroupe) => boolean): boolean {
  if (typeof who === 'object') {
    const m = membreDesigne(ctx, who.etat);
    return !!m && !m.dead && pred(m);
  }
  const list = (ctx.party ?? []).filter((m) => !m.dead);
  return who === 'all' ? list.length > 0 && list.every(pred) : list.some(pred);
}

/** Termes d'une Condition `flag` — « v1,!v2 », espaces tolérés : chaque drapeau NOMMÉ et sa négation.
 *  SOURCE UNIQUE du parse de `expr`, lue par `evalCondition` et par tout lecteur des drapeaux d'un paquet. */
export function flagTerms(expr: string): { flag: string; negated: boolean }[] {
  return expr.split(',').map((c) => c.trim()).filter(Boolean)
    .map((c) => (c.startsWith('!') ? { flag: c.slice(1), negated: true } : { flag: c, negated: false }));
}

export function evalCondition(cond: Condition, ctx: ConditionCtx): boolean {
  switch (cond.kind) {
    case 'always': return true;
    case 'flag':
      return flagTerms(cond.expr).every((t) => (t.negated ? !ctx.flags[t.flag] : !!ctx.flags[t.flag]));
    case 'time': {
      const d = toDate(ctx.gameTime);
      const now = d.hour * 60 + d.minute;
      const w = cond.window;
      if (w.afterHour != null && now < w.afterHour * 60 + (w.afterMinute ?? 0)) return false;
      if (w.beforeHour != null && now >= w.beforeHour * 60 + (w.beforeMinute ?? 0)) return false;
      return true;
    }
    case 'hasItem': {
      const need = Math.max(1, cond.count ?? 1);
      // Objet catalogué → match par `trappingId` stable ; objet CUSTOM (sans trappingId) → repli sur le nom.
      // Carve-out doctrine (#318) : ce repli n'est PAS une comparaison par-label déguisée — un objet
      // CUSTOM n'a structurellement AUCUN id de catalogue à comparer (il n'existe dans aucune source
      // data), donc son nom EST son seul identifiant stable côté ItemInstance. Rien à migrer.
      const have = (ctx.party ?? []).reduce((n, h) => n + (h.items ?? []).filter((it) => (it.trappingId ?? it.label) === cond.trappingId).length, 0);
      return have >= need;
    }
    case 'money': {
      const seuil = seuilDeBourse(cond.atLeast);
      if ('lie' in seuil) return valeurNonLiee({ tire: seuil.lie });
      return ctx.money ? brassValue(ctx.money) >= brassValue(seuil.montant) : false;
    }
    case 'partyDead': {
      if (typeof cond.who === 'object') return membreDesigne(ctx, cond.who.etat)?.dead === true;
      const party = ctx.party ?? [];
      return party.length > 0 && (cond.who === 'all' ? party.every((h) => h.dead) : party.some((h) => h.dead));
    }
    case 'etat': {
      const v = ctx.etats?.[cond.etat];
      return v !== undefined && (cond.value === undefined || v === cond.value);
    }
    case 'compare': {
      // Lecture d'un côté de la comparaison : valeur d'un État (par nom), Caractéristique (+Bonus), ou champ fixe.
      const read = (sel: CompareSubject): number | undefined => {
        const a = sel.who === 'caster' ? ctx.caster : ctx.target;
        if (!a) return undefined;
        if ('condition' in sel) return a.conditions[sel.condition] ?? 0;
        if ('characteristic' in sel) { const v = a.chars[sel.characteristic]; return sel.bonus ? Math.floor(v / 10) : v; }
        return a[sel.field];
      };
      const lhs = read(cond.subject);
      const rhsRaw = typeof cond.value === 'number' ? cond.value : read(cond.value);
      const rhs = typeof cond.value === 'number' || rhsRaw == null ? rhsRaw : rhsRaw * (cond.value.factor ?? 1);
      if (lhs == null || rhs == null) return false; // acteur absent → false
      return applyCompareOp(lhs, cond.op, rhs);
    }
    case 'slThreshold': return applyCompareOp(ctx.sl ?? 0, cond.op, cond.value);
    case 'location': return ctx.location != null && ctx.location === cond.is;
    case 'attackKind': return ctx.attackKind != null && ctx.attackKind === cond.is;
    case 'startleCause': return ctx.startleCause != null && ctx.startleCause === cond.is;
    case 'woundsDealt': return applyCompareOp(ctx.woundsDealt ?? 0, cond.op, cond.value);
    case 'engagedAdvantageGap': return applyCompareOp(ctx.engagedAdvantageGap ?? 0, cond.op, cond.value);
    case 'engagedAdvantageLead': return applyCompareOp(ctx.engagedAdvantageLead ?? 0, cond.op, cond.value);
    case 'foeInLoS': return !!ctx.foeInLoS;
    case 'cibleEnVue': return !!(cond.hostiles ? ctx.cibleEnVue?.hostile : ctx.cibleEnVue?.present);
    case 'hiddenFromFoes': return !!ctx.hiddenFromFoes;
    case 'engaged': return !!ctx.engaged;
    case 'crewTest': return !!ctx.crewTest;
    case 'roundDeCombat': return !!ctx.roundDeCombat;
    case 'nearestFoe': return applyCompareOp(ctx.nearestFoeDist ?? Infinity, cond.op, cond.value);
    case 'capability': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      return a ? applyCompareOp(a.capabilities?.[cond.id] ?? 0, cond.op ?? '>=', cond.value ?? 1) : false;
    }
    case 'relation': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      if (!a) return false;
      if (cond.is === 'groupe' || cond.is === 'neutre' || cond.is === 'hostile') return a.camp === cond.is; // camp ABSOLU
      const other = cond.who === 'caster' ? ctx.target : ctx.caster; // RELATIF à l'autre acteur
      return !!other && relationBetween(a, other) === cond.is;
    }
    case 'has': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      if (!a) return false;
      if (cond.what === 'group') return groupMatch(cond.value, a.groups);
      if (cond.what === 'talent') return a.talents.some((t) => refCouvre({ id: cond.value, spec: cond.spec }, t));
      if (cond.what === 'psych') return (a.psych ?? []).includes(cond.value);
      if (cond.what === 'immunity') return (a.immunities ?? []).includes(cond.value);
      return a.traits.includes(cond.value);
    }
    case 'casterChaosDomain': return ctx.caster?.chaosDomain === cond.is;
    case 'visiblePassive': return (cond.who === 'caster' ? ctx.caster : ctx.target)?.visiblePassive === true;
    case 'skill':
      return matchParty(ctx, cond.who ?? 'any', (m) => (m.skills ?? []).some((s) =>
        refCouvre({ id: cond.id, spec: cond.spec }, s) && (s.advances ?? 0) >= (cond.advances ?? 0)));
    case 'career': return matchParty(ctx, cond.who ?? 'any', (m) => m.career === cond.id);
    case 'talent': return matchParty(ctx, cond.who ?? 'any', (m) => (m.talents ?? []).some((t) => refCouvre({ id: cond.id, spec: cond.spec }, { id: t.talentId, spec: t.spec })));
    case 'species': return matchParty(ctx, cond.who ?? 'any', (m) => m.species === cond.id);
    case 'status': return matchParty(ctx, cond.who ?? 'any', (m) => statusMeets(actorStatus(m), cond.atLeast));
    case 'all': return cond.of.every((c) => evalCondition(c, ctx));
    case 'any': return cond.of.some((c) => evalCondition(c, ctx));
    case 'not': return !evalCondition(cond.of, ctx);
  }
}

/** Construit le contexte d'évaluation depuis l'état de jeu (drapeaux/horloge/groupe/bourse) — source
 *  UNIQUE pour que tous les sites (triggers, `si`, choix de dialogue) lisent le MÊME état. */
export function conditionCtx(s: { flags: Record<string, boolean>; gameTime: number; party?: ConditionCtx['party']; money?: Purse; etats?: Record<string, string> }): ConditionCtx {
  return { flags: s.flags, gameTime: s.gameTime, party: s.party, money: s.money, etats: s.etats };
}

/** Spécification d'un jet de compétence/caractéristique différé (→ modale) — TOUT le métier du Test,
 *  SANS les branches (portées par le nœud Flow `test`). Source UNIQUE : `Effect` 'test' est normalisé
 *  vers cette forme à l'exécution (un seul ouvreur de modale `openSkillTest`). */
export interface FlowTest {
  /** ENJEU du Test (#1117). C'est la TROISIÈME forme qui lance (après l'étape de cascade posée à la
   *  main et la `RollRequest` du seam) : `resolveFlowTest` bâtit son étape via
   *  `simpleTriggeredTestStep`, qui n'a aucun moyen de deviner ce que le Flow met en jeu — le
   *  producteur le fournit ici. DEUX provenances, une seule porte de résolution (`resolveStake`) :
   *  le MOTEUR nomme un dataset (`combatStakeRef`…), un DOCUMENT de campagne écrit sa phrase
   *  (`AuthoredStake` — arbitrage user 2026-08-12, l'enjeu d'un Flow authoré s'authore dans la scène,
   *  et `validateScene` le refuse muet). Pur-donnée dans les deux cas : la valeur voyage en save et
   *  en JSON de campagne. */
  stake?: StakeRef;
  /** Compétence testée (XOR `characteristic`) — référence EMBOÏTÉE `{ id, spec? }`. La `spec` cible
   *  QUELLE instance est testée quand le héros en possède plusieurs (Métier (Serrurier), Savoir (Magie)…) ;
   *  sinon la première suffit. */
  skill?: RefDesignee;
  /** Sens SOLLICITÉ par ce Test de Perception (LDB 18) — authoré sur le nœud de test d'une scène/dialogue :
   *  `'vue'` (repérer un mouvement, lire, guetter l'horizon) ou `'ouie'` (écouter à une porte, entendre une
   *  approche). Restreint le malus de Surdité (`skillMod{sense:'ouie'}`) au seul Test auditif, symétrique à
   *  la Cécité (qui nomme ses compétences en donnée). Absent = Test générique/ambigu → malus appliqué par
   *  défaut (conservateur : un sourd rate les indices sonores d'une vigilance générale). Lu par `openSkillTest`
   *  → `testValue`. */
  sense?: PairedSense;
  characteristic?: CharKey;
  /** TEST D'ÉQUIPAGE de ce type (`crew-test-types.json`, XOR `skill`/`characteristic`) : l'équipage du navire
   *  le joue par ses rôles (MDG 14 l.39), la branche suit son verdict. MDG 15 l.144-145 */
  crewTestType?: string;
  difficulty?: Difficulty;
  /** DR minimum requis (défaut 0 = simple réussite). */
  requireSL?: number;
  label?: string;
  /** Outil utilisé : `trappingId` de la possession cataloguée (ex. `'marteau'`) — résolu au runtime
   *  par id STABLE (`i.trappingId === tool`), jamais par libellé. Sa qualité d'artisanat module l'issue /
   *  casse l'objet. */
  tool?: string;
  /** Groupes de l'interlocuteur : malus Animosité/Préjugé sur un Test de Sociabilité (LDB 21). */
  vsGroups?: string[];
  /** Statut de la cible (« Argent 3 ») : mod social d'Échelon/Standing sur un Test social (LDB 08). */
  vsStatus?: string;
  /** Le Test social est une mendicité (option « Mendicité et Statut », LDB 08 l.63). */
  begging?: boolean;
  /** L'interlocuteur est une créature CAPRICIEUSE (Trait Capricieux, MSRC 15 l.149-159) : un tirage UNE
   *  fois sur sa table (`tirerLeCapricieux`) décale le DR du Test de Sociabilité. Authoré sur le Test
   *  d'un dialogue mené avec la créature. */
  vsCapricieux?: boolean;
  /** Difficulté réduite si l'allégeur possède la compétence/le talent requis (`resoudreFlowTest`). */
  easierIf?: { hasSkill?: { id: string; spec?: string }; hasTalent?: string; steps?: number };
  /** La difficulté EFFECTIVE vient de l'argument d'instance du porteur (« Venin (Difficile) ») —
   *  substituée à la collecte (`withArg`/`effectsOf`) ; `difficulty` ci-dessus est le défaut (arg absent).
   *  GATE reportée de l'op `test` (sémantique IDENTIQUE) — honorée par `resolveFlowTest`. */
  argDifficulty?: boolean;
  /** Le Test n'a lieu que si la cible appartient à l'un de ces Groupes (Épée de justice : « Criminel »).
   *  Sinon = no-op. Même `groupMatch` que l'op `test`. */
  onlyGroups?: string[];
  /** Le Test est sauté si la cible appartient à l'un de ces Groupes (Morsure de l'hiver : hors
   *  Mort-vivant/Démon). Même `groupMatch` que l'op `test`. */
  exceptGroups?: string[];
  /** GATE générique : le Test n'a lieu QUE si cette Condition est vraie (sinon no-op — ni étape ni branche,
   *  comme `onlyGroups`). Généralise ces gates à l'algèbre de Conditions (Brisé : « pas
   *  Engagé OU Cœur vaillant, ET pions restants »). Évaluée AVANT le jet par `resolveFlowTest`/`resolveInlineFlowTest`,
   *  par testeur ; dans un Flow de scène (`runFlow`), sur chaque héros : seuls ceux qui l'ouvrent peuvent jeter
   *  (MDG 15 l.197, l.231). */
  gate?: Condition;
  /** SOUTIEN (LDB 12 l.197) — TRI-ÉTAT, jamais une denylist par id de Compétence/Caractéristique ;
   *  coupé à la source par `openSkillTest` (`combatEffects.ts`) :
   *   - ABSENT : défaut de la VOIE qui ouvre le Test — scène/dialogue soutenable, effet DÉCLENCHÉ
   *     (`routeTriggeredTest`) et consommable NON soutenables (le sujet subit, l.197) ;
   *   - `true` : jamais soutenable, quelle que soit la voie ;
   *   - `false` : soutenable malgré la voie (Test de SOIN d'un nécessaire — soigner n'est pas résister). */
  noSupport?: boolean;
  /** MENACE à laquelle ce Test RÉSISTE (tag du talent « Résistance (Menace) », LDB 10 l.1016-1020 :
   *  `poison` pour Venin/lames empoisonnées…). Copié sur l'étape de cascade du héros → offre
   *  l'auto-succès du talent (verbe `resist`, cf. engine/menace). Absent = Test non couvert. */
  menace?: MenaceId;
  /** Difficulté DYNAMIQUE : la PREMIÈRE Condition vraie impose sa difficulté ; sinon `difficulty`
   *  (`resoudreFlowTest`). Brisé : LDB 16 l.54. */
  difficultyBy?: { cond: Condition; difficulty: Difficulty }[];
  /** Test OPPOSÉ (Assommante, LDB 62 l.235 : « Test opposé Force/Résistance ») : le côté qui jette CE
   *  Test (`skill`/`characteristic` ci-dessus) est le DÉFENSEUR (la cible/victime) ; l'ATTAQUANT (le
   *  porteur de l'effet) oppose `attacker`[+`attackerSkill`], pré-jeté et FIGÉ. L'issue success/sl du
   *  défenseur vient de `resolveOpposed(jetDéfenseur, jetAttaquantFigé)` (PAS `roll ≤ target`) ; la
   *  BRANCHE prise se lit au socle (`opposedBranchSuccess`, engine/tests) — jamais recomposée ici.
   *  Calque la mécanique figée de `recover`/`disengage` (l'opposant garde son jet, reroll-aware). */
  opposed?: { attacker: CharKey; attackerSkill?: string; attackerLabel?: string;
    /** Bonus de DR ajouté au jet du DÉFENSEUR (celui qui passe CE Test) AVANT l'opposition — Piège-lame
     *  (LDB 62 l.280 : « en ajoutant votre DR obtenu au précédent Test de Corps à corps »). Modifie À LA
     *  FOIS le vainqueur et la marge nette (il s'additionne au `sl` du défenseur dans `resolveOpposed`).
     *  Absent = 0 (Assommante). */
    bonusSL?: number;
    /** Bonus de DR ajouté au jet de l'ATTAQUANT figé (`aT`) AVANT l'opposition — Furtif (LDB 85) sur le
     *  Test de Discrétion de l'embusqueur : « Ajoutez son bonus d'Agilité au DR de tous ses Tests de
     *  Discrétion ». Baké dans `aT.sl` au pré-jet → suit la voie cascade (meta `aT`) ET inline à
     *  l'identique. Absent = 0. */
    attackerBonusSL?: number;
    /** Le DÉFENSEUR (le jeteur) est-il le camp que le RAW nomme « vous », celui qui doit REMPORTER pour
     *  que la conséquence tombe ? `true` : la conséquence est en branche `reussite` (Piège-lame, LDB 62
     *  l.280). Absent : le jeteur RÉSISTE, la conséquence est en branche `echec` (Assommante, l.235).
     *  Lu au SEUL cas d'égalité parfaite — cf. `opposedBranchSuccess` (LDB 12 l.160). */
    defenderMustWin?: boolean };
}

/** Les champs de la DÉCISION d'un `FlowTest`, lus par `resoudreFlowTest` (`engine/decisionDuTest.ts`) seul. */
export const CHAMPS_DE_DECISION = ['gate', 'difficultyBy', 'easierIf'] satisfies readonly (keyof FlowTest)[];
/** Un champ de `CHAMPS_DE_DECISION`. */
export type ChampDeDecision = (typeof CHAMPS_DE_DECISION)[number];

/** Un `FlowTest` que son PORTEUR fixe (`fixerLeTest`, `grammaire/mecanique.ts`) : les champs `K` exigés,
 *  aucune décision. */
export type JetFixe<K extends 'skill' | 'difficulty' = never> = Omit<FlowTest, ChampDeDecision> & Required<Pick<FlowTest, K>>;

/**
 * Un nœud de Flow, GÉNÉRIQUE sur le type de sa FEUILLE `E` (défaut `EffectOp` — engine pur ; la couche
 * `state` instancie `Flow<Effect>`). Cinq formes, RÉCURSIVES, jamais cycliques :
 *  - `sequence` : exécute `etapes` dans l'ordre (forme Flow d'une liste d'effets) ;
 *  - `effet`    : une feuille — applique un effet `E` (action) ;
 *  - `si`       : évalue `condition` (PUR) → `alors` / `sinon` ;
 *  - `test`     : jet ALÉATOIRE interactif → `reussite` / `echec` (forme Flow d'`Effect.test`) ;
 *  - `choix`    : DÉCISION du joueur opt-in (≠ `test` aléatoire, ≠ `si` état) → `oui` / `non`. Coût
 *    d'Avantage optionnel dépensé sur `oui`. Primitive FONDAMENTALE des réactions de combat
 *    (Frappe Réactive « vous POUVEZ tenter », Déstabilisante « vous POUVEZ dépenser 2 Av ») et, à
 *    terme, des choix de dialogue/pièges. Son exécuteur (`resolveFlowChoice`) pousse une étape-choix
 *    GÉNÉRIQUE `choixDeclenche` (`pushCombatStep` oui/non + applier unique) — il n'invente pas de mécanisme.
 */
export type Flow<E = EffectOp> =
  | { kind: 'sequence'; etapes: Flow<E>[] }
  | { kind: 'effet'; effet: E }
  | { kind: 'si'; condition: Condition; alors: Flow<E>; sinon?: Flow<E> }
  | { kind: 'test'; test: FlowTest; reussite: Flow<E>; echec: Flow<E> }
  | { kind: 'choix'; invite: string; source?: SourceRef; adapteDe?: SourceRef; coutEnAvantage?: number | IndiceTemplate; icon?: IconId; oui: Flow<E>; non?: Flow<E> };

/** TEMPLATE d'instance du coût d'Avantage d'un `choix` : l'Indice de l'entité PORTEUSE (Taillade 1A/2A,
 *  `AA 08 l.87`), substitué par `withArg` (`noyau/triggeredEffects`) avant exécution. Resté tel quel, le
 *  nœud n'est PAS offert (`resolveFlowChoice`) — jamais un coût 0. */
export const INDICE_TEMPLATE = '$indice';
export type IndiceTemplate = typeof INDICE_TEMPLATE;

/** TEMPLATE d'instance d'un champ d'op : l'ARGUMENT de l'entité PORTEUSE (trait Maladie « (peste) » →
 *  `exposeDisease{disease: ARG_TEMPLATE}`), substitué par `withArg` (`noyau/triggeredEffects`) avant
 *  exécution. Même mécanisme qu'`INDICE_TEMPLATE`, pour l'arg au lieu de l'Indice. */
export const ARG_TEMPLATE = '$arg';
export type ArgTemplate = typeof ARG_TEMPLATE;

/** Le NŒUD `test` seul — la forme UNIQUE du jet en donnée (jet + conséquence des deux branches), telle
 *  qu'un porteur l'épingle hors d'un Flow complet (rangée de Critique, cycle de maladie). */
export type FlowTestNode<E = EffectOp> = Extract<Flow<E>, { kind: 'test' }>;

/** Un nœud `test` dont la Difficulté se décide au PORTEUR (`decisionAuPorteur`, `noeudTest`) : son Test
 *  ne porte aucun champ de décision. */
export type NoeudDecideAuPorteur<E = EffectOp> = Omit<FlowTestNode<E>, 'test'> & { test: Omit<FlowTest, ChampDeDecision> & Required<Pick<FlowTest, 'difficulty'>> };

/** Flow vide (séquence sans étape) — neutre, sûr comme valeur par défaut d'un consommateur. Partagé
 *  par la donnée comme par l'état : gelé à sa définition (#2097). */
export const EMPTY_FLOW: Flow = gelerLaConstante({ kind: 'sequence', etapes: [] });

/** DÉCLENCHEUR d'un effet déclenché : la sortie d'`effectTriggerSchema` (`data/schemas/grammaire/mecanique.ts`). */
export type EffectTrigger = z.output<typeof effectTriggerSchema>;

/** CIBLE(S) d'un effet déclenché : la sortie d'`effectTargetingSchema` (`data/schemas/grammaire/mecanique.ts`). */
export type EffectTargeting = z.output<typeof effectTargetingSchema>;

/** Effet DÉCLENCHÉ : la sortie de `triggeredEffectSchema` (`data/schemas/grammaire/mecanique.ts`), plus ce que le
 *  jeu lui pose. */
export type TriggeredEffect = z.output<typeof triggeredEffectSchema> & {
  /** ENTITÉ SOURCE — JAMAIS authorée : posée à l'ÉNUMÉRATION par `effectSourcesOf`
   *  (`src/noyau/triggeredEffects.ts`), qui seule sait de quelle entité l'effet est tiré. Voyage jusqu'à
   *  l'`OpsCtx` du dispatch → ancre les `ActiveEffect` posés sur leur fiche de règle. */
  source?: EffectSource;
};

/** Enveloppe une liste d'effets-feuilles (`Effect[]`) en un Flow `sequence` de `effet` — pont de
 *  migration des consommateurs (`Trigger.effects`, `DialogueChoice.effects`) vers le Flow, sans réécrire
 *  la donnée. GÉNÉRIQUE sur la feuille (défaut `EffectOp`). */
export function flowFromEffects<E = EffectOp>(effects: E[] | undefined): Flow<E> {
  return { kind: 'sequence', etapes: (effects ?? []).map((effet) => ({ kind: 'effet', effet })) };
}

/**
 * Aplatit un Flow SANS Test ni `si` non résolu en une liste d'effets-feuilles (les `si` sont évalués
 * contre `ctx`). Couvre `sequence`/`effet`/`si`. Un nœud `test`/`choix` lève — son exécution est interactive
 * (store). Utile pour les consommateurs purement séquentiels et pour tester la résolution des branches `si`. */
export function flattenFlow<E = EffectOp>(flow: Flow<E>, ctx: ConditionCtx): E[] {
  switch (flow.kind) {
    case 'effet': return [flow.effet];
    case 'sequence': return flow.etapes.flatMap((s) => flattenFlow(s, ctx));
    case 'si': {
      const branch = evalCondition(flow.condition, ctx) ? flow.alors : flow.sinon;
      return branch ? flattenFlow(branch, ctx) : [];
    }
    case 'test':
      throw new Error('flattenFlow: un nœud `test` est interactif — utiliser runFlow (store).');
    case 'choix':
      throw new Error('flattenFlow: un nœud `choice` est interactif — utiliser runFlow (store).');
  }
}

/** Effets `effet` de PREMIER niveau d'un Flow (`sequence` plate) — édition en liste + assertions (≡ ancien `effects`). */
export function flowEffects<E = EffectOp>(flow: Flow<E>): E[] {
  return flow.kind === 'effet' ? [flow.effet] : flow.kind === 'sequence' ? flow.etapes.flatMap((s) => (s.kind === 'effet' ? [s.effet] : [])) : [];
}

/** La feuille est-elle un `EffectOp` (`{type:'ops'}`) ? Garde STRUCTURELLE — un `Flow<E>` générique peut
 *  porter d'autres feuilles (l'`Effect` complet côté state : transition/dialogue…), mais l'extraction
 *  d'ops ne concerne que les feuilles EffectOp. Source unique du narrowing pour les walkers ci-dessous. */
export function isEffectOp(e: unknown): e is EffectOp {
  return typeof e === 'object' && e !== null && (e as { type?: unknown }).type === 'ops';
}

/** GameOps des feuilles EffectOp d'un Flow de sort, filtrées par cible (`target`/`caster`). SOURCE
 *  UNIQUE de l'extraction des effets d'un sort depuis `SpellData.effects` : le cast flow applique un
 *  sous-Flow (target vs caster) via `runCombatFlow`, mais les badges UI (`spellSupport`) ont besoin de
 *  la liste d'ops. Visite récursive (les feuilles peuvent vivre sous si/test). `on` absent ⇒ `target`. */
export function spellOps<E = EffectOp>(flow: Flow<E> | undefined, on: 'target' | 'caster'): GameOp[] {
  if (!flow) return [];
  const out: GameOp[] = [];
  walkFlow(flow, (n) => {
    if (n.kind !== 'effet') return;
    const e = n.effet;
    if (isEffectOp(e) && (e.on ?? 'target') === on) out.push(...e.ops);
  });
  return out;
}

/** TOUTES les ops EffectOp d'un Flow de sort (target + caster) — pour qualifier la mécanisation d'un
 *  sort (`spellSupport`) sans privilégier une cible : un effet de lanceur (invocation, zone, vol de
 *  vie) compte autant qu'un effet de cible. */
export function spellEffectOps<E = EffectOp>(flow: Flow<E> | undefined): GameOp[] {
  return [...spellOps(flow, 'target'), ...spellOps(flow, 'caster')];
}

/**
 * OPS CERTAINES d'une branche de Flow (#1117, régime `calcule`) — la liste des `GameOp` que CETTE
 * branche appliquera À COUP SÛR, pour que l'encadré « Réussite / Échec » d'un jet se CALCULE des ops
 * au lieu d'être écrit à la main : une phrase stockée ment dès qu'une règle optionnelle change les
 * ops appliquées, une dérivation ne le peut pas.
 *
 * FAIL-CLOSED : rend `undefined` dès qu'un nœud rend l'issue INCERTAINE — un `si` non résolu (la
 * branche dépend d'une Condition), un `test` imbriqué (un second jet), un `choix` (une décision à
 * venir), ou une feuille qui n'est pas une liste d'ops (transition, dialogue). Aplatir
 * ces cas produirait un encadré qui PROMET ce qui ne se produira peut-être pas. Une branche vide rend
 * `[]` (« rien ne se produit »), qui est une réponse, pas une absence. PURE.
 *
 * `evalCond` (optionnel) — ORACLE PARTIEL de Condition : il rend `true`/`false` UNIQUEMENT pour ce
 * qu'il sait trancher hors exécution, et `undefined` pour tout le reste. Ce troisième cas est le
 * cœur du contrat : un évaluateur TOTAL (qui répondrait `false` faute de contexte) ferait promettre
 * la branche `sinon` d'une Condition qu'il n'a pas su lire — l'encadré enseignerait une règle
 * AMPUTÉE. Ici, `undefined` ⇒ le `si` reste incertain ⇒ la branche entière se tait. Sans `evalCond`,
 * tout `si` est incertain (comportement d'origine). Un `si` sans `sinon` dont la Condition est
 * FAUSSE de façon tranchée rend `[]` : rien ne s'applique, c'est une réponse.
 *
 * PORTÉE de la certitude : elle est STRUCTURELLE — elle porte sur la FORME du Flow (`effet`+ops sans
 * `test`/`choix`/`si` non résolu en amont), jamais sur le contenu d'une op. Une op dont l'effet est
 * conditionné EN INTERNE (garde dans son propre payload) est rendue comme certaine : sa certitude relève
 * de son exécuteur, `applyOps`. Une op qui doit annoncer une issue conditionnelle expose sa condition
 * dans la STRUCTURE du Flow (`si`), où cette fonction la lit.
 */
export function certainFlowOps<E = EffectOp>(
  flow: Flow<E> | undefined,
  evalCond?: (cond: Condition) => boolean | undefined,
): GameOp[] | undefined {
  if (!flow) return undefined;
  if (flow.kind === 'sequence') {
    const out: GameOp[] = [];
    for (const s of flow.etapes) {
      const ops = certainFlowOps(s, evalCond);
      if (!ops) return undefined;
      out.push(...ops);
    }
    return out;
  }
  if (flow.kind === 'effet') return isEffectOp(flow.effet) ? [...flow.effet.ops] : undefined;
  if (flow.kind === 'si' && evalCond) {
    const verdict = evalCond(flow.condition);
    if (verdict === undefined) return undefined; // l'oracle ne sait pas : on se tait, on ne suppose pas
    const branch = verdict ? flow.alors : flow.sinon;
    return branch ? certainFlowOps(branch, evalCond) : [];
  }
  return undefined;
}

/** Sous-Flow d'un Flow de sort ne gardant que les nœuds adressant `on` (target/caster) — pour appliquer
 *  SÉPARÉMENT les effets de cible (par cible, missile/soutien) et ceux du lanceur (une fois). Un `effet` ops
 *  d'un AUTRE `on` devient un `sequence` vide (neutre) ; un `effet` non-ops est rattaché à la cible. Un nœud
 *  INTERACTIF (`test`, `choix`) se joue dans UNE seule passe, ENTIER (ses feuilles des deux `on`, que
 *  `runCombatFlow` adresse chacune à son porteur) : celle de la cible dès qu'il porte une feuille de
 *  cible ou n'en porte aucune, celle du lanceur sinon. Une décision ou un jet n'est ainsi jamais joué deux
 *  fois pour une même cible : la passe de cible se rejoue, elle, à chaque cible du lancement. */
export function spellFlowFor<E = EffectOp>(flow: Flow<E> | undefined, on: 'target' | 'caster'): Flow<E> {
  if (!flow) return { kind: 'sequence', etapes: [] };
  const feuilleDe = (f: Extract<Flow<E>, { kind: 'effet' }>): 'target' | 'caster' =>
    (isEffectOp(f.effet) ? (f.effet.on ?? 'target') : 'target') === 'caster' ? 'caster' : 'target';
  const porte = (f: Flow<E>, cote: 'target' | 'caster'): boolean => {
    let oui = false;
    walkFlow(f, (n) => { if (n.kind === 'effet' && feuilleDe(n) === cote) oui = true; });
    return oui;
  };
  const vide: Flow<E> = { kind: 'sequence', etapes: [] };
  const keep = (f: Flow<E>): Flow<E> => {
    switch (f.kind) {
      case 'effet': return feuilleDe(f) === on ? f : vide;
      case 'sequence': return { kind: 'sequence', etapes: f.etapes.map(keep) };
      case 'si': return { kind: 'si', condition: f.condition, alors: keep(f.alors), ...(f.sinon ? { sinon: keep(f.sinon) } : {}) };
      case 'test':
      case 'choix': {
        const passe = porte(f, 'target') || !porte(f, 'caster') ? 'target' : 'caster';
        return passe === on ? f : vide;
      }
    }
  };
  return keep(flow);
}

/** Visite toutes les fenêtres horaires d'une Condition (validation des bornes h/min). */
export function walkConditionTimes(cond: Condition, cb: (w: TemporalCondition) => void): void {
  switch (cond.kind) {
    case 'time': cb(cond.window); break;
    case 'all': case 'any': cond.of.forEach((c) => walkConditionTimes(c, cb)); break;
    case 'not': walkConditionTimes(cond.of, cb); break;
  }
}

/** Le Flow contient-il un nœud INTERACTIF — `test` (jet) ou `choix` (décision joueur) ? Si oui, son
 *  exécution doit passer par l'exécuteur interactif (`runFlow`/`runCombatFlow`), pas un aplatissage. */
export function flowHasTest<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'effet': return false;
    case 'sequence': return flow.etapes.some((s) => flowHasTest(s));
    case 'si': return flowHasTest(flow.alors) || (flow.sinon ? flowHasTest(flow.sinon) : false);
    case 'test': return true;
    case 'choix': return true;
  }
}

/** Ops IMPURES résolues par le do-loop de `runCombatFlow` (`grantFreeAttack` → frappe gratuite ;
 *  `interruptFocus` → interruption de Focalisation ; `breakBlade` ; `delayed` → file `scheduledEffects`
 *  via `scheduleDelayedOps`) : `applyOps` les laisse inertes. Source UNIQUE pour router une branche de
 *  `test` contenant l'une d'elles vers l'exécuteur IMPUR plutôt que `runPureFlowLines` (qui les avalerait). */
const HOOK_BACKED_OPS = new Set(['grantFreeAttack', 'interruptFocus', 'breakBlade', 'delayed']);

/** Op IMPURE : de `HOOK_BACKED_OPS`, de NAVIRE (`estOpDuNavire`), résolue sur la cible `navire` par
 *  `noyau/navireOps.ts`, de la BOURSE DU GROUPE (`estOpDeLaBourseDuGroupe`), du MARCHÉ D'UN PORT
 *  (`estOpDuMarche`) ou des ATTAQUES SUBIES (`estOpDAttaquesSubies`) — `applyOps` les laisse toutes inertes. */
const estOpImpure = (o: GameOp): boolean => HOOK_BACKED_OPS.has(o.op) || estOpDuNavire(o) || estOpDeLaBourseDuGroupe(o) || estOpDuMarche(o) || estOpDAttaquesSubies(o);

/** Le Flow porte-t-il une op IMPURE (cf. `estOpImpure`) ? Si oui, son exécution ne passe jamais par
 *  `runPureFlowLines`, qui l'avalerait. */
export function flowHasImpureOp<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'effet': { const e = flow.effet; return isEffectOp(e) && e.ops.some(estOpImpure); }
    case 'sequence': return flow.etapes.some((s) => flowHasImpureOp(s));
    case 'si': return flowHasImpureOp(flow.alors) || (flow.sinon ? flowHasImpureOp(flow.sinon) : false);
    case 'test': return flowHasImpureOp(flow.reussite) || flowHasImpureOp(flow.echec);
    case 'choix': return flowHasImpureOp(flow.oui) || (flow.non ? flowHasImpureOp(flow.non) : false);
  }
}

/** Ops IMPURES (`estOpImpure`) interdites HORS branche `reussite`/`echec` d'un nœud `test` dans un Flow d'effet
 *  DÉCLENCHÉ (`effects: TriggeredEffect[]`, traits/talents/atouts/États/psychologie…) — EXCLUT
 *  `grantFreeAttack`, légitime top-level (résolu par `resolveFreeAttacks`, cf. `flowHasFreeAttack`, ex.
 *  Frappe réactive). `interruptFocus`/`breakBlade`/`delayed` n'ont de hook que dans le do-loop de
 *  `runCombatFlow` AVEC son contexte de branche de Test résolue, les ops de navire n'en ont aucun ; placées
 *  ailleurs, `applyTriggeredEffects` (walker `runPureFlowLines`) les avale en silence (`applyOps` les laisse
 *  inertes). */
const estOpImpureErrante = (o: GameOp): boolean => o.op !== 'grantFreeAttack' && estOpImpure(o);

/** Le Flow porte-t-il une op IMPURE errante (`estOpImpureErrante`) EN DEHORS d'une branche `reussite`/`echec` de `test` ?
 *  `inTestBranch` (interne, propagé par la récursion) reste vrai tant qu'on n'est pas ressorti d'un nœud
 *  `test` — vérité utilisée par la garde de bien-formation des données (`effects` déclenchés). */
/**
 * Le Flow porte-t-il une op qui DEMANDE UN DÉ À LA PORTE (#1508, `ops.opDemandeUnDe`) ? Calque exact de
 * `flowHasImpureOp` : la même question, posée d'un autre canal.
 *
 * Ce que ça décide : une branche de Test qui en porte une NE PEUT PAS se jouer par le chemin PUR
 * (`runPureFlowLines` → `applyOps`), qui tirerait ses dés en silence — elle passe par le walker de
 * combat, dont le point d'application ANNONCE ses dés (`applyLeafOps`).
 */
export function flowHasOpADe<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'effet': { const e = flow.effet; return isEffectOp(e) && e.ops.some((o) => opDemandeUnDe(o)); }
    case 'sequence': return flow.etapes.some((s) => flowHasOpADe(s));
    case 'si': return flowHasOpADe(flow.alors) || (flow.sinon ? flowHasOpADe(flow.sinon) : false);
    case 'test': return flowHasOpADe(flow.reussite) || flowHasOpADe(flow.echec);
    case 'choix': return flowHasOpADe(flow.oui) || (flow.non ? flowHasOpADe(flow.non) : false);
  }
}

export function flowHasImpureOpOutsideTest<E = EffectOp>(flow: Flow<E>, inTestBranch = false): boolean {
  switch (flow.kind) {
    case 'effet': {
      if (inTestBranch) return false;
      const e = flow.effet;
      return isEffectOp(e) && e.ops.some(estOpImpureErrante);
    }
    case 'sequence': return flow.etapes.some((s) => flowHasImpureOpOutsideTest(s, inTestBranch));
    case 'si': return flowHasImpureOpOutsideTest(flow.alors, inTestBranch) || (flow.sinon ? flowHasImpureOpOutsideTest(flow.sinon, inTestBranch) : false);
    case 'test': return flowHasImpureOpOutsideTest(flow.reussite, true) || flowHasImpureOpOutsideTest(flow.echec, true);
    case 'choix': return flowHasImpureOpOutsideTest(flow.oui, inTestBranch) || (flow.non ? flowHasImpureOpOutsideTest(flow.non, inTestBranch) : false);
  }
}

/** Le Flow accorde-t-il une ATTAQUE GRATUITE (op `grantFreeAttack`, à quelque profondeur) ? Un tel Flow
 *  cible un TIERS (le chargeur/la victime) et exige le contexte `freeAttack` → il est joué par le
 *  résolveur d'attaques gratuites (`resolveFreeAttacks`), seul à l'émettre ; le dispatcher générique le saute. */
export function flowHasFreeAttack<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'effet': { const e = flow.effet; return isEffectOp(e) && e.ops.some((o) => o.op === 'grantFreeAttack'); }
    case 'sequence': return flow.etapes.some((s) => flowHasFreeAttack(s));
    case 'si': return flowHasFreeAttack(flow.alors) || (flow.sinon ? flowHasFreeAttack(flow.sinon) : false);
    case 'test': return flowHasFreeAttack(flow.reussite) || flowHasFreeAttack(flow.echec);
    case 'choix': return flowHasFreeAttack(flow.oui) || (flow.non ? flowHasFreeAttack(flow.non) : false);
  }
}

/** Constructeur d'un nœud `test` (jet → réussite/échec). Sucre pour les PRODUCTEURS de Flow (récolte,
 *  saut…) : un jet se POSE en nœud de Flow, jamais poussé dans une liste d'effets. */
export function testFlow<E = EffectOp>(test: FlowTest, success: Flow<E>, fail: Flow<E>): Flow<E> {
  return { kind: 'test', test, reussite: success, echec: fail };
}

/**
 * Pose l'ENJEU (#1117) d'un `FlowTest` — RÈGLE UNIQUE des deux étages d'enjeu : un enjeu DÉJÀ
 * déclaré (dataset nommé par le producteur, `AuthoredStake` écrit par un document) PRIME toujours ;
 * à défaut, `stake` s'applique. Aucun enjeu à poser, ou enjeu déjà là : le `FlowTest` ressort
 * IDENTIQUE.
 *
 * Deux provenances de `stake` composent cette règle, et elles seules :
 *  - le PRODUCTEUR moteur nomme son dataset au moment où il fabrique le nœud — un nœud venu d'un
 *    `.json` porte ses branches mais ignore la rangée à laquelle il appartient (`miscast.ts` `mkTest`) ;
 *  - la couche `state` le DÉRIVE du porteur qui exige le jet (`withDerivedStake`,
 *    `src/noyau/combat/triggeredTest.ts`).
 * PUR. Les six porteurs de nœud `test` du moteur passent par ici pour nommer ce qui se joue :
 * rangée d'Imparfaite (`miscast.json`), rangée de Critique (`criticals.json`), coup à l'équipage
 * (`river-criticals.json`, `ship-criticals.json`), cycle de maladie (`symptoms.json`,
 * `maladies.json`) et escalade de séquelle (`Trauma.critTrigger`, nœud de RUNTIME — porté par
 * l'instance de Trauma, hors cardinal authoré).
 */
export function poserEnjeu(test: FlowTest, stake: StakeRef | undefined): FlowTest {
  if (test.stake || !stake) return test;
  return { ...test, stake };
}

/** Champ COMPAGNON obligatoire de chaque forme de nœud (`Flow`) — le second critère de reconnaissance :
 *  un `kind` seul ne suffit pas (l'algèbre des `Condition` en porte un aussi, et rien n'interdit à une
 *  donnée future de nommer un champ `kind`). Un objet qui a LES DEUX est un nœud de Flow. */
const FLOW_SHAPE: { readonly [K in Flow['kind']]: Exclude<keyof Extract<Flow, { kind: K }>, 'kind'> } = { sequence: 'etapes', effet: 'effet', si: 'alors', test: 'reussite', choix: 'oui' };

/** Cette valeur EST-elle un nœud de Flow ? Reconnaissance par la FORME (kind + champ compagnon), jamais
 *  par l'endroit où on l'a trouvée. PURE. */
export function isFlowNode(v: unknown): v is Flow<unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const kind = (v as { kind?: unknown }).kind;
  return typeof kind === 'string' && kind in FLOW_SHAPE && FLOW_SHAPE[kind as Flow['kind']] in (v as object);
}

/**
 * Flows PORTÉS par une feuille d'effet, trouvés PAR LA FORME — un effet peut en embarquer (l'échéance
 * d'un `delayedEffect`, la récompense d'une `petitePriere`), et rien dans le vocabulaire des effets ne
 * les DÉCLARE : ce sont des champs `Flow` ordinaires, sur n'importe quel type, à n'importe quelle
 * profondeur. Une liste nominative de types porteurs serait donc périmée au prochain effet écrit — et
 * ce qui échappe à ce parcours échappe à TOUTE validation d'arbre (jets muets compris).
 *
 * Le parcours descend dans les objets et tableaux de la feuille, s'arrête au PREMIER nœud rencontré
 * (l'arbre sous lui est celui de `walkFlow`, qui le reprendra), et se protège des cycles. PURE.
 */
export function carriedFlows<E>(effect: E): { flow: Flow<E>; chemin: CheminDeFlow }[] {
  const out: { flow: Flow<E>; chemin: CheminDeFlow }[] = [];
  const seen = new Set<object>();
  const walk = (v: unknown, chemin: CheminDeFlow) => {
    if (v == null || typeof v !== 'object' || seen.has(v as object)) return;
    seen.add(v as object);
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, [...chemin, i])); return; }
    if (isFlowNode(v)) { out.push({ flow: v as Flow<E>, chemin }); return; }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, [...chemin, k]);
  };
  walk(effect, []);
  return out;
}
/** Chemin d'un nœud depuis la racine qu'on parcourt (clés et rangs), ex. `['etapes', 1, 'alors']`. */
export type CheminDeFlow = readonly (string | number)[];

/** Genre du porteur d'une racine de Flow de scène — les portées de `Warning` de `validateScene`. */
export type GenreDeRacineDeFlow = 'trigger' | 'entity' | 'dialogue' | 'encounter';

/** Une racine de Flow d'une scène : l'arbre (non vérifié), son chemin depuis la scène, son porteur. */
export interface RacineDeFlow {
  readonly flow: unknown;
  readonly chemin: CheminDeFlow;
  readonly porteur: { readonly genre: GenreDeRacineDeFlow; readonly id: string };
}

const listeDe = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objetDe = (v: unknown): Record<string, unknown> =>
  estObjet(v) ? v : {};
const idDe = (v: Record<string, unknown>): string => (typeof v.id === 'string' ? v.id : '?');

/**
 * Les RACINES de Flow authoré d'une scène, dans l'ordre du document : déclencheurs, actions d'entité
 * (`usable.actions`), choix de dialogue, `onVictory` de rencontre. Une racine absente n'est pas rendue.
 * Tolère un document brut (avant `normalizeScene`, collections optionnelles) ; la FORME de chaque
 * `flow` rendu n'est pas vérifiée. Les Flows PORTÉS par une feuille sont ceux de `carriedFlows`. PURE.
 */
export function racinesDeFlow(scene: unknown): RacineDeFlow[] {
  const sc = objetDe(scene);
  const out: RacineDeFlow[] = [];
  const pousse = (flow: unknown, chemin: CheminDeFlow, genre: GenreDeRacineDeFlow, id: string) => {
    if (flow !== undefined) out.push({ flow, chemin, porteur: { genre, id } });
  };
  listeDe(sc.triggers).forEach((t, i) => pousse(objetDe(t).flow, ['triggers', i, 'flow'], 'trigger', idDe(objetDe(t))));
  listeDe(sc.entities).forEach((e, i) =>
    listeDe(objetDe(objetDe(e).usable).actions).forEach((a, j) =>
      pousse(objetDe(a).flow, ['entities', i, 'usable', 'actions', j, 'flow'], 'entity', `${idDe(objetDe(e))}›${idDe(objetDe(a))}`),
    ),
  );
  listeDe(sc.dialogues).forEach((d, i) =>
    listeDe(objetDe(d).nodes).forEach((n, j) =>
      listeDe(objetDe(n).choices).forEach((c, k) =>
        pousse(objetDe(c).flow, ['dialogues', i, 'nodes', j, 'choices', k, 'flow'], 'dialogue', idDe(objetDe(d))),
      ),
    ),
  );
  listeDe(sc.encounters).forEach((e, i) => pousse(objetDe(e).onVictory, ['encounters', i, 'onVictory'], 'encounter', idDe(objetDe(e))));
  return out;
}
/** RÉÉCRITURE d'un Flow, des feuilles vers la racine : `f` reçoit chaque nœud, ses branches déjà réécrites.
 *  Immuable (copie). */
export function reecrireFlow<E = EffectOp>(flow: Flow<E>, f: (node: Flow<E>) => Flow<E>): Flow<E> {
  switch (flow.kind) {
    case 'sequence': return f({ ...flow, etapes: flow.etapes.map((s) => reecrireFlow(s, f)) });
    case 'si': return f({ ...flow, alors: reecrireFlow(flow.alors, f), ...(flow.sinon ? { sinon: reecrireFlow(flow.sinon, f) } : {}) });
    case 'test': return f({ ...flow, reussite: reecrireFlow(flow.reussite, f), echec: reecrireFlow(flow.echec, f) });
    case 'choix': return f({ ...flow, oui: reecrireFlow(flow.oui, f), ...(flow.non ? { non: reecrireFlow(flow.non, f) } : {}) });
    case 'effet': return f(flow);
  }
}

/** Les ops des feuilles EffectOp d'un Flow, réécrites par `f` ; une op rendue `null` tombe, une liste prend
 *  sa place. Immuable. */
export function reecrireLesOps<E = EffectOp>(flow: Flow<E>, f: (op: GameOp) => GameOp | GameOp[] | null): Flow<E> {
  return reecrireFlow(flow, (n) => (n.kind === 'effet' && isEffectOp(n.effet)
    ? { ...n, effet: { ...n.effet, ops: n.effet.ops.flatMap((o) => f(o) ?? []) } }
    : n));
}

/** Les valeurs LIÉES d'un Flow (`TermeLie`, `engine/ops.ts`) : leurs définitions `{tire, de}` par nom, et les
 *  noms relus `{tire}` sans définition. Une définition en double lève. PUR. */
export function tiragesDuFlow(flow: unknown): { definitions: Map<string, Formula>; nonLies: string[] } {
  const definitions = new Map<string, Formula>();
  const lus = new Set<string>();
  const visiter = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(visiter); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.tire === 'string') {
      if (o.de === undefined) { lus.add(o.tire); return; }
      if (definitions.has(o.tire)) throw new Error(`#1652 — valeur liée « ${o.tire} » définie deux fois dans le même Flow.`);
      definitions.set(o.tire, o.de as Formula);
      return;
    }
    Object.values(o).forEach(visiter);
  };
  visiter(flow);
  return { definitions, nonLies: [...lus].filter((n) => !definitions.has(n)) };
}

/** LIE les valeurs tirées d'un Flow : chaque définition `{tire, de}` est tirée UNE fois par `valeurDe`, au départ
 *  du Flow et dans l'ordre du document, puis chaque `{tire}` (définition ou relecture) devient sa valeur.
 *  Un Flow sans valeur liée ressort tel quel ; une relecture sans définition lève. Immuable. MDG 15 l.245 */
export function lierLesTirages<E>(flow: Flow<E>, valeurDe: (de: Formula) => number): Flow<E> {
  const { definitions, nonLies } = tiragesDuFlow(flow);
  if (nonLies.length) throw new Error(`#1652 — valeur(s) liée(s) relue(s) sans définition dans le Flow : ${nonLies.join(', ')}.`);
  if (!definitions.size) return flow;
  const valeurs = new Map([...definitions].map(([nom, de]) => [nom, valeurDe(de)]));
  const lier = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(lier);
    if (!v || typeof v !== 'object') return v;
    const o = v as Record<string, unknown>;
    if (typeof o.tire === 'string') return valeurs.get(o.tire);
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, lier(x)]));
  };
  return lier(flow) as Flow<E>;
}

/** Visite RÉCURSIVE de tous les nœuds d'un Flow (branches `si`/`test` comprises) — pour la validation
 *  (effets référencés, bornes des conditions horaires) sur l'arbre ENTIER, pas seulement le 1er niveau.
 *  `visit` reçoit aussi le CHEMIN du nœud depuis `flow`, pour qui doit nommer un nœud fautif. */
export function walkFlow<E = EffectOp>(flow: Flow<E>, visit: (node: Flow<E>, chemin: CheminDeFlow) => void, chemin: CheminDeFlow = []): void {
  visit(flow, chemin);
  switch (flow.kind) {
    case 'sequence': flow.etapes.forEach((s, i) => walkFlow(s, visit, [...chemin, 'etapes', i])); break;
    case 'si': walkFlow(flow.alors, visit, [...chemin, 'alors']); if (flow.sinon) walkFlow(flow.sinon, visit, [...chemin, 'sinon']); break;
    case 'test': walkFlow(flow.reussite, visit, [...chemin, 'reussite']); walkFlow(flow.echec, visit, [...chemin, 'echec']); break;
    case 'choix': walkFlow(flow.oui, visit, [...chemin, 'oui']); if (flow.non) walkFlow(flow.non, visit, [...chemin, 'non']); break;
    case 'effet': break;
  }
}

/** `flow` ne porte-t-il QUE des feuilles `F` ? Rétrécit le Flow de scène qu'écrit l'éditeur au Flow d'un porteur à
 *  feuilles restreintes (effet déclenché : `EffectOp`). */
export function flowDeFeuilles<E, F extends E>(flow: Flow<E>, estFeuille: (e: E) => e is F): flow is Flow<F> {
  let toutes = true;
  walkFlow(flow, (n) => { if (n.kind === 'effet' && !estFeuille(n.effet)) toutes = false; });
  return toutes;
}

/** Arrêt d'une exécution de Flow : `executerFlow` rend `arret` sans jouer le reste de sa pile. */
export interface ArretDeFlow<R> { readonly arret: R }

/** Ce qu'un hôte fait d'un nœud : rien (la marche poursuit), un Flow joué en TÊTE de la pile, ou l'arrêt. */
export type PasDeFlow<E, R> = Flow<E> | ArretDeFlow<R> | undefined;

/** Le reste de la pile, retiré d'elle : la CONTINUATION qu'un hôte qui suspend confie à sa reprise. */
export type ResteDuFlow<E> = () => Extract<Flow<E>, { kind: 'sequence' }>;

/** Ce qu'`executerFlow` délègue à son HÔTE ; la marche décide seule `sequence` et `si`. */
export interface HoteDeFlow<E, R> {
  /** Contexte des Conditions d'un `si`, lu au nœud : l'état vivant peut avoir bougé depuis le départ. */
  conditions(): ConditionCtx;
  feuille(noeud: Extract<Flow<E>, { kind: 'effet' }>, reste: ResteDuFlow<E>): PasDeFlow<E, R>;
  test(noeud: FlowTestNode<E>, reste: ResteDuFlow<E>): PasDeFlow<E, R>;
  choix(noeud: Extract<Flow<E>, { kind: 'choix' }>, reste: ResteDuFlow<E>): PasDeFlow<E, R>;
  /** Avant chaque DÉCISION (`si`, `test`, `choix`) ; le nœud, non consommé, n'est pas dans `reste()`. */
  avantDecision?(noeud: Flow<E>, reste: ResteDuFlow<E>): ArretDeFlow<R> | undefined;
  /** Valeur rendue quand la pile est épuisée. */
  fin(): R;
}

/** EXÉCUTION d'un Flow, à PILE : `sequence` empile ses étapes, `si` sa branche ; le reste va à l'hôte. */
export function executerFlow<E, R>(flow: Flow<E>, hote: HoteDeFlow<E, R>): R {
  const pile: Flow<E>[] = [flow];
  const reste: ResteDuFlow<E> = () => ({ kind: 'sequence', etapes: pile.splice(0) });
  for (let noeud = pile.shift(); noeud; noeud = pile.shift()) {
    let pas: PasDeFlow<E, R>;
    switch (noeud.kind) {
      case 'sequence': pile.unshift(...noeud.etapes); continue;
      case 'effet': pas = hote.feuille(noeud, reste); break;
      case 'si': pas = hote.avantDecision?.(noeud, reste) ?? (evalCondition(noeud.condition, hote.conditions()) ? noeud.alors : noeud.sinon); break;
      case 'test': pas = hote.avantDecision?.(noeud, reste) ?? hote.test(noeud, reste); break;
      case 'choix': pas = hote.avantDecision?.(noeud, reste) ?? hote.choix(noeud, reste); break;
    }
    if (pas && 'arret' in pas) return pas.arret;
    if (pas) pile.unshift(pas);
  }
  return hote.fin();
}
