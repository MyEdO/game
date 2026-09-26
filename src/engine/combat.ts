/**
 * Résolution du Combat — Livre de base, chapitre « Combat » (p. 158-161).
 *
 * Étapes : 1) Toucher (Test opposé de Corps à corps / Test de Projectiles)
 *          2) Localisation (jet du toucher inversé)
 *          3) Dégâts = Dégâts d'arme + DR
 *          4) Application = Dégâts − (Bonus d'Endurance + PA de la localisation)
 */
import { RNG, defaultRNG } from './dice';
import { t } from '../i18n';
import { rollTest, resolveOpposed, evaluateTest, opposedReasons, exactDifficultyFromModifier, TestResult, type VerdictReason } from './tests';
import { bonus, effectiveChar, baseWithTraits } from './characteristics';
import { woundsFromHit } from './woundsCalc';
import { isInanimate, isStructure, structureEnduranceMult, structureTaille } from './structures';
import { agilityTestPenalty } from './encumbrance';
import { skillBaseValue } from './skills';
import { Combatant, HitLocation, Weapon, BodyShape, RangeBandId, CHAR_LABELS, DIFFICULTY_MODIFIERS, locationLabel, type CharKey, type Difficulty, type ModLine } from './types';
import { weatherTestMods } from './weatherTestMod';
import { findTableEntry } from './tables';
import { maxBy } from './pick';
import locJson from '../data/localisation.json';
import { combatTestPenaltyParts, meleeAttackerBonusLines, cannotDefend, hasCondition, COND, activeCharTestMod, activeCharTestModParts } from './conditions';
import { effectiveWeaponDamage, effectiveWeapon, effectiveWeaponRange } from './weaponDamage';
import { traumaDodgePenalty, damageSBBonus, amputationCombatPenalty } from './trauma';
import { SIZE_RANGED_MOD, SIZE_LABEL, SIZE_ORDER, sizeGap, effectiveSize, sizeDamageMultiplier, sizeGrantedQualities } from './size';
import { groupMatch } from './groups';
import { ignoredArmourAP, impenetrableAt, loadedAmmo, activeLoadout, unarmedWeapon } from './items';
import { incomingAttackMod, incomingDamageNullified, skillDRBonus, offTerrainTestDR } from './ops';
import { isPsychImmune, psychImmuneToFrom } from './psychology';
import { qualitySum, attackModQualityIds, qualityCritTriggered, parryDRAdjust, qualityDamageStep, craftTestDRAdjust, hasQuality, canFireWhileEngaged as qCanFireWhileEngaged, attackDRAdjust, vsDefenseDRAdjust, rapideParryMod, protectriceAP, rangedOpposeWeapon, isMagicWeapon, resolveQualities } from './qualities/dispatch';
import { RULE_REF } from './ruleRefs';
import { spellEffectOps } from './flowCore';
import { findPsychologyById, byId } from '../data';
import { offHandPenalty, talentDamageBonus, isSlayer, talentRangedAPIgnore, ignoresCalledShotPenalty, ignoresSizeRangedMods, sniperRangeAdjust } from './combatFeatures/dispatch';
import { isEngagedWith, meleeReachRank } from './engagement';
import { hullHitAdjust } from './shipMelee';
import { rule } from './policy';

/** Inverse le jet du toucher (23 → 32 ; « 00 » → 100). */
export function reverseRoll(r: number): number {
  const n = r % 100; // 100 → 0
  const t = Math.floor(n / 10);
  const o = n % 10;
  let rev = o * 10 + t;
  if (rev === 0) rev = 100;
  return rev;
}

// ── Localisation des coups — FOYER UNIQUE data-driven (`src/data/localisation.json`) ──────────────
// Un véhicule/navire encaisse un coup comme tout Combattant : MÊME résolution d'attaque, MÊME primitive
// de lookup (`findTableEntry`), MÊME fichier de tables. Seul l'ENUM de sortie diffère (RAW) — un navire
// n'a ni armure de Localisation ni Trauma humain → `ShipLocation` (MDG 13) ≠ `HitLocation` (LDB).

/** Gréement d'un bateau — choisit la colonne de Localisation (MDG 13). */
export type ShipRig = 'avirons' | 'voile' | 'mixte';
/** Localisation d'un coup sur un bateau — DISTINCTE de la `HitLocation` humaine. `equipements`/`cargaison`
 *  sont navales (MDG 13) ; `gouvernail`/`superstructure` sont fluviales (MSRC 7). `avirons` couvre
 *  aussi les « Rames » du bateau fluvial (mêmes avirons). */
export type ShipLocation = 'equipage' | 'avirons' | 'greement' | 'coque' | 'equipements' | 'cargaison' | 'gouvernail' | 'superstructure';

interface BodyLocEntry { min: number; max: number; loc: HitLocation }
interface ShipLocEntry { min: number; max: number; avirons: ShipLocation; voile: ShipLocation; mixte: ShipLocation }
const BODY_SHAPES = (locJson as { personnage: { shapes: Record<string, BodyLocEntry[]> } }).personnage.shapes;
/** Id de table de Localisation navale — union FERMÉE : `navire` (MDG 13) / `navire-fluvial` (MSRC 7).
 *  Miroir du schéma de la coque (`hull.locationTable`, `data/schemas/defs/vehicles.ts`). */
type ShipLocTableId = 'navire' | 'navire-fluvial';
const SHIP_LOC_ALL = locJson as unknown as Record<ShipLocTableId, { entries: ShipLocEntry[] }>;
const SHIP_LOC_TABLES: Record<ShipLocTableId, ShipLocEntry[]> = {
  navire: SHIP_LOC_ALL.navire.entries,
  'navire-fluvial': SHIP_LOC_ALL['navire-fluvial'].entries,
};
const isShipLocTableId = (id: string): id is ShipLocTableId => id in SHIP_LOC_TABLES;

/** Tableau de Localisation humanoïde (LDB 13 l.137-145) — un dé déjà INVERSÉ (1..100). */
export function hitLocation(reversed: number): HitLocation {
  return findTableEntry(BODY_SHAPES.humanoide, reversed).loc;
}

/**
 * Localisation selon la FORME du corps (LDB « Point d'Impact des Créatures » p.312), data-driven.
 * Humanoïde / quadrupède / oiseau partagent la table humanoïde (seule l'étiquette change, p.312) ;
 * serpent (01-19 Tête / 20-00 Corps) et araignée (01-09 / 10-79 Pattes / 80-00 Abdomen) ont la leur.
 */
export function hitLocationByShape(reversed: number, shape: BodyShape = 'humanoide'): HitLocation {
  return findTableEntry(BODY_SHAPES[shape] ?? BODY_SHAPES.humanoide, reversed).loc;
}

/** Localisation d'un coup (d100) sur un BATEAU du gréement donné — `ShipLocation`. `tableId` choisit la
 *  table : `navire` (MDG 13, défaut) ou `navire-fluvial` (MSRC 7). Un id inconnu LÈVE : une coque
 *  fluviale mal orthographiée se résoudrait sinon sur la table maritime, sans un mot. */
export function shipHitLocation(rig: ShipRig, roll: number, tableId: string = 'navire'): ShipLocation {
  if (!isShipLocTableId(tableId))
    throw new Error(`shipHitLocation : table de Localisation inconnue « ${tableId} » (attendu : ${Object.keys(SHIP_LOC_TABLES).join(' | ')}).`);
  const table = SHIP_LOC_TABLES[tableId];
  return findTableEntry(table, roll)[rig];
}

export { locationLabel } from './types';

/** Main ensanglantée (AA 07 l.117) : la main tenant `weaponUid` est-elle « ensanglantée » (marqueur
 *  `handGates`, op `handGate`) ? Renvoie la main gatée (`'main'`/`'off'`) — qui impose un Test de
 *  Dextérité (+20) AVANT l'Action, Échec → `disarm` — ou `null`. La DURÉE (« tant que vous êtes sous
 *  l'effet de cet État ») est portée par le marqueur lui-même : `removeCondition` le PURGE dès que
 *  l'Hémorragique tombe à 0 (lever machinerie UNIQUE) → sa seule présence suffit ici. Le marqueur
 *  par-main identifie QUELLE main. PUR — SOURCE UNIQUE des deux chemins (joueur/IA). */
export function attackHandGate(c: Combatant, weaponUid?: string): 'main' | 'off' | null {
  if (!c.handGates?.length) return null;
  const lo = activeLoadout(c);
  // Main tenant l'arme : uid EXPLICITE → le slot correspondant (une arme NATURELLE/montée hors loadout →
  // `null`, jamais « tenue en main ») ; uid ABSENT (auto-choix joueur / IA) → main directrice par défaut.
  const hand: 'main' | 'off' | null = weaponUid == null ? 'main'
    : weaponUid === lo?.off ? 'off' : weaponUid === lo?.main ? 'main' : null;
  return hand && c.handGates.includes(hand) ? hand : null;
}

/** Une Spé acceptée pour couvrir le Groupe d'une arme, et son MODE : `'full'` (bonus intégral, AUCUNE
 *  perte d'Atout) ou `'degraded'` (bonus intégral MAIS l'arme perd tous ses Atouts en gardant ses
 *  Défauts — Arbalète/Lancer par toute autre Spé de Tir, LDB 62 l.184 ; Ingénierie par Poudre noire,
 *  l.188). Consommé par `matchGroupSpec`, SOURCE UNIQUE de `combatValue`/`weaponGroupSkillMode`. */
interface SpecAcceptance { spec: string; mode: 'full' | 'degraded' }

/** Sentinelle « n'importe quelle Spé de Projectiles » (Arbalète/Lancer utilisés avec une AUTRE Spé de
 *  Tir que la sienne, « votre Compétence de Tir » sans restriction de Groupe, LDB 62 l.184) — jamais un
 *  id de Groupe réel (`WeaponGroupData.id`). */
const ANY_RANGED_SPEC = '*';

/**
 * Spés (`WeaponGroupData.id`) que couvre la Spécialisation de Corps à corps / Projectiles du Groupe
 * donné, avec leur MODE. RAW : Corps à corps (LDB 09 l.156) et Projectiles (l.423) sont des Compétences
 * *Groupées* — chaque Spécialisation (désormais un `spec` = id de Groupe, cf. `SkillData.specsSource`)
 * couvre une classe d'armes ; sans la bonne Spé, aucun Test n'est possible (LDB 62 l.180), sauf les
 * exceptions listées l.184-192 (Groupes d'Armes à distance) :
 *  - Arbalète/Lancer utilisés avec N'IMPORTE QUELLE Spé de Tir → bonus intégral, Atouts perdus (l.184).
 *  - Ingénierie utilisée via Poudre noire → bonus intégral, Atouts perdus (l.188).
 *  - Poudre noire/Explosifs utilisés via Ingénierie → bonus intégral, SANS pénalité (l.192).
 */
function acceptableSpecs(weapon: Weapon, kind: 'melee' | 'ranged'): SpecAcceptance[] {
  // `weaponGroup` PRIME sur `subType` : une arme de siège porte sa catégorie de catalogue (« armes-de-siege »)
  // en `subType` mais son vrai Groupe de Projectiles (Arbalète/Catapulte/Ingénierie/Poudre noire,
  // AA 10 l.178-193) en `weaponGroup` → c'est lui qui pilote la Spé de tir ET le décompte d'équipage. Pour toute
  // arme normale, `weaponGroup` est absent → `subType` EST le Groupe (comportement inchangé).
  const gid = weapon.weaponGroup ?? weapon.subType ?? ''; // id de Groupe d'arme (`WeaponGroupData.id`)
  if (!gid) return [];
  if (gid === 'poudre-noire' || gid === 'poudre-noire-et-ingenierie')
    return [{ spec: 'poudre-noire', mode: 'full' }, { spec: 'ingenierie', mode: 'full' }]; // LDB 62 l.192
  if (gid === 'explosifs')
    return [{ spec: 'explosifs', mode: 'full' }, { spec: 'ingenierie', mode: 'full' }]; // LDB 62 l.192
  if (gid === 'ingenierie')
    return [{ spec: 'ingenierie', mode: 'full' }, { spec: 'poudre-noire', mode: 'degraded' }]; // LDB 62 l.188
  if (kind === 'ranged' && (gid === 'arbalete' || gid === 'lancer'))
    return [{ spec: gid, mode: 'full' }, { spec: ANY_RANGED_SPEC, mode: 'degraded' }]; // LDB 62 l.184
  return [{ spec: gid, mode: 'full' }];
}

/**
 * Spé du combattant qui couvre le Groupe de l'arme, avec son MODE (`SpecAcceptance`) — SOURCE UNIQUE
 * consommée par `combatValue` (le bonus de Test est TOUJOURS intégral, cf. LDB 62 l.184 « votre
 * Compétence de Tir ») et `weaponGroupSkillMode` (info dégradée transmise à `effectiveWeapon`). Les
 * entrées EXPLICITES (`spec` réel) priment sur la sentinelle `ANY_RANGED_SPEC`, essayée en dernier
 * (meilleure Spé de Tir disponible, dégradée). `null` si aucune Spé du `skillId` de `kind` ne matche.
 */
function matchGroupSpec(c: Combatant, weapon: Weapon, kind: 'melee' | 'ranged'): { advances: number; mode: 'full' | 'degraded'; spec?: string } | null {
  const skillId = kind === 'melee' ? 'corps-a-corps' : 'projectiles';
  const matching = c.skills.filter((s) => s.id === skillId);
  if (!matching.length) return null;
  const wanted = acceptableSpecs(weapon, kind);
  for (const w of wanted) {
    if (w.spec === ANY_RANGED_SPEC) continue; // essayée en dernier, cf. plus bas
    const sk = matching.find((s) => s.spec === w.spec);
    if (sk) return { advances: sk.advances, mode: w.mode, spec: w.spec };
  }
  if (wanted.some((w) => w.spec === ANY_RANGED_SPEC)) {
    const best = matching.reduce<Combatant['skills'][number] | undefined>((m, s) => (!m || s.advances > m.advances ? s : m), undefined);
    // Pas de `spec` rendue : la MEILLEURE instance n'est pas désignable par sa `spec` (deux instances
    // peuvent la partager) — l'appelant s'en tient aux Augmentations retenues ici.
    if (best) return { advances: best.advances, mode: 'degraded' };
  }
  return null;
}

/** Caractéristique SUR LAQUELLE se résout un Test de combat : CC/CT, ou la Résolution ALTERNATIVE
 *  déclarée par l'arme (bélier → Force, ADE II 8 l.233). SOURCE UNIQUE — la sélection de Compétence
 *  (`combatSkillPick`) et tout écran qui décompose la Caractéristique du jet (`volatileCharLines`)
 *  lisent la MÊME formule. */
export function combatCharKey(kind: 'melee' | 'ranged', weapon?: Weapon): CharKey {
  return weapon?.resolveChar ?? (kind === 'melee' ? 'capacite-de-combat' : 'capacite-de-tir');
}

/** Compétence RETENUE pour un Test de combat : Caractéristique testée + Spé du Groupe de l'arme
 *  (LDB 62 l.138-139) et ses Augmentations. Aucun modificateur — SÉLECTION pure, partagée par la
 *  valeur NUE (`combatBaseValue`) et la somme des modificateurs (`combatValueMods`). */
function combatSkillPick(c: Combatant, kind: 'melee' | 'ranged', weapon?: Weapon): { charKey: CharKey; skillId?: string; spec?: string; advances: number } {
  // Résolution ALTERNATIVE déclarée par l'arme (bélier → Force, ADE II 8 l.233) : Caractéristique BRUTE,
  // aucune Compétence associée (comme l'Empoignade, `rollGrappleForce`) — court-circuite CC/CT et la Spé du Groupe.
  if (weapon?.resolveChar) return { charKey: weapon.resolveChar, advances: 0 };
  const charKey = combatCharKey(kind, weapon);
  if (weapon && weaponUnmastered(c, weapon)) return { charKey, advances: 0 }; // arme inhabituelle non maîtrisée : carac brute (ACE 12 l.17-21)
  const skillId = kind === 'melee' ? 'corps-a-corps' : 'projectiles';
  const matching = c.skills.filter((s) => s.id === skillId);
  if (matching.length === 0) return { charKey, advances: 0 };
  if (!weapon || !weapon.subType) return { charKey, skillId, advances: Math.max(0, ...matching.map((s) => s.advances)) };
  const m = matchGroupSpec(c, weapon, kind);
  return { charKey, skillId, spec: m?.spec, advances: m?.advances ?? 0 };
}

