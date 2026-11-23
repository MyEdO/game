/**
 * Ops — vocabulaire d'effets mécaniques PARTAGÉ par les sorts (specs structurées,
 * cf. engine/spellspec + data/spellspecs), les tables d'Incantations Imparfaites /
 * Colère des dieux (engine/miscast) et les mutations de Corruption (à venir).
 *
 * Chaque `GameOp` décrit UNE opération sur un Combatant ; `applyOps` les exécute
 * (mutation directe, comme le reste du moteur) et renvoie les lignes de journal.
 * Les quantités sont des `Formula` résolues à l'application — littéral, « (Bonus
 * de X) », « (X) », jet de dés — contre un RÉFÉRENT (le lanceur pour un sort,
 * la victime pour une table de contrecoup).
 *
 * Fidélité (règle 1) : une op n'existe que si la règle source la décrit — la
 * citation est portée par la spec/table qui l'emploie ; ce qui n'est pas
 * modélisable reste une op `narrative` (journalisée, arbitrage MJ, rien d'inventé).
 */
import type { z } from 'zod';
import type { RegleOptionnelleId } from './policy';
import type { FabriqueDId } from './fabriqueDId';
import { RNG, roll, type DiceSpec, rollDice, totalDuDe } from './dice';
import { bonus, effectiveChar, effectiveArmourAt, blessuresReconciliees } from './characteristics';
import { LOCALISATIONS_DE_COUP } from './localisations';
import {
  addCondition,
  addTimedCondition,
  addClockCondition,
  removeCondition,
  loseWounds,
  hasCondition,
  releaseConditionLocks,
  aUnVerrouLevePar,
  syncDerivedConditions,
  removeActiveEffects,
  pionsRetirables,
} from './conditions';
import { conditionLabel, diseaseLabel, psychologyLabel, qualityRefLabel, findTraitById, findTrappingById, refLabel } from '../data';
import { MINUTES_PER_DAY, joursParSemaine, minutesParSemaine } from './clock';
import { contractDiseaseOnce, exposerALaMaladie, aggravateDiseaseSymptom, attenuateDiseaseSymptom, grantDiseaseSymptom, suspendSymptom } from './disease';
import { groupMatch, groupesDe } from './groups';
import { findTableEntry } from './tables';
import { applyFall } from './movement';
import { ALL_MAGIC, type CastPenalty, type Difficulty, type Main } from './types';
import { refCouvre, type RefDesignee } from '../data/schemas/grammaire/ref';
import { contexteDeTestSchema, exposureLevelSchema, type NatureDInfluence } from '../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import type {
  GameOp,
  OpPassive,
  fenetreDeDeterminationSchema,
  perSLSchema,
  senseSchema,
} from '../data/schemas/grammaire/mecanique';
import { bypassedAP } from './armourBypass';
import { dernierIndex, grantTrait, grantPsychTrait, memeTraitPsy, removeGrantedTrait, sameInstance, traitsAccordesPar } from './grantedTraits';
import { caracDuCombattant, evaluer, resolveFormula, slBonus, valeurSansTirage } from './formule';
import { choixDuTrait, traitsOctroyes, type ChoixDuTrait } from './traitOctroye';
import { rollMutation } from '../data/mutations';
import { attachMutation, easeExposure, corruptionEaseSteps, recoitLaCorruption } from './corruption';
import { effectTableDie, findEffectTableById } from '../data/effectTables';
import { deDeTirageDe } from '../data/rangees';
// cycle runtime (grapple→structures→…→conditions→ops) : appelés à l'application, jamais à l'init du module
import {
  peutEtreEmpoigne,
  setGrapple,
} from './grapple';
import type { CodexTarget } from './ruleRefs'; // module FEUILLE (aucun import) : type de l'identité de source portée par PassiveMod
import { cureDiseases, blessDiseaseDuration, maladieABenir, aucuneMaladieABenir } from './rest';
import { applyAlcoholTest, EFFET_D_IVRESSE } from './drunkenness';
import {
  cureCriticalWounds,
  receiveMedicalAid,
  traumaPassiveMods,
  permanentAmputations,
  consolidateAmputations,
  estPlaieAmputation,
  plaieDAmputation,
  avecSequelles,
  type SequelleNeuve,
} from './trauma';
import { applyHealWounds, soinMagiqueOperant } from './healing';
import { fateSaveOrDie } from './fortune';
import { acquerirTalent } from './careerSlots';
import {
  contexteDeNaissanceDObjet,
  damageLeatherArmour,
  endommagerLEquipementPorte,
  itemFromGive,
  giveTrappingLabel,
  recomputeLoadout,
  weaponItem,
  activeLoadout,
  damageString,
  autoStowNewItem,
  lacherLArme,
  laisserTomber,
  armeNaturelleAccordee,
  estUneVraieArme,
  ficheDObjetPorte,
  objetDeSlot,
  isWeaponActive,
  uidDArme,
  type TrappingResolver,
} from './items';
import { bourseBrass, setBourseBrass } from './bourse';
import { itemCapability } from './capabilities';
import { objetSourceDeLArme } from './weaponLoad';
import { retraitsDits } from './weaponDamage';
import { effectivePsychTraits, isFrenzyCapable, suppressPsychTraits, type CibleEnVue, type PsychAffliction } from './psychology';
import { cibleDeRef, estCibleType, identiteDeCiblage } from './psych/ciblage';
import { traitOctroye } from './psych/opsPsy';
import { norm } from '../lib/normalize';
import { ConjureForm, conjureFormOptions, equipConjuredWeapon, specDArmeInvoquee } from './conjuredWeapons';
import { polymorphOps } from './polymorph';
import { clockLabel, type Duration } from './duration';
import { suspendSource } from './suspension';
import { deitySkills, priestCult } from './magic'; // cycle runtime (magic→ops) : appelé à l'application, jamais à l'init du module
import { gainAdvantage as gainAvantage, avantageApresGain, avantageApresPerte } from './advantage';
// Type-only (effacé à la compilation) : la FORME unifiée des effets « à la touche » d'une arme
// enchantée/invoquée = un `TriggeredEffect` (feuille EffectOp — noyau engine pur, jamais de transition),
// dispatché par `noyau/triggeredEffects` (pas ici).
import type { TriggeredEffect } from './flowCore';
import {
  EffectSource,
  CHAR_LABELS,
  CharKey,
  Combatant,
  type ModLine,
  HitLocation,
  HIT_LOCATION_LABELS,
  ItemInstance,
  Weapon,
  locationLabel,
} from './types';
import { constaterDans, emettreDans, faitDArgent, faitDObjet, nomDeSource, type Applique, type FaitAvecLigne } from './faits';
import { campOf } from './relations';
import { formatWardSave, traitLisible } from './traits/dispatch';
import { woundsFromHit } from './woundsCalc';
import type { ChaosAlign, ExposureLevel } from './corruption';
import { t, deElide, type MsgKey } from '../i18n';
import { applyActiveEffect } from './effetsActifs';
import { cleDeDe, desDeclaresDe, hauteurDeChute, type DeDeclare } from './faitsDOp';
import { nomDe } from './nom';

export { applyActiveEffect } from './effetsActifs';
export { resolveFormula } from './formule';
export {
  cleDeDe,
  D10_CHUTE,
  demandesDeDes,
  estOpDAttaquesSubies,
  estOpDeLaBourseDuGroupe,
  estOpDuMarche,
  estOpDuNavire,
  type DemandeDe,
  type OpDuNavire,
} from './faitsDOp';

// ---------------------------------------------------------------------------
// Formules
// ---------------------------------------------------------------------------

/** Termes dont la valeur ne se connaît qu'AU jet : les dés, la VALEUR du jet d'une op `rollThreshold`
 *  (`{rolled}` — Régénération « récupère [le dé] PB »), les DR du Test courant. */
export type TermeDeJet =
  | { dice: DiceSpec }
  | { rolled: true }
  /** DR (Degrés de Réussite) du Test COURANT (`ctx.sl`) — le terme qui manquait pour authorer une
   *  quantité ÉCHELONNÉE par la marge sans passer par `perSL` (qui n'exprime qu'un pas linéaire ajouté à
   *  un socle). Mendier : « un nombre de sous de cuivre égal à votre Bonus de Sociabilité x DR par heure »
   *  (LDB 09 l.97) s'écrit `{times:{of:{times:{of:{bonusOf:'sociabilite'},factor:{sl:true}}},factor:{rule:…}}}`.
   *  Hors contexte de Test (aucun `ctx.sl`) : 0, jamais NaN. */
  | { sl: true }
  | TermeLie;

/** VALEUR LIÉE dans la portée d'un Flow : `{tire, de}` la DÉFINIT, `{tire}` la RELIT. Toutes sont tirées
 *  UNE fois au départ du Flow et substituées par leur valeur (`lierLesTirages`, `engine/flowCore.ts`) avant
 *  toute évaluation : « Vous pouvez les récupérer » rend les MÊMES 2d10 marins (MDG 15 l.245). Lue non
 *  liée, elle lève. */
export type TermeLie = { tire: string; de?: Formula };

/** La grammaire d'une quantité, paramétrée par les termes de jet qu'elle admet (`J`). */
export type FormuleDe<J> =
  | number
  | { bonusOf: CharKey }
  | { charOf: CharKey }
  | J
  /** INDICE de l'attaque NATURELLE en cours (« Morsure +10 », « Souffle +15 ») — injecté par le
   *  résolveur de manœuvre (`ctx.indice`). Permet d'authorer les Dégâts « Indice » d'une manœuvre en
   *  GameOp : `wounds { amount: {indiceOf:true}, ignoreTB:false, ignoreAP:false }`. 0 hors contexte. */
  | { indiceOf: true }
  /** Nombre de PIONS de l'État qui DÉCLENCHE l'effet (Empoisonné « 1 PB/pion », En Flammes « +1/pion ») —
   *  injecté par le bus d'événements (`ctx.stacks`) quand un `effects: onRoundEnd` d'État est joué. 0 hors contexte. */
  | { stacks: 'self' }
  /** ÉCART d'Avantage avec les adversaires ENGAGÉS (`max(0, meilleur Avantage ennemi engagé − le sien)`) —
   *  injecté par le dispatcher de combat (`ctx.engagedAdvantageGap`, calculé sur la `battle`). Valeur
   *  RELATIONNELLE de l'arène (Instable « perd la différence d'Avantage », LDB 85 l.177). 0 hors contexte. */
  | { engagedAdvantageGap: true }
  /** Blessures infligées par l'attaque/lancement courant (`ctx.woundsDealt`) — miroir Formula de la
   *  Condition `woundsDealt`. Absorption « Toute attaque qui touche la créature inflige une quantité ÉGALE
   *  de Dégâts à la victime absorbée » (EDO 11 l.222) : `wounds { amount: { woundsDealt: true } }`. 0 hors contexte. */
  | { woundsDealt: true }
  /** BLESSURES MAXIMALES du référent (`wounds.max`) — « Le vaisseau perd 75 % de ses Blessures » (MDG 15
   *  l.33) s'écrit `{parTranche:4, of:{times:{of:{blessuresMax:true}, factor:3}}}`. 0 sans combattant. */
  | { blessuresMax: true }
  /** TAILLE du navire référent, sa longueur en mètres (MDG 12 l.54) : « payer 1d10 CO plus la Taille du
   *  navire en pistoles » (MDG 15 l.246). 0 hors du référent du navire de campagne (`referentDuNavire`). */
  | { tailleDuNavire: true }
  /** VALEUR de la cargaison en cale du navire référent, en sous de cuivre (Enc × prix de base de chaque lot) :
   *  « 10 % de la valeur de toute la cargaison » (MDG 15 l.247). 0 hors du référent du navire de campagne. */
  | { valeurCargaison: true }
  /** SOMME de termes (composition) — « 1d10 + (pions − 1) » des Dégâts d'En Flammes (LDB 16 l.84). Permet
   *  d'authorer une formule composée sans coder en dur l'addition au moteur. Récursif. */
  | { sum: FormuleDe<J>[] }
  /** FACTEUR multiplicatif (« 1d10 × 10 minutes » — Mystracine/Mandragore, LDB 71 l.33/35) : résout `of`
   *  puis multiplie par `factor`. NB : `10d10` n'est PAS équivalent (distribution différente) — fidélité RAW.
   *  `factor` est lui-même une `Formula` : le PRODUIT DE DEUX FORMULES (« (Force Mentale) × 1d10 minutes »,
   *  VDM 05 — Contact doré) s'écrit `{times:{of:{charOf:'force-mentale'}, factor:{dice:{n:1,sides:10}}}}`. */
  | { times: { of: FormuleDe<J>; factor: FormuleDe<J> } }
  /** VALEUR d'une RÈGLE OPTIONNELLE du registre (`src/data/reglesOptionnelles.json`, lue par
   *  `rule(id)`) — terme GÉNÉRAL : toute quantité qu'un livre ne chiffre pas (`maison`) reste ÉDITABLE
   *  au panneau in-game au lieu d'être figée dans le moteur. Une règle non numérique (ou inconnue) vaut
   *  0, comme toute formule malformée. */
  | { rule: RegleOptionnelleId }
  /** BORNE BASSE d'un terme (`max(minimum, of)`) — clause d'ENTRÉE du livre, portée par la formule
   *  qui la reçoit : « inutilisable pour 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) »
   *  (`AA 07 l.113`, `LDB 18 l.88`) s'écrit `{minimum:1, of:{sum:[…]}}`. Récursif. `minimum` nomme CE
   *  concept seul — `atLeast` est déjà le seuil d'un palier (`rollThreshold`) et d'une Condition. */
  | { minimum: number; of: FormuleDe<J> }
  /** NOMBRE DE TRANCHES ENTIÈRES de `parTranche` dans `of` (`⌊of / parTranche⌋`) — « l'État Sonné pour
   *  chaque tranche de 5 Blessures subies » (`LDB 85 l.324`) s'écrit
   *  `{minimum:1, of:{parTranche:5, of:{woundsDealt:true}}}`. Récursif. */
  | { parTranche: number; of: FormuleDe<J> };

/** Quantité résolue à l'application : littéral, « (Bonus de X) », « (X) », dés, terme de jet. */
export type Formula = FormuleDe<TermeDeJet>;

/** Quantité LUE AVANT tout jet — portée, cibles et zone d'un Sort, bonus de DR, modificateur de Test
 *  affiché : aucun terme de jet n'y entre (#2817), son évaluation (`valeurSansTirage`) ne tire rien. */
export type FormuleSansTirage = FormuleDe<never>;

/** L'Avantage d'un CAMP SANS FICHE (habitué, figurants) après des ops DÉCLARÉES : seul le vocabulaire
 *  d'Avantage s'y lit (`gainAdvantage`, `spendAdvantage`), par les primitives d'`engine/advantage`. Toute
 *  autre op lève : elle n'a aucun porteur où tomber (#2333). */
export function avantageDeCampSansFiche(avant: number, ops: readonly GameOp[], plafond: number, rng: RNG, ref?: Combatant): number {
  return ops.reduce((n, o) => {
    if (o.op === 'gainAdvantage') {
      if (typeof o.amount !== 'number' && !ref) throw new Error(`[avantage de camp] formule d'Avantage sans fiche où la résoudre (#2333)`);
      return avantageApresGain(n, Math.max(0, typeof o.amount === 'number' ? o.amount : resolveFormula(o.amount, ref!, rng)), plafond);
    }
    if (o.op === 'spendAdvantage') return avantageApresPerte(n, o.amount);
    throw new Error(`[avantage de camp] op « ${o.op} » hors du vocabulaire d'Avantage d'un camp sans fiche (#2333)`);
  }, avant);
}

/** Clés reconnues d'une `Formula` OBJET — SOURCE UNIQUE, alignée sur l'union `Formula` et sur les
 *  branches de `resolveFormula`. Réutilisée par le garde-fou d'intégrité des données
 *  (`src/data/data-wellformed.test.ts`) pour valider les champs Formula des `GameOp` sans re-coder la liste. */
export const FORMULA_OBJECT_KEYS = ['bonusOf', 'charOf', 'dice', 'rolled', 'indiceOf', 'stacks', 'engagedAdvantageGap', 'woundsDealt', 'blessuresMax', 'tailleDuNavire', 'valeurCargaison', 'sl', 'tire', 'rule', 'sum', 'times', 'minimum', 'parTranche'] as const;

/** Une valeur est-elle une `Formula` VALIDE — résoluble par `resolveFormula` sans planter ? `number` FINI,
 *  ou objet portant exactement une clé connue (`sum` récursif). PUR. Rejette une string (un `'$indice'`
 *  non substitué qui atteindrait `resolveFormula` — le bug qu'on garde), un objet vide, `NaN`/`Infinity`. */
export function isValidFormula(f: unknown): f is Formula {
  if (typeof f === 'number') return Number.isFinite(f);
  if (typeof f !== 'object' || f === null) return false;
  const o = f as Record<string, unknown>;
  if ('minimum' in o) return typeof o.minimum === 'number' && Number.isFinite(o.minimum) && isValidFormula(o.of);
  if ('parTranche' in o) return Number.isInteger(o.parTranche) && (o.parTranche as number) > 0 && isValidFormula(o.of);
  if ('sum' in o) return Array.isArray(o.sum) && o.sum.every(isValidFormula);
  if ('tire' in o) return typeof o.tire === 'string' && (o.de === undefined || isValidFormula(o.de));
  if ('times' in o) {
    const t = o.times as Record<string, unknown> | null;
    return !!t && typeof t === 'object' && isValidFormula(t.of) && isValidFormula(t.factor);
  }
  return FORMULA_OBJECT_KEYS.some((k) => k in o);
}

/**
 * FENÊTRE ouverte par une dépense de Point de Détermination sur l'État qu'une op `condition` PASSIVE
 * porte (`LDB 17 l.61`) : le fait source est SUSPENDU le temps de cette fenêtre — la réconciliation
 * retire alors l'État, l'échéance le repose si la cause tient toujours.
 *  - ABSENTE : `{ scale:'rounds', left:1 }`. `LDB 16 l.117` ne parle QUE de l'État *Inconscient* ;
 *    le défaut s'étend à tout État dérivé d'un canal passif (valeur maison, éditable par `resolveWindow`).
 *  - `'none'` : la dépense est REFUSÉE — `LDB 20 l.188`.
 *  - `rounds`/`clock` : durée AUTHORÉE, chaque terme étant une `Formula` (donc un `{rule}` éditable
 *    quand le livre ne chiffre pas la fenêtre — `LDB 20 l.170`).
 * DISTINCTE de `durationRounds`/`durationMinutes`/`durationHours`, qui sont la durée de l'ÉTAT POSÉ.
 */
export type ResolveWindow = z.output<typeof fenetreDeDeterminationSchema>;

/** Résout la fenêtre ci-dessus en `Duration` — `undefined` = REFUS (`'none'`). PURE (`now` injecté). */
export function resolveWindowDuration(w: ResolveWindow | undefined, ref: Combatant, now: number, rng: RNG): Duration | undefined {
  if (w === undefined) return { scale: 'rounds', left: 1 };
  if (w === 'none') return undefined;
  if (w.scale === 'rounds') return { scale: 'rounds', left: resolveFormula(w.left, ref, rng) };
  return { scale: 'clock', until: now + resolveFormula(w.minutes, ref, rng) };
}

