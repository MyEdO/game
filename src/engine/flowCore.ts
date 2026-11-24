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
import type {
  ArbreDeFlow,
  EffetDeclencheMoteur,
  JetDecidable,
  Condition,
  effectTargetingSchema,
  effectTriggerSchema,
  flowTestSchema,
  testFixeSchema,
} from '../data/schemas/grammaire/mecanique';
import { toDate } from './clock';
import type { CharKey, EffectSource, HitLocation } from './types';
import { relationBetween, type Camp } from './relations';
import { groupMatch } from './groups';
import {
  estOpDAttaquesSubies,
  estOpDeLaBourseDuGroupe,
  estOpDuMarche,
  estOpDuNavire,
  opDemandeUnDe,
} from './faitsDOp';
import { valeurNonLiee } from './formule';
import type { Formula, GameOp } from './ops';
import type { CibleEnVue } from './psychology';
import { refCouvre, type Id } from '../data/schemas/grammaire/ref';
// Type SEUL (effacé à la compilation — aucun cycle runtime) : `StakeRef` est la forme canonique de la
// zone d'enjeu, et la redéclarer ici serait la 2ᵉ source du même vocabulaire que #1117 combat.
import type { StakeRef } from '../data';
import { actorStatus, statusMeets, type PorteurDeStatut } from './social';
import { gelerLaConstante } from '../lib/gelerProfond';
import { estObjet } from '../lib/objet.mjs';