/**
 * Valeur de Compétence de combat NUE (Caractéristique + avances de la *bonne* Spécialisation), au sens
 * de `LDB 09 l.17` : c'est la grandeur du départage à DR égal (`LDB 12 l.160`), insensible à l'Avantage,
 * aux États et aux effets actifs — ceux-ci voyagent dans `combatValueMods`.
 *
 * RAW : Corps à corps et Projectiles étant Groupées, les Augmentations ne comptent QUE pour la
 * Spécialisation correspondant au Groupe de l'arme tenue (exemple Sigrid, LDB 09 l.44 : sans la
 * Spé adéquate on teste sur la Caractéristique brute). `weapon` omis (créatures, Piétinement,
 * affichage générique) → comportement historique : meilleure Spé disponible.
 */
export function combatBaseValue(c: Combatant, kind: 'melee' | 'ranged', weapon?: Weapon): number {
  const p = combatSkillPick(c, kind, weapon);
  // FORMULE UNIQUE : `skillBaseValue` (Caractéristique effective + Augmentations), avec la
  // Caractéristique IMPOSÉE par le combat (CC/CT, ou celle de la résolution alternative de l'arme).
  // Quand la Spé retenue n'est pas désignable par sa `spec` (meilleure Spé disponible, Spé absente,
  // arme non maîtrisée, carac brute), seules ses Augmentations retenues s'ajoutent à cette carac.
  return p.skillId != null && p.spec != null
    ? skillBaseValue(c, p.skillId, p.spec, p.charKey)
    : effectiveChar(c, p.charKey) + p.advances;
}

/**
 * Modificateurs FONDUS dans la valeur de combat, en SOMME : mods de Test char-QUALIFIÉS d'effets
 * ACTIFS (`activeCharTestMod`). Ils vivent DANS la valeur et ne transitent JAMAIS par `combineMods`
 * (plafond « Combiner les Difficultés », LDB 14 l.91-96) — les y verser les amputerait à −30.
 * #193 : pénalité de récupération « Tests effectués avec ce bras » (Épaule luxée, LDB/AA) — scopée à
 * l'arme tenue dans CETTE main (`weaponHand`), jamais l'autre. Inerte si `weapon` absent (créature sans
 * arme, Piétinement…) ou si aucun effet ne porte `testModHand`.
 */
export function combatValueMods(c: Combatant, kind: 'melee' | 'ranged', weapon?: Weapon): number {
  return combatValueModParts(c, kind, weapon).reduce((s, p) => s + p.value, 0);
}

/** Les MÊMES modificateurs, en composantes NOMMÉES (libellé + renvoi Codex de l'entité émettrice) —
 *  SOURCE UNIQUE dont `combatValueMods` est la Σ : l'écran qui rebase une valeur de combat sur sa
 *  valeur NUE (`combatBaseValue`) annonce l'écart au lieu de le fondre (#1178, `ReloadModal`). */
export function combatValueModParts(c: Combatant, kind: 'melee' | 'ranged', weapon?: Weapon): ModLine[] {
  if (weapon?.resolveChar) return []; // carac BRUTE (ADE II 8 l.233) : aucun mod de Test char-qualifié
  const charKey = kind === 'melee' ? 'capacite-de-combat' : 'capacite-de-tir';
  return activeCharTestModParts(c, charKey, { weaponHand: weapon?.hand });
}

/** Valeur de combat FONDUE = valeur NUE + ses modificateurs (identité `base + modificateurs`). */
export function combatValue(c: Combatant, kind: 'melee' | 'ranged', weapon?: Weapon): number {
  return combatBaseValue(c, kind, weapon) + combatValueMods(c, kind, weapon);
}

/**
 * Libellé du Test d'attaque affiché (menteur si codé en dur indépendamment de `combatValue`, #203+) :
 * une Résolution ALTERNATIVE déclarée par l'arme (bélier → Force, ADE II 8 l.233) résout sur la
 * Caractéristique nommée, PAS Corps à corps/Projectiles — le libellé doit suivre `combatValue`,
 * SOURCE UNIQUE des deux (jamais un binaire `kind` recalculé séparément).
 */
export function attackTestLabel(weapon: Weapon | undefined, kind: 'melee' | 'ranged'): string {
  if (weapon?.resolveChar) return CHAR_LABELS[weapon.resolveChar];
  return kind === 'ranged' ? 'Projectiles' : 'Corps à corps';
}

/**
 * Arme INHABITUELLE non maîtrisée (ACE 12 l.19 « Entraînement avec une arme inhabituelle » :
 * « pour véritablement maîtriser une telle arme, il faut avoir la patience d'échouer et de recommencer
 * indéfiniment ») : tant que le trapping `requiresMastery` de l'arme tenue n'est pas dans
 * `c.masteredWeapons`, le porteur est traité comme SANS la Compétence du Groupe — carac brute
 * (mécanique de la Spé manquante, LDB 09 l.44) et Défauts contextuels du Groupe (LDB 62 l.146-147).
 * Lue par `combatValue` et `hasWeaponGroupSkill` ; inerte sur les armes hors inventaire (créatures).
 */
export function weaponUnmastered(c: Combatant, weapon: Weapon): boolean {
  if (!weapon.uid) return false;
  const it = (c.items ?? []).find((i) => i.uid === weapon.uid);
  if (!it?.requiresMastery) return false;
  return !(it.trappingId != null && (c.masteredWeapons ?? []).includes(it.trappingId));
}

/**
 * MODE de la Spé (de Corps à corps / Projectiles) qui couvre le **Groupe** de l'arme (LDB 62 l.138-139,
 * exceptions l.184-192) — réutilise `matchGroupSpec`/`acceptableSpecs`, SOURCE UNIQUE des Spés autorisées
 * par Groupe (comme `combatValue`). `'none'` si l'arme n'a pas de Groupe (`subType` absent), si elle est
 * INHABITUELLE non maîtrisée (ACE 12 l.17-21), ou si aucune Augmentation ne la couvre. Consommé par le funnel
 * de contexte d'arme (`WeaponContext.groupSkillMode`, lu par `effectiveWeapon`).
 */
export function weaponGroupSkillMode(c: Combatant, weapon: Weapon, kind: 'melee' | 'ranged'): 'full' | 'degraded' | 'none' {
  if (!weapon.subType) return 'none';
  if (weaponUnmastered(c, weapon)) return 'none'; // arme inhabituelle non maîtrisée (ACE 12 l.17-21) : Défauts du Groupe
  return matchGroupSpec(c, weapon, kind)?.mode ?? 'none';
}

/**
 * Le combattant possède-t-il la Spécialisation EXACTE (de Corps à corps / Projectiles) du **Groupe** de
 * l'arme (LDB 62 l.138-139), en mode PLEIN uniquement — un accès dégradé (l.184-192, via une AUTRE Spé de
 * Tir) n'est PAS « la Spé du Groupe » : la Qualification d'Arme d'équipe (AA 10 l.228-247, `hasCrewSkill`)
 * distingue ce cas précis (un tireur à l'Arc ne QUALIFIE PAS une pièce d'Arbalète, même si son propre Test
 * de tir dégradé reste possible — `combatValue`). Réutilise `weaponGroupSkillMode`.
 * Sert aussi aux règles de Groupe CONTEXTUELLES (Fléau sans compétence → Dangereuse, LDB 62 l.146-147).
 */
export function hasWeaponGroupSkill(c: Combatant, weapon: Weapon, kind: 'melee' | 'ranged'): boolean {
  return weaponGroupSkillMode(c, weapon, kind) === 'full';
}

/** Mode de défense STRUCTUREL. `social` = SUBSTITUTION d'une Compétence sociale à Corps à corps (LDB 09
 *  l.207 Dressage / l.287 Intimidation) « à la place de Corps à corps quand vous vous défendez face à
 *  ceux qui ont peur de vous » — data-driven (`SkillData.combatSubstitute`), MÊLÉE uniquement (le tir
 *  n'ouvre que Parade/Esquive). Sa valeur de base voyage dans `socialBase` (calculée par la couche
 *  état/UI via `combatSubstitute`), son libellé dans `DefenseSub.label`. */
export type DefenseMode = 'parade' | 'esquive' | 'social';
/** Descripteur d'une défense par substitution sociale : valeur de Test de la Compétence substituée
 *  (`base`) + son libellé d'affichage (`label`, ex. « Intimidation »). Thread depuis la couche état. */
export interface DefenseSub { base: number; label: string }

/**
 * Valeur de défense NUE (Parade = Corps à corps avec l'arme parante ; Esquive = Agilité + avances ;
 * Social = valeur de Test de la Compétence substituée, fournie par `socialBase`), au sens de
 * `LDB 09 l.17` : grandeur du départage à DR égal (`LDB 12 l.160`). Les pénalités de mobilité et les
 * effets actifs voyagent dans `defenseValueMods`. `weapon` (arme du défenseur) n'est utilisé qu'en Parade,
 * pour aligner la Spé de Corps à corps sur l'arme tenue.
 */
export function defenseBaseValue(c: Combatant, mode: DefenseMode, weapon?: Weapon, socialBase?: number): number {
  if (mode === 'social') return socialBase ?? 0; // base = Test de la Compétence sociale (Intimidation/Dressage), calculée en amont
  if (mode === 'parade') return combatBaseValue(c, 'melee', weapon ?? c.weapons[0]);
  return skillBaseValue(c, 'esquive', undefined, 'agilite');
}

/**
 * Modificateurs FONDUS dans la valeur de défense, en SOMME : pénalité de mobilité + mods de Test
 * char-QUALIFIÉS d'effets ACTIFS. Ils vivent DANS la valeur et ne transitent JAMAIS par `combineMods`
 * (plafond « Combiner les Difficultés », LDB 14 l.91-96) — les y verser les amputerait à −30.
 * L'Esquive subit la pénalité d'Agilité d'Encombrement (Surchargé, LDB 61 l.35-40).
 */
export function defenseValueMods(c: Combatant, mode: DefenseMode, weapon?: Weapon): number {
  if (mode === 'social') return 0; // valeur fournie clé en main par la couche état
  if (mode === 'parade') return combatValueMods(c, 'melee', weapon ?? c.weapons[0]);
  // Pénalité de mobilité : pire pénalité (non-cumul, LDB 16 l.13) entre Encombrement et traumatisme
  // de jambe (Déchirure −10/−20, Fracture −20 « règle du Pied », LDB 18 l.220/229/285).
  const mobilityPenalty = Math.min(agilityTestPenalty(c), traumaDodgePenalty(c));
  // #193 : pénalité de récupération « Tests impliquant cette jambe » (Genou démis, LDB/AA) — Esquive EST
  // classée « déplacement » (SkillData.movement), même catégorie que l'État À Terre/Empêtré.
  return mobilityPenalty + activeCharTestMod(c, 'agilite', { movement: true });
}

/** Valeur de défense FONDUE = valeur NUE + ses modificateurs (identité `base + modificateurs`). */
export function defenseValue(c: Combatant, mode: DefenseMode, weapon?: Weapon, socialBase?: number): number {
  return defenseBaseValue(c, mode, weapon, socialBase) + defenseValueMods(c, mode, weapon);
}

/** Détail d'un jet (pour l'affichage : base, modificateurs, cible, d100 et DR). */
// Le modificateur étiqueté (`ModLine`) est défini dans `types.ts` — FORME UNIQUE, lisible des
// collecteurs d'États comme du moteur de combat sans cycle d'import ; ré-exporté ici pour les
// lecteurs historiques (une définition, deux chemins d'import).
export type { ModLine } from './types';

/** Degré de masquage d'une ligne de jet à l'écran — DÉFINITION UNIQUE, partagée par le jet RÉSOLU
 *  (`RollBreakdown`) et le pré-jet (`PendingRoll`). Rendu par le site unique `ui/RollLine.tsx`. */
export type RollMask = 'value' | 'roll';

/**
 * SECONDE LECTURE d'une ligne de jet (Test COMBINÉ, `LDB 12 l.202-208`) — DÉFINITION UNIQUE, partagée
 * par le jet RÉSOLU (`RollBreakdown.second` : le verdict de la seconde valeur) et le pré-jet
 * (`PendingRoll.second` : sa seule cible, le dé n'étant pas tombé). Rendue par le site unique
 * `ui/RollLine.tsx`, sous la ligne qu'elle prolonge — un seul dé, deux lectures.
 */
export interface SecondReadLine {
  label: string;
  base?: number;
  target: number;
  difficulty?: Difficulty;
  /** Issue de CETTE lecture — absente avant le jet (la ligne n'annonce alors que sa cible). */
  sl?: number;
  success?: boolean;
}

export interface RollBreakdown {
  /** Intitulé du jet : 'Corps à corps' / 'Parade' / 'Esquive' / 'Projectiles'. */
  label: string;
  /** SEUIL PUR (#1426) : le jet décrit est un POURCENTAGE (`dé ≤ nombre visé`), pas un Test — la ligne
   *  rend son verdict en clair, sans ✓±DR (un pourcentage n'a pas de Degré de Réussite). Absent = Test. */
  evaluation?: 'seuil';
  /** Difficulté du Test — NATURE du jet, pas un modificateur circonstanciel : elle se lit
   *  sur la LIGNE (texte + valeur, `ui/RollLine.tsx`) et n'entre JAMAIS dans `mods` (#1072). Sa
   *  valeur reste comprise dans `modifier`/`target`. */
  difficulty?: Difficulty;
  /** Modificateur RÉEL des circonstances quand il ne tombe sur AUCUN cran de l'échelle
   *  (`DifficultyComposition.difficultyCombined`) : présent ⇒ `difficulty` est la DÉCLARÉE et
   *  l'affichage compose « Combinée (+30) ». DÉRIVÉ — aucun site ne le pose à la main. */
  difficultyCombined?: number;
  /** COMPOSITION du palier quand il est DÉRIVÉ d'une combinaison de circonstances (`LDB 14 l.91-96`,
   *  mode plafonné de `rollLine`) : ces lignes ne sont PLUS dans `mods` — le palier les porte, et son
   *  popover les détaille. Absente = Difficulté déclarée, `mods` porte tout. */
  difficultyParts?: ModLine[];
  /** Difficulté ALLÉGÉE (`FlowTest.easierIf`) : libellé de la Compétence/du Talent qui l'a permis —
   *  annoté avec la difficulté sur la ligne. */
  easedBy?: string;
  /** Mode de défense STRUCTUREL (≠ libellé d'affichage) — renseigné sur le jet du DÉFENSEUR pour que
   *  le moteur branche sur la nature de la défense (Esquive = Test de Déplacement) sans matcher le texte. */
  mode?: DefenseMode;
  /** Valeur de Compétence/Caractéristique de base (avant modificateurs) — la valeur TESTÉE dont la
   *  ligne rend « base + modificateurs = cible ». En COMBAT elle porte encore les modificateurs de la
   *  VALEUR (`combatValueMods`/`defenseValueMods`) : elle n'est donc pas le Niveau de Compétence nu. */
  base: number;
  /** Niveau de Compétence NU du jet décrit (`LDB 09 l.17`) — la SEULE grandeur du départage à DR égal
   *  (`LDB 12 l.160`). Reconduite du `TestResult` que ce détail décrit : un jet réhydraté de ce détail
   *  (`hydrateTR`) retrouve ainsi sa nue au lieu de reprendre `base`, qui n'en est pas une en combat.
   *  Absente quand le producteur du jet n'en pose pas (jet non opposable : piétinement, tir dévié). */
  nue?: number;
  /** Somme des modificateurs appliqués (Avantage, viser, États, portée, Atouts…). */
  modifier: number;
  /** Détail étiqueté des modificateurs (somme = `modifier` quand renseigné). */
  mods?: ModLine[];
  /** Valeur cible effective (= base + modificateurs) : on réussit si jet ≤ cible. */
  target: number;
  /** ÉCRÊTAGE réellement subi par la cible (`TestResult.clamped`) — la seule source qui autorise la
   *  chip « plafond/plancher » : sans elle, une cible à 99 par coïncidence serait mal nommée. */
  clamped?: number;
  roll: number;
  success: boolean;
  /** Degrés de Réussite de CE jet (positif = réussite). */
  sl: number;
  /** Masque d'AFFICHAGE de la ligne (jamais une donnée de règle — les valeurs restent EXACTES) :
   *  `'value'` = base/cible cachées (adversaire opaque, ex. Marchandage du marchand) ; `'roll'` ⊃
   *  `'value'` = ligne entière masquée, « ? » à la place du dé et du ✓/✗ ±DR (#990). */
  mask?: RollMask;
  /** Z5c — RAISON du verdict de CETTE ligne quand la comparaison des DR ne le dit pas seule
   *  (départage d'un Test opposé, LDB 12 l.160). Posée par le résolveur du Test opposé sur la ligne
   *  concernée ; `ui/RollLine.tsx` en rend la phrase. Absente = rien à expliquer. */
  decided?: VerdictReason;
  /** SECONDE LECTURE du MÊME dé — Test COMBINÉ (`LDB 12 l.202-208`, verbatim l.206 : « Faire un seul
   *  Test, en comparant donc un unique jet de pourcentage avec la valeur de ces deux Compétences »).
   *  ZONE d'affichage de la ligne, DÉRIVÉE par le socle qui a évalué (`state/cascade.secondReadOf`) :
   *  aucune surface ne recompare le dé. Absente = la ligne n'a qu'une lecture (le cas de tous les
   *  jets ordinaires). */
  second?: SecondReadLine;
}