/** Échelle « par +N DR » d'un sort (LDB 41/42/47 — « +1 par +2 DR », « +DR Dégâts ») :
 *  appliquée au DR du jet d'incantation (`OpsCtx.sl`), jamais négative. */
export type PerSL = z.output<typeof perSLSchema>;
/** Estimation DÉTERMINISTE d'une `Formula` pour le SCORING (jamais de tirage — le planning ne doit PAS
 *  consommer le RNG seedable, sous peine de désync du flux déterministe / coop / tests reproductibles, et
 *  d'une magnitude aléatoire). Calque la convention statique de `missileDamage` (valeur écrite). Les dés
 *  rendent leur MOYENNE (`n×(faces+1)/2 + plus`) ; `(X)`/`(Bonus de X)` la valeur réelle (déterministe) ;
 *  `{rolled}` une valeur de référence neutre (le dé moyen d'un d10 ≈ 5,5) ; `{rule}` la valeur de la règle,
 *  comme `resolveFormula` (terme PUR et déterministe : il se score comme il se résout) ; les axes
 *  relationnels (Indice/stacks/écart d'Avantage/PB infligés) absents au planning → 0. `{minimum}` borne
 *  l'espérance de `of` — approximation : E[max(n,X)] ≥ max(n,E[X]). PUR, sans RNG. */
export function formulaExpectation(f: Formula, ref: Combatant): number {
  return evaluer<TermeDeJet>(f, caracDuCombattant(ref), jetEspere);
}

/** Le terme de jet à son espérance (`formulaExpectation`) : dé moyen, `{rolled}` 5,5, `{sl}`, une valeur liée et
 *  tout objet inconnu (formule malformée) 0. */
function jetEspere(t: TermeDeJet): number {
  if ('dice' in t) return totalDuDe(t.dice, t.dice.n * (t.dice.sides + 1) / 2);
  if ('rolled' in t) return 5.5;
  return 0;
}

/** Somme des bonus de DR à une Compétence (`skill`, Spécialisation comprise) conférés au porteur — op `skillDRBonus` PASSIVE
 *  (`TraitData.passive`, lue PAR ID — Furtif : +Bonus d'Agilité au DR de Discrétion, LDB 85), PROJETÉE
 *  par une aura (`auraMods`), portée par une SÉQUELLE (`traumaPassiveMods` — LDB 18 l.61/l.72), OU
 *  TEMPORISÉE par un effet actif (`ActiveEffect.drBonus` — chansons de marin, MDG 09). Distincte de
 *  `skillMod` (valeur du Test) — consommée au calcul du DR d'un Test
 *  RÉUSSI (Discrétion de la Surprise, incantation, attaque, Test générique). */
export function skillDRBonus(c: Combatant, skill: RefDesignee): number {
  const matches = (s?: RefDesignee) => s != null && refCouvre(s, skill);
  let n = 0;
  for (const t of c.traits ?? []) {
    for (const op of findTraitById(t.id)?.passive ?? []) {
      if (op.op === 'skillDRBonus' && 'skill' in op && matches(op.skill)) n += valeurSansTirage(op.bonus, c);
    }
  }
  // Séquelles (`c.traumas`) : leurs ops passives, `kind` = `passiveKind` de la fiche, sinon DÉRIVÉ par
  // `traumaOpKind` — qui ne classe que maxWeaponHands/senseLoss/moveScale et rend `douleur` par défaut,
  // donc annulable par Détermination/Insensible/prothèse. Les cicatrices sociales (LDB 18 l.61 et l.72)
  // portent `passiveKind: "intrinseque"` : liste d'annulateurs VIDE, leur DR survit à la Détermination.
  // Une séquelle à `skillDRBonus` SANS `passiveKind` tomberait, elle, en `douleur` (annulée par Insensible).
  for (const m of traumaPassiveMods(c)) if (m.op.op === 'skillDRBonus' && matches(m.op.skill)) n += valeurSansTirage(m.op.bonus, c);
  // Auras — `aura.passive` projeté dans `auraMods` par le hook `recompute-auras`. Sommé (le DR cumule),
  // comme les passifs de trait.
  for (const m of c.auraMods ?? []) if (m.op.op === 'skillDRBonus' && matches(m.op.skill)) n += valeurSansTirage(m.op.bonus, c);
  // Effets ACTIFS temporisés (op `skillDRBonus` exécutée — chanson de marin « Jacques Bret », MDG 09 l.228).
  for (const e of c.activeEffects ?? []) for (const b of e.drBonus ?? []) if ('skill' in b && matches(b.skill)) n += b.bonus;
  // Objets POSSÉDÉS : leur `passive` skillDRBonus (Boussole : « Les Tests d'Orientation bénéficient de
  // +1 DR avec l'aide d'une boussole », MDG 14 l.275) — NON gaté sur le port, comme `lockpicks`/`isRations`
  // (l'outil se sort pour servir) ; les passifs de VALEUR d'objet (skillMod des Bésicles) restent, eux,
  // gatés porté/tenu via `passiveMods`.
  for (const it of c.items ?? []) {
    for (const op of it.passive ?? []) if (op.op === 'skillDRBonus' && 'skill' in op && matches(op.skill)) n += valeurSansTirage(op.bonus, c);
  }
  return n;
}

/** Ops `offTerrainMod` PASSIVES du combattant (traits INHÉRENTS `c.traits`, lus PAR ID comme
 *  `skillDRBonus` — Créature marine MDG 16 l.17 / Aquatique MSRC 15 l.139). PUR. */
function offTerrainOps(c: Combatant): Extract<GameOp, { op: 'offTerrainMod' }>[] {
  const out: Extract<GameOp, { op: 'offTerrainMod' }>[] = [];
  for (const t of c.traits ?? []) {
    for (const op of findTraitById(t.id)?.passive ?? []) if (op.op === 'offTerrainMod') out.push(op);
  }
  return out;
}

/** Terrains d'ÉLECTION requis par les passifs `offTerrainMod` (`eau` pour Créature marine/Aquatique) —
 *  vide = aucune contrainte. Lu par le state (`placeCombatant`) pour poser le drapeau `offTerrain`. PUR. */
export function requiredTerrains(c: Combatant): string[] {
  return [...new Set(offTerrainOps(c).map((o) => o.terrain.id))];
}

/** Mouvement IMPOSÉ hors de son terrain (op `offTerrainMod.mSet` — Créature marine : « son M tombe à 1 »,
 *  MDG 16 l.17 ; Aquatique : « ne peut pas se déplacer sur la terre ferme », MSRC 15 l.139 → 0), actif seulement
 *  quand le drapeau POSITIONNEL `c.offTerrain` est posé. Plusieurs sources → la plus contraignante (min).
 *  `null` = pas de contrainte. Lu par `effectiveMovement`. PUR. */
export function offTerrainMoveCap(c: Combatant): number | null {
  if (!c.offTerrain) return null;
  const sets = offTerrainOps(c).filter((o) => o.mSet != null).map((o) => o.mSet!);
  return sets.length ? Math.min(...sets) : null;
}

/** Malus de DR à TOUS les Tests hors de son terrain (op `offTerrainMod.testDR` — Créature marine :
 *  « tous les Tests qu'elle effectue subissent –2 DR », MDG 16 l.17), gaté par `c.offTerrain`. Σ. Consommé
 *  aux épines de Test : attaque (`applyHit` via les sites `skillDRBonus` de combat.ts), Test générique
 *  (`rollFlowSpecs`), incantation (`magicTestSLBonus`). PUR. */
export function offTerrainTestDR(c: Combatant): number {
  if (!c.offTerrain) return 0;
  return offTerrainOps(c).reduce((s, o) => s + (o.testDR ?? 0), 0);
}

/** Suffocation hors de son terrain (op `offTerrainMod.suffocates` — Créature marine : « doivent être
 *  immergées pour respirer correctement (…) sinon elles se mettent à suffoquer », MDG 16 l.19), gaté par
 *  `c.offTerrain`. Consommé par `suffocationTick` (`engine/suffocation.ts`) — SOURCE UNIQUE avec le
 *  drapeau d'effet `suffocates` (sorts) ; aucun `hasTrait` de créature nommée. PUR. */
export function offTerrainSuffocates(c: Combatant): boolean {
  if (!c.offTerrain) return false;
  return offTerrainOps(c).some((o) => o.suffocates);
}

/** Somme des bonus de DR aux Tests d'une CARACTÉRISTIQUE (op `charDRBonus` — chanson « Camarades
 *  d'équipage » : +1 DR aux Tests de Sociabilité, MDG 09 l.236) : passifs de trait + auras + effets
 *  actifs. Consommée sur un Test RÉUSSI (même règle d'application que `skillDRBonus`/LDB 10 l.19). */
export function charDRBonusOf(c: Combatant, char: CharKey | undefined): number {
  if (!char) return 0;
  let n = 0;
  for (const t of c.traits ?? []) {
    for (const op of findTraitById(t.id)?.passive ?? []) {
      if (op.op === 'charDRBonus' && op.characteristic === char) n += valeurSansTirage(op.bonus, c);
    }
  }
  for (const m of c.auraMods ?? []) if (m.op.op === 'charDRBonus' && m.op.characteristic === char) n += valeurSansTirage(m.op.bonus, c);
  for (const e of c.activeEffects ?? []) for (const b of e.drBonus ?? []) if ('characteristic' in b && b.characteristic === char) n += b.bonus;
  return n;
}

/** Les modificateurs au Test d'un ATTAQUANT visant `c` (op PASSIVE `incomingAttackMod` de ses traits) pour un
 *  mode d'attaque (`melee`/`distance`, ops `all` comprises), une ligne par trait, à son nom et liée à sa fiche
 *  (Parasité LDB 85 l.257, Nuée l.253). Circonstance : une condition de la CIBLE (`LDB 14 l.48`). */
export function incomingAttackLines(c: Combatant, mode: 'melee' | 'distance'): ModLine[] {
  const out: ModLine[] = [];
  for (const t of c.traits ?? []) {
    const trait = findTraitById(t.id);
    let n = 0;
    for (const op of trait?.passive ?? []) {
      if (op.op === 'incomingAttackMod' && (op.mode === mode || op.mode === 'all')) n += op.amount;
    }
    if (n) out.push({ label: trait!.label, value: n, famille: 'circonstance', ref: { category: 'traits', id: t.id } });
  }
  return out;
}

/** L'attaque du porteur compte-t-elle comme `keyword` (op passive `attackKeyword`, par id) ? Magique/
 *  Démoniaque/Fabriqué → 'magic'. (La qualité d'arme 'magic' est vérifiée à part par `isMagicWeapon`.) */
export function attackHasKeyword(c: Combatant, keyword: 'magic'): boolean {
  for (const t of c.traits ?? []) for (const op of findTraitById(t.id)?.passive ?? []) if (op.op === 'attackKeyword' && op.keyword === keyword) return true;
  return false;
}

/** Les Dégâts entrants sur `defender` sont-ils NULLIFIÉS (op passive `mitigateIncoming{mode:'nullify'}`,
 *  Éthéré) ? `unlessKeyword:'magic'` laisse passer l'attaque si elle est magique (l'`attacker` porte le
 *  mot-clé OU l'arme est magique → `weaponHasMagic`). */