export { poserEnjeu } from './enjeuDuTest';

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
 *  campagne, `noyau/navireOps.ts`), `testeur` (scène, branche d'un Test : cuit par `avecLeTesteur`) ou
 *  `caster`/`target` (contexte d'incantation, résolu par le flux de sort). */
export interface EffectOp {
  type: 'ops';
  ops: GameOp[];
  on?: 'groupe' | 'heros' | 'navire' | 'membreAuHasard' | 'testeur' | 'caster' | 'target' | CibleDeRole | CibleDeVolontaires;
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
  /** L'acteur est-il un NAVIRE (`estNavire`) ? Lu par la Condition `navire`. */
  navire?: boolean;
}

/** SÉLECTEUR de héros d'une Condition de groupe : un héros au moins (`any`), tout le groupe (`all`), ou
 *  le héros que DÉSIGNE l'état de campagne `etat` (forme `heros`, `GameState.etats`) — EDO 02 l.91.
 *  Référence non désignée → le prédicat sélectionné est faux. */
export type PartySelector = 'any' | 'all' | { etat: string };

export type { Condition } from '../data/schemas/grammaire/mecanique';

/** Contexte d'évaluation d'une Condition (lecture seule) — ensemble CLOS : drapeaux, horloge, et état
 *  VIVANT du groupe (mort/inventaire/bourse). `party`/`money` absents → les conditions d'état sont false. */
export interface ConditionCtx {
  flags: Record<string, boolean>;
  gameTime: number;
  party?: { id?: string; dead?: boolean; items?: { trappingId?: string }[];
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
      const id = cond.objet.id;
      const have = (ctx.party ?? []).reduce((n, h) => n + (h.items ?? []).filter((it) => it.trappingId === id).length, 0);
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
      if (cond.what === 'group') return groupMatch(cond.ref.id, a.groups);
      if (cond.what === 'talent') return a.talents.some((t) => refCouvre(cond.ref, t));
      if (cond.what === 'psych') return (a.psych ?? []).includes(cond.ref.id);
      if (cond.what === 'immunity') return (a.immunities ?? []).includes(cond.ref.id);
      return a.traits.includes(cond.ref.id);
    }
    case 'casterChaosDomain': return ctx.caster?.chaosDomain === cond.is;
    case 'visiblePassive': return (cond.who === 'caster' ? ctx.caster : ctx.target)?.visiblePassive === true;
    case 'navire': return (cond.who === 'caster' ? ctx.caster : ctx.target)?.navire === true;
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

/** Spécification d'un jet de compétence/caractéristique différé (→ modale) : la sortie de `flowTestSchema`
 *  (`data/schemas/grammaire/mecanique.ts`), sans les branches (portées par le nœud Flow `test`), dont l'enjeu
 *  s'élargit aux formes du MOTEUR (`StakeRef` : valeurs calculées, enjeu dérivé du porteur). Sa décision
 *  comporte les Conditions que le moteur évalue (`JetDecidable`). */
export interface FlowTest extends Omit<z.output<typeof flowTestSchema>, 'stake' | keyof JetDecidable>, JetDecidable {
  stake?: StakeRef;
}

/** Les champs de la DÉCISION d'un `FlowTest`, lus par `resoudreFlowTest` (`engine/decisionDuTest.ts`) seul. */
export const CHAMPS_DE_DECISION = ['gate', 'onlyGroups', 'exceptGroups', 'difficultyBy', 'easierIf'] satisfies readonly (keyof FlowTest)[];
/** Un champ de `CHAMPS_DE_DECISION`. */
export type ChampDeDecision = (typeof CHAMPS_DE_DECISION)[number];

/** Le Test que son PORTEUR fixe (`testFixeSchema`, `porteurDeTestFixe`, `grammaire/mecanique.ts`) : les champs `K`
 *  exigés, aucune décision. */
export type JetFixe<K extends 'skill' | 'difficulty' = never> = z.output<typeof testFixeSchema> & Required<Pick<z.output<typeof testFixeSchema>, K>>;

/**
 * Un nœud de Flow, GÉNÉRIQUE sur le type de sa FEUILLE `E` (défaut `EffectOp` — engine pur ; la couche
 * `state` instancie `Flow<Effect>`), du Test `T` de ses nœuds `test` et du coût d'Avantage `C` de ses
 * `choix`, et de la Condition `D` des nœuds `si`. `arbreDeFlow` (`grammaire/mecanique.ts`) compose les
 * sorties de ces schémas dans chaque arbre (par exemple le Flow de scène, `FlowDeScene`). Cinq formes, RÉCURSIVES, jamais cycliques :
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
export type Flow<E = EffectOp, T = FlowTest, C = number | IndiceTemplate, D = Condition> = ArbreDeFlow<E, T, C, D>;

/** TEMPLATE d'instance du coût d'Avantage d'un `choix` : l'Indice de l'entité PORTEUSE (Taillade 1A/2A,
 *  `AA 08 l.87`), substitué par `withArg` (`noyau/triggeredEffects`) avant exécution. Resté tel quel, le
 *  nœud n'est PAS offert (`resolveFlowChoice`) — jamais un coût 0. */
export const INDICE_TEMPLATE = '$indice';
export type IndiceTemplate = typeof INDICE_TEMPLATE;

/** TEMPLATE d'instance d'un champ d'op : l'ARGUMENT de l'entité PORTEUSE (trait Maladie « (peste) » →
 *  `exposeDisease{disease: ARG_TEMPLATE}`), substitué par `withArg` (`noyau/triggeredEffects`) avant
 *  exécution. Même mécanisme qu'`INDICE_TEMPLATE`, pour l'arg au lieu de l'Indice. */
export const ARG_TEMPLATE = '$arg';

/** Le NŒUD `test` seul — la forme UNIQUE du jet en donnée (jet + conséquence des deux branches), telle
 *  qu'un porteur l'épingle hors d'un Flow complet (rangée de Critique, cycle de maladie). */
export type FlowTestNode<E = EffectOp, T = FlowTest, C = number | IndiceTemplate, D = Condition> = Extract<Flow<E, T, C, D>, { kind: 'test' }>;

/** Flow vide (séquence sans étape) — neutre, sûr comme valeur par défaut d'un consommateur. Partagé
 *  par la donnée comme par l'état : gelé à sa définition (#2097). */
export const EMPTY_FLOW = gelerLaConstante<{ kind: 'sequence'; etapes: [] }>({ kind: 'sequence', etapes: [] });

/** DÉCLENCHEUR d'un effet déclenché : la sortie d'`effectTriggerSchema` (`data/schemas/grammaire/mecanique.ts`). */
export type EffectTrigger = z.output<typeof effectTriggerSchema>;

/** CIBLE(S) d'un effet déclenché : la sortie d'`effectTargetingSchema` (`data/schemas/grammaire/mecanique.ts`). */
export type EffectTargeting = z.output<typeof effectTargetingSchema>;

/** Effet DÉCLENCHÉ : la sortie de `triggeredEffectSchema` (`data/schemas/grammaire/mecanique.ts`), plus ce que le
 *  jeu lui pose. */
export type TriggeredEffect = EffetDeclencheMoteur & {
  /** ENTITÉ SOURCE — JAMAIS authorée : posée à l'ÉNUMÉRATION par `effectSourcesOf`
   *  (`src/noyau/triggeredEffects.ts`), qui seule sait de quelle entité l'effet est tiré. Voyage jusqu'à
   *  l'`OpsCtx` du dispatch → ancre les `ActiveEffect` posés sur leur fiche de règle. */
  source?: EffectSource;
};

/** Enveloppe une liste d'effets-feuilles (`Effect[]`) en un Flow `sequence` de `effet` — pont de
 *  migration des consommateurs (`Trigger.effects`, `DialogueChoice.effects`) vers le Flow, sans réécrire
 *  la donnée. GÉNÉRIQUE sur la feuille (défaut `EffectOp`). */
export function flowFromEffects<E = EffectOp, T = FlowTest, C = number | IndiceTemplate>(effects: E[] | undefined): Flow<E, T, C, never> {
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
  const out: GameOp[] = [];
  const complet = walkFlow(flow, (noeud) => {
    switch (noeud.kind) {
      case 'sequence': return;
      case 'effet':
        if (!isEffectOp(noeud.effet)) return 'stop';
        out.push(...noeud.effet.ops);
        return;
      case 'si': {
        const verdict = evalCond?.(noeud.condition);
        if (verdict === undefined) return 'stop';
        return verdict ? 'alors' : 'sinon';
      }
      case 'test':
      case 'choix':
        return 'stop';
      default:
        noeud satisfies never;
        return 'stop';
    }
  });
  return complet ? out : undefined;
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
 *  via `scheduleDelayedOps` ; `zone` → crochet `OpsCtx.onZone` de `applyLeafOps`) : `applyOps` les laisse inertes. Source UNIQUE pour router une branche de
 *  `test` contenant l'une d'elles vers l'exécuteur IMPUR plutôt que `runPureFlowLines` (qui les avalerait). */
const HOOK_BACKED_OPS = new Set(['grantFreeAttack', 'interruptFocus', 'breakBlade', 'delayed', 'zone']);

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
 *  Frappe réactive), et `zone`, légitime top-level (`applyTriggeredEffects` route son Flow vers `runCombatFlow`).
 *  `interruptFocus`/`breakBlade`/`delayed` n'ont de hook que dans le do-loop de
 *  `runCombatFlow` AVEC son contexte de branche de Test résolue, les ops de navire n'en ont aucun ; placées
 *  ailleurs, `applyTriggeredEffects` (walker `runPureFlowLines`) les avale en silence (`applyOps` les laisse
 *  inertes). */
const estOpImpureErrante = (o: GameOp): boolean => o.op !== 'grantFreeAttack' && o.op !== 'zone' && estOpImpure(o);

/** Le Flow porte-t-il une op IMPURE errante (`estOpImpureErrante`) EN DEHORS d'une branche `reussite`/`echec` de `test` ?
 *  `inTestBranch` (interne, propagé par la récursion) reste vrai tant qu'on n'est pas ressorti d'un nœud
 *  `test` — vérité utilisée par la garde de bien-formation des données (`effects` déclenchés). */
/**
 * Le Flow porte-t-il une op qui DEMANDE UN DÉ À LA PORTE (#1508, `opDemandeUnDe`) ? Calque exact de
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
export function testFlow<E = EffectOp, T = FlowTest, C = number | IndiceTemplate, D = Condition>(
  test: T, success: Flow<E, T, C, D>, fail: Flow<E, T, C, D>,
): FlowTestNode<E, T, C, D> {
  return { kind: 'test', test, reussite: success, echec: fail };
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
/** La branche `flow` d'un Test jeté par `heroId`, chaque feuille `on:'testeur'` cuite sur lui (`on:'heros'`, `heroId`) ;
 *  les branches d'un `test` imbriqué cuisent à leur propre résolution, sur leur testeur. Immuable. #4834 */
export function avecLeTesteur<E, T, C, D>(flow: ArbreDeFlow<E, T, C, D>, heroId: string): ArbreDeFlow<E, T, C, D> {
  switch (flow.kind) {
    case 'sequence': return { ...flow, etapes: flow.etapes.map((s) => avecLeTesteur(s, heroId)) };
    case 'si': return { ...flow, alors: avecLeTesteur(flow.alors, heroId), ...(flow.sinon ? { sinon: avecLeTesteur(flow.sinon, heroId) } : {}) };
    case 'choix': return { ...flow, oui: avecLeTesteur(flow.oui, heroId), ...(flow.non ? { non: avecLeTesteur(flow.non, heroId) } : {}) };
    case 'test': return flow;
    case 'effet': return isEffectOp(flow.effet) && flow.effet.on === 'testeur' ? { ...flow, effet: { ...flow.effet, on: 'heros', heroId } } : flow;
  }
}

/** Les chemins des feuilles `on:'testeur'` de `flow` qu'aucun Test à testeur unique ne porte : le nœud `test` le plus
 *  proche au-dessus d'elles manque, ou c'est un Test d'équipage (`crewTestType`, N marins). #4834 */
export function testeursHorsDeLeurTest<E, T extends { crewTestType?: unknown }, C, D>(
  flow: ArbreDeFlow<E, T, C, D>,
  chemin: CheminDeFlow = [],
  sousSonTest = false,
): CheminDeFlow[] {
  const dans = (f: ArbreDeFlow<E, T, C, D> | undefined, cle: string, sous = sousSonTest): CheminDeFlow[] =>
    f ? testeursHorsDeLeurTest(f, [...chemin, cle], sous) : [];
  switch (flow.kind) {
    case 'sequence': return flow.etapes.flatMap((s, i) => testeursHorsDeLeurTest(s, [...chemin, 'etapes', i], sousSonTest));
    case 'si': return [...dans(flow.alors, 'alors'), ...dans(flow.sinon, 'sinon')];
    case 'choix': return [...dans(flow.oui, 'oui'), ...dans(flow.non, 'non')];
    case 'test': {
      const unique = flow.test.crewTestType === undefined;
      return [...dans(flow.reussite, 'reussite', unique), ...dans(flow.echec, 'echec', unique)];
    }
    case 'effet': return !sousSonTest && isEffectOp(flow.effet) && flow.effet.on === 'testeur' ? [chemin] : [];
  }
}

/** RÉÉCRITURE d'un Flow, des feuilles vers la racine : `f` reçoit chaque nœud, ses branches déjà réécrites.
 *  Immuable (copie). */
export function reecrireFlow<E, T, C, D>(
  flow: ArbreDeFlow<E, T, C, D>,
  f: (node: ArbreDeFlow<E, T, C, D>) => ArbreDeFlow<E, T, C, D>,
): ArbreDeFlow<E, T, C, D> {
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
 *  `visit` reçoit aussi le CHEMIN du nœud depuis `flow`, pour qui doit nommer un nœud fautif.
 *  Le visiteur peut ignorer les enfants, arrêter tout le parcours, ou retenir une branche d'un `si`.
 *  Le résultat dit si le parcours est allé au bout. */
export function walkFlow<E = EffectOp>(
  flow: Flow<E>,
  visit: (node: Flow<E>, chemin: CheminDeFlow) => void | 'ignorer' | 'stop' | 'alors' | 'sinon',
  chemin: CheminDeFlow = [],
): boolean {
  const suite = visit(flow, chemin);
  if (suite === 'stop') return false;
  if (suite === 'ignorer') return true;
  switch (flow.kind) {
    case 'sequence':
      for (const [i, etape] of flow.etapes.entries()) {
        if (!walkFlow(etape, visit, [...chemin, 'etapes', i])) return false;
      }
      return true;
    case 'si':
      if (suite !== 'sinon' && !walkFlow(flow.alors, visit, [...chemin, 'alors'])) return false;
      return suite === 'alors' || !flow.sinon || walkFlow(flow.sinon, visit, [...chemin, 'sinon']);
    case 'test':
      return walkFlow(flow.reussite, visit, [...chemin, 'reussite']) && walkFlow(flow.echec, visit, [...chemin, 'echec']);
    case 'choix':
      return walkFlow(flow.oui, visit, [...chemin, 'oui']) && (!flow.non || walkFlow(flow.non, visit, [...chemin, 'non']));
    case 'effet': return true;
    default:
      flow satisfies never;
      return true;
  }
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
      default: return noeud satisfies never;
    }
    if (pas && 'arret' in pas) return pas.arret;
    if (pas) pile.unshift(pas);
  }
  return hote.fin();
}