export interface AttackResult {
  hit: boolean;
  attackerRoll: number;
  defenderRoll?: number;
  netSL: number;
  location?: HitLocation;
  /** RAW-2 (LDB 17 l.68) : localisation du Coup Critique CHOISIE par le joueur via « Je ne faillirai pas ! »
   *  — court-circuite le tirage aléatoire dans `applyCriticalToTarget`. Absente = localisation au hasard. */
  critLocation?: HitLocation;
  damage?: number; // dégâts bruts (avant mitigation)
  woundsLost?: number; // Blessures réellement perdues
  /** PA externe location-INDÉPENDANT appliqué aux Dégâts (PA d'opposition `extraAP` − Tir sûr) — permet de
   *  recalculer les Blessures à la localisation RE-TIRÉE d'un Coup Critique (`woundsAtCritLocation`, LDB 18
   *  l.55), où seule l'ignorance de PA (Partielle / Points faibles) dépend de la localisation. */
  apExternal?: number;
  critical: boolean;
  /** SAUVEGARDE « 1d10 ≥ Indice » de CE coup, DÉCIDÉE (LDB 85 l.98, LDB 85 l.278, LDB 47 l.410) — posée
   *  par la porte (étape de dé), jamais par le moteur. Sa présence dit que le dé est tombé : le registre
   *  de touche APPLIQUE l'issue au lieu d'en redemander un, et un coup qui repasse par le registre après
   *  une autre fenêtre (Déviation) ne rejoue pas la sauvegarde. */
  sauvegarde?: { sauve: boolean };
  /** +1 Avantage gagné par l'attaquant (true) ou le défenseur (false), null = aucun. */
  advantageTo: 'attacker' | 'defender' | null;
  defenderDefeated: boolean;
  /** Détail du jet d'attaque (cible, d100, DR) — pour la modale. */
  attackerDetail?: RollBreakdown;
  /** Détail du jet de défense en Test opposé (cible, d100, DR) — absent si non opposé. */
  defenderDetail?: RollBreakdown;
  /** Frappe Mortelle (LDB 14 l.9 / 85 l.299) : touche de mêlée réussie d'un attaquant plus grand
   *  → balayage possible vers un autre adversaire à portée. Orchestré par le store/combatFlow. */
  cleave?: boolean;
  /** Arme avec laquelle le défenseur a PARÉ (mode parade uniquement) — sert aux Critiques du Test
   *  opposé (Piège-lame, LDB 62 l.278) et à la Maladresse défensive d'une arme Dangereuse. */
  parryWeapon?: Weapon;
  /** Cible Inconsciente — règle optionnelle « mort-auto » (LDB 16 l.113) : en CORPS À CORPS, la cible
   *  est tuée automatiquement. Le store applique la mise hors de combat MORTELLE par le chemin des morts
   *  normales (finalizeHeroDeath → Destin possible). Absent/false = comportement « critique » (RAW). */
  autoKill?: boolean;
  log: string;
}

/** Détail d'AFFICHAGE d'un jet de combat. La valeur nue voyage AVEC lui (`nue`, lue sur le
 *  `TestResult` décrit) : sans elle, tout jet réhydraté du détail (Chance, dé posé, ré-opposition)
 *  reprendrait `base` — la valeur TESTÉE — et rouvrirait le départage mixte (`LDB 12 l.160`). */
const bd = (label: string, base: number, t: TestResult, c?: DifficultyComposition, mode?: DefenseMode): RollBreakdown => {
  // La Difficulté n'est PAS recomposée ici : elle est POSÉE par qui a roulé le jet, avec les
  // modificateurs qui ont fait la cible. `bd` la relaie — un détail d'affichage ne redécide rien.
  return {
    label,
    ...(mode ? { mode } : {}),
    base,
    ...(t.base != null ? { nue: t.base } : {}),
    modifier: t.target - base,
    ...(c ? { mods: c.mods, difficulty: c.difficulty } : {}),
    ...(c?.difficultyCombined != null ? { difficultyCombined: c.difficultyCombined } : {}),
    ...(c?.difficultyParts ? { difficultyParts: c.difficultyParts } : {}),
    target: t.target,
    roll: t.roll,
    success: t.success,
    sl: t.sl,
  };
};
export const DEFENSE_LABEL: Record<'parade' | 'esquive', string> = { parade: t('defense.parade'), esquive: t('defense.esquive') };

/** Libellé FR de la nature d'une attaque gratuite de créature (`freeKind`) — terminologie de combat,
 *  source UNIQUE (utilisée par la modale de défense). */
export const FREE_ATTACK_LABEL: Record<string, string> = {
  morsure: t('freeAttack.morsure'), caudale: t('freeAttack.caudale'), cornes: t('freeAttack.cornes'), pietinement: t('freeAttack.pietinement'),
  langue: t('freeAttack.langue'), hurlement: t('freeAttack.hurlement'),
};

/**
 * Combiner les Difficultés (LDB `14 - _GoBack.md` l.91-96) — le plafond borne la combinaison des
 * CIRCONSTANCES, jamais les ressources propres du jeteur. La partition se lit SITUATIONNEL/PROPRE :
 * tout modificateur SITUATIONNEL du Test — terrain, météo, position, angle, distance, geste (Viser,
 * Localisation visée, Main secondaire, tir en bougeant), état ou trait de l'ADVERSAIRE — est
 * `famille: 'circonstance'` et entre dans les deux sommes plafonnées (RAW +60 Très Facile / −30 Très
 * Difficile) ; ce qui est une RESSOURCE ou un état PROPRE du jeteur (Avantage, SES États, Soutien)
 * est `famille: 'jet'` et s'ajoute hors plafond. L'appartenance à la table ne fait PAS le classement :
 * elle n'est qu'un échantillon (chapeau l.48), et l'exemple chiffré l.96 plafonne une situation DU
 * JETEUR (« alors qu'on se trouve dans la neige jusqu'à la taille ») avec l'État d'un adversaire.
 * Le classement des États DU JETEUR hors plafond (`LDB 16 l.11`, `l.13` ; Soutien `LDB 12 l.189`)
 * reste un ARBITRAGE maison : le RAW ne règle pas l'interaction des deux régimes.
 * Les deux plafonds sont des règles optionnelles (`combat-diff-cap-bonus`/`-malus`).
 *
 * Les deux exemples du livre, VERBATIM (l.95-96) :
 *   « Si la situation nécessite l'ajout de deux pénalités ou plus, contentez-vous de faire la somme
 *     des différents modificateurs sans dépasser **Très Difficile -30**. Par exemple, le brouillard
 *     ajouté au fait de vouloir toucher une Localisation précise donne un Test de **Capacité de
 *     Combat Difficile (-20)**. Lorsqu'il est combiné, le Test devient simplement **Très Difficile
 *     (-30)** au lieu de recevoir une pénalité de **-40**. De la même façon, si la situation implique
 *     l'addition de deux bonus, faites la somme des modificateurs jusqu'à un maximum de **+60** ou
 *     **Très Facile** . »
 *   « Si la situation demande à la fois une pénalité et un bonus, faites-en la somme pour obtenir la
 *     nouvelle difficulté. Attaquer un adversaire alors qu'on se trouve dans la neige jusqu'à la
 *     taille nécessite normalement un Test **Très Difficile (-30)**. Mais attaquer un adversaire qui
 *     est *À Terre* ne nécessite qu'un Test **Facile (+20)**. Dans une situation ou les deux
 *     paramètres s'applique, le Test sera **Difficile (-10)** parce que **-30** plus **+20** font
 *     **-10** . »
 */
export function combineMods(mods: ModLine[]): number {
  let pos = 0;
  let neg = 0;
  let free = 0;
  for (const m of mods) {
    if (m.famille !== 'circonstance') free += m.value;
    else if (m.value >= 0) pos += m.value;
    else neg += m.value;
  }
  const capBonus = rule('combat-diff-cap-bonus') as number;
  const capMalus = rule('combat-diff-cap-malus') as number;
  return free + Math.min(capBonus, pos) + Math.max(-capMalus, neg);
}

/** Ce que les modificateurs pesant sur la CIBLE DU d100 (le nombre visé) font de la Difficulté d'un
 *  jet de combat — forme UNIQUE, lue par le pré-jet (`state/rollSeam.ts`, monteur canonique) comme
 *  par le post-jet (`bd`). « Cible » désigne ici le NOMBRE visé, jamais l'adversaire. */
export interface DifficultyComposition {
  /** Difficulté à AFFICHER : le palier composé quand il tombe sur un cran de l'échelle, la déclarée sinon. */
  difficulty: Difficulty;
  /** Modificateur RÉEL des circonstances quand il ne tombe sur AUCUN cran de l'échelle (`LDB 14` n'en
   *  nomme pas) : l'AFFICHAGE en compose « Combinée (+30) ». Présent ⇒ `difficulty` est la DÉCLARÉE et
   *  ne doit JAMAIS s'afficher seule. */
  difficultyCombined?: number;
  /** Composition du palier (circonstances + écart du plafond) : ces lignes ne sont PLUS dans `mods`. */
  difficultyParts?: ModLine[];
  /** Ce qui reste en CHIPS — hors table (`LDB 14 l.48`), plus l'écart du plafond quand rien n'est composé. */
  mods: ModLine[];
  /** Combinaison PLAFONNÉE des seules circonstances (`LDB 14 l.91-96`) — 0 sans circonstance. */
  circCombined: number;
}

/** La Difficulté d'un jet réduite à ce qui la NOMME : le cran de l'échelle, plus le modificateur RÉEL
 *  quand la composition n'en atteint aucun. DÉRIVÉE de `DifficultyComposition` — même paire, mêmes noms
 *  de champs : ce que le moteur transporte est ce que l'affichage met en mots (`ui/difficultyText`). */
export type DifficultyShown = Pick<DifficultyComposition, 'difficulty' | 'difficultyCombined'>;

/**
 * COMPOSE la Difficulté d'un jet de combat à partir de ce qui pèse sur sa cible (`LDB 14 l.91-96`,
 * verbatim cité au-dessus de `combineMods`). Quatre conditions, toutes nécessaires :
 *  (a) au moins une circonstance — sinon le palier nommerait un pur artefact de plafond ;
 *  (d) une Difficulté déclarée NEUTRE (`DIFFICULTY_MODIFIERS[declared] === 0`) — un site qui DÉCLARE
 *      sa Difficulté (Test de combat authoré Difficile) la garde, la composition ne peut pas l'avaler ;
 *      en attaque elle est Intermédiaire d'office (`LDB 13 l.118`), donc la composition opère.
 * Le modificateur composé tombe sur un cran de l'échelle → ce cran est la Difficulté affichée ; sinon
 * il voyage tel quel (`difficultyCombined`), et l'affichage le nomme sans jamais le rabattre sur un
 * cran voisin (`difficultyFromModifier` est un plus proche voisin : un −15 y trouverait −10).
 */
export function composeDifficulty(declared: Difficulty, surLaCible: ModLine[]): DifficultyComposition {
  const circonstances = surLaCible.filter((m) => m.famille === 'circonstance');
  const circBrut = circonstances.reduce((s, m) => s + m.value, 0);
  const circCombined = combineMods(circonstances);
  // L'amputation du plafond est une LIGNE : sans elle, elle ne serait imputable à personne.
  const ecretage: ModLine[] = circCombined === circBrut
    ? []
    : [{ label: 'plafond Difficultés', value: circCombined - circBrut, famille: 'circonstance', ref: RULE_REF['combiner-les-difficultes'] }];
  if (!circonstances.length || DIFFICULTY_MODIFIERS[declared] !== 0) {
    return { difficulty: declared, mods: [...surLaCible, ...ecretage], circCombined };
  }
  const parts = [...circonstances, ...ecretage];
  const mods = surLaCible.filter((m) => m.famille !== 'circonstance');
  const cran = exactDifficultyFromModifier(circCombined);
  return cran
    ? { difficulty: cran, difficultyParts: parts, mods, circCombined }
    : { difficulty: declared, difficultyCombined: circCombined, difficultyParts: parts, mods, circCombined };
}

/** Difficulté d'un jet de COMBAT composée par ce qui pèse sur sa cible : Intermédiaire à la source
 *  (`LDB 13 l.118`), puis la table (`LDB 14 l.91-96`). SEUL point d'entrée des résolveurs — ils
 *  composent avec les modificateurs qui ont RÉELLEMENT fait la cible, une fois. */
export function composeAttack(mods: ModLine[]): DifficultyComposition {
  return composeDifficulty('intermediaire', mods);
}

/**
 * COMPTEUR des re-dérivations qui ont RECOMPOSÉ faute de composition transportée (#1153 L4) — sonde
 * partagée, patron `ANONYMES`/`REPLIS_DEUX_CIBLES`. Un site de re-dérivation qui oublie le transport
 * retombe dans le défaut d'origine (Difficulté d'une attaque qui change parce qu'on dépense sa
 * Chance) : le repli reste possible — un appel direct hors flux doit rester résoluble — mais il ne
 * peut plus être SILENCIEUX. Inerte en PROD hors journal.
 */
export const REDERIVATIONS = { recomposees: 0 };

/** Repli du transport : compose depuis le contexte APPAUVRI du re-jet, et le DIT. */
function compoDeRepli(mods: ModLine[], site: string): DifficultyComposition {
  REDERIVATIONS.recomposees += 1;
  console.error(`[combat] ${site} : re-dérivation SANS Difficulté transportée — recomposée depuis un contexte appauvri (ni distance, ni env, ni flanc/dos). Passer \`frozenDifficulty(detail d'origine)\` au call-site.`);
  return composeAttack(mods);
}

/**
 * REPREND la Difficulté d'un jet DÉJÀ résolu (`RollBreakdown`) pour la transporter telle quelle vers
 * une re-dérivation (#1153 L4) — Chance « +1 DR », dé choisi, Résilience, touche déviée. Dépenser un
 * point ne rejoue pas les circonstances : re-composer depuis le contexte appauvri du re-jet (sans
 * distance, sans env, sans flanc/dos) changerait la Difficulté AFFICHÉE d'une attaque déjà tranchée.
 * `circCombined` se relit de la composition portée (les `difficultyParts` en SONT la somme).
 */
export function frozenDifficulty(d: RollBreakdown | undefined): DifficultyComposition | undefined {
  if (!d?.difficulty) return undefined;
  const parts = d.difficultyParts;
  return {
    difficulty: d.difficulty,
    ...(d.difficultyCombined != null ? { difficultyCombined: d.difficultyCombined } : {}),
    ...(parts ? { difficultyParts: parts } : {}),
    mods: d.mods ?? [],
    circCombined: (parts ?? []).reduce((s, m) => s + m.value, 0),
  };
}