export function incomingDamageNullified(defender: Combatant, attacker: Combatant, weaponHasMagic: boolean): boolean {
  for (const t of defender.traits ?? []) {
    for (const op of findTraitById(t.id)?.passive ?? []) {
      if (op.op === 'mitigateIncoming' && op.mode === 'nullify') {
        if (op.unlessKeyword === 'magic' && (weaponHasMagic || attackHasKeyword(attacker, 'magic'))) continue;
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

/** Sens PAIRÉ (œil/oreille, LDB 18) — vocabulaire PARTAGÉ par `senseLoss` (perte de l'organe) et la
 *  restriction `skillMod.sense` (le Test SOLLICITE ce sens : Surdité ne pénalise que les Tests de
 *  Perception basés sur l'ouïe, pas ceux basés sur la vue/l'odorat — LDB 18). */
export type PairedSense = z.output<typeof senseSchema>;

/** Mot RÉSERVÉ de `scheduleRespawn.ref` : la créature DÉFUNTE elle-même, lue par son `creatureId` à la
 *  programmation (`noyau/combatFlow › scheduleRespawnFromOp`). */
export const SELF_REF = 'self';

export type { GameOp } from '../data/schemas/grammaire/mecanique';

/** Aggravation d'une météo imposée : le dé de chaque matin, son seuil, et les axes qu'il impose. MDG 15 l.248 */
export type AggravationMeteo = NonNullable<Extract<GameOp, { op: 'meteoImposee' }>['aggravation']>;

/** Op d'une liste lue par le collecteur `passiveMods` : sans `auTotal` (#3060). */
export type { OpPassive } from '../data/schemas/grammaire/mecanique';

/** Profil d'ANNULATION d'un effet PASSIF (système unifié) — le « flag de typage » qui dit CE QUI le neutralise.
 *  Porté par chaque `PassiveMod` ; une table `kind → annulateurs` (engine/trauma) applique le gating. */
export type PassiveKind =
  | 'douleur'      // pénalité de douleur (séquelle) : Détermination + Insensible + prothèse 'all'
  | 'mobilite'     // pénalité de mobilité (séquelle de jambe) : idem + prothèse 'movement'
  | 'structurel'   // membre perdu : prothèse 'all' SEULE (ni Détermination ni Insensible)
  | 'sensoriel'    // organe perdu : rien
  | 'maladie'      // symptôme de maladie : Détermination SEULE (pas Insensible)
  | 'faim'         // pénalité de Faim : « Plus besoin de manger »
  | 'magique'      // effet ACTIF (ActiveEffect) : inconditionnel ; pool selon sa SOURCE (`poolDeNonCumul` : Sorts LDB 46 l.119, même Prière LDB 40 l.19), sinon sommé ; expire seul
  | 'etat'         // pénalité/effet d'un État (LDB 16) : pool NON-CUMUL, le pire seul (LDB 16 l.13) ; Exténué ×stacks
  | 'ivresse'      // pénalité d'Ivresse (LDB 09 l.475) : sommée (LDB 14 l.95) ; ignorée 1 Round par la Détermination (flag `drunkIgnore`)
  | 'intrinseque'; // trait/mutation/qualité : inconditionnel ET ADDITIF (Σ dans la base — corps/équipement permanent)

/** Attribut visé par `attrMod` → sa CLÉ d'affichage (#1318 V8c₅, 8ᵉ forme) : le nom rendu au joueur
 *  passait en paramètre de `t()` sous forme de littéral FR — il s'affichait donc hors catalogue. */
const ATTR_KEY = { wounds: 'op.attributBlessures', fortune: 'op.attributFortune', resolve: 'op.attributDetermination' } as const satisfies Record<string, MsgKey>;

/** Effet PASSIF porté par un élément (trauma/trait/mutation/qualité…) : une op + son profil d'annulation.
 *  Unité du collecteur unifié `passiveMods` ; `kind` absent ⇒ `intrinseque`.
 *
 *  `src` = IDENTITÉ Codex de l'entité qui porte le passif (l'État pour un `kind:'etat'`, le symptôme
 *  pour un `kind:'maladie'`, le trait pour une aura) — posée par le collecteur, qui la connaît au
 *  moment où il pousse. Elle sert l'AFFICHAGE nommé d'une composante (chip « −30 Brisé » et son
 *  renvoi Codex, `combatTestPenaltyParts`) ; le calcul ne la lit jamais. */
export interface PassiveMod {
  op: OpPassive;
  kind?: PassiveKind;
  /** Entité ÉMETTRICE en ids stables — c'est elle qui NOMME la composante d'un détail de jet et lui
   *  donne son renvoi Codex (`passivePartLine`). À poser à l'ÉMISSION, jamais devinée au rendu. */
  src?: CodexTarget;
  /** Nom PROPRE de l'émetteur, pour une entité HORS CATALOGUE (armure forgée à la main, mutation
   *  maison) : il n'y a aucune fiche à ouvrir, mais la composante doit rester NOMMÉE — jamais repliée
   *  sur sa famille (« Passif »). Lu par `passivePartLine` quand `src` manque ou ne résout pas. */
  label?: string;
  /** Le passif se VOIT sur le porteur (lésion apparente : Vers du Reik au visage/aux mains) — posé à
   *  l'ÉMISSION, jamais deviné au rendu. Ce que la doctrine appelle « visible » est une propriété de la
   *  part émise, pas du porteur : elle s'agrège par `aPassifVisible` (engine/trauma) et se lit en
   *  Condition `visiblePassive` — une apparence qui suscite la sympathie du passant (LDB 09 l.97). */
  visible?: true;
}

export interface OpsCtx {
  rng: RNG;
  /** Forge les uids des objets donnés, des armes invoquées et des enchantements (#2907). */
  idNeuf: FabriqueDId;
  /** Résout les références d'objet à la création d'un don ou d'une arme invoquée. #4257 */
  resolveTrapping?: TrappingResolver;
  /** Référent des formules « (Bonus de X) » (le lanceur d'un sort) ; défaut : la cible. */
  caster?: Combatant;
  /** Équipage d'une COQUE (`crewIds` résolus en Combattants) — pour les ops de navire : `removeShipPoste`
   *  démancipe le chef de pièce. Passé par `applyHullCritical`. */
  crew?: Combatant[];
  /** COQUE dont le Critique est en cours de résolution — sa `ship.lengthM` donne la Taille (`MDG 12
   *  l.122-129`, via `hullShipSize`) que lisent les tables indexées par bateau (op `fall` : hauteur de chute,
   *  `MDG 13 l.684`). Passée par la porte du coup à l'équipage (`applyCrewHit` en direct, `hullId` de
   *  l'étape pour la voie cascade). Absente = anomalie nommée par l'op, jamais une hauteur de 0. */
  hull?: Combatant;
  /** SORT SOURCE en cours d'incantation : tout `ActiveEffect` POSÉ par cet `applyOps` en est marqué
   *  (`ActiveEffect.spell`), pour la DISSIPATION (LDB 46 l.158-162). Posé par `applyCast` (Sorts durables). */
  sourceSpell?: {
    spellId: string; ni: number; casterId: string; label: string;
    /** ZONE D'EFFET du sort, DÉJÀ RÉSOLUE par ses lecteurs uniques (`magic.zdeDiameterMeters` pour le
     *  diamètre — la géométrie qu'une ZdE a dans le livre, LDB 47 l.28 ; `combatFlow.zoneRadiusMeters`
     *  pour le rayon, seul site du passage diamètre→rayon). Les auras de garde (Dôme, Bouclier
     *  anti-flèches) la LISENT ici au lieu de la re-déclarer : la zone d'un sort s'authore à UN endroit,
     *  sa ligne « Cible ». Absente = le sort n'a pas de ZdE chiffrable. */
    zde?: { diametreM: number; rayonM: number };
  };
  /** id STABLE du sort/prière en cours d'incantation — posé sur TOUT `ActiveEffect` durable de ce lancement
   *  (`ActiveEffect.sourceSpellId`), Prières COMPRISES (≠ `sourceSpell`, arcane-only dissipation). Sert
   *  l'IDENTITÉ du sort pour l'anti-spam de buff de l'IA. Posé par `applyCast` à CHAQUE lancement. */
  sourceSpellId?: string;
  /** Forme choisie par le lanceur pour une arme invoquée à forme libre (op `grantWeapon` +
   *  `chooseForm`) — fixe Groupe/allonge/mains. Défaut (absent) : la 1ʳᵉ forme proposée. */
  conjureForm?: ConjureForm;
  /** EXPOSITION corruptrice (op `corruptionExposure`) de `cible`, au niveau déjà atténué — fourni par
   *  `noyau/corruptionFlow.crochetsDeCorruption`. Sans hook (moteur pur/tests), l'op est journalisée inerte. */
  onCorruptionExposure?: (cible: Combatant, level: ExposureLevel, nature?: NatureDInfluence, difficulty?: Difficulty) => string[];
  /** Libellé de la source (sort/table) — ActiveEffect.label + journal ; se LIT par `nomDeSource`. */
  label?: string;
  /** REJEU de fin de Round d'ops récurrentes portées par un effet actif : posé par `endOfRound`
   *  (`engine/conditions.ts`), jamais par un site d'application. Seul ce drapeau distingue la POSE de
   *  la RE-POSE — la FORME de l'op ne le dit pas (`LDB 16 l.117`). Il porte sur les ops LITTÉRALES
   *  re-jouées, et sur elles seules : la dérivation `imbrique` l'ôte à toute descente (table, seuil,
   *  forme, échelon). */
  rejeuRecurrent?: boolean;
  /** ENTITÉ SOURCE des ops en cours (sort, talent, trait, objet, maladie, mutation…) — marquée sur TOUT
   *  `ActiveEffect` posé par cet `applyOps` (`ActiveEffect.source`). Ancrage de règle GÉNÉRAL : c'est
   *  elle qui donne sa fiche Codex à une pastille d'effet, quel que soit le TYPE de source (arbitrage
   *  user 2026-07-18 — « les GameOps sont rattachés à quelque chose »). `sourceSpellId` reste le canal
   *  SPÉCIFIQUE des sorts (anti-spam de buff côté IA) : les deux cohabitent, aucun n'est redondant. */
  source?: EffectSource;
  /** id STABLE de l'effet en cours (langue-indépendant) — marqué sur TOUT `ActiveEffect` posé par cet
   *  `applyOps` (`ActiveEffect.effectId`), même mécanisme que `sourceSpell`/`sourceSpellId` ci-dessus.
   *  Sert l'identité de retrait/détection (`transform`/`endTransform`, chansons de marin…) — JAMAIS le `label`
   *  (affichage, non stable/traductible). */
  effectId?: string;
  /** Une op de la liste en cours, ou d'une liste qui l'englobe, est un `attrMod` de Blessures `auTotal` :
   *  chaque `charMod` posé ici est marqué `ActiveEffect.blessuresAuTotal` (#3060). Dérivé par `applyOps`
   *  et transmis aux descentes ; jamais posé par un site d'application. */
  blessuresAuTotal?: true;
  /** Durée (en Rounds) des `charMod` sans durée propre — celle du sort. */
  defaultDurationRounds?: number;
  /** Échéance d'HORLOGE (minutes `gameTime`) des effets actifs d'un sort à durée en
   *  minutes/heures/jours (LDB 47) : devient une durée `{scale:'clock'}` (cf. `durationFromCtx`),
   *  purgée par l'horloge (`purgeClockEffects`). Exclusif de `defaultDurationRounds`. */
  defaultUntilTime?: number;
  /** Horloge de jeu (minutes) — base des `castPenalty` à durée en minutes/jours. */
  now?: number;
  /** DR du jet d'incantation — alimente les échelles « par +N DR » (`PerSL`) des ops. */
  sl?: number;
  /** PAS de Surincantation alloués à l'axe Durée (`pendingCast.overcast.duration`) — alimente
   *  `rollTable.extraRollsPerStep` (LDB 47 l.13-17, EDOC 13 l.230+270-276). */
  overcastDurationSteps?: number;
  /** Jets sur le Tableau RÉELLEMENT choisis par le lanceur (EDOC 13 l.276 : « vous POUVEZ » — décidable,
   *  jamais forcé), borné à `overcastDurationSteps`. Absent = tous les pas alloués (défaut, IA). */
  chosenTableRolls?: number;
  /** EDOC 13 l.245. */
  onChoixDeTrait?: (cible: Combatant, op: Extract<GameOp, { op: 'grantTrait' }>, options: readonly ChoixDuTrait[], ctx: OpsCtx) => boolean;
  /** Marqueur de RÉ-ENTRANCE `onOwnTestFailed` : posé sur le flowCtx des effets déclenchés par ce trigger
   *  (MSRC 16 — Crampes). Threadé jusqu'à un nœud Flow `test` (le FM de palier 2) routé en cascade : son
   *  étape est tamponnée `meta.noOwnTestFailed` pour que sa résolution NE ré-émette JAMAIS le trigger
   *  (garde de ré-entrance qui survit à la cadence asynchrone du héros). */
  noReentryOwnTestFailed?: boolean;
  /** Blessures RÉELLEMENT infligées par le lancement courant (Projectile magique) — base du Vol de
   *  vie (op `lifeSteal`). Posé par la résolution missile avant d'appliquer les ops du lanceur. */
  woundsDealt?: number;
  /**
   * DÉS DÉJÀ POSÉS par la porte pour CES ops (#1508) — clé (`cleDeDe`) → valeur du dé, telle que
   * `demandesDeDes` l'a ANNONCÉE. C'est le CANAL op → applier : le moteur FABRIQUE la demande (quels
   * dés, pour quoi), la couche `noyau` OUVRE la fenêtre (étape à dé nu, affichable/lançable/posable) et
   * REVERSE ici ce qui est tombé. Le dé posé REMPLACE le tirage : aucun rng n'est consommé pour lui.
   *
   * Absent (pilote headless : moteur pur, test, résolveur inline) ⇒ l'op tire elle-même, au même
   * point du rng qu'avant — la porte reste le chemin, jamais une condition de correction.
   *
   * Ne DESCEND PAS aux ops imbriquées (`imbrique`) : les clés sont indexées sur le rang de l'op dans
   * CE tableau, une descente les ferait collisionner avec celles du parent.
   */
  des?: ReadonlyMap<string, number>;
  /** Valeur du jet courant d'une op `rollThreshold` — résout les Formula `{rolled}` des ops de palier. */
  rolled?: number;
  /** INDICE de l'attaque naturelle d'une MANŒUVRE en cours (« Morsure +10 ») — résout les Formula
   *  `{indiceOf}` (Dégâts authorés en GameOp). Posé par le résolveur de manœuvre. */
  indice?: number;
  /** Nombre de PIONS de l'État qui déclenche un `effects: onRoundEnd` — résout les Formula `{stacks:'self'}`
   *  (Empoisonné « 1 PB/pion », En Flammes « +1/pion »). Posé par le bus à la diffusion d'un effet d'État. */
  stacks?: number;
  /** Écart d'Avantage avec les adversaires Engagés — résout `{engagedAdvantageGap:true}` ET la Condition
   *  `engagedAdvantageGap` (Instable). Calculé sur la `battle` par le dispatcher de combat. */
  engagedAdvantageGap?: number;
  /** Avance d'Avantage SIGNÉE sur tous les adversaires Engagés — résout la Condition `engagedAdvantageLead`
   *  (Absorption : `> 0` = strictement supérieur à tous). Calculée sur la `battle` par le dispatcher. */
  engagedAdvantageLead?: number;
  /** Localisation de la touche courante (dé inversé) — lue par la Condition Flow `location` (Assommante). */
  location?: HitLocation;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — lu par la Condition Flow
   *  `attackKind` (Vampirique : Vol de vie sur Morsure seulement). */
  attackKind?: string;
  /** CAUSE de l'effarouchement courant ('noise'/'magic', LDB 85 l.197) — lue par la Condition Flow
   *  `startleCause` (exemption Dressé : Guerre ignore les bruits, Magie ignore la magie). */
  startleCause?: 'noise' | 'magic';
  /** Un adversaire vivant est-il dans la Ligne de Vue du porteur — résout la Condition `foeInLoS`
   *  (sortie de Frénésie, Brisé). Précalculé sur la `battle` par le dispatcher de combat. */
  foeInLoS?: boolean;
  /** L'instance d'affliction psychologique dont l'effet est joué — lue par `endPsych { instance }`. Posée par
   *  le dispatcher des états psy (`noyau/triggeredEffects.ts`). */
  affliction?: PsychAffliction;
  /** Verdict de cette instance sur sa Cible en vue — résout la Condition `cibleEnVue`. Précalculé par le
   *  dispatcher de combat. */
  cibleEnVue?: CibleEnVue;
  /** Géométrie d'arène de la récupération du Brisé (LDB 16) — précalculée par le dispatcher : aucun ennemi
   *  ne voit l'acteur (`hiddenFromFoes`), acteur Engagé (`engaged`), distance au plus proche (`nearestFoeDist`).
   *  Résolvent les Conditions `hiddenFromFoes`/`engaged`/`nearestFoe`. */
  hiddenFromFoes?: boolean;
  engaged?: boolean;
  nearestFoeDist?: number;
  /** Gain de Corruption de `cible` AVEC seuil → mutation (`noyau/corruptionFlow.crochetsDeCorruption`) ;
   *  sans hook, l'op `corruption` incrémente simplement le compteur. */
  onCorruption?: (cible: Combatant, n: number, align?: ChaosAlign) => Applique;
  /** GAIN d'Avantage de l'op `gainAdvantage`, fourni par le noyau (`noyau/combat/advantagePool.ts`
   *  `campGain` : seul point de gain en combat, AA 11 l.11-13, LDB 10 l.364). Absent : primitif
   *  `engine/advantage.gainAdvantage`. */
  onGainAdvantage?: (c: Combatant, n: number) => void;
  /** Branché par la couche state en combat : reçoit l'objet de l'inventaire qu'un combattant LÂCHE (op `disarm`), déjà
   *  retiré de lui (`laisserTomber`), pour le déposer au sol à sa case. Sans crochet (moteur pur, hors combat), l'arme
   *  quitte la main et reste à son porteur (`lacherLArme`). */
  onLacher?: (c: Combatant, objet: ItemInstance) => void;
  /** Branché par la couche state (`noyau/combatFlow.crochetDeZone`) : POSE la zone d'une op `zone` qui porte sa durée
   *  (`durationRounds`, déjà tirée en `rounds`) sur `cible`, ou au point `centreDeZone`. Sans crochet (moteur pur), l'op
   *  reste inerte. */
  onZone?: (op: Extract<GameOp, { op: 'zone' }>, rounds: number, cible: Combatant, ctx: OpsCtx) => string[];
  /** Point où se pose la zone d'une op `zone` quand ce n'est pas la case de sa cible : le point d'arrivée d'une arme
   *  lancée qui manque (LDB 14 l.142 ; #4202). */
  centreDeZone?: { x: number; y: number; z?: number };
  /** Clause d'Avantage de groupe (AA) du Trait Redoutable (`MDG 16 l.13`) : branché par le store
   *  (`noyau/combat/advantagePool.ts` `creditOpposingAdvantage`, fourni par `turnHooks.fireTurnEdgeTriggers`
   *  pour `onTurnStart`) sur l'op `topUpAdvantage{feedOpposingPool:true}` — crédite `n` (l'Indice PLEIN) à la
   *  réserve du camp OPPOSÉ. Sans contexte (moteur pur/tests, hors mode groupe), la clause est inerte. */
  onOpposingAdvantage?: (n: number) => string[];
  /** ARME du coup courant — quand un `op:'wounds' { weaponHit:true }` résout les Blessures comme un coup
   *  d'arme (`woundsFromHit` : qualités + armure à `location` + BE). Posé par le routeur d'attaque (S4) et
   *  par les effets d'AIRE d'une arme (munitions). Absent → l'op reste en mode Formula. */
  weapon?: Weapon;
}

/**
 * Durée d'un effet actif posé au cours d'une incantation, dérivée du contexte. Échelles mutuellement
 * exclusives (cf. `engine/duration.ts`) : horloge (minutes/heures/jours, LDB 47) prime ; sinon Rounds ;
 * sinon permanent (effet sans durée déclarée, retiré explicitement) — aucune sentinelle de repli.
 */
export function durationFromCtx(ctx: OpsCtx): Duration {
  if (ctx.defaultUntilTime != null) return { scale: 'clock', until: ctx.defaultUntilTime };
  if (ctx.defaultDurationRounds != null) return { scale: 'rounds', left: ctx.defaultDurationRounds };
  return { scale: 'permanent' };
}

/** Libellé EXACT de l'échéance d'horloge d'une durée posée (« 4 j », « 7 h »), vide hors horloge. */
function libelleDHorloge(duree: Duration, ctx: OpsCtx): string {
  return duree.scale === 'clock' ? clockLabel(duree.until - (ctx.now ?? 0), { exact: true }) ?? '' : '';
}

/** Champs de DURÉE qu'une op peut porter — consommés à la pose par `durationFromOp`. */
interface OpDuree { durationRounds?: Formula; durationMinutes?: Formula; durationHours?: Formula; durationDays?: Formula; durationWeeks?: Formula }

/** L'op porte-t-elle une durée d'HORLOGE intrinsèque ? */
function aUneHorloge(o: OpDuree): boolean {
  return o.durationMinutes != null || o.durationHours != null || o.durationDays != null || o.durationWeeks != null;
}

/** Minutes d'HORLOGE intrinsèques de l'op, résolues UNE fois dans `ctx` ; `undefined` sans champ
 *  d'horloge. */
function minutesDHorloge(o: OpDuree, ref: Combatant, ctx: OpsCtx): number | undefined {
  if (!aUneHorloge(o)) return undefined;
  return formuleDuCtx(o.durationMinutes ?? 0, ref, ctx) + formuleDuCtx(o.durationHours ?? 0, ref, ctx) * 60
    + formuleDuCtx(o.durationDays ?? 0, ref, ctx) * MINUTES_PER_DAY
    + formuleDuCtx(o.durationWeeks ?? 0, ref, ctx) * minutesParSemaine();
}

/** Résout `f` dans le contexte `ctx` de l'op qui la porte : TOUS les termes de contexte (`rolled`, `indiceOf`,
 *  `stacks`, `engagedAdvantageGap`, `woundsDealt`, `sl`) y valent leur valeur courante — un terme qu'un
 *  site omettrait vaudrait 0 en silence. `ctx` est lu à l'appel : `woundsDealt` est vivant pendant la
 *  boucle d'`applyOps`. */
function formuleDuCtx(f: Formula, ref: Combatant, ctx: OpsCtx): number {
  return resolveFormula(f, ref, ctx.rng, ctx.rolled, ctx.indice, ctx.stacks, ctx.engagedAdvantageGap, ctx.woundsDealt, ctx.sl);
}

/** Durée INTRINSÈQUE portée par l'op (Rounds, sinon horloge depuis `ctx.now`), à défaut celle du
 *  contexte — mêmes échelles exclusives que `durationFromCtx` (LDB 47). Un minimum de durée vit dans
 *  la FORMULE de l'entrée (`{minimum, of}`), jamais au site d'appel. */
function durationFromOp(o: OpDuree, ctx: OpsCtx, ref: Combatant): Duration {
  if (o.durationRounds != null) return { scale: 'rounds', left: formuleDuCtx(o.durationRounds, ref, ctx) };
  const minutes = minutesDHorloge(o, ref, ctx);
  if (minutes != null) return { scale: 'clock', until: (ctx.now ?? 0) + minutes };
  return durationFromCtx(ctx);
}

/** L'op telle qu'elle vit en PASSIF : ses champs de durée sont consommés à la pose (l'`ActiveEffect`
 *  porteur EST la durée), comme le canal de l'État porté (`data/schemas/grammaire/mecanique.ts`). */
function sansDuree<T extends OpDuree>(o: T): T {
  const passif = { ...o };
  delete passif.durationRounds;
  delete passif.durationMinutes;
  delete passif.durationHours;
  delete passif.durationDays;
  return passif;
}

/**
 * CAUSE PERSISTANTE (`LDB 16 l.117`) : une op `condition` RÉCURRENTE gatée sur l'État qu'elle pose —
 * le porteur ne subit pas un État de plus par Round, il le REGAGNE tant que la cause dure. UNIQUE
 * définition du prédicat : l'application (journal) et les lecteurs du Codex (`noyau/codex/opRows.ts`,
 * `humanize.ts`, `registry.ts`) l'importent d'ici. Accepte aussi le dialecte miscast
 * (`data/miscast.json`, `engine/miscast.ts`), dont les champs portent les mêmes noms et la même forme.
 */
export function estCausePersistante(o: { op?: unknown; perRound?: unknown }): boolean {
  return o.perRound === true && estPoseDEtat(o) && o.unlessCondition?.id === o.id.id;
}

/** L'op pose-t-elle un État ? Une op `condition` du `GameOp` comme du dialecte miscast. */
export const estPoseDEtat = (o: { op?: unknown }): o is { op: 'condition'; id: { id: string }; unlessCondition?: { id: string } } => o.op === 'condition';

/** Message UNIQUE du refus « récurrence à l'horloge » — rendu au PARSE (`data/schemas/grammaire/mecanique.ts`)
 *  et à l'application (`applyOps`), mot pour mot. */
export function messageRecurrenceHorloge(id: string): string {
  return t('op.err.recurrenceHorloge', { id });
}

/** Message UNIQUE du refus « État PORTÉ sans durée de contexte » (#1695) — rendu au PARSE du document
 *  de Sort (`data/schemas/defs/spells.ts`, quand la Durée est instantanée ou absente) et à l'application
 *  (`applyOps`, quand `durationFromCtx` rend `permanent`), mot pour mot. Jumeau de ci-dessus. */
export function messagePorteSansDuree(id: string): string {
  return t('op.err.porteSansDuree', { id });
}

/** Pose un effet actif porteur d'ops RÉCURRENTES (re-jouées chaque fin de Round par `endOfRound`).
 *  Durée : celle que l'op PORTE (`duration` — « un minimum de 1d10 Rounds » d'une rangée de table,
 *  `LDB 40 l.75`), sinon celle du sort (`ctx`), Surincantation de Durée incluse. Les `ops` doivent
 *  être round-safe (valeurs littérales) — pas de résolution de formule/`perSL` au tick. */
function pushPerRound(target: Combatant, ops: GameOp[], ctx: OpsCtx, duration?: Duration): void {
  target.activeEffects = target.activeEffects ?? [];
  target.activeEffects.push({
    label: nomDeSource(ctx), bonus: 0,
    duration: duration ?? durationFromCtx(ctx),
    opsPerRound: ops,
  });
}

/**
 * PROVENANCE d'effets déclenchés qu'une op FOND dans un objet (`augmentWeapon`/`grantWeapon` :
 * l'enchantement d'un sort, le poison d'un consommable, l'arme invoquée) — les effets gardent
 * l'ENTITÉ qui les a posés (`ctx.source`), au lieu d'hériter de celle de l'ARME porteuse au moment
 * du dispatch (`effectSourcesOf`, qui ne tague QUE ce qui n'a pas déjà de source).
 *
 * Sans elle, la Morsure de l'hiver enduite sur une épée se présente comme l'ÉPÉE : la pastille
 * d'effet ouvrirait la fiche de l'arme, et l'enjeu du Test qu'elle exige dirait « ce qui se joue :
 * Épée » au lieu du sort (#1262 V2 L6d). Immuable (clone partiel) ; sans `source`, inchangés — un
 * effet EN PROPRE de l'objet (Déchireur de sociabilité) reste, lui, attribué à l'objet, ce qui est juste.
 */
function stampSource(effects: TriggeredEffect[], source?: EffectSource): TriggeredEffect[] {
  if (!source) return effects;
  return effects.map((e) => (e.source ? e : { ...e, source }));
}

/**
 * ZONE d'une AURA DE GARDE (Dôme, Bouclier anti-flèches) — elle n'est PAS un paramètre de l'op : elle
 * est déclarée UNE fois, par la ligne « Cible » du sort qui la pose (ZdE en DIAMÈTRE, LDB 47 l.28), et
 * arrive ici DÉJÀ RÉSOLUE (`OpsCtx.sourceSpell.zde`). Aucune arithmétique de zone dans l'op.
 *
 * `porteur` : la cible de CET `applyOps` est le lanceur, donc celui qui ÉRIGE la zone — les autres n'y
 * sont que couverts, et leur ligne de journal le dit courtément (au lieu de répéter la zone à chacun).
 *
 * FAIL-FAST : une aura posée hors d'un sort à ZdE n'a AUCUNE zone où se mesurer ; la deviner (un rayon
 * par défaut) rendrait une protection que personne n'a déclarée.
 */
function zoneDeGarde(ctx: OpsCtx, cible: Combatant, op: string): { rayonM: number; diametreM: number; porteur: boolean } {
  const zde = ctx.sourceSpell?.zde;
  if (!zde) {
    throw new Error(`op « ${op} » : aucune Zone d'Effet à lire — la zone d'une aura de garde vient de la `
      + "ligne « Cible » du sort qui la pose (LDB 47 l.28), et ce contexte n'en porte pas.");
  }
  return { ...zde, porteur: ctx.caster?.id === cible.id };
}

/**
 * PARTITION TOTALE des champs d'`OpsCtx` pour le canal op → applier (#1508) — quatre seaux, et un
 * champ d'`OpsCtx` appartient à EXACTEMENT un.
 *
 * Elle existe parce qu'une feuille d'ops DIFFÉRÉE (ses dés ouverts à la porte) se reprend PLUS TARD,
 * depuis une étape SÉRIALISÉE : son contexte doit traverser une sauvegarde et le réseau. Reconstruire
 * « les quelques champs dont on se souvient » perdait mesurablement le reste (`{woundsDealt}` d'EDO 11
 * tombait à 0). La totalité est tenue AU TYPE (`_OpsCtxPartitionTotale` ci-dessous) : ajouter un champ
 * à `OpsCtx` sans le classer ici ne compile plus — aucune liste à la main ne peut dériver en silence.
 */
/** GELÉS : primitifs/données pures, portés VERBATIM par le `meta` de l'étape (sérialisables, coop). */
export const OPS_CTX_GELES = [
  'sourceSpell', 'sourceSpellId', 'conjureForm', 'label', 'rejeuRecurrent', 'source', 'effectId', 'blessuresAuTotal',
  'defaultDurationRounds', 'defaultUntilTime', 'now', 'sl', 'overcastDurationSteps', 'chosenTableRolls',
  'noReentryOwnTestFailed', 'woundsDealt', 'rolled', 'indice', 'stacks', 'engagedAdvantageGap',
  'engagedAdvantageLead', 'location', 'attackKind', 'startleCause', 'foeInLoS', 'affliction', 'cibleEnVue',
  'hiddenFromFoes', 'engaged', 'nearestFoeDist', 'weapon', 'centreDeZone',
] as const;
/** PAR RÉFÉRENCE : des Combattants — leur ID voyage, l'état les redonne (`actorIn`/`coqueParId`). */
export const OPS_CTX_PAR_REFERENCE = ['caster', 'hull', 'crew'] as const;
/** REBÂTIS à la reprise par un chemin NOMMÉ (`noyau/combatEffects.ctxRepris`) : le rng et la fabrique d'ids de la partie,
 *  le résolveur d'objets et les hooks de Corruption (`noyau/corruptionFlow.crochetsDeCorruption`), d'Avantage
 *  et du sol, qui reçoivent leur cible en argument (`onOpposingAdvantage` sur le porteur `caster`), et les dés eux-mêmes (relus sur les étapes
 *  sœurs — jamais recopiés). */
export const OPS_CTX_REBATIS = ['rng', 'idNeuf', 'resolveTrapping', 'onCorruption', 'onCorruptionExposure', 'onGainAdvantage', 'onOpposingAdvantage', 'onLacher', 'onZone', 'onChoixDeTrait', 'des'] as const;

type CleClassee =
  | (typeof OPS_CTX_GELES)[number] | (typeof OPS_CTX_PAR_REFERENCE)[number]
  | (typeof OPS_CTX_REBATIS)[number];
/** Les champs d'`OpsCtx` qu'AUCUN seau ne réclame — `never` tant que la partition est totale. */
export type CleOpsCtxNonClassee = Exclude<keyof OpsCtx, CleClassee>;
/** TOTALITÉ AU TYPE : si `CleOpsCtxNonClassee` cesse d'être `never` (champ ajouté à `OpsCtx` sans seau),
 *  ce type devient `false` et `tsc` échoue ICI, en nommant le champ. */
export type _OpsCtxPartitionTotale = [CleOpsCtxNonClassee] extends [never] ? true
  : ['CHAMP D_OpsCtx NON CLASSÉ — le classer dans OPS_CTX_GELES / _PAR_REFERENCE / _REBATIS', CleOpsCtxNonClassee];
const _partitionTotale: _OpsCtxPartitionTotale = true;
void _partitionTotale;

/** La NATURE de ce que pose un lot d'ops, qui le nomme quand sa source n'a pas de libellé (#1906). */
/** Ce que fait une pénalité d'incantation (`CastPenalty`), en clair : le libellé UNIQUE du journal et de
 *  sa pastille d'état. */
export function effetDePenaliteDIncantation(cp: Pick<CastPenalty, 'skill' | 'mod' | 'blocked' | 'maxZeroDR'>): string {
  const skill = cp.skill === ALL_MAGIC ? t('op.frag.touteMagie') : refLabel('skills', { id: cp.skill });
  if (cp.blocked) return t('op.penaliteDIncantation.bloquee', { skill });
  if (cp.maxZeroDR) return t('op.penaliteDIncantation.drMaxNul');
  return cp.mod == null ? '' : t('op.penaliteDIncantation.modificateur', { mod: String(cp.mod), skill });
}

/** Le CONTEXTE GELÉ d'une feuille différée — la part d'`OpsCtx` qui voyage telle quelle. */
export type OpsCtxGele = Pick<OpsCtx, (typeof OPS_CTX_GELES)[number]>;

/** GÈLE la part sérialisable d'un `OpsCtx` (champs `undefined` omis — un `meta` snapshoté en JSON ne
 *  porte pas de trous). Lecture UNIQUE de `OPS_CTX_GELES` : rien à tenir à jour ailleurs. */
export function gelerOpsCtx(ctx: OpsCtx): OpsCtxGele {
  const out: Record<string, unknown> = {};
  for (const k of OPS_CTX_GELES) if (ctx[k] !== undefined) out[k] = ctx[k];
  return out as OpsCtxGele;
}

/** Rang dans `c.psychTraits` du Trait que retire `o` : l'instance visée (type et Cible), sinon le premier Trait
 *  du type nommé, sinon le premier porté ; −1 si aucun. */
function rangDuTraitARetirer(c: Combatant, o: Extract<GameOp, { op: 'removePsychTrait' }>): number {
  const traits = c.psychTraits ?? [];
  if (!o.psychType) return traits.length ? 0 : -1;
  const type = o.psychType.id;
  if (o.cible === undefined) return traits.findIndex((p) => p.type === type);
  const visee = identiteDeCiblage(type, cibleDeRef(o.cible));
  return traits.findIndex((p) => identiteDeCiblage(p.type, p.cible) === visee);
}

/** Le contexte où se juge une op de retrait : DR et source de l'application ; `avantLeJet` juge l'op avant le
 *  Test qui l'échelonne, un compte qui croît avec le DR restant alors possible. */
export type ContexteDeRetrait = Pick<OpsCtx, 'sl' | 'source' | 'affliction'> & { avantLeJet?: boolean };

/** Les afflictions de `c` auxquelles `o` met fin : l'instance du contexte (`instance`, par son identité de
 *  ciblage), ou celles du type ; une affliction ciblée seulement si elle est ACTIVE. */
function afflictionsFinies(c: Combatant, o: Extract<GameOp, { op: 'endPsych' }>, ctx: ContexteDeRetrait): PsychAffliction[] {
  const visee = o.instance
    ? (p: PsychAffliction) => !!ctx.affliction && identiteDeCiblage(p.type, p.cible) === identiteDeCiblage(ctx.affliction.type, ctx.affliction.cible)
    : (p: PsychAffliction) => p.type === o.type?.id;
  return (c.psychState ?? []).filter((p) => visee(p) && (!estCibleType(p.type) || p.active === true));
}

/** Le type d'état psy que nomme une op `endPsych` (celui de l'instance du contexte, sinon le sien). */
const typeDeFin = (o: Extract<GameOp, { op: 'endPsych' }>, ctx: ContexteDeRetrait): string | undefined =>
  o.instance ? ctx.affliction?.type : o.type?.id;

/** Un compte `base` + échelle de DR est-il positif sous `ctx` ? */
function comptePositif(base: number, perSL: PerSL | undefined, ctx: ContexteDeRetrait): boolean {
  return base + slBonus(ctx.sl, perSL) > 0 || (!!ctx.avantLeJet && !!perSL && perSL.amount > 0 && !perSL.onFailure);
}

/** La raison pour laquelle l'op de RETRAIT `o` n'a rien à ôter à `c` sous `ctx` (État, Trait accordé, état ou
 *  Trait psychologique, maladie, Blessure critique, Péché), ou `null` : l'op changerait la fiche. Prédicat
 *  UNIQUE : `applyOps` saute sans un mot l'op sans objet, les verdicts des gestes délibérés disent sa raison. */
export function opSansObjet(c: Combatant, o: GameOp, ctx: ContexteDeRetrait = {}): string | null {
  switch (o.op) {
    case 'removeCondition': {
      const id = o.id?.id ?? c.conditions[0]?.id;
      if (!id) return t('op.sansEtatARetirer', { name: nomDe(c) });
      return pionsRetirables(c, id) > 0 ? null : t('op.sansPionDEtatARetirer', { name: nomDe(c), cond: conditionLabel(id) });
    }
    case 'removeTrait':
      return traitsAccordesPar(c, o.trait.id, ctx.source).length ? null : t('op.sansTraitARetirer', { name: nomDe(c), trait: refLabel('traits', o.trait) });
    case 'endPsych': {
      if (afflictionsFinies(c, o, ctx).length) return null;
      const type = typeDeFin(o, ctx);
      return type ? t('op.sansPsychologieAFinir', { name: nomDe(c), psych: psychologyLabel(type) }) : t('op.sansInstanceDePsychologie', { name: nomDe(c) });
    }
    case 'removePsychTrait': return rangDuTraitARetirer(c, o) < 0 ? t('op.sansPsychologieARetirer', { name: nomDe(c) }) : null;
    case 'sinMod': return o.amount === 0 || (o.amount < 0 && !(c.sinPoints ?? 0)) ? t('op.sansPecheARetirer', { name: nomDe(c) }) : null;
    case 'cureDisease':
      return c.diseases?.length && comptePositif(o.count ?? 1, o.countPerSL, ctx) ? null : t('op.sansMaladieAGuerir', { name: nomDe(c) });
    case 'cureCriticalWound':
      return (c.traumas ?? []).some((tr) => tr.kind != null) && comptePositif(o.count ?? 1, o.countPerSL, ctx) ? null : t('op.sansCritiqueAGuerir', { name: nomDe(c) });
    case 'reduceDiseaseDays': {
      const opts = { disease: o.disease?.id, once: o.oncePerDisease };
      const dz = maladieABenir(c, opts);
      if (!dz) return aucuneMaladieABenir(c, opts);
      const raccourcit = dz.minutesLeft > MINUTES_PER_DAY && (!!o.dice || comptePositif(o.days ?? 1, o.daysPerSL, ctx));
      return o.oncePerDisease || raccourcit ? null : t('rest.diseaseUnchanged', { name: nomDe(c), disease: diseaseLabel(dz.id) });
    }
    case 'aideMedicale':
      return (c.traumas ?? []).some((tr) => tr.awaitingMedicalAid) || aUnVerrouLevePar(c, 'medicalAid') ? null : t('op.sansAideMedicaleAttendue', { name: nomDe(c) });
    default: return null;
  }
}

/** La ligne de journal d'un Test d'Exposition dû par `c`, niveau libellé. LDB 19 l.29 */
export function ligneDExposition(c: Combatant, level: ExposureLevel): string {
  return t('op.expositionALaCorruption', { name: nomDe(c), level: libelleDeValeur(exposureLevelSchema, level) });
}

/** La raison pour laquelle les ops de RÉUSSITE `ops` d'un geste délibéré (Activité, consommable) n'auraient
 *  rien à changer à `c` : chacune est `opSansObjet`, et la première dit pourquoi ; `null` sinon. */
export function reussiteSansObjet(c: Combatant, ops: readonly GameOp[], ctx: ContexteDeRetrait = {}): string | null {
  if (!ops.length) return null;
  const raisons = ops.map((o) => opSansObjet(c, o, ctx));
  return raisons.every((r) => r != null) ? raisons[0] : null;
}

type OpTable = Extract<GameOp, { op: 'rollTable' }>;

/** Les rangées d'une op `rollTable` : en ligne (`entries`) ou référencées (`table` → tables.json, fail-fast). */
function rangeesDeLaTable(o: OpTable): { min: number; max: number; ops: GameOp[] }[] {
  return o.table ? findEffectTableById(o.table.id).entries : o.entries;
}

/** Une rangée tirée d'une `rollTable` : ses ops et le dé tiré (`rolled` des ops de la rangée). */
interface RangeeTiree { ops: GameOp[]; rolled: number }

/** Développe une op `rollTable` en rangées tirées, sans rien appliquer : un jet par rangée rendue, tiré à la
 *  demande (l'appelant qui applique une rangée avant la suivante garde l'ordre des tirages de `rng`).
 *  VDM 03 l.698 ; MSRC 16 l.90 ; EDOC 13 l.276 */
export function* tirerLaTable(o: OpTable, ctx: Pick<OpsCtx, 'sl' | 'overcastDurationSteps' | 'chosenTableRolls'>, rng: RNG): Generator<RangeeTiree> {
  const rows = rangeesDeLaTable(o);
  const de = o.table ? effectTableDie(o.table.id) : deDeTirageDe(o);
  const modifier = (o.mod ?? 0) + (o.addNegativeSL ? Math.max(0, -(ctx.sl ?? 0)) : 0);
  const allocatedSteps = Math.max(0, ctx.overcastDurationSteps ?? 0);
  const chosenSteps = Math.min(ctx.chosenTableRolls ?? allocatedSteps, allocatedSteps);
  const times = 1 + (o.extraRollsPerStep ? chosenSteps * o.extraRollsPerStep : 0);
  for (let i = 0; i < times; i++) {
    const rolled = rollDice(de, rng);
    yield { ops: findTableEntry(rows, rolled + modifier).ops, rolled };
  }
}

/**
 * Exécute une liste d'ops sur `target`. Les `charMod` consécutifs d'une même
 * source sont appliqués individuellement mais journalisés en UNE ligne (format
 * historique de l'incantation). Renvoie les lignes de journal et les faits appliqués (#4574).
 */
export function applyOps(target: Combatant, opsRecues: GameOp[], ctx: OpsCtx): Applique {
  const ops = structuredClone(opsRecues); // #2097
  const source = structuredClone(ctx.source); // #2097
  const rng = ctx.rng;
  const ref = ctx.caster ?? target;
  const lines: string[] = [];
  const sortie: Applique = { lignes: lines, faits: [] };
  // LA seule émission d'un fait de la classe (#4574) : le fait et sa ligne, ensemble.
  const emettre = (cible: Combatant, f: FaitAvecLigne) => emettreDans(sortie, cible, f, ctx.label);
  // Une perte de Blessures et les faits de ses conséquences (`loseWounds`), que le journal ne dit pas.
  const perdre = (cible: Combatant, n: number, mitigation?: Extract<FaitAvecLigne, { genre: 'blessures' }>['mitigation']): number => {
    const perte = loseWounds(cible, n);
    if (perte.perdues > 0) emettre(cible, { genre: 'blessures', ...sur(cible), valeur: -perte.perdues, ...(mitigation ? { mitigation } : {}) }); // LDB 16 l.105
    for (const f of perte.faits) constaterDans(sortie, f);
    return perte.perdues;
  };
  const sur = (cible: Combatant) => ({ cible: cible.id, camp: campOf(cible) });
  // Ce qu'une application imbriquée ou un socle d'États a dit : ses lignes ET ses faits.
  const absorber = (a: Applique) => { lines.push(...a.lignes); sortie.faits.push(...a.faits); };
  // Soin par la SOURCE UNIQUE `applyHealWounds` : le fait dit les Blessures RÉELLEMENT regagnées (post-plafond).
  const soigner = (qui: Combatant, n: number, vol?: true) => {
    const avant = qui.wounds.current;
    const suite = applyHealWounds(qui, n, { wake: false, log: () => [] });
    const regagnees = qui.wounds.current - avant;
    if (!vol || regagnees > 0) emettre(qui, { genre: 'blessures', ...sur(qui), valeur: regagnees, ...(vol ? { vol } : {}) });
    lines.push(...suite);
  };
  // DISSIPATION (LDB 46) : on retient les ActiveEffect PRÉ-EXISTANTS (par référence) pour ne marquer,
  // en fin d'op, QUE ceux posés par CE sort source (robuste au dédoublonnage en place de `applyActiveEffect`).
  const preEffects = (ctx.sourceSpell || ctx.sourceSpellId || ctx.effectId || source) ? new Set(target.activeEffects ?? []) : null;
  // Agrégation des charMod (une ligne par source, façon « Écorce (-10 Ag, -10 Dex, 6 rounds) »).
  const charParts: string[] = [];
  let charRounds: number | null = null;
  let charClockMin: number | null = null;
  const flushCharMods = () => {
    if (!charParts.length) return;
    const dur = charRounds != null ? t('op.frag.rounds', { n: charRounds })
      : charClockMin != null ? (charClockMin >= 60 ? t('op.frag.heures', { n: Math.round(charClockMin / 60), s: charClockMin >= 120 ? 's' : '' }) : t('op.frag.minutes', { n: charClockMin }))
      : t('op.frag.horsCombat');
    lines.push(t('op.ligneDeCaracteristique', { name: nomDe(target), label: nomDeSource(ctx), parts: charParts.join(', '), dur }));
    charParts.length = 0;
  };
  // Filtre par Groupe de la CIBLE (engine/groups) : `only` = doit appartenir à l'un (« les
  // Morts-vivants gagnent aussi… ») ; `except` = exclu si appartient à l'un (Morsure de l'hiver :
  // hors Mort-vivant/Démon).
  const groupGate = (only?: string[], except?: string[]): boolean =>
    (!only || only.some((g) => groupMatch(g, groupesDe(target))))
    && (!except || !except.some((g) => groupMatch(g, groupesDe(target))));
  // CONTEXTE des ops IMBRIQUÉES (rangée de table, seuil franchi, forme, échelon d'aggravation) —
  // DÉRIVATION UNIQUE, appelée à chaque descente : le drapeau de REJEU n'y descend pas. Il ne vaut que
  // pour les ops LITTÉRALES re-jouées par `endOfRound` (`LDB 16 l.117`) ; ce qu'un dé atteint sous elles
  // est une PREMIÈRE pose, qu'aucune fin de Round n'avait encore posée. Fonction et non constante : le
  // ctx est vivant pendant la boucle (`ctx.woundsDealt`), un instantané pris ici le figerait.
  //  Les DÉS POSÉS n'y descendent pas non plus : leurs clés (`cleDeDe`) sont indexées sur le rang de
  //  l'op dans CE tableau, et le rang 0 d'une descente collisionnerait avec le rang 0 du parent.
  //  Le marquage des Blessures au total (`blessuresAuTotal`, #3060) y descend : la liste qui porte
  //  l'`attrMod` couvre ses descentes.
  const blessuresAuTotal = ctx.blessuresAuTotal ?? (ops.some((o) => o.op === 'attrMod' && o.attr === 'wounds' && o.auTotal) ? true : undefined);
  const imbrique = (extra?: Partial<OpsCtx>): OpsCtx => ({ ...ctx, blessuresAuTotal, ...extra, rejeuRecurrent: undefined, des: undefined });
  // LE DÉ D'UNE OP (#1508), seul point de consommation du canal : la valeur POSÉE par la porte pour le
  // champ DÉCLARÉ (`DES_DUNE_OP`), à défaut le tirage — au même point du rng qu'avant le canal. Le
  // `case` ne connaît ni la clé ni sa graphie : il nomme son CHAMP, comme la déclaration.
  //
  // Le lecteur se FABRIQUE à partir des déclarations (`lecteurDe(rang, declares)`), et c'est ce qui
  // ferme la faute de frappe : le type des champs vient des SEULES déclarations, le nom demandé s'y
  // vérifie. Pris dans le MÊME appel, le nom et les déclarations laissent l'inférence les unifier, et
  // `'degatss'` compile : d'où les deux temps.
  const lecteurDe = <C extends string>(rang: number, declares: DeDeclare<C>[]) => (champ: C): number => {
    const d = declares.find((x) => x.champ === champ);
    if (!d) throw new Error(`op « ${ops[rang]?.op} » : dé « ${champ} » non DÉCLARÉ (DES_DUNE_OP) — la porte ne peut pas l'ouvrir, et il tomberait en silence.`);
    return ctx.des?.get(cleDeDe(rang, champ)) ?? rollDice(d.spec, rng);
  };
  for (const [iOp, o] of ops.entries()) {
    if (o.op !== 'charMod') flushCharMods();
    if (opSansObjet(target, o, ctx)) continue;
    switch (o.op) {
      case 'wounds': {
        if (!groupGate(o.onlyGroups)) break;
        const raw = Math.max(0, formuleDuCtx(o.amount, ref, ctx) + slBonus(ctx.sl, o.perSL));
        // MODE COUP D'ARME (S1) : délègue au résolveur partagé `woundsFromHit` → qualités d'arme
        // (Perforante/Empaleuse), armure à la `ctx.location` et BE, sans dupliquer la mitigation.
        if (o.weaponHit && ctx.weapon) {
          const n = woundsFromHit(ctx.weapon, target, ctx.location ?? 'corps', raw, o.extraAP ?? 0, o.min ?? 1, ctx.caster?.size);
          ctx.woundsDealt = perdre(target, n); // PB réellement perdus (drain/Vol de vie suivant)
          break;
        }
        // Défaut : ignore BE+PA. `ignoreTB:false` → déduit le Bonus d'Endurance ; `ignoreAP:false` → déduit les PA.
        const tb = o.ignoreTB === false ? bonus(effectiveChar(target, 'endurance')) : 0;
        // `apFrom:'least'` → PA de la Localisation la moins protégée (En Flammes) ; sinon le Corps.
        const locDesPA = o.apFrom === 'least'
          ? LOCALISATIONS_DE_COUP.reduce((m, l) => (effectiveArmourAt(target, l) < effectiveArmourAt(target, m) ? l : m))
          : 'corps';
        const totalAP = effectiveArmourAt(target, locDesPA);
        const bypass = o.bypassArmour ? bypassedAP(target, locDesPA, o.bypassArmour, totalAP) : 0; // attribut de Domaine : perce le métal/non-magique
        // PA de la Localisation (si non ignorés) + PA situationnels du coup (`extraAP` : poupe/Bélier de collision…).
        const ap = (o.ignoreAP === false ? Math.max(0, totalAP - bypass) : 0) + (o.extraAP ?? 0);
        const n = Math.max(o.min ?? 0, raw - tb - ap);
        // `ctx.woundsDealt` = PB RÉELLEMENT perdus (clampé par loseWounds) → un drain/Vol de vie qui SUIT
        // (`lifeSteal`) soigne « le même nombre » que la victime a effectivement perdu (Absorption EDO 11 l.222).
        const mitigation = o.ignoreTB === false || o.ignoreAP === false
          ? { pa: o.ignoreAP === false ? 'touches' as const : 'ignores' as const, be: o.ignoreTB === false ? 'deduit' as const : 'ignore' as const }
          : 'sans' as const;
        ctx.woundsDealt = perdre(target, n, mitigation); // perte centralisée (−Avantage + À Terre à 0)
        break;
      }
      case 'heal': {
        const n = soinMagiqueOperant(target) ? Math.max(0, formuleDuCtx(o.amount, ref, ctx) + slBonus(ctx.sl, o.perSL)) : 0; // AA 10 l.134
        // SOURCE UNIQUE `applyHealWounds` (`healing.ts`) : plafonné par munition Empaleuse logée (LDB
        // 62 l.250) comme le reste ; ni verrou « soin de rencontre » (Guérison seulement) ni réveil
        // ici — sort/potion inconscient géré par `receiveMedicalAid`/`releaseConditionLocks` ci-dessous.
        soigner(target, n);
        lines.push(...receiveMedicalAid(target)); // sort/prière de soin = Aide Médicale (LDB 18 l.311)
        absorber(releaseConditionLocks(target, ctx.sourceSpellId != null ? 'magic' : 'medicalAid')); // verrous d'État (LDB 18) : soin d'un sort = magie (⊇ Aide Médicale) ; potion/objet = Aide Médicale
        break;
      }
      case 'healCaster': {
        const who = ctx.caster ?? target;
        const n = Math.max(0, formuleDuCtx(o.amount, ref, ctx));
        soigner(who, n);
        lines.push(...receiveMedicalAid(who)); // sort/prière de soin = Aide Médicale (LDB 18 l.311)
        absorber(releaseConditionLocks(who, 'magic')); // healCaster = soin d'un sort → magie (lève aussi les verrous Aide Médicale, LDB 18)
        break;
      }
      case 'gainAdvantage': {
        const n = Math.max(0, formuleDuCtx(o.amount, ref, ctx));
        const avant = target.advantage ?? 0;
        if (ctx.onGainAdvantage) ctx.onGainAdvantage(target, n);
        else gainAvantage(target, n);
        const gagne = (target.advantage ?? 0) - avant;
        if (gagne > 0) emettre(target, { genre: 'avantage', ...sur(target), valeur: gagne, total: target.advantage ?? 0 });
        break;
      }
      case 'topUpAdvantage': {
        // Porte l'Avantage à AU MOINS `amount` (jamais réduit) — Redoutable complète jusqu'à l'Indice.
        const want = typeof o.amount === 'string' ? 0 : Math.max(0, formuleDuCtx(o.amount, ref, ctx));
        const avant = target.advantage ?? 0;
        if (avant < want) {
          target.advantage = want;
          emettre(target, { genre: 'avantage', ...sur(target), valeur: want - avant, total: want, complete: true });
        }
        // Clause AA Redoutable (MDG 16 l.13) : l'op S'EXÉCUTE ⇒ le garde-fou de la donnée (empetre/
        // inconscient/surpris, dans le nœud `if` englobant) est déjà franchi — l'Indice PLEIN part EN
        // PLUS pour la réserve adverse, indépendamment de si `target.advantage` avait déjà atteint `want`.
        // Garde HÉRITÉE par le feed de groupe : arbitrage user 2026-07-16 (#536).
        if (o.feedOpposingPool) lines.push(...(ctx.onOpposingAdvantage?.(want) ?? []));
        break;
      }
      case 'condition': {
        const id = o.id.id;
        if (!groupGate(o.onlyGroups)) break;
        if (o.grapple && !peutEtreEmpoigne(target)) break; // #1595 c.6230022636
        if (o.perRound && aUneHorloge(o)) throw new Error(messageRecurrenceHorloge(id));
        // Gates d'État (Sommeil, LDB 47) : l'op ne s'applique que si la cible porte / ne porte pas
        // l'État — évalués à CHAQUE application. Sous `perRound`, l'application est le REJEU de fin
        // de Round : les gates partent AVEC l'op récurrente (ci-dessous) et sont évalués là.
        if (!o.perRound) {
          if (o.onlyIfCondition && !hasCondition(target, o.onlyIfCondition.id)) break;
          if (o.unlessCondition && hasCondition(target, o.unlessCondition.id)) break;
        }
        const v = Math.max(1, formuleDuCtx(o.value ?? 1, ref, ctx) + slBonus(ctx.sl, o.valuePerSL));
        if (o.carried) {
          // État PORTÉ (#1695, LDB 48 l.495) : UN effet porteur par op — deux lancers du même sort font
          // deux effets, donc deux pions (LDB 16 l.11). L'op passive porte la valeur RÉSOLUE ; le pion,
          // sa durée et son retrait sont l'affaire de la réconciliation (`syncDerivedConditions`, fin
          // d'`applyOps`) — qui pousse AUSSI la ligne de journal et la notification de l'État.
          const duree = durationFromCtx(ctx);
          if (duree.scale === 'permanent') {
            // « Porté » sans source DATÉE n'a aucun sens : le pion serait PERMANENT, anonyme et hors de
            // portée de la Détermination. REFUS journalisé, aucun effet posé : une donnée fautive se VOIT au
            // journal, elle ne tue pas l'incantation en cours.
            lines.push(messagePorteSansDuree(id));
            break;
          }
          target.activeEffects = [...(target.activeEffects ?? []), {
            label: ctx.label ?? conditionLabel(id), bonus: 0, duration: duree,
            passive: [{ op: 'condition', id: o.id, value: v, ...(o.resolveWindow ? { resolveWindow: o.resolveWindow } : {}) }],
          }];
          break;
        }
        // Force d'évasion (Empêtré « se libérer » — LDB 16 l.66) : résolue MAINTENANT contre le
        // référent (le lanceur pour un sort) et FIGÉE sur l'entrée d'État → le flux de récupération
        // l'opposera, même si le lanceur n'est plus en jeu.
        const escape = o.escapeStrength != null ? Math.max(0, formuleDuCtx(o.escapeStrength, ref, ctx)) : undefined;
        const threshold = o.escapeThreshold != null ? Math.max(0, formuleDuCtx(o.escapeThreshold, ref, ctx)) : undefined;
        const struggleDamage = o.struggleDamage != null ? Math.max(0, formuleDuCtx(o.struggleDamage, ref, ctx)) : undefined;
        // Durée PORTÉE par l'op, résolue UNE fois ici : horloge (minutes/heures depuis `ctx.now`) ou
        // Rounds. Exclusives (cf. JSDoc du champ) — l'horloge prime, aucun dé n'est tiré pour l'autre.
        const clockMin = minutesDHorloge(o, ref, ctx);
        const rounds = clockMin == null && o.durationRounds != null ? formuleDuCtx(o.durationRounds, ref, ctx) : undefined;
        const avantageAvant = target.advantage ?? 0;
        if (o.perRound) {
          // État récurrent = cas particulier de l'effet récurrent général (op `perRound`) : la
          // valeur est figée maintenant, l'op `condition` littérale est re-jouée chaque fin de Round,
          // gates compris. L'effet porteur dure ce que l'op déclare, sinon ce que le contexte déclare.
          const duree: Duration | undefined = rounds != null ? { scale: 'rounds', left: rounds } : undefined;
          pushPerRound(target, [{ op: 'condition', id: o.id, value: v, ...(o.onlyIfCondition ? { onlyIfCondition: o.onlyIfCondition } : {}), ...(o.unlessCondition ? { unlessCondition: o.unlessCondition } : {}), ...(escape != null ? { escapeStrength: escape } : {}), ...(threshold != null ? { escapeThreshold: threshold } : {}), ...(o.entangleOnFail ? { entangleOnFail: true } : {}), ...(struggleDamage != null ? { struggleDamage } : {}), ...(o.difficulte ? { difficulte: o.difficulte } : {}) }], ctx, duree);
          // CAUSE PERSISTANTE (`LDB 16 l.117`) : l'op se gate sur l'État qu'elle pose — le porteur ne
          // subit pas un État de plus par Round, il le REGAGNE s'il s'en débarrasse. Journal dédié.
          // L'annonce ne pose aucun État : son fait vaut 0, chaque pose de fin de Round dira le sien.
          emettre(target, { genre: 'etat', ...sur(target), id, valeur: 0, duree: { parRound: v, ...(rounds != null ? { rounds } : {}) },
            ...(estCausePersistante(o) ? { sauf: true } : {}) });
        } else if (clockMin != null) {
          // État à durée d'HORLOGE (Belladone/Fleur de lune : sommeil « 1d10+4/5 heures ») — échéance
          // résolue MAINTENANT depuis ctx.now, purgée par purgeClockEffects (patron castPenalty.minutes).
          const min = clockMin;
          addClockCondition(target, id, v, (ctx.now ?? 0) + min, escape, threshold, o.entangleOnFail, struggleDamage, o.difficulte);
          emettre(target, { genre: 'etat', ...sur(target), id, valeur: v, duree: { minutes: min } });
        } else if (rounds != null) {
          addTimedCondition(target, id, v, rounds, escape, threshold, o.entangleOnFail, struggleDamage, o.difficulte);
          emettre(target, { genre: 'etat', ...sur(target), id, valeur: v, duree: { rounds } });
        } else {
          addCondition(target, id, v, escape, threshold, o.entangleOnFail, struggleDamage, { lockedUntil: o.lockedUntil, unlockBy: o.unlockBy }, o.difficulte); // verrous : prédicat d'état / acte de soin (LDB 18)
          // REJEU d'une cause persistante (`LDB 16 l.117`) : c'est le DRAPEAU de rejeu qui le dit
          // (`ctx.rejeuRecurrent`, posé par `endOfRound` seul), jamais la forme de l'op — une première
          // pose gatée reste une pose. La ligne NOMME la cause, portée par le `ctx.label` relayé.
          emettre(target, { genre: 'etat', ...sur(target), id, valeur: v,
            ...(ctx.rejeuRecurrent && o.unlessCondition?.id === id && ctx.label ? { regagne: true } : {}) });
        }
        if (avantageAvant > 0 && !target.advantage) emettre(target, { genre: 'avantage', ...sur(target), valeur: -avantageAvant, total: 0 }); // LDB 16 l.7
        // Empoignade (LDB 14 l.159) : le flag `grapple` pose la relation symétrique entre l'attaquant
        // (`ctx.caster`) et la cible — UNE seule fois (les ré-applications perRound ne portent pas le flag).
        if (o.grapple && ctx.caster && ctx.caster.id !== target.id) setGrapple(ctx.caster, target);
        break;
      }
      case 'removeCondition': {
        const id = (o.id?.id ?? target.conditions[0]?.id)!; // `opSansObjet` : un État retirable est porté
        // `all` : retire TOUT l'État (Potion de vitalité « tout État Exténué ») ; sinon `value` pions (défaut 1).
        const v = o.all
          ? (target.conditions.find((x) => x.id === id)?.value ?? 1)
          : Math.max(1, formuleDuCtx(o.value ?? 1, ref, ctx) + slBonus(ctx.sl, o.valuePerSL));
        const avant = target.conditions.find((x) => x.id === id)?.value ?? 0;
        removeCondition(target, id, v);
        const retires = avant - (target.conditions.find((x) => x.id === id)?.value ?? 0);
        emettre(target, { genre: 'etat', ...sur(target), id, valeur: -retires, ...(o.all ? { tous: true } : {}) });
        break;
      }
      case 'endPsych': {
        const finies = afflictionsFinies(target, o, ctx); // `opSansObjet` : au moins une
        for (const p of finies) if (estCibleType(p.type)) p.active = false;
        target.psychState = (target.psychState ?? []).filter((p) => estCibleType(p.type) || !finies.includes(p));
        lines.push(t('op.finDePsychologie', { name: nomDe(target), psych: psychologyLabel(finies[0].type) }));
        break;
      }
      case 'beginPsych': {
        // Pose/mise à jour d'un état psychologique porté (collection `psychState`, ≠ `conditions`).
        // UPSERT par identité pour un Trait CIBLÉ, par (`type` + `sourceId`) sinon : un re-Test contre la
        // MÊME source met à jour SON entrée au lieu d'en empiler une seconde.
        const list = [...(target.psychState ?? [])];
        const type = o.type.id;
        const cible = o.cible === undefined ? undefined : cibleDeRef(o.cible);
        const identite = identiteDeCiblage(type, cible);
        const at = list.findIndex((p) => (cible !== undefined ? identiteDeCiblage(p.type, p.cible) === identite : p.type === type && p.sourceId === o.sourceId));
        const precedente: Partial<(typeof list)[number]> = at >= 0 ? list[at] : {};
        const { calmeDR: _calmeDR, surmontee: _surmontee, fromTest: _fromTest, ...gardee } = precedente;
        const active = o.active ?? (estCibleType(type) ? true : undefined);
        const next = {
          ...gardee,
          type,
          ...(cible !== undefined ? { cible } : {}),
          ...(o.sourceId != null ? { sourceId: o.sourceId } : {}),
          ...(o.indice != null ? { indice: Math.max(0, formuleDuCtx(o.indice, ref, ctx)) } : {}),
          ...(o.calmeDR != null ? { calmeDR: Math.max(0, formuleDuCtx(o.calmeDR, ref, ctx)) } : {}),
          ...(o.surmontee != null ? { surmontee: o.surmontee } : {}),
          ...(active != null ? { active } : {}),
          ...(o.lastTestRound != null ? { lastTestRound: o.lastTestRound } : {}),
          ...(o.fromTest != null ? { fromTest: o.fromTest } : {}),
        };
        if (at >= 0) list[at] = next; else list.push(next);
        target.psychState = list;
        // `active:false` = marqueur d'affliction RÉSISTÉE (empêche le re-déclenchement) : rien n'est subi.
        if (o.active !== false) lines.push(t('op.debutDePsychologie', { name: nomDe(target), psych: psychologyLabel(type) }));
        break;
      }
      case 'grantPsychTrait': {
        // Trait PSYCHOLOGIQUE conféré (≠ état de combat) : posé dans `c.psychTraits` (la DONNÉE persistée),
        // noyau PARTAGÉ `grantPsychTrait` (`grantedTraits.ts`) — même chemin qu'`attachMutation` (permanent).
        // À durée d'horloge, l'`ActiveEffect` porteur EST la durée (patron `grantTrait`).
        if (o.envers) throw new Error(`grantPsychTrait « ${o.psychType.id} » : \`envers\` non résolu — le noyau le résout en Cible d'individu avant applyOps (noyau/personneChoisie.ts).`);
        const { type, cible } = traitOctroye(o);
        const pose = grantPsychTrait(target, type, cible, source);
        if (aUneHorloge(o)) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({ label: nomDeSource(ctx), bonus: 0, duration: durationFromOp(o, ctx, ref), grantedPsychTrait: pose });
        }
        lines.push(t('op.traitPsychologiqueAccorde', { name: nomDe(target), psych: psychologyLabel(type), src: nomDeSource(ctx) }));
        break;
      }
      case 'removePsychTrait': {
        // Convalescence « Les choses s'arrangent » (ADE II Annexe I) : retire UN Trait psy de `c.psychTraits`
        // (≠ `endPsych`, qui apaise une affliction de combat `psychState`). Sans `psychType` = le 1ᵉʳ porté.
        const rang = rangDuTraitARetirer(target, o);
        const removed = target.psychTraits![rang];
        // L'`ActiveEffect` porteur de CETTE instance tombe avec elle, et l'emporte (`removeActiveEffects`) :
        // son échéance retirerait sinon une instance accordée depuis.
        const porteur = (target.activeEffects ?? [])[dernierIndex(target.activeEffects ?? [], (e) => !!e.grantedPsychTrait && memeTraitPsy(removed)(e.grantedPsychTrait))];
        if (porteur) removeActiveEffects(target, (e) => e === porteur, sortie);
        else target.psychTraits = target.psychTraits!.filter((_, i) => i !== rang);
        lines.push(t('op.traitPsychologiqueRetire', { name: nomDe(target), psych: psychologyLabel(removed.type) }));
        break;
      }
      case 'charMod': {
        const dur: Duration = durationFromOp(o, ctx, ref);
        applyActiveEffect(target, {
          label: nomDeSource(ctx), characteristic: o.characteristic, bonus: o.mod, duration: dur,
          ...(blessuresAuTotal ? { blessuresAuTotal } : {}),
          ...(ctx.sourceSpell ? { spell: ctx.sourceSpell } : {}),
          ...(ctx.sourceSpellId ? { sourceSpellId: ctx.sourceSpellId } : {}),
          ...(source ? { source } : {}),
        });
        charParts.push(`${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.characteristic]}`);
        charRounds = dur.scale === 'rounds' ? dur.left : null;
        // Le fragment de durée en minutes ne se compose que d'une échéance INTRINSÈQUE : une horloge héritée
        // du contexte (`ctx.defaultUntilTime`) est une date, pas un décompte — elle se dit « hors combat ».
        charClockMin = aUneHorloge(o) && dur.scale === 'clock' ? dur.until - (ctx.now ?? 0) : null;
        break;
      }
      case 'ap': {
        // Signe PRÉSERVÉ : un `amount` négatif RETIRE des PA (VDM 05). Le plancher 0 est celui du TOTAL,
        // appliqué par `effectiveArmourAt` — jamais à la pose.
        const n = formuleDuCtx(o.amount, ref, ctx);
        // « à la Localisation touchée » (VDM 05) : la Localisation vient du COUP courant. Hors contexte
        // de touche, rien n'est posé — jamais un repli silencieux sur « toutes les Localisations ».
        const loc = o.atHitLocation ? ctx.location : o.loc;
        if (o.atHitLocation && loc == null) {
          lines.push(t('op.paSansLocalisation', { name: nomDe(target) }));
          break;
        }
        const dur = durationFromCtx(ctx);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0, duration: dur, ...(loc ? { apAt: { [loc]: n } } : { apAll: n }),
          ...(o.noDeviation ? { noDeviation: true } : {}),
        });
        lines.push(t(n < 0 ? 'op.perteDePa' : 'op.pa', { name: nomDe(target), n: Math.abs(n), src: nomDeSource(ctx), durTxt: dur.scale === 'rounds' ? `, ${t('op.frag.rounds', { n: dur.left })}` : '' }));
        break;
      }
      case 'corruption': {
        const amount = o.amount + slBonus(ctx.sl, o.perSL);
        if (amount === 0) break;
        if (amount < 0) {
          // RETRAIT de Corruption (Innocence immaculée, LDB 42 — −1 de plus par +2 DR) :
          // décrément direct, jamais sous 0.
          const before = target.corruption ?? 0;
          target.corruption = Math.max(0, before + amount);
          emettre(target, { genre: 'corruption', ...sur(target), valeur: target.corruption - before, total: target.corruption });
        } else if (ctx.onCorruption) {
          absorber(ctx.onCorruption(target, amount, o.align));
        } else if (recoitLaCorruption(target)) {
          // Sans contexte store (moteur pur, tests unitaires) : simple incrément — align ignoré.
          target.corruption = (target.corruption ?? 0) + amount;
          emettre(target, { genre: 'corruption', ...sur(target), valeur: amount, total: target.corruption });
        }
        break;
      }
      case 'sinMod': {
        // Péché ±N (LDB 40 l.36 ; ACE Annexe I « Pénitence ») — plancher 0, delta RÉEL journalisé.
        const before = target.sinPoints ?? 0;
        target.sinPoints = Math.max(0, before + o.amount);
        const delta = target.sinPoints - before;
        lines.push(t(delta > 0 ? 'op.pecheAjoute' : 'op.pecheRetire', { name: nomDe(target), amount: Math.abs(delta), total: target.sinPoints }));
        break;
      }
      case 'corruptionExposure': {
        // Sens ABRI (VDM 05) : pose la protection en crans, aucune exposition posée.
        if (o.easeSteps != null) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({ label: nomDeSource(ctx), bonus: 0, duration: durationFromCtx(ctx), corruptionEase: o.easeSteps });
          lines.push(t('op.corruptionAllegee', { name: nomDe(target), n: o.easeSteps, src: nomDeSource(ctx) }));
          break;
        }
        // LDB 19 l.29 ; VDM 05 (abri). Moteur pur sans hook : journalisé inerte, rien de tiré en silence.
        const level = easeExposure(o.level ?? 'mineure', corruptionEaseSteps(target));
        if (level == null) {
          lines.push(t('op.corruptionConjuree', { name: nomDe(target) }));
          break;
        }
        if (ctx.onCorruptionExposure) lines.push(...ctx.onCorruptionExposure(target, level, o.nature, o.difficulty));
        else lines.push(ligneDExposition(target, level));
        break;
      }
      case 'gainResource': {
        // `amount` négatif = RETRAIT (VDM 12 l.833). Seul le COMPTEUR porte un plancher (0) ; l'argument
        // de l'op n'en porte pas — le neutraliser rendrait un retrait indistinguable d'un no-op.
        const n = o.amount + slBonus(ctx.sl, o.perSL);
        if (n === 0) break;
        const fate = o.resource === 'fate';
        const key = fate ? 'fate' : 'fortune';
        const before = target[key] ?? 0;
        target[key] = Math.max(0, before + n);
        if (o.temporary && n > 0) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({
            label: nomDeSource(ctx), bonus: 0,
            duration: durationFromCtx(ctx),
            ...(fate ? { grantedFate: n } : { grantedFortune: n }),
          });
        }
        const moved = Math.abs(target[key] - before);
        // Le journal dit ce qui a BOUGÉ : compteur déjà à 0, rien n'est retiré, rien ne se journalise
        // (« −0 Point » serait un événement inventé).
        if (n > 0) lines.push(t('op.ressourceGagnee', { name: nomDe(target), n, s: n > 1 ? 's' : '', res: t(fate ? 'op.ressourceDestin' : 'op.ressourceFortune'), temp: o.temporary ? t('op.fragmentDeDureeDeSort') : '', total: target[key] }));
        else if (moved > 0) lines.push(t('op.ressourcePerdue', { name: nomDe(target), n: moved, s: moved > 1 ? 's' : '', res: t(fate ? 'op.ressourceDestin' : 'op.ressourceFortune'), total: target[key] }));
        break;
      }
      case 'castPenalty': {
        const cp: NonNullable<Combatant['castPenalties']>[number] = {
          label: nomDeSource(ctx, 'contrecoup'),
          skill: o.skill?.id ?? ALL_MAGIC,
          ...(source ? { source } : {}),
          ...(o.mod != null ? { mod: o.mod } : {}),
          ...(o.blocked ? { blocked: true } : {}),
          ...(o.maxZeroDR ? { maxZeroDR: true } : {}),
        };
        let dureeTxt = '';
        if (o.rounds != null) {
          cp.roundsLeft = formuleDuCtx(o.rounds, ref, ctx);
          dureeTxt = t('op.frag.plafondDeRounds', { n: cp.roundsLeft, s: cp.roundsLeft > 1 ? 's' : '' });
        } else if (o.minutes != null) {
          const min = formuleDuCtx(o.minutes, ref, ctx);
          cp.untilTime = (ctx.now ?? 0) + min;
          dureeTxt = t('op.frag.minutes', { n: min });
        } else if (o.hours != null) {
          const h = formuleDuCtx(o.hours, ref, ctx);
          cp.untilTime = (ctx.now ?? 0) + h * 60;
          dureeTxt = t('op.frag.heures', { n: h, s: h > 1 ? 's' : '' });
        } else if (o.days != null || o.weeks != null) {
          const d = formuleDuCtx(o.days ?? 0, ref, ctx) + formuleDuCtx(o.weeks ?? 0, ref, ctx) * joursParSemaine();
          cp.untilTime = (ctx.now ?? 0) + d * MINUTES_PER_DAY;
          dureeTxt = t('op.frag.jours', { n: d, s: d > 1 ? 's' : '' });
        }
        target.castPenalties = [...(target.castPenalties ?? []), cp];
        lines.push(t('op.penaliteDIncantation', { name: nomDe(target), what: effetDePenaliteDIncantation(cp), duree: dureeTxt ? t('op.frag.pendant', { dureeTxt }) : '', label: cp.label }));
        break;
      }
      case 'statusMod': {
        const n = formuleDuCtx(o.amount, ref, ctx);
        if (n === 0) break;
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({ label: nomDeSource(ctx), bonus: 0, duration: { scale: 'adventure' }, statusMod: n });
        lines.push(t('op.modificateurDeStatut', { name: nomDe(target), sign: n >= 0 ? '+' : '', n }));
        break;
      }
      case 'grantReverseToken': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({ label: nomDeSource(ctx), bonus: 0, duration: { scale: 'adventure' }, reverseToken: { skill: o.skill ? structuredClone(o.skill) : undefined, ...(o.characteristic ? { characteristic: o.characteristic } : {}), ...(o.contexte ? { contexte: o.contexte } : {}), ...(o.illimite ? { illimite: true } : {}) } });
        lines.push(t('op.jetonDInversionAccorde', {
          name: nomDe(target),
          skill: o.skill ? refLabel('skills', o.skill) : o.characteristic ? t('op.inversionDeTestDeCaracteristique', { char: deElide(CHAR_LABELS[o.characteristic]) }) : t('op.inversionDeToutTest'),
          contexte: o.contexte ? ` ${libelleDeValeur(contexteDeTestSchema, o.contexte)}` : '',
          fois: t(o.illimite ? 'op.inversionIllimitee' : 'op.inversionUneFois'),
        }));
        break;
      }
      case 'grantTrait': {
        if (!groupGate(o.onlyGroups)) break; // « les Mort-vivant/Démoniaque gagnent Instable » (Bannissement)
        if (o.choix && ctx.onChoixDeTrait?.(target, o, choixDuTrait(o.trait.id, target), ctx)) break;
        const duree = durationFromOp(o, ctx, ref);
        for (const inst of traitsOctroyes(o, { lanceur: ref, porteur: target, rng, sl: ctx.sl, src: source })) {
          const accorde = grantTrait(target, inst, ctx.idNeuf);
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({
            label: nomDeSource(ctx), bonus: 0,
            duration: { ...duree },
            grantedTrait: structuredClone(accorde),
          });
          lines.push(t('op.traitAccorde', { name: nomDe(target), trait: traitLisible(inst), src: nomDeSource(ctx) }));
        }
        break;
      }
      case 'removeTrait': {
        // Les instances que CETTE source a accordées (`traitsAccordesPar`), le natif et l'octroi d'un tiers
        // restant intacts (EDOC 12 l.217 ; LDB 226). Une instance à effet porteur part avec lui
        // (`removeActiveEffects`) ; un octroi permanent se retire seul.
        const accordes = traitsAccordesPar(target, o.trait.id, source);
        const permanents = [...accordes];
        const porteurs = (target.activeEffects ?? []).filter((e) => {
          const i = e.grantedTrait ? permanents.findIndex((g) => sameInstance(e.grantedTrait!, g)) : -1;
          if (i >= 0) permanents.splice(i, 1);
          return i >= 0;
        });
        removeActiveEffects(target, (e) => porteurs.includes(e), sortie);
        for (const g of permanents) removeGrantedTrait(target, g);
        lines.push(t('op.traitRetire', { name: nomDe(target), trait: traitLisible(accordes[0]) }));
        break;
      }
      case 'augmentWeapon': {
        const dmg = o.damageBonus != null ? Math.max(0, formuleDuCtx(o.damageBonus, ref, ctx)) : undefined;
        // LDB 42 l.145 ; LDB 43 l.252,281
        const lo = activeLoadout(target);
        const held = [lo?.main, lo?.secondaire]
          .map((u) => objetDeSlot(target, u))
          .filter((i): i is ItemInstance => !!i && isWeaponActive(target, i.uid));
        const item = held.find((i) => !o.requiresWeapon || o.requiresWeapon.some((id) => id === i.shape?.id));
        if (!item) {
          lines.push(t('op.sansArmeAEnchanter', { name: nomDe(target), src: nomDeSource(ctx) }));
          break;
        }
        const enchantId = ctx.idNeuf('it');
        item.enchants = [
          ...(item.enchants ?? []),
          {
            id: enchantId,
            ...(o.addQualities?.length ? { addQualities: o.addQualities } : {}),
            ...(dmg ? { damageBonus: dmg } : {}),
            ...(o.bypass != null ? { bypass: o.bypass } : {}),
            ...(o.onHitEffects?.length ? { onHitEffects: stampSource(o.onHitEffects, source) } : {}),
            ...(o.removeQualities?.length ? { removeQualities: o.removeQualities } : {}),
            ...(o.removeType != null ? { removeType: o.removeType } : {}),
            ...(o.suppressEnchants ? { suppressEnchants: true } : {}),
            ...(o.passive?.length ? { passive: o.passive } : {}),
          },
        ];
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          enchantRef: { itemUid: item.uid, enchantId },
        });
        recomputeLoadout(target); // replie l'enchant dans l'arme active (visible + appliqué)
        const parts = [
          ...(o.addQualities ?? []).map((id) => qualityRefLabel({ id })), // id stable → libellé affiché
          ...(dmg ? [`+${dmg} Dégâts`] : []),
          ...(o.onHitEffects?.length ? ['effet à la touche'] : []),
          ...retraitsDits(o),
          ...(o.suppressEnchants ? [t('op.frag.enchantementsSuspendus')] : []),
          ...(o.passive?.length ? [t('op.frag.passifDArme')] : []),
        ];
        lines.push(t('op.armeEnchantee', { name: nomDe(target), item: item.label, parts: parts.join(', '), src: nomDeSource(ctx) }));
        break;
      }
      case 'cureDisease': {
        const n = Math.max(0, (o.count ?? 1) + slBonus(ctx.sl, o.countPerSL));
        lines.push(...cureDiseases(target, n));
        break;
      }
      case 'reduceDiseaseDays': {
        // `dice` (Rouille mouchetée : 1d10 jours) tiré à l'application ; `disease` = filtre par id ;
        // `oncePerDisease` = verrou « une fois par maladie » (Bénédiction de Convalescence, LDB 41) ;
        // `daysPerSL` = échelle sur le DR du Test précédent (Gesundheit, MSRC 04 l.184-186).
        const days = (o.dice ? rollDice(o.dice, rng) : (o.days ?? 1)) + slBonus(ctx.sl, o.daysPerSL);
        lines.push(...blessDiseaseDuration(target, maladieABenir(target, { disease: o.disease?.id, once: o.oncePerDisease })!, days, o.oncePerDisease));
        break;
      }
      case 'preventInfection': {
        target.woundDressed = true; // LDB 09 l.260
        lines.push(t('op.infectionPrevenue', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'aideMedicale': {
        lines.push(...receiveMedicalAid(target));
        absorber(releaseConditionLocks(target, 'medicalAid')); // LDB 18 l.308-311
        break;
      }
      case 'exposeDisease': {
        // SILENCIEUX : l'exposition se résout au bilan de fin de combat, ou hors combat par `ouvrirLesContagions`.
        target.diseaseExposure = exposerALaMaladie(target.diseaseExposure, o);
        break;
      }
      case 'contractDisease': {
        // Contraction instantanée (incubation 0) — délègue à la machinerie de maladie (cycle-safe :
        // disease.ts n'importe `ops` qu'en type). Inerte si déjà porteur.
        lines.push(...contractDiseaseOnce(target, o.disease.id, rng));
        break;
      }
      case 'kill': {
        lines.push(fateSaveOrDie(target) ? t('op.mort.sauveParLeDestin', { name: nomDe(target) }) : t('op.mort', { name: nomDe(target) }));
        break;
      }
      case 'cureCriticalWound': {
        const n = Math.max(0, (o.count ?? 1) + slBonus(ctx.sl, o.countPerSL));
        lines.push(...cureCriticalWounds(target, n));
        break;
      }
      case 'amputer': {
        const loc = o.loc ?? ctx.location ?? 'corps';
        // Quantité perdue par les séquelles CUMULATIVES : dé de la ligne (« 1d10 dents ») + échelle de DR
        // (« un orteil par DR en dessous de 0 ») — le dé est une QUANTITÉ, jamais un Test.
        const units = Math.max(1, (o.unites != null ? formuleDuCtx(o.unites, ref, ctx) : 1) + slBonus(ctx.sl, o.unitesPerSL));
        // Au plus UNE plaie chirurgicale par membre : l'escalade de la ligne (« Pied écrasé », LDB 18 l.180)
        // l'a déjà posée avec son échéance (`stampCriticalEscalation`) — la doubler perdrait cette échéance.
        const dejaPlaie = (target.traumas ?? []).some((t) => estPlaieAmputation(t) && t.location === loc);
        const poses: SequelleNeuve[] = [
          ...(dejaPlaie ? [] : [plaieDAmputation(loc)]),
          ...permanentAmputations(o.sequels, loc, units),
        ];
        target.traumas = avecSequelles(target.traumas, poses);
        for (const p of poses) lines.push(t('op.amputer', { name: nomDe(target), label: p.label, loc: locationLabel(loc, target.bodyShape) }));
        // Cumuls (LDB 18 l.247/251/273/277/281) : agrégation + escalade au seuil, au MÊME point que la pose.
        lines.push(...consolidateAmputations(target));
        break;
      }
      case 'grantTalent': {
        const dur = durationFromCtx(ctx);
        const talent = refLabel('talents', o.talent);
        // Octroi SANS échéance (VDM 02 l.238) : acquisition structurelle, `acquerirTalent` (engine/careerSlots.ts).
        if (dur.scale === 'permanent') {
          const acquis = acquerirTalent(target, o.talent);
          lines.push(t(acquis ? 'op.talentAccorde' : 'op.talentAccorde.maximum', { name: nomDe(target), talent, src: nomDeSource(ctx) }));
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: dur,
          grantedTalent: { talentId: o.talent.id, ...(o.talent.spec ? { spec: o.talent.spec } : {}) },
        });
        lines.push(t('op.talentAccorde', { name: nomDe(target), talent, src: nomDeSource(ctx) }));
        break;
      }
      case 'suppressTalents': {
        const duree = durationFromOp(o, ctx, ref);
        for (const talent of o.talents) suspendSource(target, { category: 'talents', id: talent.id }, duree, nomDeSource(ctx));
        lines.push(t('op.talentsSuspendus', {
          name: nomDe(target),
          talents: o.talents.map((x) => refLabel('talents', x)).join(', '),
          duree: libelleDHorloge(duree, ctx),
          src: nomDeSource(ctx),
        }));
        break;
      }
      case 'deityBan': {
        const dieu = priestCult(ref);
        if (!dieu) {
          lines.push(t('op.interditDivin.sansDivinite', { name: nomDe(target), src: nomDeSource(ctx) }));
          break;
        }
        const duree = durationFromOp(o, ctx, ref);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({ label: nomDeSource(ctx), bonus: 0, duration: duree, deityBan: dieu });
        lines.push(t('op.interditDivin', { name: nomDe(target), dieu: refLabel('gods', { id: dieu }), duree: libelleDHorloge(duree, ctx), src: nomDeSource(ctx) }));
        break;
      }
      case 'prayerForAction': {
        const duree = durationFromOp(o, ctx, ref);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({ label: nomDeSource(ctx), bonus: 0, duration: duree, prayerForAction: true });
        const n = duree.scale === 'rounds' ? duree.left : 0;
        lines.push(t('op.prierePourAgir', { name: nomDe(target), duree: t('op.frag.plafondDeRounds', { n, s: n > 1 ? 's' : '' }), src: nomDeSource(ctx) }));
        break;
      }
      case 'forbidFlee': {
        const duration = durationFromCtx(ctx);
        if (duration.scale === 'rounds' && duration.left <= 0) break;
        const label = nomDeSource(ctx);
        target.activeEffects ??= [];
        target.activeEffects.push({ label, bonus: 0, duration, fleeForbidden: true });
        lines.push(t('op.fuiteInterdite', { name: nomDe(target), src: label }));
        break;
      }
      case 'reduceToZero': {
        // PB à 0 SEUL ; l'Inconscient ou l'Enflammé est posé par une op `condition` séparée
        // dans l'entrée appelante (ex. Châtiment ajoute inconscient, Tonnerre ajoute en-flammes).
        target.wounds.current = 0;
        lines.push(t('op.reduitAZero', { name: nomDe(target) }));
        break;
      }
      case 'banish': {
        if (!groupGate(o.onlyGroups)) break; // Fauche-démon : ne bannit qu'une cible Démoniaque
        // Retrait du jeu — pas de corps/Inconscient/Critique. Émet TOUJOURS la narration (la cible peut être
        // déjà `dead` d'un Critique létal : le retrait est l'issue NARRÉE de SA mort). L'unicité est garantie
        // en amont (déclencheur `onSlain` pour le Démoniaque, `if woundsCurrent<=0` pour l'Instable).
        target.dead = true;
        lines.push(t(o.narration === 'unravel' ? 'op.bannissement.dissolution' : 'op.bannissement', { name: nomDe(target) }));
        break;
      }
      case 'removeShipPoste': {
        // « Canon perdu » (MDG 13 l.765) : une pièce passe par-dessus bord — retirée de la coque + son
        // chef démancipé. La coque (`target`) est la source de vérité ; l'équipage vient de `ctx.crew`.
        const postes = target.postes;
        if (postes?.length) {
          const [lost] = postes.splice(rng.int(0, postes.length - 1), 1);
          const chef = lost.crewIds?.[0] ? ctx.crew?.find((c) => c.id === lost.crewIds![0]) : undefined;
          if (chef?.mannedPoste === lost) { // il ne sert plus rien
            chef.mannedPoste = undefined;
            const piece = (chef.weapons ?? []).find((w) => w.uid === lost.item.uid);
            if (piece) lacherLArme(chef, piece);
          }
          lines.push(t('op.posteDeNavireRetire', { name: lost.item.label }));
        }
        break;
      }
      case 'ignoreStatePenalties': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          // `count` (Les dames de L'Anguille, MDG 09 l.244 : « peut ignorer UN État ») → n'ignore que
          // les N pires États ; absent = TOUTES les pénalités d'État (Endurance de l'anachorète, LDB 42).
          ...(o.count != null ? { ignoreStatesCount: o.count } : { ignoreStatePenalties: true }),
        });
        lines.push(t('op.penalitesDEtatIgnorees', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'freeReroll': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          freeReroll: true,
        });
        lines.push(t('op.relanceGratuite', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'critTwice': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          critRollTwice: true,
        });
        lines.push(t('op.critiqueDouble', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'damageArmour': {
        const loc = damageLeatherArmour(target);
        if (loc) constaterDans(sortie, faitDObjet(target, { armure: loc }, 'usee'));
        lines.push(loc
          ? t('op.cuirRetreci', { name: nomDe(target), loc: HIT_LOCATION_LABELS[loc] })
          : t('op.sansCuirAPourrir', { name: nomDe(target) }));
        break;
      }
      case 'damageWornGear': {
        const { localisations, armes } = endommagerLEquipementPorte(target);
        lines.push(t('op.equipementAbime', { name: nomDe(target), localisations, armes }));
        break;
      }
      case 'suppressPsych': {
        if (!target.psychTraits?.length && !effectivePsychTraits(target).length && !isFrenzyCapable(target)) {
          lines.push(t('op.sansPsychologieASuspendre', { name: nomDe(target) }));
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          suppressedPsych: suppressPsychTraits(target),
        });
        lines.push(t('op.psychologieSuspendue', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'suffocate': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          suffocates: true,
        });
        lines.push(t('op.suffocation', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'noHunger': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          noHunger: true,
        });
        lines.push(t('op.sansFaim', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'testMod': {
        // `characteristic` présent = modificateur QUALIFIÉ (Mystracine « +10 aux Tests d'Endurance et de FM,
        // −10 Ag/I/Int », LDB 71 l.33) → `testModChar`, lu par `testValue` pour les seuls Tests de cette
        // Caractéristique ; absent = mod GLOBAL (lu par `effectGlobalTestMod`, qui EXCLUT les qualifiés).
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          testMod: o.amount,
          ...(o.characteristic ? { testModChar: o.characteristic } : {}),
          ...(o.weaponHand ? { testModHand: o.weaponHand } : {}),
          ...(o.movementOnly ? { testModMovementOnly: true } : {}),
        });
        lines.push(t('op.modificateurDeTest', { name: nomDe(target), mod: `${o.amount >= 0 ? '+' : ''}${o.amount}${o.characteristic ? ` (${CHAR_LABELS[o.characteristic]})` : ''}`, src: nomDeSource(ctx) }));
        break;
      }
      case 'attrMod': {
        // EXÉCUTABLE (Bonnet de fou « +4 Blessures », LDB 71 l.20) : effet actif `attrMods`, lu par le
        // calcul du max concerné (wounds → effectiveMaxWounds ; fortune → fortuneMax ;
        // resolve → resolveMax). Destin/Résilience exclus de l'union `attr` (#292, ci-dessus).
        const n = formuleDuCtx(o.mod, ref, ctx);
        if (!n) break;
        applyActiveEffect(target, { label: nomDeSource(ctx), bonus: 0, duration: durationFromCtx(ctx), attrMods: { [o.attr]: n } });
        lines.push(t('op.modificateurDAttribut', { name: nomDe(target), mod: `${n >= 0 ? '+' : ''}${n}`, attr: t(ATTR_KEY[o.attr]), src: nomDeSource(ctx) }));
        break;
      }
      case 'diseaseTestMod': {
        // Bonus aux Tests liés à une maladie (Fleur de lune/Racine de terre/Tonique digestif) — sommé par
        // `activeDiseaseTestMod` (engine/disease) aux Tests de contraction/cycle/fin.
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          diseaseTestMod: { amount: o.amount, ...(o.diseases?.length ? { diseases: o.diseases } : {}) },
        });
        lines.push(t('op.modificateurDeTestDeMaladie', { name: nomDe(target), mod: `${o.amount >= 0 ? '+' : ''}${o.amount}`, what: o.diseases?.length ? o.diseases.map((d) => refLabel('maladies', { id: d })).join(', ') : t('op.frag.toutesMaladies'), src: nomDeSource(ctx) }));
        break;
      }
      case 'suppressSymptom': {
        // Suspension d'un symptôme par id (Racine de terre → bubons) — les canaux passive/onTick du
        // symptôme sont ignorés tant que l'effet dure (`symptomSuppressed`), restitués à l'expiration.
        suspendSymptom(target, o.symptom.id, durationFromCtx(ctx), nomDeSource(ctx));
        lines.push(t('op.symptomeSuspendu', { name: nomDe(target), symptom: refLabel('symptoms', o.symptom), src: nomDeSource(ctx) }));
        break;
      }
      case 'aggravateSymptom': {
        // EDOC 08 l.104-108 : échelon d'aggravation. Le symptôme est DÉJÀ à cette sévérité →
        // l'échelon `otherwise` ; symptôme ABSENT → rien (l'échelon suivant ne s'ouvre pas).
        const r = aggravateDiseaseSymptom(target, o.disease.id, o.symptom.id, o.severity);
        lines.push(...r.log);
        if (r.etat === 'deja' && o.otherwise?.length) absorber(applyOps(target, o.otherwise, imbrique()));
        break;
      }
      case 'attenuateSymptom': {
        // LDB 20 l.159 : l'échelon REDESCEND d'un cran, À DURÉE (celle que déclare le porteur — même
        // canal que `suppressSymptom`). Plus rien à atténuer → l'échelon `otherwise` ; symptôme ABSENT
        // → rien (symétrique exact d'`aggravateSymptom`).
        const r = attenuateDiseaseSymptom(target, o.disease.id, o.symptom.id, durationFromCtx(ctx), nomDeSource(ctx));
        lines.push(...r.log);
        if (r.etat === 'deja' && o.otherwise?.length) absorber(applyOps(target, o.otherwise, imbrique()));
        break;
      }
      case 'grantSymptom': {
        lines.push(...grantDiseaseSymptom(target, o.disease.id, o.symptom.id, o.severity));
        break;
      }
      case 'testDAgir': {
        // Gate d'action par Round (Racine de mandragore) : le drapeau est lu au début du tour du porteur
        // en combat (`resolveActGates`, couche state) — cadence-aware, jamais un jet silencieux de héros.
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          testDAgir: { characteristic: o.characteristic },
        });
        lines.push(t('op.testDAgir', { name: nomDe(target), char: CHAR_LABELS[o.characteristic], src: nomDeSource(ctx) }));
        break;
      }
      case 'noBreath': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          noBreath: true,
        });
        lines.push(t('op.sansSouffle', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'weatherWard': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          weatherImmune: true,
        });
        lines.push(t('op.protectionMeteo', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'giveTrapping': {
        const n = Math.max(1, (o.count ?? 1) + slBonus(ctx.sl, o.perSL));
        target.items = target.items ?? [];
        for (let i = 0; i < n; i++) {
          const it = itemFromGive({ ...o, trappingId: o.objet?.id }, ctx.idNeuf, source, ctx.resolveTrapping, contexteDeNaissanceDObjet(target));
          target.items.push(it);
          autoStowNewItem(target, it); // #204 : rangement par défaut
        }
        lines.push(t('op.objetDonne', { name: nomDe(target), count: n > 1 ? `${n}× ` : '', item: giveTrappingLabel(o, ctx.resolveTrapping), src: nomDeSource(ctx) }));
        break;
      }
      case 'money': {
        if (o.groupe) break;
        const n = Math.round(formuleDuCtx(o.montant.brass, ref, ctx));
        if (n === 0) break;
        const avant = bourseBrass(target);
        const apres = setBourseBrass(target, avant + n, ctx.idNeuf); // plancher 0 : on ne doit jamais d'argent
        const delta = apres - avant;
        if (delta === 0) break;
        emettre(target, faitDArgent(target, delta));
        break;
      }
      case 'perRound': {
        pushPerRound(target, o.ops, ctx);
        break;
      }
      case 'rollThreshold': {
        const rolled = roll(1, o.sides, rng);
        for (const th of o.thresholds) {
          if (rolled >= th.atLeast) absorber(applyOps(target, th.ops, imbrique({ rolled })));
        }
        break;
      }
      case 'rollTable': {
        for (const r of tirerLaTable(o, ctx, rng)) absorber(applyOps(target, r.ops, imbrique({ rolled: r.rolled })));
        break;
      }
      case 'rollMutation': {
        // Mutation à DURÉE du Sort (EDOC 13 l.276-277) — même chemin que la Corruption (rollMutation +
        // attachMutation), sans reveal ni damnation (moteur pur ; la couche state expose la modale via son
        // propre flux de mutation). Durée du ctx par défaut → ActiveEffect porteur qui la détache à
        // l'expiration ; permanente (`duration:'permanent'` OU ctx sans durée) → aucun porteur (comme grantTrait).
        const dur = o.duration === 'permanent' ? { scale: 'permanent' as const } : durationFromCtx(ctx);
        const m = attachMutation(target, rollMutation(o.table.id, rng), rng);
        if (dur.scale !== 'permanent') {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({ label: nomDeSource(ctx, 'mutation'), bonus: 0, duration: dur, grantedMutation: m });
        }
        if (target.items?.length) recomputeLoadout(target); // armes/PA naturels de mutation → loadout
        // Libellé FIDÈLE à la durée RÉELLE (jamais « permanente » en dur pour un octroi temporisé,
        // même vocabulaire que les autres effets à durée, cf. `op.psychologieSuspendue`/`op.symptomeSuspendu`
        // « pour la durée »).
        lines.push(t('op.tirageDeMutation', { name: nomDe(target), mutation: m.label, durability: dur.scale === 'permanent' ? t('op.mutationPermanente') : t('op.mutationTemporaire') }));
        break;
      }
      case 'charDamage': {
        // Perte PERMANENTE de Caractéristique de BASE (Vers de carie, MSRC 16 l.94-103) — jamais sous 0.
        const n = Math.max(0, formuleDuCtx(o.amount, ref, ctx));
        if (n > 0) {
          const before = target.characteristics[o.characteristic];
          target.characteristics[o.characteristic] = Math.max(0, before - n);
          lines.push(t('op.degatsDeCaracteristique', { name: nomDe(target), n: before - target.characteristics[o.characteristic], char: CHAR_LABELS[o.characteristic] }));
        }
        break;
      }
      case 'grantNaturalWeapon': {
        const n = Math.max(0, formuleDuCtx(o.damage, ref, ctx));
        const accordees = (target.activeEffects ?? []).flatMap((e) => (e.naturalWeapon ? [e.naturalWeapon] : []));
        const weapon = armeNaturelleAccordee(o, n, { uid: uidDArme(`nat-sort-${norm(o.label)}`, accordees), source }); // #2907
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? o.label, bonus: 0,
          duration: durationFromCtx(ctx),
          naturalWeapon: weapon,
        });
        recomputeLoadout(target);
        const natQuals = weapon.qualities.map(qualityRefLabel).join(', ');
        lines.push(t('op.armeNaturelleAccordee', { name: nomDe(target), weapon: o.label, dmg: damageString(weapon.damage), quals: weapon.qualities.length ? `, ${natQuals}` : '', src: nomDeSource(ctx) }));
        break;
      }
      case 'grantWeapon': {
        const flat = Math.max(0, formuleDuCtx(o.damage, ref, ctx) + (o.damagePlus ?? 0));
        // #2967
        const form = o.chooseForm ? (ctx.conjureForm ?? conjureFormOptions(ref)[0]) : null;
        const item = weaponItem(specDArmeInvoquee(ctx.resolveTrapping ?? findTrappingById, o, flat, source, form, `conjure-${ctx.idNeuf('it')}`));
        // SET d'armes DÉDIÉ rendu actif (réutilise les loadouts) — le joueur peut rebasculer sur ses
        // armes ; à l'expiration, le set d'origine est restauré (engine/conjuredWeapons).
        // Effets « à la touche » (Épée ardente → En flammes) PORTÉS PAR L'OBJET invoqué (enchant) ;
        // equipConjuredWeapon recompose le loadout → repliés dans l'arme active. Pas d'enchantRef :
        // l'objet est retiré en bloc à l'expiration (dropExpiredGrantedWeapons).
        if (o.onHitEffects?.length) item.enchants = [{ id: ctx.idNeuf('it'), onHitEffects: stampSource(o.onHitEffects, source) }];
        const conjuredSet = equipConjuredWeapon(target, item);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? o.label, bonus: 0,
          duration: durationFromCtx(ctx),
          conjuredSet,
        });
        const conjQuals = item.qualities.map(qualityRefLabel).join(', ');
        lines.push(t('op.armeAccordee', { name: nomDe(target), item: item.label, dmg: item.damage ? damageString(item.damage) : '—', quals: item.qualities.length ? `, ${conjQuals}` : '', src: nomDeSource(ctx) }));
        break;
      }
      case 'castWard': {
        let radius = Math.max(0, formuleDuCtx(o.radius, ref, ctx));
        if (o.perSL) {
          radius += Math.floor(Math.max(0, ctx.sl ?? 0) / Math.max(1, o.perSL.every))
            * Math.max(0, formuleDuCtx(o.perSL.radiusFormula, ref, ctx));
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          castWard: { radiusMeters: radius, mod: o.mod },
        });
        lines.push(t('op.protectionDIncantation', { name: nomDe(target), radius, sign: o.mod >= 0 ? '+' : '−', n: Math.abs(o.mod), src: nomDeSource(ctx) }));
        break;
      }
      case 'arrowWard': {
        const zone = zoneDeGarde(ctx, target, 'arrowWard');
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          arrowWard: { radiusMeters: zone.rayonM },
        });
        lines.push(t(zone.porteur ? 'op.bouclierAntiFleches' : 'op.bouclierAntiFlechesCouvert', { name: nomDe(target), diametre: zone.diametreM, src: nomDeSource(ctx) }));
        break;
      }
      case 'domeWard': {
        const zone = zoneDeGarde(ctx, target, 'domeWard');
        const [ward] = traitsOctroyes(o, { lanceur: ref, porteur: target, rng });
        if (ward.value === undefined) throw new Error(`[domeWard] Trait « ${ward.id} » octroyé sans Indice (LDB 47 l.410)`);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          domeWard: { radiusMeters: zone.rayonM, ward },
        });
        lines.push(t(zone.porteur ? 'op.dome' : 'op.domeCouvert', {
          name: nomDe(target), diametre: zone.diametreM, trait: formatWardSave({ kind: 'trait', id: ward.id }, ward.value), src: nomDeSource(ctx),
        }));
        break;
      }
      case 'attackWardFM': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          attackWardFM: true,
        });
        lines.push(t('op.protectionDAttaqueFm', { name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'martyr': {
        if (!ctx.caster) {
          lines.push(t('op.martyrSansPretre', { name: nomDe(target) }));
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          martyrGuard: ctx.caster.id,
        });
        lines.push(t('op.martyr', { caster: nomDe(ctx.caster), name: nomDe(target), src: nomDeSource(ctx) }));
        break;
      }
      case 'fall': {
        const { hauteur, table } = hauteurDeChute(o, target, ctx);
        // Les DEUX dés de la chute (hauteur MDG 13 l.684, Dégâts LDB 15 l.80) passent par la porte quand
        // un applier les y a ouverts (`demandesDeDes` → étape à dé nu → `ctx.des`) : le dé POSÉ remplace
        // le tirage, sans consommer de rng. Sans canal (pilote headless), l'op tire aux mêmes points.
        const declares = desDeclaresDe(o, target, ctx);
        const de = lecteurDe(iOp, declares);
        // Hauteur ENTIÈRE (nid-de-pie) : aucun dé n'est DÉCLARÉ, la Formule donne le nombre telle quelle.
        const metres = declares.some((d) => d.champ === 'hauteur')
          ? de('hauteur')
          : formuleDuCtx(hauteur, ref, ctx);
        const d10Chute = de('degats');
        const avant = target.wounds.current;
        // Les États que la chute POSE se lisent par DIFFÉRENCE — la ligne ne nomme aucun État : c'est
        // `applyFall` (LDB 15 l.84) qui décide, et ce qu'il pose se dit tel quel.
        const etatsAvant = new Set((target.conditions ?? []).map((c) => c.id));
        applyFall(target, metres, d10Chute);
        const poses = (target.conditions ?? []).filter((c) => !etatsAvant.has(c.id)).map((c) => conditionLabel(c.id));
        lines.push(t('op.chute', {
          name: nomDe(target),
          table,
          m: metres,
          n: avant - target.wounds.current,
          etats: poses.length ? ` (${poses.join(', ')})` : '',
        }));
        break;
      }
      case 'zone': {
        // Zone d'un sort (sans `durationRounds`) : posée par `placeSpellZone`, à la durée du sort (LDB 47 l.15).
        if (o.durationRounds === undefined || !ctx.onZone) break;
        const declares = desDeclaresDe(o, target, ctx);
        const rounds = declares.length ? lecteurDe(iOp, declares)('duree') : formuleDuCtx(o.durationRounds, ref, ctx);
        lines.push(...ctx.onZone(o, rounds, target, ctx));
        break;
      }
      case 'summon':
      case 'scheduleRespawn':
      case 'grantFreeAttack':
      case 'interruptFocus':
      case 'breakBlade':
      case 'push':
      case 'teleport':
      case 'chain':
      case 'delayed':
      case 'shipMorale':
      case 'manann':
      case 'shipCritical':
      case 'navireMod':
      case 'meteoImposee':
      case 'cargaison':
      case 'provisions':
      case 'equipage':
      case 'perilDeMer':
      case 'navireHostile':
      case 'infestation':
      case 'combatEnMer':
      case 'commission':
      case 'constructeurDEscale':
      case 'rationsDEscale':
      case 'marcheDuPort':
      case 'attaquesSubies':
        // Effets IMPURS (grille + initiative / reconstitution programmée / ouverture
        // d'une frappe / interruption de Focalisation / désarmement-bris de Piège-lame / poussée /
        // téléportation / rebond de Projectile / ops différées à échéance d'horloge) — résolus par la
        // couche state (combatFlow : applySummon / scheduleRespawn → file horloge ; les
        // hooks `freeAttack`/`focusInterrupt`/`piegeALame` appelés par `runCombatFlow` ; `applyCast` scanne
        // push/teleport/chain ; `delayed` → `scheduleDelayedOps` aux points d'application d'un EffectOp ;
        // les ops de navire → `noyau/navireOps.ts` ; l'op du marché d'un port → `noyau/portFlow.ts` ; les
        // attaques subies → l'effet de scène `ops`),
        // qui détient get/set et le combattant. `applyOps` (moteur pur) les laisse INERTES.
        break;
      case 'polymorph':
        // Métamorphose : développée en charMod différentiel + grantTrait (auto-restitués) — pure. + id de
        // la forme le temps de l'effet (morphRef, `liveMorphRef`), restitué à l'expiration.
        absorber(applyOps(target, polymorphOps(target, o.creature.id), imbrique()));
        applyActiveEffect(target, { label: nomDeSource(ctx, 'metamorphose'), morphRef: o.creature.id, bonus: 0, duration: durationFromCtx(ctx) });
        break;
      case 'transform': {
        // Applique les deltas AUTHORÉS sous le LABEL `tag` (déterministe → retrait atomique) et une durée
        // PERMANENTE (forme durable ≠ buff de sort : on efface toute durée héritée du ctx). L'apparence
        // (morphRef) porte le MÊME tag pour être retirée avec le reste par `endTransform`.
        const inner: OpsCtx = imbrique({ label: o.tag, effectId: o.tag, defaultDurationRounds: undefined, defaultUntilTime: undefined });
        absorber(applyOps(target, o.ops, inner));
        if (o.creature) applyActiveEffect(target, { label: o.tag, effectId: o.tag, morphRef: o.creature.id, bonus: 0, duration: { scale: 'permanent' } });
        lines.push(t('op.metamorphose', { name: nomDe(target), tag: o.tag }));
        break;
      }
      case 'endTransform': {
        const portes: Applique = { lignes: [], faits: [] };
        if (!removeActiveEffects(target, (e) => e.effectId === o.tag, portes).length) break; // pas dans cette forme → no-op
        lines.push(t('op.finDeMetamorphose', { name: nomDe(target), tag: o.tag }));
        absorber(portes);
        break;
      }
      case 'lifeSteal': {
        const who = ctx.caster ?? target;
        const dealt = Math.max(0, ctx.woundsDealt ?? 0);
        const healed = (o.round ?? 'floor') === 'ceil'
          ? Math.ceil((dealt * o.num) / o.den)
          : Math.floor((dealt * o.num) / o.den);
        // SOURCE UNIQUE `applyHealWounds` — même plafond de munition logée (LDB 62 l.250) que le reste ;
        // le fait ne sort que si le drain rend RÉELLEMENT des PB (post-plafond).
        if (healed > 0) soigner(who, healed, true);
        break;
      }
      case 'skillMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          passive: [o],
        });
        lines.push(t('op.modificateurDeCompetence', { name: nomDe(target), mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, skill: o.skill.id, src: nomDeSource(ctx) }));
        break;
      }
      case 'deitySkillMod': {
        const associees = deitySkills(target);
        if (!associees.length) {
          lines.push(t('op.modificateurDeCompetenceDivine.sansListe', { name: nomDe(target), src: nomDeSource(ctx) }));
          break;
        }
        const frappees = o.pick === 'all' ? associees : [associees[rng.int(0, associees.length - 1)]];
        const duree = durationFromOp(o, ctx, ref);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0, duration: duree,
          passive: frappees.map((id) => ({ op: 'skillMod', skill: { id }, mod: o.mod })),
        });
        lines.push(t('op.modificateurDeCompetenceDivine', {
          name: nomDe(target),
          mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`,
          skills: frappees.map((id) => refLabel('skills', { id })).join(', '),
          duree: libelleDHorloge(duree, ctx),
          src: nomDeSource(ctx),
        }));
        break;
      }
      // +DR temporisé à une Compétence / une Caractéristique (chansons de marin, MDG 09 l.228/236) :
      // porté par `ActiveEffect.drBonus`, lu par `skillDRBonus`/`charDRBonusOf` sur un Test RÉUSSI.
      case 'skillDRBonus': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0, duration: durationFromCtx(ctx),
          drBonus: [{ skill: o.skill ? structuredClone(o.skill) : undefined, bonus: formuleDuCtx(o.bonus, ref, ctx) }],
        });
        lines.push(t('op.bonusDeDr', { name: nomDe(target), what: o.skill?.id ?? o.testType?.id ?? '', src: nomDeSource(ctx) }));
        break;
      }
      case 'charDRBonus': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0, duration: durationFromCtx(ctx),
          drBonus: [{ characteristic: o.characteristic, bonus: formuleDuCtx(o.bonus, ref, ctx) }],
        });
        lines.push(t('op.bonusDeDr', { name: nomDe(target), what: CHAR_LABELS[o.characteristic], src: nomDeSource(ctx) }));
        break;
      }
      // Modificateur aux Tests INDIVIDUELS d'un Test d'équipage (« Naviguons tous ensemble », MDG 09 l.224).
      case 'crewTestMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0, duration: durationFromCtx(ctx),
          crewTestMod: o.mod,
        });
        lines.push(t('op.modificateurDeTestDEquipage', { name: nomDe(target), mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, src: nomDeSource(ctx) }));
        break;
      }
      case 'light': {
        // Chemin SORT : pose un ActiveEffect.light TEMPORISÉ (durée du sort), lu par `combatantLights`
        // (vision) au MÊME point que la lumière d'un objet porté. (Côté OBJET le `passive` n'est jamais
        // exécuté par applyOps → l'op est naturellement inerte là-bas.)
        const lumière = o.tone ? { radiusM: o.radiusM, tone: o.tone.id } : { radiusM: o.radiusM };
        applyActiveEffect(target, { label: nomDeSource(ctx, 'lumiere'), bonus: 0, light: lumière, duration: durationFromCtx(ctx) });
        lines.push(t('op.lumiere', { name: nomDe(target), n: o.radiusM, src: nomDeSource(ctx) }));
        break;
      }
      case 'moveScale': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromOp(o, ctx, ref),
          passive: [sansDuree(o)],
        });
        lines.push(t('op.echelleDeMouvement', { name: nomDe(target), num: o.num, den: o.den, src: nomDeSource(ctx) }));
        break;
      }
      case 'moveMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          passive: [o],
        });
        lines.push(t('op.modificateurDeMouvement', { name: nomDe(target), mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, src: nomDeSource(ctx) }));
        break;
      }
      case 'maxWeaponHands': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromOp(o, ctx, ref),
          passive: [sansDuree(o)],
        });
        lines.push(t('op.mainsDArmeMaximum', { name: nomDe(target), hands: o.hands, src: nomDeSource(ctx) }));
        break;
      }
      case 'disarm': {
        // Main RÉSOLUE depuis la localisation du coup courant (convention DROITIER, `handAmputated`) ;
        // `corps`/absente (« au hasard l'un de vos deux bras ») → tirage aléatoire.
        const hand: Main = ctx.location === 'brasG' ? 'secondaire' : ctx.location === 'brasD' ? 'main' : rng.int(0, 1) === 0 ? 'main' : 'secondaire';
        const tenue = (target.weapons ?? []).find((w) => estUneVraieArme(w) && w.derivedFromItem == null
          && (w.hands === 2 || (w.hand === 'secondaire') === (hand === 'secondaire')));
        const objet = tenue && (objetSourceDeLArme(target, tenue)
          ?? ficheDObjetPorte(tenue, ctx.resolveTrapping ?? findTrappingById));
        if (objet && itemCapability(objet, 'disarmImmune')) {
          // ADE II 02 l.695.
          lines.push(t('op.desarmementImmunise', { name: nomDe(target), item: objet.label }));
        } else if (tenue) {
          if (!ctx.onLacher) lacherLArme(target, tenue);
          else {
            const tombe = laisserTomber(target, tenue, ctx.idNeuf);
            if (tombe) ctx.onLacher(target, tombe);
          }
          lines.push(t('op.desarmement', { name: nomDe(target), item: tenue.label }));
        } else {
          lines.push(t('op.desarmementVain', { name: nomDe(target) }));
        }
        break;
      }
      case 'handGate': {
        // Main gatée résolue depuis la Localisation du coup (convention DROITIER partagée avec `disarm`) —
        // un Critique Main ensanglantée frappe toujours un bras (`brasG`/`brasD`) ; `corps`/absente → au hasard.
        const hand: Main = ctx.location === 'brasG' ? 'secondaire' : ctx.location === 'brasD' ? 'main' : rng.int(0, 1) === 0 ? 'main' : 'secondaire';
        target.handGates = [...(target.handGates ?? []).filter((h) => h !== hand), hand];
        lines.push(t('op.testDeMain', { name: nomDe(target) }));
        break;
      }
      case 'senseLoss': {
        lines.push(t('op.perteDeSens', { name: nomDe(target), sense: t(o.sense === 'vue' ? 'op.sensVue' : 'op.sensOuie'), src: nomDeSource(ctx, 'sequelle') }));
        break;
      }
      case 'loseTurn':
        // `what` cible UNE des deux ressources (issue du choix du gate de Mandragore) ; absent = les deux.
        if (o.what !== 'movement') target.loseNextAction = true;
        if (o.what !== 'action') target.loseNextMovement = true;
        lines.push(t(o.what === 'action' ? 'op.actionPerdue' : o.what === 'movement' ? 'op.mouvementPerdu' : 'op.tourPerdu', { name: nomDe(target) }));
        break;
      case 'teamCommander':
        // Commandant d'équipe (AA) : pose le lien chef→commandant. La substitution effective du score est
        // re-dérivée à chaque tir (vivant + à portée de voix), pas figée ici — cf. `noyau/monde/commandTeam`.
        target.teamCommanderId = o.commanderId;
        break;
      case 'weaponRollMod':
      case 'weaponDamageMod':
      case 'armourPierce':
      case 'critOnRoll':
      case 'offTerrainMod':
        // PASSIFS d'arme (Atouts/Défauts) lus PAR ID par `engine/qualities/dispatch` aux moments de combat —
        // INERTES dans le moteur d'ops (comme skillDRBonus/incomingAttackMod/attackKeyword/mitigateIncoming).
        // `offTerrainMod` : passif POSITIONNEL (Créature marine/Aquatique), lu par offTerrainMoveCap/TestDR.
        break;
      case 'spendAdvantage': {
        const who = ctx.caster ?? target;
        const avant = who.advantage ?? 0;
        who.advantage = avantageApresPerte(avant, o.amount);
        if (o.amount == null && avant > 0) emettre(who, { genre: 'avantage', ...sur(who), valeur: -avant, total: who.advantage });
        break;
      }
      case 'ignoreAnimosity': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: nomDeSource(ctx), bonus: 0,
          duration: durationFromCtx(ctx),
          ignoreAnimosity: true,
        });
        break;
      }
      case 'intoxicate': {
        // Boisson alcoolisée (LDB 09 l.475) : un échec de Résistance à l'alcool → −10 aux CC/CT/Ag/Dex/Int,
        // Ivresse (1d10) au seuil BE. Le Test lui-même est le nœud `test` du Flow de consommable (branche fail).
        const be = bonus(effectiveChar(target, 'endurance'));
        const { log, drunkOps } = applyAlcoholTest(target, false, be, rng);
        lines.push(...log);
        // La MÉCANIQUE du résultat d'Ivresse (Bravoure/meilleur ami/belligérant, `drunkenness.json`)
        // est un `GameOp[]`, comme `tantQuIvre` — exécutés ICI, sous le ctx imbriqué de l'op (`EFFET_D_IVRESSE` marque les
        // ActiveEffect posés, retirés en bloc par `soberUpDissipate`).
        const sousIvresse = [...(drunkOps ?? []), ...(o.tantQuIvre ?? [])];
        if (sousIvresse.length) absorber(applyOps(target, sousIvresse, imbrique({ effectId: EFFET_D_IVRESSE })));
        break;
      }
      case 'narrative':
        lines.push(o.nombre === undefined ? o.text : t('op.nombreNarratif', { text: o.text, n: Math.round(formuleDuCtx(o.nombre, ref, ctx)) }));
        break;
    }
  }
  flushCharMods();
  // Marque les effets actifs POSÉS par ce sort source (durables) : identité + NI → Dissipation (Sorts
  // seulement, `sourceSpell`) ET id du sort → anti-spam IA (TOUT lancement, Prières comprises, `sourceSpellId`)
  // ET id STABLE de l'effet en cours (`effectId` — transform/chansons de marin…, retrait par IDENTITÉ).
  if ((ctx.sourceSpell || ctx.sourceSpellId || ctx.effectId || source) && target.activeEffects) {
    for (const e of target.activeEffects) {
      if (preEffects!.has(e)) continue;
      if (ctx.sourceSpell && !e.spell) e.spell = ctx.sourceSpell;
      if (ctx.sourceSpellId && !e.sourceSpellId) e.sourceSpellId = ctx.sourceSpellId;
      if (ctx.effectId && !e.effectId) e.effectId = ctx.effectId;
      if (source && !e.source) e.source = source;
    }
  }
  // Toute op qui bouge un fait SOURCE d'État dérivé passe par ici (`aggravateSymptom`/`attenuateSymptom`/
  // `grantSymptom`/`contractDisease`/`suppressSymptom`…) : la réconciliation clôt l'application, une fois,
  // au lieu d'être recopiée sur chaque case. IDEMPOTENTE — les descentes imbriquées n'écrivent rien de plus.
  absorber(syncDerivedConditions(target));
  target.wounds = blessuresReconciliees(target);
  return sortie;
}