/** Modificateurs qui font la CIBLE d'un jet de défense — SOURCE UNIQUE du résolveur (`rollMeleeDefender`),
 *  de la ligne résolue (`combineOpposed`) et du pré-jet (`previewDefense`) : `defenseModifiers`
 *  (Avantage, État, Sur la défensive, Neige, Main secondaire, Maniement deux armes) + le malus Rapide,
 *  qui dépend de l'arme ATTAQUANTE (`LDB 62 l.298-302`) et vit donc hors de `defenseModifiers` : −10
 *  aux Tests de Corps à corps (Parade) contre une arme Rapide, sauf si l'arme de parade l'est aussi ;
 *  l'Esquive défend normalement. Trois lecteurs, une liste — sinon l'écran et le dé divergent. */
export function defenseTargetMods(
  defender: Combatant,
  mode: DefenseMode,
  dodgeMod = 0,
  parryWeapon?: Weapon,
  vsWeapon?: Weapon,
): ModLine[] {
  const mods = defenseModifiers(defender, mode, dodgeMod, parryWeapon);
  const rapide = mode === 'parade' ? rapideParryMod(vsWeapon, parryWeapon) : 0;
  if (rapide) mods.push({ label: 'Rapide', value: rapide, famille: 'jet', ref: RULE_REF.rapide });
  return mods;
}

/** Option « Longueur d'Arme » (LDB 62 l.172, règle optionnelle `combat-weapon-reach`) : si l'arme de
 *  mêlée de l'adversaire a une Allonge SUPÉRIEURE à la vôtre, vous subissez −10 pour le toucher. La
 *  comparaison porte sur DEUX longueurs (`meleeReachRank`) : une seule non ordonnable → aucun malus.
 *  Adversaire sans arme de mêlée = Mains nues, « Personnelle » (l.28/l.158) : jamais plus long. Pure. */
export function weaponReachPenalty(attackerWeapon: Weapon, targetMelee: Weapon | undefined): number {
  if (!rule('combat-weapon-reach')) return 0;
  const target = meleeReachRank(targetMelee);
  const attacker = meleeReachRank(attackerWeapon);
  return target != null && attacker != null && target > attacker ? -10 : 0;
}

/**
 * Modificateur de DEGRÉ DE RÉUSSITE psychologique de l'attaquant CONTRE `target` (LDB 21) — RAW en DR,
 * jamais en valeur cible : Peur −1 DR (l.29, vs la source, sauf immunité Haine/Amour) ; Haine/Animosité
 * +1 DR contre le groupe haï (l.22/41) ; Amour/Camaraderie +1 DR (défense des aimés/du groupe, l.77/82).
 * Immunité psychologique (trait/Frénésie/Détermination, LDB 17 l.59) → 0. Sans Peur (LDB 10) ne donne pas
 * d'immunité d'office : le malus suit l'ÉTAT réel (une Peur active non vaincue, `calmeDR < indice`).
 * Appliqué à `atkSL` à chaque résolution d'attaque (cœur opposé + passes non opposées), une seule fois.
 */
export function psychDRAdjust(attacker: Combatant, target: Combatant | null): number {
  if (!target || isPsychImmune(attacker)) return 0;
  const psy = attacker.psychState ?? [];
  const groups = target.groups ?? [];
  // Peur ANNULÉE si une affliction active immunise l'attaquant à ce CANAL (Haine vs son groupe l.41,
  // Amour l.75 dont l’`active` porte déjà « tant que vous défendez ») — siège UNIQUE `psychImmuneToFrom`,
  // partagé avec `fearSourceFor` et la porte hors combat : un seul verdict, aucun roster requis ici.
  const fearCancelled = psychImmuneToFrom(attacker, target, 'peur');
  // Chaque état psy porte sa contribution `attackDR` (±1) + son ciblage `vs` en DONNÉES — plus de ±1 ni de
  // type (`peur`/`haine`/…) codé par-nom : un nouvel état psy (Phobie…) déclare son DR dans le JSON.
  let dr = 0;
  for (const p of psy) {
    const adr = findPsychologyById(p.type)?.attackDR;
    if (!adr) continue;
    const applies = adr.vs === 'source'
      ? p.sourceId === target.id && (p.calmeDR ?? 0) < (p.indice ?? 1) // Peur active non vaincue vs sa source
      : adr.vs === 'group'
        ? !!p.active && !!p.cible && groupMatch(p.cible, groups) // Haine/Animosité vs le groupe ciblé
        : !!p.active; // 'any' : Amour/Camaraderie (défense), dès lors qu'actif
    if (!applies || (adr.amount < 0 && fearCancelled)) continue; // malus de Peur effacé par Haine/Amour
    dr += adr.amount;
  }
  return dr;
}

/**
 * Modificateurs étiquetés d'un Test d'attaque (source UNIQUE : le moteur les somme pour le jet,
 * l'UI les affiche). Toutes les valeurs sont sourcées dans la table des Difficultés de Combat
 * (`14 - _GoBack.md`) : Avantage ×10 (LDB 14 l.215), portée (l.54-84), Viser +20 (l.61), Précise +10
 * (Armes l.304), Localisation visée −20 (LDB 14 l.73), Cible vulnérable À Terre/Surpris +20 (l.64).
 */
/** Lignes de mod des ÉTATS d'un combattant — SOURCE UNIQUE des trois producteurs (attaque, défense,
 *  Test de combat « brut »). Chaque composante de la pénalité arrive NOMMÉE et liée au Codex
 *  (`combatTestPenaltyParts`) : le gagnant du pool non-cumul porte le nom de SON État (« −30 Brisé »),
 *  le sort et le symptôme qui stackent gardent chacun leur ligne. `[]` si rien ne pèse. */
export function conditionModLines(c: Combatant): ModLine[] {
  return combatTestPenaltyParts(c);
}

export function attackModifiers(
  attacker: Combatant,
  target: Combatant | null,
  weapon: Weapon,
  opts: { kind: 'melee' | 'ranged'; location?: HitLocation | null; distanceTiles?: number; env?: ModLine[]; flankRear?: boolean; metresPerTile?: number },
): ModLine[] {
  const out: ModLine[] = [];
  const adv = attacker.advantage * 10;
  if (adv) out.push({ label: 'Avantage', value: adv, famille: 'jet', ref: RULE_REF.avantage });
  out.push(...conditionModLines(attacker));
  if (attacker.nextActionPenalty) out.push({ label: 'Maladresse (Round précédent)', value: -attacker.nextActionPenalty, famille: 'jet', ref: RULE_REF['maladresse-tableau-des-oups'] });
  // Amputation (LDB 18 l.251/263) : pénalité CONTEXTUELLE à l'arme — s'applique ssi l'arme implique la main blessée.
  const amp = amputationCombatPenalty(attacker, weapon);
  if (amp) out.push({ label: 'Amputation', value: amp, famille: 'jet', ref: RULE_REF.amputation });
  // Psychologie (LDB 21) : Peur/Haine/Amour modulent le DR du jet (±1 DR, l.29/22/41/77/82), PAS la valeur
  // cible — appliqué à `atkSL` via `psychDRAdjust` au moment de la résolution (cœur opposé + passes non
  // opposées), jamais ici (un ±10 sur la cible fausserait la probabilité ET le DR, contra RAW).
  if (opts.kind === 'ranged') {
    // Portée RÉSOLUE à l'usage (jet `{bf}` → BF×N ; mètres fixes inchangés) + modificateur de la munition tirée.
    const rangeM = effectiveWeaponRange(weapon, loadedAmmo(attacker, weapon)?.ammoRangeMod, () => bonus(effectiveChar(attacker, 'force')));
    if (opts.distanceTiles != null && rangeM != null) {
      const m0 = rangeBandModifier(opts.distanceTiles, rangeM, opts.metresPerTile);
      // Tireur embusqué (LDB 10) : aucune pénalité à Longue distance, moitié à Portée extrême.
      const m = m0 != null ? sniperRangeAdjust(attacker, m0) : null;
      const name = rangeBandName(opts.distanceTiles, rangeM, opts.metresPerTile);
      if (m != null && m !== 0 && name) out.push({ label: name, value: m, famille: 'circonstance', ref: RULE_REF['portee-d-une-arme'] });
    }
    if (attacker.aiming) out.push({ label: 'Viser', value: 20, famille: 'circonstance', ref: RULE_REF.viser }); // LDB 14, Tableau des Difficultés de Combat — Accessible (+20)
    // Salve (Aux Armes p.126) : chaque tir SUPPLÉMENTAIRE dans le Round subit −10 cumulatif.
    const salvoShots = hasQuality(weapon, 'salve') ? (attacker.shotsThisTurn ?? 0) : 0;
    if (salvoShots > 0) out.push({ label: 'Salve (tir suivant)', value: -10 * salvoShots, famille: 'jet', ref: RULE_REF.salve });
    // Taille de la CIBLE au tir (LDB 14 l.118-131) — valeur absolue −30..+60. Une Nuée ignore la
    // Taille et donne +40 au tir contre elle (LDB 85 l.253).
    if (target?.swarm) out.push({ label: 'Nuée (tir)', value: 40, famille: 'circonstance', ref: RULE_REF.nuee });
    else if (target && !ignoresSizeRangedMods(attacker)) { // Tireur d'élite (LDB 10) : ignore la Taille de la cible
      const sm = SIZE_RANGED_MOD[effectiveSize(target.size)];
      if (sm !== 0) out.push({ label: `Taille (cible) — ${SIZE_LABEL[effectiveSize(target.size)]}`, value: sm, famille: 'circonstance', ref: RULE_REF['taille-cible-au-tir'] });
    }
  } else if (target) {
    // Cible vulnérable : une ligne PAR État qui l'expose (« +20 À Terre », « +10 Assourdi » de dos),
    // chacune liée à sa fiche — jamais un « Cible vulnérable » anonyme qui fond deux règles distinctes.
    out.push(...meleeAttackerBonusLines(target, { flankRear: opts.flankRear }));
    // Parasité (LDB 85 l.257) : −10 pour toucher la créature en Corps à corps (vermine perturbante).
    const para = incomingAttackMod(target, 'melee');
    if (para) out.push({ label: 'Parasité', value: para, famille: 'circonstance', ref: RULE_REF.parasite });
    // Option « Longueur d'Arme » (LDB 62 l.172) : arme adverse plus longue → −10 pour la toucher.
    const reach = weaponReachPenalty(weapon, target.weapons?.find((w) => w.type === 'melee'));
    if (reach) out.push({ label: "Allonge de l'adversaire", value: reach, famille: 'circonstance', ref: RULE_REF['allonge-longueur-d-arme'] });
  }
  // +10 au plus petit, mêlée ET tir (LDB 85 l.366). Une Nuée ignore TOUTES les règles de Taille (l.253).
  if (target && !attacker.swarm && !target.swarm && sizeGap(attacker.size, target.size) < 0) out.push({ label: 'Taille (plus petit)', value: 10, famille: 'circonstance', ref: RULE_REF['taille-modificateurs-en-combat'] });
  const precise = qualitySum(weapon, 'attackMod');
  if (precise) {
    // La qualité PORTEUSE est la référence de la ligne quand elle est SEULE à contribuer ; à
    // plusieurs contributrices, aucune ne peut prétendre expliquer le total à elle seule.
    const q = attackModQualityIds(weapon);
    out.push({ label: 'Précise', value: precise, famille: 'jet', ref: q.length === 1 ? { category: 'qualities', id: q[0] } : undefined });
  }
  // Arme d'équipe en sous-effectif re-recevant un Défaut déjà porté → −10 plat (MDG 12 l.460), baké sur
  // l'arme tirée par `crewedFireWeapon` (≠ le −1 DR d'Imprécise, qui reste sur la qualité).
  if (weapon.crewedTohitPenalty) out.push({ label: 'Sous-effectif (Défaut redoublé)', value: weapon.crewedTohitPenalty, famille: 'jet', ref: RULE_REF['arme-d-equipe'] });
  // Machine de guerre en Équipe incomplète (ADE II 8 l.233) : −20 plat, baké par `warMachineFireWeapon`
  // (3ᵉ courbe de sous-effectif, DISTINCTE de celle d'AA ci-dessus).
  if (weapon.crewTeamPenalty) out.push({ label: 'Équipe incomplète', value: weapon.crewTeamPenalty, famille: 'jet', ref: RULE_REF['equipe-incomplete-machine-de-guerre'] });
  // Localisation visée = Difficile −20 (LDB 14 l.73) — SAUF contre une créature de Taille ≥ 2 catégories
  // supérieure : on choisit GRATUITEMENT la zone la plus proche / en Ligne de Vue (LDB « Point
  // d'Impact des Créatures » p.312 / `76` l.39).
  // Frappe assommante (Tête + arme Assommante) / Tir mortel (distance) : pas de pénalité (LDB 10).
  if (opts.location && !(target && sizeGap(target.size, attacker.size) >= 2)
      && !ignoresCalledShotPenalty(attacker, opts.kind, opts.location, hasQuality(weapon, 'assommante'))) out.push({ label: 'Localisation visée', value: -20, famille: 'circonstance', ref: RULE_REF['viser-une-localisation'] });
  // Possession pas prévue pour la Taille du porteur (ADE II 2 l.710) : −20 plat, ex. un ogre maniant
  // une arme de Taille Moyenne. Symétrique quand `sizeFor` est POSÉ (une arme taillée pour une Taille
  // devient réellement inadaptée à une autre, ADE II 2 l.604). Sans `sizeFor` (possession ORDINAIRE
  // du catalogue) : la LDB ne cite aucune pénalité d'équipement pour un porteur plus PETIT que la
  // Moyenne (Talent Petit, LDB 10 l.939-943, muet sur l'équipement) — seul un porteur plus GRAND que la
  // Moyenne (ex. ogre) subit le malus, l'objet ordinaire étant implicitement taillé pour la Moyenne.
  // Une arme NATURELLE (`Weapon.natural` — dents/griffes/cornes) ou SIZELESS (trait « Arme » générique
  // sans objet de catalogue résolu, `creatureEquip.weaponFromTrait`) est PAR DÉFINITION à la Taille de
  // son porteur : jamais de « Possession pas à sa taille », qui vise un OBJET manufacturé réel (ADE II
  // ch.02 l.604-710).
  const gearSize = effectiveSize(weapon.sizeFor);
  const carrierSize = effectiveSize(attacker.size);
  if (!weapon.natural && !weapon.sizeless && gearSize !== carrierSize
      && (weapon.sizeFor !== undefined || SIZE_ORDER[carrierSize] > SIZE_ORDER.moyenne)) {
    out.push({ label: 'Possession pas à sa taille', value: -20, famille: 'jet', ref: RULE_REF['possession-pas-a-sa-taille'] });
  }
  // Pénalité de main secondaire (LDB 14 l.181) ; Ambidextre la réduit via le registre combatFeatures.
  if (weapon.hand === 'off') {
    const p = offHandPenalty(attacker);
    if (p) out.push({ label: 'Main secondaire', value: p, famille: 'circonstance', ref: RULE_REF['main-secondaire'] });
  }
  // Météo « Tests physiques » (EDOC 8 l.82, #341) : CANAL UNIQUE — le Test d'attaque est physique
  // (Corps à corps = CC, Projectiles = CT). Lu depuis `attacker.envWeather` (posé à l'ouverture du combat),
  // jamais recâblé côté state (la garde d'import interdit tout autre lecteur de `weatherPhysicalTestMod`).
  out.push(...weatherTestMods(attacker.envWeather, opts.kind === 'ranged' ? 'capacite-de-tir' : 'capacite-de-combat'));
  // Modificateurs WEAPON-CONTEXTUELS dérivés de la SCÈNE (couvert / obscurité / météo au TIR (rangedMod/
  // poudre) / mouvement / tir-mêlée), calculés côté state (combatFlow) et injectés ici — la table de
  // Difficultés de Combat n'est pas exhaustive. La pénalité « Tests physiques » n'y est PLUS (canal ci-dessus).
  if (opts.env) out.push(...opts.env);
  return out;
}

/** Surnombre en mêlée (LDB « Difficulté de Combat », 14 - _GoBack.md l.85/92) : 2 attaquants au
 *  contact d'une même cible → +20 (Accessible) ; 3 ou plus → +40 (Facile). `attackers` inclut
 *  l'attaquant courant. Renvoyé en `ModLine` pour injection via `env`. */
export function outnumberMod(attackers: number): ModLine | null {
  if (attackers >= 3) return { label: 'Surnombre (3+ c.1)', value: 40, famille: 'circonstance', ref: RULE_REF['superiorite-numerique'] };
  if (attackers === 2) return { label: 'Surnombre (2 c.1)', value: 20, famille: 'circonstance', ref: RULE_REF['superiorite-numerique'] };
  return null;
}

/** « Tirer dans le tas » (LDB « Difficulté de Combat », 14 - _GoBack.md l.81/86/89) : tirer sur une
 *  cible noyée dans un groupe serré d'ennemis → 3-6 cibles +20, 7-12 → +40, 13+ → +60. `group` inclut
 *  la cible elle-même. */
export function crowdMod(group: number): ModLine | null {
  if (group >= 13) return { label: 'Tirer dans le tas (13+)', value: 60, famille: 'circonstance', ref: RULE_REF['tirer-dans-le-tas'] };
  if (group >= 7) return { label: 'Tirer dans le tas (7-12)', value: 40, famille: 'circonstance', ref: RULE_REF['tirer-dans-le-tas'] };
  if (group >= 3) return { label: 'Tirer dans le tas (3-6)', value: 20, famille: 'circonstance', ref: RULE_REF['tirer-dans-le-tas'] };
  return null;
}

/** Le défenseur possède-t-il une Spé de Corps à corps donnée (id de Groupe d'arme, ex. `'parade'`) ?
 *  « Compétence de Corps à corps » = compétence dont l'entrée déclare puiser ses spé dans les Groupes
 *  d'armes de mêlée (`specsSource`) — la garantie même que `spec` est comparable à un id de Groupe. */
function hasMeleeSpec(c: Combatant, spec: string): boolean {
  return (c.skills ?? []).some((s) => byId('skill', s.id)?.specsSource === 'weaponGroupsMelee' && (s.spec ?? '') === spec);
}

/** Pénalité à la PARADE avec l'arme `weapon` (LDB 62 l.151) : 0 en main principale ; 0 si arme à 1 main +
 *  Défensive + le défenseur a Corps à corps (Parade) ; sinon pénalité de main secondaire (Ambidextre la réduit). */
export function parryPenalty(defender: Combatant, weapon: Weapon | undefined): number {
  if (!weapon || weapon.hand !== 'off') return 0;
  if (weapon.hands === 1 && hasQuality(weapon, 'defensive') && hasMeleeSpec(defender, 'parade')) return 0;
  return offHandPenalty(defender);
}

/** Modificateurs étiquetés d'un Test de DÉFENSE (Parade/Esquive). `dodgeMod` = pénalité météo
 *  (neige épaisse −30) appliquée à l'esquive uniquement (LDB 14 l.82). `weapon` = arme de parade
 *  (pénalité de main secondaire en Parade, sauf exception Parade+Défensive). */
export function defenseModifiers(defender: Combatant, mode: DefenseMode, dodgeMod = 0, weapon?: Weapon): ModLine[] {
  const out: ModLine[] = [];
  const adv = defender.advantage * 10;
  // Avantage HORS table de Difficulté (`LDB 14 l.48`, comme `attackModifiers`) → `famille: 'jet'` : ne
  // compte pas dans le plafond ±30/+60 de `combineMods`, qui ne combine que les circonstances.
  if (adv) out.push({ label: 'Avantage', value: adv, famille: 'jet', ref: RULE_REF.avantage });
  out.push(...conditionModLines(defender));
  if (defender.defensiveStance) out.push({ label: 'Sur la défensive', value: 20, famille: 'jet', ref: RULE_REF['sur-la-defensive'] });
  if (mode === 'esquive' && dodgeMod) out.push({ label: 'Neige épaisse', value: dodgeMod, famille: 'circonstance' });
  if (mode === 'parade') {
    const pp = parryPenalty(defender, weapon);
    if (pp) out.push({ label: 'Main secondaire', value: pp, famille: 'circonstance', ref: RULE_REF['main-secondaire'] });
    // Amputation (LDB 18) : la parade est un Test d'ARME → même pénalité contextuelle que l'attaque (ssi l'arme de parade implique la main blessée).
    const amp = weapon ? amputationCombatPenalty(defender, weapon) : 0;
    if (amp) out.push({ label: 'Amputation', value: amp, famille: 'jet', ref: RULE_REF.amputation });
  }
  // Substitution sociale (Intimidation/Dressage) : ni arme ni esquive → pas de main secondaire, de
  // neige, ni de malus « maniement deux armes » ; seuls Avantage/État/Sur la défensive s'appliquent.
  if (mode !== 'social' && defender.dualStrikeDefensePenalty) out.push({ label: 'Maniement deux armes', value: -10, famille: 'jet', ref: RULE_REF['combat-deux-armes'] }); // LDB 10 l.767-773
  // Météo « Tests physiques » (EDOC 8 l.82, #341) : le CANAL UNIQUE `weatherTestMods` lit `defender.envWeather`
  // (posé à l'ouverture du combat), scopé par la carac RÉELLE du mode (Parade = CC, Esquive = Agilité) — jamais
  // recâblé par surface (la garde d'import interdit tout autre lecteur de `weatherPhysicalTestMod`).
  out.push(...weatherTestMods(defender.envWeather, defenseTestChar(mode)));
  return out;
}

/** Caractéristique RÉELLE d'un mode de défense (Parade = Test de CC, Esquive = Agilité) — pour le canal météo
 *  « Tests physiques » (EDOC 8 l.82). La substitution sociale n'est PAS un Test physique → `null` (aucune). */
function defenseTestChar(mode: DefenseMode): CharKey | null {
  return mode === 'parade' ? 'capacite-de-combat' : mode === 'esquive' ? 'agilite' : null;
}

/** Modificateurs de BASE d'un Test de combat « brut » (hors Atouts d'arme et bonus de cible), en lignes
 *  NOMMÉES : Avantage ×10 + pénalité d'États + météo « Tests physiques » (canal `weatherTestMods`, #341).
 *  MÊME nomenclature que `attackModifiers`/`defenseModifiers` — une modale de Test opposé « brut »
 *  (Empoignade, Au Contact, Désengagement) affiche ainsi ses modificateurs au lieu d'un +N anonyme.
 *  `ck` = la Caractéristique RÉELLE du Test brut (Empoignade → Force, Désengagement/coup dans le dos →
 *  CC) : la météo n'arrive que si elle est physique (LISTE maison `physicalTestChars`). */
/** LA ligne d'AVANTAGE d'un porteur (`LDB 14 l.215` : +10 par point à un Test approprié), ou `null`
 *  sans Avantage — SOURCE UNIQUE de sa mise en ligne, partagée par les Tests de combat « bruts »
 *  (`baseTestModLines`, ci-dessous) et par tout Test HORS arène que la règle dit « approprié »
 *  (Middenball NADJ 16 l.119 : « en utilisant les règles habituelles relatives à l'Avantage »).
 *  Réutiliser ; ne jamais réécrire `c.advantage * 10`. */
export function advantageModLine(c: Combatant): ModLine | null {
  const adv = (c.advantage ?? 0) * 10;
  // Avantage HORS table de Difficulté (comme `attackModifiers`/`defenseModifiers`) → `famille: 'jet'`.
  return adv ? { label: 'Avantage', value: adv, famille: 'jet', ref: RULE_REF.avantage } : null;
}

export function baseTestModLines(c: Combatant, ck?: CharKey): ModLine[] {
  const out: ModLine[] = [];
  const adv = advantageModLine(c);
  if (adv) out.push(adv);
  out.push(...conditionModLines(c));
  out.push(...weatherTestMods(c.envWeather, ck ?? null));
  return out;
}

/** Somme des modificateurs de base d'un Test de combat « brut » — la VALEUR que roule le résolveur.
 *  SOURCE UNIQUE partagée avec `baseTestModLines` (l'affichage et le jet ne peuvent pas diverger).
 *  Réutiliser ; ne pas réécrire `c.advantage * 10 + …`. */
export function baseTestMods(c: Combatant, ck?: CharKey): number {
  return baseTestModLines(c, ck).reduce((s, l) => s + l.value, 0);
}

export interface AttackOptions {
  defense?: DefenseMode | 'none';
  /** Localisation visée (Difficile −20 au Test, LDB 14 l.73 ; sinon localisation = jet inversé). */
  location?: HitLocation;
  /** Modificateurs dérivés de la scène (couvert/obscurité/météo/mouvement/tir-mêlée), injectés par combatFlow. */
  env?: ModLine[];
  /** Pénalité météo à l'esquive (neige épaisse −30, LDB 14 l.82), injectée par combatFlow. */
  dodgeMod?: number;
  /** Combat monté — CHARGE (LDB 14 l.183) : pour le calcul des DÉGÂTS seulement, on substitue la Force
   *  (Bonus `sb`) et la Taille de la MONTURE à celles du cavalier (le toucher reste la CC du cavalier). */
  dmgProxy?: { sb: number; size: Combatant['size'] };
  /** « Retenir ses coups » (Aux Armes 07 l.59-61) : maîtriser sans tuer — déclaré AVANT le jet. N'agit
   *  qu'en MÊLÉE (jamais tir/sort) et pas avec une arme infligeant *En flammes*. Retire Empaleuse/
   *  Percutante/Perforante + l'Atout Taille du coup, et supprime le Critique SAUF si la cible tombe à 0. */
  withhold?: boolean;
  /** L'attaque frappe par le FLANC ou le DERRIÈRE de la cible (facing établi par combatFlow) : active le
   *  bonus SUPPLÉMENTAIRE d'Assourdi (+10, LDB 16 l.29) dans `meleeAttackerBonus`. Absent = de face. */
  flankRear?: boolean;
}

// `woundsFromHit` (Blessures d'un coup d'arme) vit dans le module FEUILLE `woundsCalc.ts`
// (réutilisable sans cycle par `ops.ts` — `op:'wounds'` en mode coup d'arme y délègue). Importé en tête +
// ré-exporté ici pour les importeurs historiques de `combat` (volley/combatFlow/combatArea…). INCHANGÉ.
export { woundsFromHit };

/** Atout Pistolet (LDB « Les armes » l.297-298 : « Vous pouvez utiliser cette arme pour attaquer
 *  en Combat rapproché »). Seule une arme à distance possédant cet Atout peut tirer en étant
 *  Engagé / au contact ; les autres armes à distance (arc, arbalète…) ne le peuvent pas. */
export function canFireWhileEngaged(weapon: Weapon): boolean {
  return qCanFireWhileEngaged(weapon);
}

/** Choisit l'arme adaptée à la distance de la cible : au CONTACT (Combat rapproché) on privilégie
 *  une arme de mêlée — une arme à distance n'y tire qu'avec l'Atout Pistolet (l.297-298) ; à
 *  DISTANCE on privilégie une arme à distance. Dernier recours : la première arme. `undefined` si
 *  `weapons` est vide (structure/décor sans arme, ex. une porte survolée en combat — #203/régression
 *  écran noir) : à l'appelant de décider (aucune arme à afficher/tirer n'est un cas légitime).*/
export function attackWeapon(weapons: Weapon[], targetAdjacent: boolean): Weapon | undefined {
  if (targetAdjacent) {
    return weapons.find((w) => w.type === 'melee') ?? weapons.find(canFireWhileEngaged) ?? weapons[0];
  }
  return weapons.find((w) => w.type === 'ranged') ?? weapons[0];
}

/** `attackWeapon` pour un ATTAQUANT en train d'agir (attaque/tir choisi ou évalué) : un tel combattant
 *  a TOUJOURS au moins une arme — mains nues en dernier recours pour un héros (`recomputeLoadout`,
 *  `items.ts` l.512) ou une arme générique pour une créature (`weaponsFromTraits`, `items.ts` l.114-118).
 *  Échoue fort (jamais un cast de complaisance) si l'invariant est violé — ce combattant ne devrait
 *  jamais atteindre ce point sans arme. */
export function assertAttackWeapon(weapons: Weapon[], targetAdjacent: boolean): Weapon {
  const w = attackWeapon(weapons, targetAdjacent);
  if (!w) throw new Error('assertAttackWeapon : combattant sans arme (invariant mains-nues/arme générique violé)');
  return w;
}

/** Jet de l'ATTAQUANT seul (Précise +10, viser -10, Avantage×10, États) — n'inclut
 *  PAS le jet de défense : sert au flux par modale (jet figé, appelé UNE fois). */
export function rollMeleeAttacker(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  location?: HitLocation,
  env: ModLine[] = [],
  flankRear?: boolean,
): TestResult {
  const atkVal = combatValue(attacker, 'melee', weapon);
  const t = rollTest(atkVal, 'intermediaire', rng, combineMods(attackModifiers(attacker, defender, weapon, { kind: 'melee', location, env, flankRear })));
  return { ...t, base: combatBaseValue(attacker, 'melee', weapon) }; // LDB 12 l.160
}

/** Jet du DÉFENSEUR seul (Parade = Corps à corps, Esquive = Agilité + avances ;
 *  « Sur la défensive » +20). C'est le SEUL jet relancé par un point de Chance. */
export function rollMeleeDefender(
  defender: Combatant,
  mode: DefenseMode,
  rng: RNG = defaultRNG,
  dodgeMod = 0, // neige épaisse : −30 à l'esquive (LDB 14 l.82) ; n'affecte pas la parade
  parryWeapon: Weapon | undefined = defender.weapons[0], // arme de parade choisie (spé + pénalité main 2nde)
  vsWeapon?: Weapon, // arme de l'ATTAQUANT (Rapide : −10 à la parade d'une arme non-Rapide, LDB 62 l.298-302)
  sub?: DefenseSub, // substitution sociale (mode 'social') : base = Test de la Compétence substituée
): TestResult {
  const defVal = defenseValue(defender, mode, parryWeapon, sub?.base);
  const t = rollTest(defVal, 'intermediaire', rng, combineMods(defenseTargetMods(defender, mode, dodgeMod, parryWeapon, vsWeapon)));
  return { ...t, base: defenseBaseValue(defender, mode, parryWeapon, sub?.base) }; // LDB 12 l.160
}

/** Jet de Corps à corps « brut » d'un combattant pour le Test opposé de Désengagement
 *  (LDB 15 l.49 « Esquive/Corps à corps »). Inclut l'Avantage×10 et les pénalités
 *  d'États, mais PAS les Atouts d'arme ni les bonus de cible (ce n'est pas une attaque portée). */
export function rollDisengageAttack(foe: Combatant, rng: RNG = defaultRNG): TestResult {
  const t = rollTest(combatValue(foe, 'melee', foe.weapons[0]), 'intermediaire', rng, baseTestMods(foe, 'capacite-de-combat'));
  return { ...t, base: combatBaseValue(foe, 'melee', foe.weapons[0]) }; // LDB 12 l.160
}

/** Jet de FORCE « brut » pour le Test opposé d'Empoignade (LDB 14 l.161 : « un Test opposé de Force »).
 *  Valeur = caractéristique de Force + Avantage×10 + pénalités d'États (`baseTestMods`), sans Atout
 *  d'arme (c'est une lutte au corps à corps, pas une frappe portée). Partagé flux joueur + IA. */
export function rollGrappleForce(c: Combatant, rng: RNG = defaultRNG): TestResult {
  const force = effectiveChar(c, 'force'); // valeur NUE : `baseTestMods` voyage dans le modificateur (LDB 12 l.160)
  return { ...rollTest(force, 'intermediaire', rng, baseTestMods(c, 'force')), base: force };
}

/** Arme du coup dans le dos d'une Fuite : c'est un **Test de Corps à corps** (LDB 15 l.63) → l'arme de
 *  MÊLÉE du frappeur, et les mains nues à défaut (arc en main : on frappe, on ne tire pas — `attackWeapon`
 *  ne convient pas, son dernier repli rend `weapons[0]`, fût-il une arme à distance). SOURCE UNIQUE : la
 *  spec du flux et l'application du résultat doivent voir la MÊME arme que le résolveur. */
export function backstabWeapon(foe: Combatant): Weapon {
  return foe.weapons.find((w) => w.type === 'melee') ?? unarmedWeapon();
}

/** Attaque gratuite « dans le dos » lors d'une Fuite (LDB 15 l.63,66) : Test de Corps
 *  à corps NON opposé, +20 au toucher (dos tourné), DR = Dégâts comme d'habitude. */
export function resolveBackstabAttack(foe: Combatant, target: Combatant, rng: RNG = defaultRNG): AttackResult {
  const weapon = backstabWeapon(foe);
  // Les lignes qui composent la cible, NOMMÉES : celles du Test de combat brut (`baseTestModLines`,
  // source unique du jet) + le +20 du dos tourné. Sans cette ligne, le +20 s'imputait à la première
  // circonstance venue. Classement `circonstance` : l'entrée `LDB 14 l.62` (cf. `LDB 13 l.171` et
  // `LDB 15 l.68` ; rappel `LDB 15 l.66`).
  const mods: ModLine[] = [
    ...baseTestModLines(foe, 'capacite-de-combat'),
    { label: 'Dos tourné (adversaire en fuite)', value: 20, famille: 'circonstance', ref: RULE_REF['attaque-de-flanc-ou-de-dos'] },
  ];
  const atk = rollTest(combatValue(foe, 'melee', weapon), 'intermediaire', rng, mods.reduce((s, m) => s + m.value, 0));
  return resolveMeleePassive(foe, target, weapon, atk, undefined, [], undefined, false, composeAttack(mods));
}

/** Combine un jet d'attaque et un jet de défense DÉJÀ obtenus en AttackResult
 *  (Test opposé). drAdjust : Défensive (déf.) +1 DR / À Enroulement (att.) -1 DR,
 *  en Parade uniquement. */
export function finishMelee(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  def: TestResult,
  defenseMode: DefenseMode,
  location?: HitLocation,
  env: ModLine[] = [],
  dodgeMod = 0,
  dmgProxy?: AttackOptions['dmgProxy'], // Charge montée : Force+Taille de la monture pour les dégâts (LDB 14 l.183)
  parryWeapon: Weapon | undefined = defender.weapons[0], // arme de parade choisie (spé + Atouts + pénalité main 2nde)
  withhold = false, // « Retenir ses coups » (Aux Armes 07 l.59-61)
  sub?: DefenseSub, // substitution sociale (mode 'social') : base + libellé de la Compétence substituée
  compo?: DifficultyComposition, // Difficulté FIGÉE par la résolution d'origine (#1153 L4) ; absente = composée ici
): AttackResult {
  const atkBd = bd(attackTestLabel(weapon, 'melee'), combatValue(attacker, 'melee', weapon), atk, compo ?? composeAttack(attackModifiers(attacker, defender, weapon, { kind: 'melee', location, env })));
  return combineOpposed(attacker, defender, weapon, atk, def, defenseMode, atkBd, { location, dmgProxy, parryWeapon, dodgeMod, withhold, sub });
}

/**
 * Cœur PARTAGÉ du Test OPPOSÉ — à partir des jets d'attaque/défense DÉJÀ obtenus + du breakdown
 * d'attaque `atkBd` (libellé « Corps à corps » vs « Projectiles », construit par l'appelant avec SES
 * mods : la mêlée via `finishMelee`, le tir DÉFENDU via `resolveRanged` — défense RAW Protectrice 2+/
 * Bout Portant/tireur Engagé). drAdjust : Défensive (déf.) +1 DR (l.273), À Enroulement (att.) -1 DR
 * (l.259), pénalité de Taille en Parade (LDB 85 l.370) ; Protectrice (LDB 62 l.296) → Indice PA
 * partout en Parade. Imprécise/Pratique/Peu Fiable/Lente modulent le DR du Test (LDB 62/60).
 */
function combineOpposed(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  def: TestResult,
  defenseMode: DefenseMode,
  atkBd: ReturnType<typeof bd>,
  opts: { location?: HitLocation; dmgProxy?: AttackOptions['dmgProxy']; parryWeapon?: Weapon; dodgeMod?: number; withhold?: boolean; sub?: DefenseSub } = {},
): AttackResult {
  const { location, dmgProxy } = opts;
  const parryWeapon = opts.parryWeapon ?? defender.weapons[0];
  const dodgeMod = opts.dodgeMod ?? 0;
  const noSize = !!attacker.swarm || !!defender.swarm; // Nuée : ignore toutes les règles de Taille (LDB 85 l.253)
  const parrySizePenalty = defenseMode === 'parade' && !noSize ? 2 * Math.max(0, sizeGap(attacker.size, defender.size)) : 0;
  // +DR d'effet actif/trait sur un Test d'ATTAQUE RÉUSSI (chanson « Jacques Bret » : +1 DR Corps à corps,
  // MDG 09 l.228) — même règle d'application que le +DR de Talent (LDB 10 l.19 : « utilisation RÉUSSIE »).
  const atkSL = atk.sl + craftTestDRAdjust(weapon, atk.success) + attackDRAdjust(weapon, atk.success) + psychDRAdjust(attacker, defender)
    + (atk.success ? skillDRBonus(attacker, weapon.type === 'ranged' ? 'projectiles' : 'corps-a-corps') : 0)
    + offTerrainTestDR(attacker); // hors de son terrain (Créature marine, MDG 16 l.17) : −DR à TOUS ses Tests
  const defSL = def.sl - parrySizePenalty + vsDefenseDRAdjust(weapon)
    + (defenseMode === 'parade' ? parryDRAdjust(parryWeapon, weapon) + craftTestDRAdjust(parryWeapon, def.success) : 0)
    + offTerrainTestDR(defender);
  const opp = resolveOpposed({ ...atk, sl: atkSL }, { ...def, sl: defSL });
  const defLabel = defenseMode === 'social' ? (opts.sub?.label ?? DEFENSE_LABEL.parade) : DEFENSE_LABEL[defenseMode];
  // Difficulté de la DÉFENSE : mêmes modificateurs que le jet réellement roulé (`defenseTargetMods`,
  // Rapide compris) — sans lui, la ligne résolue annoncerait une Difficulté que la cible contredit.
  const defBd = bd(defLabel, defenseValue(defender, defenseMode, parryWeapon, opts.sub?.base), def, composeAttack(defenseTargetMods(defender, defenseMode, dodgeMod, parryWeapon, weapon)), defenseMode);
  const usedParry = defenseMode === 'parade' ? parryWeapon : undefined; // arme de parade (Critiques opposés / Piège-lame)
  // Z5c — la RAISON du départage (LDB 12 l.160) va sur la LIGNE du camp qu'elle explique : le
  // résolveur la dit une fois, l'affichage n'a plus rien à déduire ni à recomparer.
  // CONDITION d'annotation : les DR que les lignes AFFICHENT (`atk.sl`/`def.sl`, ceux que `bd` pose)
  // doivent être égaux EUX AUSSI. Les ajustements de DR (Taille en Parade, Défensive, Peur/Haine…)
  // entrent dans le verdict sans paraître sur les lignes : quand ils créent ou effacent l'égalité,
  // la phrase citerait des DR que l'écran ne montre pas. Ces cas restent MUETS (périmètre #1152).
  const [atkWhy, defWhy] = atk.sl === def.sl ? opposedReasons(opp) : [undefined, undefined];
  const atkLine = atkWhy ? { ...atkBd, decided: atkWhy } : atkBd;
  const defLine = defWhy ? { ...defBd, decided: defWhy } : defBd;
  if (opp.winner === 'defender') {
    return {
      hit: false,
      attackerRoll: atk.roll,
      defenderRoll: def.roll,
      netSL: opp.netSL,
      critical: false,
      advantageTo: 'defender',
      defenderDefeated: false,
      attackerDetail: atkLine,
      defenderDetail: defLine,
      parryWeapon: usedParry,
      log: `${attacker.label} rate son attaque ; ${defender.label} gagne +1 Avantage.`,
    };
  }
  if (opp.winner === 'tie') {
    // Statu quo (LDB 12 l.160) : personne ne l'emporte.
    return {
      hit: false,
      attackerRoll: atk.roll,
      defenderRoll: def.roll,
      netSL: 0,
      critical: false,
      advantageTo: null,
      defenderDefeated: false,
      attackerDetail: atkLine,
      defenderDetail: defLine,
      parryWeapon: usedParry,
      log: `Échange neutre : ni ${attacker.label} ni ${defender.label} ne prend l'avantage.`,
    };
  }
  const critical = atk.isDouble && atk.success;
  // Protectrice (LDB 62 l.296) : opposer l'attaque avec l'arme → Indice PA à toutes les localisations.
  const res = applyHit(attacker, defender, weapon, atkLine, opp.netSL, critical, location, dmgProxy, defenseMode === 'parade' ? protectriceAP(parryWeapon) : 0, opts.withhold);
  res.defenderRoll = def.roll;
  res.defenderDetail = defLine;
  res.parryWeapon = usedParry;
  if (res.hit && (attacker.swarm || sizeGap(dmgProxy?.size ?? attacker.size, defender.size) >= 1)) res.cleave = true; // Frappe Mortelle — plus grand OU Nuée (LDB 85 l.362/253) ; charge montée → Taille de la monture
  return res;
}

/**
 * Cible Inconscient (LDB 16 l.113) : l'attaquant bénéficie de « Je ne faillirai pas ! »
 * (LDB 17 l.68) sans dépenser de Résilience — il *choisit* le résultat, donc on prend le
 * meilleur : une réussite **critique** (double choisi). À distance, les Dégâts sont ceux
 * d'un tir **à bout portant** (+6 DR ≈ le +60 au toucher de la bande de portée). Le jet
 * brut n'est qu'un TOUCHÉ provisoire : la Localisation du Critique (garanti) est choisissable
 * par l'attaquant qui pilote (LDB 17 l.68, `pa.forced` → CritLocationPicker, cf. targetingModes.ts).
 */
function helplessTest(atk: TestResult, kind: 'melee' | 'ranged'): TestResult {
  const dr = Math.max(atk.sl, 0) + (kind === 'ranged' ? 6 : 0);
  return { ...atk, success: true, isDouble: true, sl: dr };
}

/** Issue d'une attaque de mêlée SANS défense — cas IMPOSÉS par le RAW (Surpris/Inconscient/Fuir dos
 *  tourné/objet inanimé ; jamais un choix volontaire) — à partir d'un jet d'attaque déjà obtenu :
 *  un simple succès suffit à toucher. */
export function resolveMeleePassive(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  location?: HitLocation,
  env: ModLine[] = [],
  dmgProxy?: AttackOptions['dmgProxy'], // Charge montée : Force+Taille de la monture pour les dégâts (LDB 14 l.183)
  withhold = false, // « Retenir ses coups » (Aux Armes 07 l.59-61)
  compo?: DifficultyComposition, // Difficulté FIGÉE par l'orchestrateur (#1153 L4) ; absente = composée ici
): AttackResult {
  const atkBd = bd(attackTestLabel(weapon, 'melee'), combatValue(attacker, 'melee', weapon), atk, compo ?? composeAttack(attackModifiers(attacker, defender, weapon, { kind: 'melee', location, env })));
  if (!atk.success) return miss(attacker, defender, atkBd, 'defender');
  const res = applyHit(attacker, defender, weapon, atkBd, atk.sl + attackDRAdjust(weapon, atk.success) + psychDRAdjust(attacker, defender) + skillDRBonus(attacker, 'corps-a-corps') + offTerrainTestDR(attacker), atk.isDouble && atk.success, location, dmgProxy, 0, withhold); // Imprécise : −1 DR à l'attaque (LDB 62 l.323) ; Pointue (LDB 62 l.288) ; Peur/Haine ±1 DR (LDB 21) ; +DR d'effet actif sur un Test réussi (Jacques Bret) ; hors de son terrain −DR (Créature marine, MDG 16 l.17)
  if (res.hit && (attacker.swarm || sizeGap(dmgProxy?.size ?? attacker.size, defender.size) >= 1)) res.cleave = true; // Frappe Mortelle — plus grand OU Nuée (LDB 85 l.362/253) ; charge montée → Taille de la monture
  return res;
}

/** Cible sans défense possible face à une attaque (LDB 16 l.113). */
export const isHelplessTarget = (c: Combatant): boolean => hasCondition(c, 'inconscient');

/** Résout une attaque de mêlée (Test opposé de Corps à corps). Orchestrateur :
 *  jet d'attaque PUIS jet de défense (ordre RNG inchangé) ; voie instantanée. */
export function resolveMelee(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  opts: AttackOptions = {},
): AttackResult {
  // Un OBJET INANIMÉ (structure de siège / véhicule-coque / affût inerte) n'a ni CC/Ag, ni Parade, ni Esquive → jamais de défense.
  const defenseMode = (cannotDefend(defender) || isInanimate(defender)) ? 'none' : opts.defense ?? 'parade';
  let atk = rollMeleeAttacker(attacker, defender, weapon, rng, opts.location, opts.env, opts.flankRear);
  // Cible Inconsciente (LDB 16 l.113) : auto-réussite + Critique (RAW). Règle optionnelle « mort-auto » :
  // en CORPS À CORPS la cible est tuée automatiquement → on marque `autoKill` (le store finalise la mort
  // par le chemin normal, Destin possible). Le tir n'est PAS concerné (cf. resolveRanged).
  const helpless = isHelplessTarget(defender);
  if (helpless) atk = helplessTest(atk, 'melee');
  const autoKill = helpless && rule('combat-helpless-mode') === 'mort-auto';
  let res: AttackResult;
  // Difficulté COMPOSÉE ICI, une fois, avec les mods COMPLETS (flanc/dos compris — `rollMeleeAttacker`
  // les a déjà pesés sur la cible) : les deux branches la reçoivent FIGÉE, aucune ne la recompose
  // d'un contexte plus pauvre (#1153 L4).
  const compo = composeAttack(attackModifiers(attacker, defender, weapon, { kind: 'melee', location: opts.location, env: opts.env, flankRear: opts.flankRear }));
  if (defenseMode === 'none') {
    res = resolveMeleePassive(attacker, defender, weapon, atk, opts.location, opts.env, opts.dmgProxy, opts.withhold, compo);
  } else {
    const def = rollMeleeDefender(defender, defenseMode, rng, opts.dodgeMod, defender.weapons[0], weapon);
    res = finishMelee(attacker, defender, weapon, atk, def, defenseMode, opts.location, opts.env, opts.dodgeMod, opts.dmgProxy, defender.weapons[0], opts.withhold, undefined, compo);
  }
  if (autoKill && res.hit) res.autoKill = true;
  return res;
}

/**
 * Bandes de portée d'un tir (table des Difficultés de Combat, LDB 14 l.50-86) :
 * Bout portant (≤ Portée÷10) +40, Courte (≤ Portée÷2) +20, Moyenne (≤ Portée) +0, Longue (≤ Portée×2)
 * −10, Extrême (≤ Portée×3) −30 ; au-delà = hors de portée. Échelle 1 case = `metresPerTile` (défaut 2 m,
 * LDB 15 l.12 ; une Scène MER en déclare une autre, cf. `sceneMetresPerTile`).
 * SOURCE UNIQUE des seuils : le modificateur ET le nom y lisent. `rangeMeters` = Portée de l'arme en m.
 */
const RANGE_BANDS: { id: RangeBandId; maxFactor: number; mod: number; label: string }[] = [
  { id: 'bout-portant', maxFactor: 1 / 10, mod: 40, label: 'Bout portant' },
  { id: 'courte', maxFactor: 1 / 2, mod: 20, label: 'Courte portée' },
  { id: 'moyenne', maxFactor: 1, mod: 0, label: 'Moyenne' },
  { id: 'longue', maxFactor: 2, mod: -10, label: 'Longue' },
  { id: 'extreme', maxFactor: 3, mod: -30, label: 'Extrême' },
];

/** Ordre STABLE des bandes (du plus proche au plus loin) — SOURCE UNIQUE pour comparer une bande courante
 *  à la PORTÉE MINIMALE d'une arme (`belowMinRangeBand`). */
const RANGE_BAND_ORDER: RangeBandId[] = RANGE_BANDS.map((b) => b.id);

/** Bande de portée applicable, ou null si hors de portée (au-delà de Portée×3). `metresPerTile` = échelle
 *  de la Scène (défaut 2 m/case, PUR — jamais lu depuis `state`, fourni par l'appelant). */
function rangeBandAt(distanceTiles: number, rangeMeters: number, metresPerTile = 2): { id: RangeBandId; mod: number; label: string } | null {
  const m = distanceTiles * metresPerTile;
  return RANGE_BANDS.find((b) => m <= rangeMeters * b.maxFactor) ?? null;
}

/** Modificateur de portée d'un tir (LDB 14 l.50-86) ; null si hors de portée. */
export function rangeBandModifier(distanceTiles: number, rangeMeters: number, metresPerTile = 2): number | null {
  return rangeBandAt(distanceTiles, rangeMeters, metresPerTile)?.mod ?? null;
}

/** Nom de la bande de portée — pour l'affichage. */
export function rangeBandName(distanceTiles: number, rangeMeters: number, metresPerTile = 2): string | null {
  return rangeBandAt(distanceTiles, rangeMeters, metresPerTile)?.label ?? null;
}

/** id STABLE de la bande de portée courante (≠ libellé) ; null si hors de portée. */
export function rangeBandId(distanceTiles: number, rangeMeters: number, metresPerTile = 2): RangeBandId | null {
  return rangeBandAt(distanceTiles, rangeMeters, metresPerTile)?.id ?? null;
}

/** Le tir est-il REFUSÉ car la cible est plus PROCHE que la bande minimale autorisée de l'arme (machines de
 *  siège ADE II 8 l.251/253 : « à Bout Portant » / « distance inférieure à leur Portée Courte ») ? C'est
 *  un REFUS, pas un malus. `false` si l'arme n'a pas de minimale, ou si la cible est HORS de portée (autre
 *  gate) — on ne refuse QUE parce qu'elle est trop proche. */
export function belowMinRangeBand(distanceTiles: number, rangeMeters: number, minBand: RangeBandId, metresPerTile = 2): boolean {
  const cur = rangeBandId(distanceTiles, rangeMeters, metresPerTile);
  if (cur == null) return false; // hors de portée : géré ailleurs, pas « trop proche »
  return RANGE_BAND_ORDER.indexOf(cur) < RANGE_BAND_ORDER.indexOf(minBand);
}

/**
 * Modes de défense AUTORISÉS contre une attaque à DISTANCE. Défaut RAW : AUCUN (LDB 13 l.135, le tir
 * est un Test de Projectiles non opposé). Trois exceptions, indépendantes (le défenseur choisit parmi
 * les modes obtenus) :
 *  - Parade : bouclier/arme **Protectrice 2+**, projectile en Ligne de Vue (LDB 62 l.296) ;
 *  - Parade : tireur **Engagé** avec sa cible (tir au contact) → « n'importe quelle Corps à corps » (LDB 14 l.44) ;
 *  - Esquive : tir à **Bout Portant** (LDB 14 l.40).
 * `[]` = tir non défendable → résolution non opposée habituelle.
 */
export function rangedDefenseModes(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  distanceTiles: number | undefined,
  los: boolean,
  metresPerTile = 2,
): ('parade' | 'esquive')[] {
  if (cannotDefend(defender)) return []; // Surpris / À Terre… : pas de réaction (LDB 16)
  const modes = new Set<'parade' | 'esquive'>();
  if (isEngagedWith(attacker, defender.id)) modes.add('parade'); // tireur Engagé (l.70) : toute Corps à corps
  else if (los && rangedOpposeWeapon(defender.weapons)) modes.add('parade'); // bouclier Protectrice 2+ en Ligne de Vue (l.307)
  const rangeM = effectiveWeaponRange(weapon, loadedAmmo(attacker, weapon)?.ammoRangeMod, () => bonus(effectiveChar(attacker, 'force')));
  if (distanceTiles != null && rangeM != null && rangeBandId(distanceTiles, rangeM, metresPerTile) === 'bout-portant')
    modes.add('esquive'); // Bout Portant (l.62)
  return [...modes];
}

/** Meilleure défense AUTO contre un tir (cible NON-héros, ou résolution synchrone) : parmi les modes
 *  RAW autorisés (`rangedDefenseModes`), celui de plus haute valeur effective. `undefined` = aucune
 *  défense → tir non opposé. La Parade utilise l'arme Protectrice 2+ si présente, sinon la main. */
export function bestRangedDefense(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  distanceTiles: number | undefined,
  los = true,
  metresPerTile = 2,
): { mode: 'parade' | 'esquive'; parryWeapon?: Weapon } | undefined {
  const modes = rangedDefenseModes(attacker, defender, weapon, distanceTiles, los, metresPerTile);
  if (!modes.length) return undefined;
  const parryWeapon = rangedOpposeWeapon(defender.weapons) ?? defender.weapons[0];
  const valOf = (m: 'parade' | 'esquive') => defenseValue(defender, m, m === 'parade' ? parryWeapon : undefined);
  const best = maxBy(modes, valOf)!.item; // `modes` non vide (garde ci-dessus) ; first-max = mode le plus défensif.
  return { mode: best, parryWeapon: best === 'parade' ? parryWeapon : undefined };
}

/** Résout une attaque à distance (Test de Projectiles, non opposé). */
export function resolveRanged(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  distanceTiles?: number,
  location?: HitLocation,
  env: ModLine[] = [],
  defense?: { mode: 'parade' | 'esquive'; parryWeapon?: Weapon; dodgeMod?: number },
  metresPerTile = 2,
): AttackResult {
  const atkVal = combatValue(attacker, 'ranged', weapon);
  const rangeM = effectiveWeaponRange(weapon, loadedAmmo(attacker, weapon)?.ammoRangeMod, () => bonus(effectiveChar(attacker, 'force')));
  if (distanceTiles != null && rangeM != null && rangeBandModifier(distanceTiles, rangeM, metresPerTile) == null)
    return { hit: false, attackerRoll: 0, netSL: 0, critical: false, advantageTo: null, defenderDefeated: false, log: `${attacker.label} : cible hors de portée.` };
  const mods = attackModifiers(attacker, defender, weapon, { kind: 'ranged', location, distanceTiles, env, metresPerTile });
  let atk: TestResult = { ...rollTest(atkVal, 'intermediaire', rng, combineMods(mods)), base: combatBaseValue(attacker, 'ranged', weapon) }; // LDB 12 l.160
  if (isHelplessTarget(defender)) atk = helplessTest(atk, 'ranged'); // auto-succès, Dégâts à bout portant (LDB 16 l.113)
  const atkBd = bd(attackTestLabel(weapon, 'ranged'), atkVal, atk, composeAttack(mods));
  // Tir DÉFENDU (RAW : Protectrice 2+ LDB 62 l.296 / Bout Portant 14 l.62 / tireur Engagé 14 l.70) →
  // Test OPPOSÉ, cœur partagé avec la mêlée (`combineOpposed`). L'Inconscient ne se défend pas.
  if (defense && !isHelplessTarget(defender)) {
    const def = rollMeleeDefender(defender, defense.mode, rng, defense.dodgeMod ?? 0, defense.parryWeapon ?? defender.weapons[0], weapon);
    return combineOpposed(attacker, defender, weapon, atk, def, defense.mode, atkBd, { location, parryWeapon: defense.parryWeapon, dodgeMod: defense.dodgeMod });
  }
  if (!atk.success) {
    return {
      hit: false,
      attackerRoll: atk.roll,
      attackerDetail: atkBd,
      netSL: atk.sl,
      critical: false,
      advantageTo: null, // pas d'Avantage au défenseur en combat à distance
      defenderDefeated: false,
      log: `${attacker.label} manque sa cible.`,
    };
  }
  return applyHit(attacker, defender, weapon, atkBd, atk.sl + attackDRAdjust(weapon, atk.success) + psychDRAdjust(attacker, defender) + skillDRBonus(attacker, 'projectiles') + offTerrainTestDR(attacker), atk.isDouble && atk.success, location); // Imprécise : −1 DR (LDB 62 l.323) ; Pointue (LDB 62 l.288) ; Peur/Haine ±1 DR (LDB 21) ; +DR d'effet actif sur un tir réussi ; hors de son terrain −DR (MDG 16 l.17)
}

/** Jet d'attaque FIGÉ d'un TIR (Test de Projectiles, mods de portée/Taille/État inclus) — mirror de
 *  `rollMeleeAttacker` pour la défense réactive : l'IA fige son tir, le héros oppose ensuite sa défense. */
export function rollRangedAttacker(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  distanceTiles?: number,
  location?: HitLocation,
  env: ModLine[] = [],
  metresPerTile = 2,
): TestResult {
  const mods = attackModifiers(attacker, defender, weapon, { kind: 'ranged', location, distanceTiles, env, metresPerTile });
  const t = rollTest(combatValue(attacker, 'ranged', weapon), 'intermediaire', rng, combineMods(mods));
  return { ...t, base: combatBaseValue(attacker, 'ranged', weapon) }; // LDB 12 l.160
}

/** Test OPPOSÉ d'un TIR DÉFENDU (RAW Protectrice 2+/Bout Portant/tireur Engagé) à partir des jets
 *  d'attaque/défense DÉJÀ obtenus — mirror de `finishMelee` pour le tir : construit le breakdown
 *  « Projectiles » (mods de portée) puis délègue au cœur partagé `combineOpposed`. */
export function finishRanged(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  def: TestResult,
  defenseMode: DefenseMode, // le tir n'ouvre que Parade/Esquive (cf. rangedDefenseModes) — 'social' n'y parvient jamais
  distanceTiles?: number,
  location?: HitLocation,
  env: ModLine[] = [],
  parryWeapon?: Weapon,
  dodgeMod = 0,
  metresPerTile = 2,
  compo?: DifficultyComposition, // Difficulté FIGÉE par le jet d'origine (#1153 L4) ; absente = composée ici
): AttackResult {
  const mods = attackModifiers(attacker, defender, weapon, { kind: 'ranged', location, distanceTiles, env, metresPerTile });
  const atkBd = bd(attackTestLabel(weapon, 'ranged'), combatValue(attacker, 'ranged', weapon), atk, compo ?? composeAttack(mods));
  return combineOpposed(attacker, defender, weapon, atk, def, defenseMode, atkBd, { location, parryWeapon, dodgeMod });
}

/**
 * Touche « accidentelle » de Projectiles sur un allié intercalé (Tir dans la mêlée, LDB
 * `14 - _GoBack.md` l.136) : un tir qui aurait touché sans la pénalité de −20 dévie et frappe un
 * allié de la cible. Reconstruit la touche depuis le jet d'origine `roll` et la valeur cible SANS
 * le −20 (`effTarget`) — sans relancer (la touche était acquise) ; dégâts recalculés sur la victime.
 */
export function resolveStrayRangedHit(
  attacker: Combatant,
  victim: Combatant,
  weapon: Weapon,
  roll: number,
  effTarget: number,
  /** Ligne du tir d'ORIGINE : sa Difficulté est TRANSPORTÉE (c'est le même jet), et ce qui sépare
   *  `effTarget` de la cible d'origine devient une ligne NOMMÉE — sans quoi la touche déviée
   *  afficherait une cible chargée sans rien pour l'expliquer (#1153 L4). */
  origine?: RollBreakdown,
): AttackResult {
  const atk = evaluateTest(roll, effTarget);
  const base = combatValue(attacker, 'ranged', weapon);
  // Sans ligne d'origine il n'y a rien à transporter : l'appelant n'en avait pas (appels directs de
  // pur calcul de Dégâts). Les DEUX chemins de produit la passent — cf. `attackAt` (`combatFlow`).
  const src = frozenDifficulty(origine);
  const porte = (src ? src.circCombined : 0) + (src?.mods ?? []).reduce((s, m) => s + m.value, 0);
  const devie = effTarget - base - porte;
  const compo: DifficultyComposition | undefined = src && {
    ...src,
    mods: devie ? [...src.mods, { label: 'Tir dévié', value: devie, famille: 'jet', ref: RULE_REF['tir-dans-un-combat-au-corps-a-corps'] }] : src.mods,
  };
  const atkBd = bd(`${attackTestLabel(weapon, 'ranged')} (dévié)`, base, atk, compo);
  const res = applyHit(attacker, victim, weapon, atkBd, Math.max(0, atk.sl), atk.isDouble && atk.success);
  res.log = `Le tir dévie dans la mêlée et touche ${victim.label} !`;
  return res;
}

/** Attaque de Piétinement (LDB 85 l.387) : créature plus grande, Dégâts = Bonus de Force (+0),
 *  via Corps à corps (Bagarre). Action gratuite — le coût de 1 Avantage est géré par le store. */
export function resolveTrample(attacker: Combatant, target: Combatant, rng: RNG = defaultRNG): AttackResult {
  const fist: Weapon = { label: 'Piétinement', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
  const mods = attackModifiers(attacker, target, fist, { kind: 'melee' });
  const atk = rollTest(combatValue(attacker, 'melee'), 'intermediaire', rng, combineMods(mods));
  const atkBd = bd('Corps à corps (Piétinement)', combatValue(attacker, 'melee'), atk, composeAttack(mods));
  if (!atk.success) return miss(attacker, target, atkBd, null);
  return applyHit(attacker, target, fist, atkBd, atk.sl, atk.isDouble && atk.success);
}

/** L'arme inflige-t-elle l'État *En flammes* (un onHitEffect posant la Condition `en-flammes`, ex. Épée
 *  ardente de Rhuin) ? Une telle arme NE peut PAS Retenir ses coups (Aux Armes 07 l.61). */
export function weaponInflictsFlames(weapon: Weapon): boolean {
  return (weapon.onHitEffects ?? []).some((e) =>
    spellEffectOps(e.flow).some((o) => o.op === 'condition' && o.id === COND.enFlammes),
  );
}

function applyHit(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atkBd: RollBreakdown,
  dr: number,
  critical: boolean,
  forcedLoc?: HitLocation,
  dmgProxy?: AttackOptions['dmgProxy'],
  extraAP = 0, // PA conférés par l'arme d'opposition du défenseur (Protectrice, LDB 62 l.296)
  withhold = false, // « Retenir ses coups » (Aux Armes 07 l.59-61) — voir applyHit, n'agit qu'en mêlée
): AttackResult {
  // Arme usée à +0 → improvisée (LDB 62 l.135). L'enchantement (Magique/Dégâts/onHit) est DÉJÀ replié
  // dans l'arme active par recomputeLoadout (applyEnchants) — porté par l'objet, plus de merge ici.
  weapon = effectiveWeapon(weapon);
  // Retenir ses coups (Aux Armes 07 l.59-61) : maîtriser sans tuer. N'a d'effet qu'en MÊLÉE, jamais avec
  // une arme infligeant *En flammes* (l.61). On retire du profil POUR CE COUP (sans muter l'objet
  // partagé) les qualités déclarant `capabilities.withheldOnRestraint`, et on force `noSize` (ni Atout de
  // Taille »). Le Critique est ensuite suspendu sauf si la cible tombe à 0 Blessure (calculé plus bas).
  const withholding = withhold && weapon.type === 'melee' && !weaponInflictsFlames(weapon);
  // `resolveQualities` (avec Groupe) énumère propre+FAMILLE avant filtrage — sinon une qualité retirée
  // portée par la FAMILLE (ex. Empaleuse d'Escrime) survivrait au retrait (elle est absente de la liste
  // propre de l'arme, `resolveQualities` la réinjecterait). `noFamilyQualities` bloque cette ré-injection
  // SANS effacer `subType`/`weaponGroup` — `combatValue` doit voir la MÊME Spé (Retenir ses coups ne
  // change pas la compétence maniée).
  if (withholding) {
    const kept = resolveQualities(weapon)
      .filter((r) => !r.caps?.withheldOnRestraint)
      .map((r) => (r.indice != null ? { id: r.id, value: r.indice } : { id: r.id }));
    weapon = { ...weapon, qualities: kept, noFamilyQualities: true };
  }
  // Un OBJET INANIMÉ (structure/véhicule/affût) n'a PAS de Tableau de Localisation → aucune localisation
  // (l'affichage omet alors le membre, et le résolveur de Blessures l'ignore déjà : armure 0 partout).
  const loc = isInanimate(defender) ? undefined : (forcedLoc ?? hitLocationByShape(reverseRoll(atkBd.roll), defender.bodyShape));
  // Éthéré (LDB 85 l.134) : « ne peut être blessée que par les Attaques magiques » — une attaque
  // non magique (créature non Magique/Démoniaque, arme non magique) passe au travers : 0 Blessure.
  if (incomingDamageNullified(defender, attacker, isMagicWeapon(weapon))) {
    return {
      hit: true, attackerRoll: atkBd.roll, attackerDetail: atkBd, netSL: dr, location: loc,
      damage: 0, woundsLost: 0, critical: false, advantageTo: 'attacker', defenderDefeated: false,
      log: `${attacker.label} touche ${defender.label}… mais le coup passe au travers (Éthéré — seules les attaques magiques la blessent).`,
    };
  }
  // Charge montée (LDB 14 l.183) : DÉGÂTS calculés avec la Force (Bonus) et la Taille de la MONTURE.
  let sb = (dmgProxy ? dmgProxy.sb : bonus(effectiveChar(attacker, 'force'))) + damageSBBonus(attacker); // +1 BF en Frénésie via `sbBonus` (psychology.json, LDB 21 l.33)
  // Tueur (LDB 10) : « utilisez le Bonus d'Endurance de votre adversaire comme votre Bonus de Force
  // s'il est plus élevé ; déterminez toujours ce point avant toute autre règle ».
  if (isSlayer(attacker)) sb = Math.max(sb, bonus(effectiveChar(defender, 'endurance')));
  const dmgSize = dmgProxy?.size ?? attacker.size; // Taille servant aux règles de DÉGÂTS (Atouts conférés + ×N)
  // COQUE de navire (MDG 13) : petites armes sans effet sur le vaisseau (l.605) ; corps à corps mitigé
  // par le TABLEAU DE COMPARAISON DES TAILLES (l.618-637), qui « remplace les modificateurs normaux » de
  // Taille (l.616) → `noSize` ; plancher 0 Blessure (un coup trop faible ricoche, comme la bordée).
  const hullAdj = hullHitAdjust(dmgSize, weapon, defender);
  const weaponDmg = effectiveWeaponDamage(weapon, sb); // Dégâts réduits par l'usure de l'arme (LDB 62 l.135)
  const units = atkBd.roll % 10; // dé des unités (LDB 62 l.244/266) ; « 00 » → 0
  // Dévastatrice (max(DR, unités)) / Percutante (+unités), annulés par Inoffensive ; Atouts conférés
  // par la Taille (attaquant plus grand, LDB 85 l.360) fusionnés via `extra` (qualityDamageStep).
  // Une Nuée ignore toutes les règles de Taille (LDB 85 l.253) : ni Atout ni multiplicateur de Taille.
  // Épuisante (LDB 62 l.319) : Percutante/Dévastatrice de l'arme inertes hors Charge (`charged`).
  const noSize = !!attacker.swarm || !!defender.swarm || withholding || !!hullAdj; // Retenir ses coups perd l'Atout Taille (Aux Armes 07 l.61) ; coque : tableau MDG à la place (l.616)
  const { dmgDR, bonus: dmgBonus } = qualityDamageStep(weapon, { effDR: dr, units, charged: !!attacker.chargedThisTurn }, noSize ? [] : sizeGrantedQualities(dmgSize, defender.size));
  let damage = weaponDmg + Math.max(0, dmgDR) + dmgBonus;
  // Talents de Dégâts (LDB 10) : Coup puissant (mêlée), Tir précis (distance), Combat déloyal
  // (Bagarre), Charge berserk/Déterminé (en Charge) — +niveau, avant le multiplicateur de Taille.
  damage += talentDamageBonus(attacker, weapon, !!attacker.chargedThisTurn);
  // LDB 85 l.361 ; ordre vis-à-vis de l'encaisse : séquence LDB 13 l.149-163 (étape 3 Dégâts, étape 4 encaisse).
  if (!noSize) damage *= sizeDamageMultiplier(dmgSize, defender.size);
  // Coque (MDG 13 l.618-637) : le BE ajusté du tableau (« 3 × BE » / « BE−1 ») est appliqué côté
  // Dégâts (mathématiquement identique, sans écraser le clamp de PA) — « 3 × BE » ⇔ −2×BE de plus.
  if (hullAdj && 'extraTB' in hullAdj) damage -= hullAdj.extraTB;
  // Coup Critique : double réussi (déjà dans `critical`) ou Atout Empaleuse sur un multiple de
  // 10 (l.282). L'OVERKILL (Blessures perdues > PB COURANTS, LDB 18 l.17) est désormais
  // géré par le STORE (pipeline de critique), car il dépend des PB courants de la cible — pas des PB max.
  // Empaleuse déjà retirée du profil si l'on Retient ses coups → `empale` est alors false (pas de Critique
  // « multiple de 10 » ni de bypass d'armure Empaleuse).
  const empale = qualityCritTriggered(weapon, atkBd.roll);
  let isCritical = critical || empale;
  // Impénétrable (LDB 63) : « Toutes les Blessures Critiques causées par un nombre impair pour vous
  // toucher sont ignorées » — pièce Impénétrable à la localisation + jet de toucher impair.
  if (isCritical && atkBd.roll % 2 === 1 && loc && impenetrableAt(defender, loc)) isCritical = false;
  // Retenir ses coups (Aux Armes 07 l.59) : le coup est non létal — pour le calcul d'armure, on le traite comme NON
  // critique (les Blessures normales sont infligées comme d'habitude). Le Critique n'est ré-autorisé que si
  // la cible tombe à 0 Blessure (juste après, sur `defeated`).
  const critForArmour = withholding ? false : isCritical;
  // Partielle / Points faibles (LDB 63) : PA des pièces concernées ignorés par CETTE touche.
  const ignoredAP = loc ? ignoredArmourAP(defender, loc, { roll: atkBd.roll, critical: critForArmour, empaleuse: hasQuality(weapon, 'empaleuse') }) : 0;
  // Tir sûr (LDB 10) : ignore niveau PA de la cible au tir.
  const sureShot = weapon.type === 'ranged' ? talentRangedAPIgnore(attacker) : 0;
  // Coque bloquée (MDG 13) : petites armes (l.605) / case « – » du tableau des Tailles (l.614) →
  // AUCUNE Blessure ni Critique de navire ; sinon plancher 0 pour une coque (un coup faible ricoche).
  const hullBlocked = !!hullAdj && 'blocked' in hullAdj;
  if (hullBlocked) isCritical = false;
  const woundsLost = hullBlocked ? 0 : woundsFromHit(weapon, defender, loc, damage, extraAP - ignoredAP - sureShot, hullAdj ? 0 : 1, attacker.size);
  // AA 10 l.98 — terme DIT au journal quand le BE d'une Structure est compté plusieurs fois.
  const beMult = structureEnduranceMult(weapon, defender, attacker.size);
  const beBase = bonus(effectiveChar(defender, 'endurance'));
  const mitLabel = beMult > 1
    ? `BE ${beBase} × ${beMult} (Taille ${SIZE_LABEL[effectiveSize(structureTaille(defender))]} contre ${SIZE_LABEL[effectiveSize(attacker.size)]}) = ${beBase * beMult}, +PA`
    : 'BE+PA';
  const newWounds = defender.wounds.current - woundsLost;
  const defeated = newWounds <= 0;
  // Retenir ses coups (Aux Armes 07 l.59) : « vous N'infligez de Blessure Critique QUE SI votre adversaire tombe à 0
  // Blessure ». Sinon le Critique est supprimé (les Blessures normales restent infligées).
  if (withholding) isCritical = isCritical && defeated;
  return {
    hit: true,
    attackerRoll: atkBd.roll,
    attackerDetail: atkBd,
    netSL: dr,
    location: loc,
    damage,
    woundsLost,
    apExternal: extraAP - sureShot,
    critical: isCritical,
    advantageTo: 'attacker',
    defenderDefeated: defeated,
    log: hullBlocked
      ? `${attacker.label} touche ${defender.label}, sans effet sur la coque (${hullAdj.blocked === 'petites-armes'
          ? 'les tirs de petites armes n’infligent pas assez de Dégâts pour avoir un effet sur un vaisseau'
          : 'trop petit pour entamer cette coque'} — MDG 13).`
      : `${attacker.label} touche ${defender.label}${loc ? ` (${locationLabel(loc, defender.bodyShape)})` : ''} : ` +
        `${damage} dégâts − ${damage - woundsLost} (${mitLabel}) = ${woundsLost} Blessures` +
        (isCritical ? ' — CRITIQUE !' : '') +
        '.',
  };
}

/**
 * Recalcule les Blessures NON-critiques d'un Coup Critique à sa localisation RE-TIRÉE (`LDB 18 l.55` :
 * « Pour calculer enfin les Dégâts non Critiques d'une Attaque, utilisez la nouvelle Localisation
 * déterminée par la Blessure Critique »). Un Coup Critique re-tire la localisation (1d100 frais, ou choix
 * RAW-2) ; les Dégâts non-critiques utilisent CETTE localisation → PA portée + ignorance de PA (Partielle /
 * Points faibles, `ignoredArmourAP`) RÉ-ÉVALUÉS à la nouvelle localisation. Réutilise EXACTEMENT la queue de
 * `applyHit` : `res.apExternal` (PA location-indépendant : Tir sûr / PA d'opposition) + `ignoredArmourAP` à
 * `location`. Les PB du Critique eux-mêmes ignorent BE+PA (gérés à part, `LDB 18 l.53`).
 */
export function woundsAtCritLocation(res: AttackResult, weapon: Weapon, defender: Combatant, location: HitLocation): number {
  // AA 10 l.105 — ce site re-tire une Localisation : une Structure ne peut pas y passer, et la Taille de
  // l'attaquant (`AA 10 l.98`) n'y a donc aucun terme à compter (passée `undefined`, jamais omise).
  if (isStructure(defender)) throw new Error(`woundsAtCritLocation : ${defender.label} est une Structure — AA 10 l.105.`);
  const ignoredAP = ignoredArmourAP(defender, location, { roll: res.attackerRoll, critical: true, empaleuse: hasQuality(weapon, 'empaleuse') });
  return woundsFromHit(weapon, defender, location, res.damage ?? 0, (res.apExternal ?? 0) - ignoredAP, 1, undefined);
}

function miss(
  attacker: Combatant,
  defender: Combatant,
  atkBd: RollBreakdown,
  advantageTo: 'attacker' | 'defender' | null,
): AttackResult {
  return {
    hit: false,
    attackerRoll: atkBd.roll,
    attackerDetail: atkBd,
    netSL: 0,
    critical: false,
    advantageTo,
    defenderDefeated: false,
    log: `${attacker.label} manque ${defender.label}.`,
  };
}


/**
 * Ordre d'initiative (LDB 13 l.31) : Initiative décroissante, départage par Agilité décroissante.
 * « S'il y a encore égalité, demandez un Test opposé d'Agilité » : pour un GROUPE de combattants à
 * Initiative ÉGALE **et** Agilité ÉGALE (égalité EXACTE), l'ordre relatif est résolu par un Test
 * d'Agilité — chaque membre lance un d100 vs sa valeur d'Ag, et l'on ordonne par DR décroissant (puis,
 * à DR égal, par jet croissant = la plus grande marge de réussite, départage stable).
 * `rng` ABSENT → aucun jet (tri stable déterministe, comportement historique inchangé) ; PRÉSENT → les
 * groupes à égalité exacte sont départagés par le Test (déterministe à graine fixée). Le Test n'est roulé
 * QUE pour les membres d'un groupe à égalité exacte (zéro tirage sinon → aucune dérive du RNG en aval).
 * PUR (RNG injecté).
 */
export function initiativeOrder(combatants: Combatant[], rng?: RNG): Combatant[] {
  const initOf = (c: Combatant) => c.initiative ?? baseWithTraits(c, 'initiative');
  const agOf = (c: Combatant) => baseWithTraits(c, 'agilite');
  const tieTest = new Map<Combatant, TestResult>();
  if (rng) {
    const groupKey = (c: Combatant) => `${initOf(c)}|${agOf(c)}`;
    const groupSize = new Map<string, number>();
    for (const c of combatants) groupSize.set(groupKey(c), (groupSize.get(groupKey(c)) ?? 0) + 1);
    // Roulé dans l'ordre d'ENTRÉE, uniquement pour les égalités exactes → consommation RNG minimale et déterministe.
    for (const c of combatants) if ((groupSize.get(groupKey(c)) ?? 0) > 1) tieTest.set(c, rollTest(effectiveChar(c, 'agilite'), 'intermediaire', rng));
  }
  return [...combatants].sort((a, b) => {
    const ia = initOf(a), ib = initOf(b);
    if (ib !== ia) return ib - ia;
    const aga = agOf(a), agb = agOf(b);
    if (agb !== aga) return agb - aga;
    const ta = tieTest.get(a), tb = tieTest.get(b);
    if (ta && tb) {
      if (tb.sl !== ta.sl) return tb.sl - ta.sl;         // DR décroissant
      if (ta.roll !== tb.roll) return ta.roll - tb.roll; // à DR égal : jet le plus bas d'abord (marge la plus grande)
    }
    return 0; // égalité totale → tri stable (ordre d'entrée préservé)
  });
}

/** Type d'OUVERTURE d'un combat, dérivé du RÉSULTAT de surprise déjà résolu (État Surpris posé par
 *  applySurprise au démarrage) — PAS de l'intention `enc.surprise` (un guetteur peut résister).
 *  'ambush' = un héros est surpris (on nous tombe dessus) ; 'assault' = un ennemi est surpris (on les
 *  prend par surprise) ; 'combat' = personne. L'embuscade prime (alarme dominante). */
export function combatOpening(combatants: Combatant[]): 'ambush' | 'assault' | 'combat' {
  if (combatants.some((c) => c.kind === 'hero' && hasCondition(c, COND.surpris))) return 'ambush';
  if (combatants.some((c) => c.kind === 'enemy' && hasCondition(c, COND.surpris))) return 'assault';
  return 'combat';
}

/**
 * Re-dérive une attaque NON opposée (tir OU mêlée passive) à partir d'un jet d'attaque DÉJÀ figé
 * — pour la Chance « +1 DR » (ch.17 l.26) : le DR voulu est porté par `atk.sl`, on NE relance PAS
 * le d100 (le succès reste celui du jet propre) et on recalcule uniquement les Dégâts.
 */
export function rederivePassiveAttack(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  kind: 'melee' | 'ranged',
  location?: HitLocation,
  withhold = false, // « Retenir ses coups » (Aux Armes 07 l.59-61) — n'agit qu'en mêlée (gardé par applyHit)
  compo?: DifficultyComposition, // Difficulté FIGÉE par la résolution d'origine (#1153 L4)
): AttackResult {
  // La composition FIGÉE par la résolution d'origine est TRANSPORTÉE : re-composer ici depuis un
  // contexte appauvri (ni distance, ni env, ni flanc/dos) annoncerait une autre Difficulté et
  // laisserait l'écart en chip « autres » — dépenser sa Chance ne change pas la Difficulté du jet.
  const atkBd = bd(attackTestLabel(weapon, kind), combatValue(attacker, kind, weapon), atk, compo ?? compoDeRepli(attackModifiers(attacker, defender, weapon, { kind, location }), 'rederivePassiveAttack'));
  if (!atk.success) {
    return {
      hit: false,
      attackerRoll: atk.roll,
      attackerDetail: atkBd,
      netSL: atk.sl,
      critical: false,
      advantageTo: kind === 'ranged' ? null : 'defender',
      defenderDefeated: false,
      log: kind === 'ranged' ? `${attacker.label} manque sa cible.` : `${attacker.label} manque ${defender.label}.`,
    };
  }
  return applyHit(attacker, defender, weapon, atkBd, atk.sl, atk.isDouble && atk.success, location, undefined, 0, withhold);
}
