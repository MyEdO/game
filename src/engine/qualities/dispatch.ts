/**
 * Dispatcher PUR des qualités d'objet : lit les `QualityInstance` STRUCTURÉES (`{id, value?}`) portées
 * par l'objet (jamais une chaîne « id value » re-parsée), résout leur donnée mécanique PAR ID, puis expose
 * des helpers que combat.ts/items.ts/combatFlow appellent au lieu de tester des chaînes en dur. Aucune
 * mutation. Accepte tout porteur de `qualities` (Weapon ou ItemInstance).
 *
 * La MÉCANIQUE de chaque qualité vit dans `qualities.json`, lue PAR ID —
 * `passive: GameOp[]` (weaponRollMod/weaponDamageMod/armourPierce/critOnRoll/testMod) pour les
 * modificateurs, `capabilities` pour les drapeaux irréductibles.
 */
import type { Weapon, QualityInstance, ArmourBypass } from '../types';
import type { QualityId } from './ids';
import type { QualityDef } from './types';
import { findQualityById, findWeaponGroupById, qualityInstance, type QualityCapabilities, type QualityData } from '../../data';
import type { GameOp } from '../ops';

/** Tout porteur de qualités (Weapon ou ItemInstance) — seul `qualities` est requis ; `weaponGroup`/
 *  `subType` (`weaponGroup ?? subType` = Groupe d'objet) donnent accès aux qualités de FAMILLE.
 *  `noFamilyQualities` bloque cette fusion SANS effacer `subType`/`weaponGroup` (cf. `Weapon.noFamilyQualities` —
 *  la compétence/talent lus par `subType` restent intacts pour un profil qui remplace la liste de qualités).
 *  `removedQualities`/`removedTypes` : qualités NEUTRALISÉES par une altération (op `augmentWeapon`,
 *  VDM 05 *Défaut*) — retirées APRÈS la fusion de famille ; `passive` : ops passives conférées par cette
 *  même altération, lues au MÊME point que le `passive` d'un Atout de registre (`weaponPassiveOps`). */
export type QualityCarrier = { qualities: QualityInstance[]; weaponGroup?: string | null; subType?: string | null; noFamilyQualities?: boolean;
  removedQualities?: string[]; removedTypes?: ('atout' | 'defaut')[]; passive?: GameOp[] };

/** Une qualité résolue présente sur un objet : sa définition de registre (libellé), son id STABLE, sa
 *  donnée mécanique (`qualities.json` → passive/capabilities/effects) et son Indice éventuel. */
export interface ResolvedQuality {
  def: QualityDef;
  /** id STABLE (slug) de la qualité — clé de lecture de la mécanique dans la donnée. */
  id: string;
  /** Donnée mécanique (`qualities.json`) — `undefined` si la qualité n'a pas d'entrée de données. */
  data?: QualityData;
  /** Drapeaux/marqueurs de capacité (raccourci `data.capabilities`). */
  caps?: QualityCapabilities;
  /** Indice porté par la référence (`QualityInstance.value`) — paramètre les effets de la qualité
   *  (`state/triggeredEffects::withArg`, template `$indice`) et son affichage (`qualityRefLabel`). */
  indice?: number;
}

/** Ops passives de la qualité (lecture par id dans la donnée). */
const passiveOf = (id: string): GameOp[] => findQualityById(id)?.passive ?? [];

/** SOURCE UNIQUE des ops PASSIVES d'ARME à consulter : celles des qualités présentes (registre, par id) +
 *  celles conférées par une ALTÉRATION de l'arme (`Weapon.passive`, op `augmentWeapon.passive` — VDM 05
 *  *Défaut* « −1 DR à tous les Tests pour attaquer avec elle »). Tout lecteur de passif d'arme passe ICI. */
export function weaponPassiveOps(w: QualityCarrier | undefined): GameOp[] {
  if (!w) return [];
  return [...resolveQualities(w).flatMap((r) => passiveOf(r.id)), ...(w.passive ?? [])];
}

/** Qualités du registre présentes sur l'objet (normalisées, avec id/donnée/Indice). Chaînes inconnues
 *  ignorées. Applique la PRÉSÉANCE `capabilities.beats` (ids) : une qualité vaincue par une autre présente
 *  est retirée (« Imprécise prend le dessus » sur Précise, LDB 62 l.323 ; Lente sur Rapide, LDB 62 l.302). */
export function resolveQualities(w: QualityCarrier | undefined): ResolvedQuality[] {
  if (!w) return [];
  const own = w.qualities ?? [];
  const ownIds = new Set(own.map((q) => q.id));
  const familyQualities = w.noFamilyQualities ? [] : (findWeaponGroupById(w.weaponGroup ?? w.subType)?.qualities ?? []);
  const merged = [...own, ...familyQualities.filter((q) => !ownIds.has(q.id)).map(qualityInstance)];
  const out: ResolvedQuality[] = [];
  for (const q of merged) {
    const data = findQualityById(q.id);
    out.push({ def: { key: data?.label ?? q.id }, id: q.id, data, caps: data?.capabilities, indice: q.value });
  }
  const beaten = new Set(out.flatMap((r) => r.caps?.beats ?? []));
  // Neutralisations d'une ALTÉRATION (op `augmentWeapon`) : par id, et par POLARITÉ lue dans le REGISTRE
  // (`QualityData.polarite`) — jamais une liste d'ids en dur. Appliquées APRÈS la fusion de famille : le RAW
  // (« Tous les Atouts de l'arme disparaissent », VDM 05) ne distingue pas propre et famille.
  const removedIds = w.removedQualities?.length ? new Set(w.removedQualities) : null;
  const removedTypes = w.removedTypes?.length ? new Set<string>(w.removedTypes) : null;
  if (!beaten.size && !removedIds && !removedTypes) return out;
  return out.filter((r) => !beaten.has(r.id) && !removedIds?.has(r.id) && !(r.data?.polarite != null && removedTypes?.has(r.data.polarite)));
}

/** L'objet possède-t-il la qualité d'`id` STABLE (`QualityId`) ? Compare par id (≠ littéral FR). */
export function hasQuality(w: QualityCarrier | undefined, id: QualityId): boolean {
  return resolveQualities(w).some((r) => r.id === id);
}

/** La qualité d'`id` est-elle un Atout (≠ Défaut) ? Lu dans la DONNÉE (`qualities.json` champ `polarite`). Sert au
 *  « perd tous ses Atouts » d'une baliste tirée en solo (AA 10 l.148). Qualité inconnue → false (pas un Atout). */
export function isAtoutQuality(id: string): boolean {
  return findQualityById(id)?.polarite === 'atout';
}

/** Indice de la qualité d'`id` sur l'objet (ex. Solide/Recharge → N), ou undefined si absente/sans Indice. */
export function qualityIndice(w: QualityCarrier | undefined, id: QualityId): number | undefined {
  return resolveQualities(w).find((r) => r.id === id)?.indice;
}

/** Somme d'un modificateur numérique sur les qualités présentes (0 si aucune) — lu dans les ops PASSIVES
 *  de la donnée. `attackMod` = `weaponRollMod{phase:'attack'}.flatMod` (Précise +10) ; `armourReduction` =
 *  `armourPierce.amount` (Perforante 1). */
export function qualitySum(w: QualityCarrier | undefined, field: 'attackMod' | 'armourReduction'): number {
  let n = 0;
  for (const op of weaponPassiveOps(w)) {
    if (field === 'attackMod' && op.op === 'weaponRollMod' && op.phase === 'attack') n += op.flatMod ?? 0;
    else if (field === 'armourReduction' && op.op === 'armourPierce') n += op.amount;
  }
  return n;
}

/** Bypass d'armure déclarés par les qualités PRÉSENTES sur l'objet (Perforante `bypass:'nonMetal'`, LDB
 *  62 l.270) — lu via `weaponPassiveOps` (altérations d'arme comprises). Un objet peut cumuler plusieurs
 *  bypass (qualité + `Weapon.bypass` d'enchantement) : chacun est appliqué au reliquat, cf. `woundsCalc`. */
export function qualityArmourBypasses(w: QualityCarrier | undefined): ArmourBypass[] {
  return weaponPassiveOps(w)
    .filter((op): op is Extract<GameOp, { op: 'armourPierce' }> => op.op === 'armourPierce' && op.bypass != null)
    .map((op) => op.bypass!);
}

/** ids STABLES des qualités PRÉSENTES qui portent un modificateur PLAT au Test d'attaque (part
 *  `attackMod` de `qualitySum`) — permet au site d'affichage de lier le modificateur à SA qualité au
 *  Codex. Une altération d'arme (`Weapon.passive`, op `augmentWeapon`) n'est pas une qualité de
 *  registre : elle n'a pas d'id et n'apparaît donc pas ici. */
export function attackModQualityIds(w: QualityCarrier | undefined): string[] {
  return resolveQualities(w)
    .filter((r) => (r.data?.passive ?? []).some((op) => op.op === 'weaponRollMod' && op.phase === 'attack' && (op.flatMod ?? 0) !== 0))
    .map((r) => r.id);
}

/** Une qualité de l'arme déclenche-t-elle un Critique pour ce jet ? (Empaleuse `critOnRoll` multiple de 10). */
export function qualityCritTriggered(w: QualityCarrier | undefined, roll: number): boolean {
  for (const op of weaponPassiveOps(w)) if (op.op === 'critOnRoll' && roll % op.mod === op.equals) return true;
  return false;
}

type RollPhase = Extract<GameOp, { op: 'weaponRollMod' }>['phase'];
/** Somme des `weaponRollMod` d'une PHASE de jet de combat sur les qualités présentes (DR par défaut). */
function rollModSum(w: QualityCarrier | undefined, phase: RollPhase, kind: 'drMod' | 'flatMod' = 'drMod'): number {
  let n = 0;
  for (const op of weaponPassiveOps(w)) if (op.op === 'weaponRollMod' && op.phase === phase) n += (kind === 'drMod' ? op.drMod : op.flatMod) ?? 0;
  return n;
}

/** Ajustement de DR de la PARADE (Test opposé) : Défensive (arme du défenseur) +1, À Enroulement (arme de l'attaquant) -1. */
export function parryDRAdjust(defenderWeapon: QualityCarrier | undefined, attackerWeapon: QualityCarrier | undefined): number {
  return rollModSum(defenderWeapon, 'parryByDefender') + rollModSum(attackerWeapon, 'parryAgainstAttacker');
}

/** ±DR au Test d'ATTAQUE avec l'arme. La phase `attack` s'applique que le Test soit réussi ou raté
 *  (Imprécise -1, LDB 62 l.323) ; la phase `attackSuccess` n'entre QUE sur un Test réussi (Pointue +1,
 *  LDB 62 l.288) — d'où `success`. Inclut le sous-effectif d'une Arme d'équipe d'Indice ≥ 3 (Imprécise,
 *  Aux Armes p.124). */
export function attackDRAdjust(w: QualityCarrier | undefined, success: boolean): number {
  return rollModSum(w, 'attack') + (success ? rollModSum(w, 'attackSuccess') : 0) + (crewedTeamIndice(w) >= 3 ? -1 : 0);
}

/** +DR à TOUT Test de défense (Parade ET Esquive) contre l'arme de l'attaquant (Lente +1, LDB 62 l.331). */
export function vsDefenseDRAdjust(attackerWeapon: QualityCarrier | undefined): number {
  return rollModSum(attackerWeapon, 'vsDefense');
}

/** L'arme peut-elle tirer au Combat rapproché (Atout Pistolet) ? */
export function canFireWhileEngaged(w: Weapon | undefined): boolean {
  return !!w && w.type === 'ranged' && resolveQualities(w).some((r) => r.caps?.canFireWhileEngaged);
}

/** L'objet est-il insensible aux dégâts/destruction (Incassable) ? (remplace les regex /incassable/i). */
export function isUnbreakable(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.caps?.unbreakable);
}

/** L'arme est-elle une arme à feu (Poudre noire / Explosion) ? (remplace les regex /poudre|explos/i sur les qualités). */
export function isFirearmQuality(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.caps?.firearm);
}

/** Ajustement de DR d'un Test RATÉ utilisant l'objet : Pratique +1, Peu Fiable -1 (LDB 60 l.22/58).
 *  Renvoie 0 si le test est RÉUSSI (la règle ne vise que les échecs). */
export function craftTestDRAdjust(w: QualityCarrier | undefined, success: boolean): number {
  if (success) return 0;
  return rollModSum(w, 'testFail');
}

/** Somme des modificateurs de Sociabilité (Laid -10, LDB 60 l.54) des qualités du porteur — lus dans la DONNÉE
 *  éditable (`qualities.json` → `QualityData.passive`, op `testMod{Soc}`), extraits comme `traitCharMods`. */
export function qualitySocMods(w: QualityCarrier | undefined): { id: string; amount: number }[] {
  const out: { id: string; amount: number }[] = [];
  for (const r of resolveQualities(w))
    for (const op of passiveOf(r.id)) if (op.op === 'testMod' && op.char === 'sociabilite') out.push({ id: r.id, amount: op.amount });
  return out;
}

/** Somme de `qualitySocMods` — SOURCE UNIQUE, pour les sites qui n'ont qu'un nombre à porter. */
export function qualitySocMod(w: QualityCarrier | undefined): number {
  return qualitySocMods(w).reduce((s, q) => s + q.amount, 0);
}

/** Indice d'équipage requis d'une Arme d'équipe (la valeur de la qualité `crewedTeam`), 0 si l'arme n'en a
 *  pas. PUR. Quand l'équipage RÉEL est modélisé (poste servi), `crewedFireWeapon` bake les Défauts effectifs
 *  et RETIRE la qualité → ces helpers ne voient plus d'Indice ici (déficit déjà appliqué). À défaut d'équipage
 *  modélisé (héros qui sert seul une pièce), l'Indice subsiste et l'arme est traitée comme maniée en solo. */
export function crewedTeamIndice(w: QualityCarrier | undefined): number {
  return resolveQualities(w).find((r) => r.caps?.crewedTeam)?.indice ?? 0;
}

/** DR cible du rechargement (Recharge Indice), DOUBLÉ pour une Arme d'équipe maniée seul
 *  (sous-effectif, Aux Armes p.124). 0 si l'arme n'a pas le Défaut Recharge. */
export function reloadDRTarget(w: (QualityCarrier & { reload?: number }) | undefined): number {
  return (w?.reload ?? 0) * (crewedTeamIndice(w) >= 2 ? 2 : 1);
}

/** Rapide (LDB 62 l.302) : −10 à la PARADE contre une arme Rapide si l'arme de parade n'est
 *  pas Rapide elle-même. 0 sinon (l'Esquive et les autres Compétences défendent normalement). */
export function rapideParryMod(attackerWeapon: QualityCarrier | undefined, parryWeapon: QualityCarrier | undefined): number {
  if (!resolveQualities(attackerWeapon).some((r) => r.caps?.fastStrike)) return 0;
  return resolveQualities(parryWeapon).some((r) => r.caps?.fastStrike) ? 0 : -10;
}

/** Lente (LDB 62 l.331) : le porteur d'une arme Lente (active) frappe en dernier dans le Round. */
export function strikesLast(weapons: QualityCarrier[] | undefined): boolean {
  return (weapons ?? []).some((w) => resolveQualities(w).some((r) => r.caps?.slowStrike));
}

/** Rapide (LDB 62 l.298-300) : le porteur peut attaquer hors de l'ordre d'Initiative (pré-emption gratuite). */
export function canStrikeFirst(weapons: QualityCarrier[] | undefined): boolean {
  return (weapons ?? []).some((w) => resolveQualities(w).some((r) => r.caps?.fastStrike));
}

/** Dangereuse (LDB 62 l.315) : ce jet RATÉ avec cette arme inclut-il un chiffre de Maladresse
 *  (dizaines ou unités) ? Une Arme d'équipe d'Indice ≥ 4 maniée en sous-effectif devient Dangereuse
 *  (Aux Armes p.124) — seuil {9}. La Poudre imprégnée d'Aqshy (AA 08 l.544) élargit le seuil à {8,9}
 *  via `fumbleDigits` ; le seuil effectif est l'UNION des digits de toutes les qualités résolues. */
export function dangerousNine(w: QualityCarrier | undefined, roll: number, success: boolean): boolean {
  const digits = new Set<number>();
  for (const r of resolveQualities(w)) {
    if (r.caps?.fumbleOn9) digits.add(9);
    for (const d of r.caps?.fumbleDigits ?? []) digits.add(d);
  }
  if (crewedTeamIndice(w) >= 4) digits.add(9);
  if (success || digits.size === 0) return false;
  return digits.has(roll % 10) || digits.has(Math.floor(roll / 10) % 10);
}

/** Chargeur (Indice) avant rechargement complet : À répétition (LDB 62 l.229/231) ou Salve (Aux Armes
 *  p.126) — l'arme tire Indice fois avant d'exiger un rechargement. undefined si l'arme n'en a pas. */
export function magazineSize(w: QualityCarrier | undefined): number | undefined {
  const r = resolveQualities(w).find((x) => x.caps?.magazine || x.caps?.salvo);
  return r ? r.indice ?? 1 : undefined;
}

/** Protectrice (Indice) : PA conférés à TOUTES les localisations quand on OPPOSE l'attaque avec
 *  cette arme (LDB 62 l.296). 0 si la qualité est absente. */
export function protectriceAP(parryWeapon: QualityCarrier | undefined): number {
  const r = resolveQualities(parryWeapon).find((x) => x.caps?.parryAP);
  return r ? r.indice ?? 1 : 0;
}

/** Protectrice ≥ 2 : permet d'OPPOSER les projectiles tirés en Ligne de Vue (LDB 62 l.296).
 *  Renvoie l'arme protectrice utilisable, ou undefined. */
export function rangedOpposeWeapon(weapons: Weapon[] | undefined): Weapon | undefined {
  return (weapons ?? []).find((w) => {
    const r = resolveQualities(w).find((x) => x.caps?.parryAP);
    return r && (r.indice ?? 1) >= 2;
  });
}

/** Perturbante (LDB 62 l.272-274) : l'arme peut repousser au lieu de blesser. */
export function canPushback(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.caps?.pushback);
}

/** Piège-lame (LDB 62 l.278) : l'arme peut piéger une lame sur un Critique défensif. */
export function hasBladeTrap(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.caps?.bladeTrap);
}

/** Arme MAGIQUE (qualité enchantée, ADE II) : ses attaques comptent comme magiques (Éthéré, LDB 85). */
export function isMagicWeapon(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.caps?.magic);
}

export interface DamageStepCtx {
  /** DR-pour-dégâts de base (DR du Test d'attaque, Atouts de DR compris). */
  effDR: number;
  /** Dé des unités du jet de toucher (LDB 62 l.244/266). */
  units: number;
  /** L'attaquant a Chargé ce Tour (gating Épuisante, LDB 62 l.319). */
  charged?: boolean;
}
export interface DamageStep {
  /** DR-dégâts effectif (Dévastatrice : max(DR, unités)). */
  dmgDR: number;
  /** Bonus plat de Dégâts (Percutante : + dé des unités). */
  bonus: number;
}

/** Ajustement de Dégâts dû aux qualités (ops PASSIVES `weaponDamageMod`) : Dévastatrice (DR = max(DR, dé
 *  des unités)), Percutante (+ dé des unités) ; **annulés** si une qualité Inoffensive est présente. `extra` =
 *  qualités conférées hors arme (ex. par la Taille, LDB 85 l.360). Épuisante (`chargeGated`, LDB 62 l.319) :
 *  les Atouts de Dégâts DE L'ARME ne valent qu'en Charge (`ctx.charged`) — pas ceux conférés par la Taille. Pur. */
export function qualityDamageStep(w: QualityCarrier | undefined, ctx: DamageStepCtx, extra: string[] = []): DamageStep {
  // Ops `weaponDamageMod` de l'ARME (id → passif). Épuisante : hors Charge, on retire les Atouts de Dégâts
  // de l'arme (maxUnits / plusUnits) — pas ceux conférés par la Taille (`extra`).
  const tiring = resolveQualities(w).some((r) => passiveOf(r.id).some((op) => op.op === 'weaponDamageMod' && op.chargeGated)) && !ctx.charged;
  const armOps: Extract<GameOp, { op: 'weaponDamageMod' }>[] = [];
  for (const r of resolveQualities(w))
    for (const op of passiveOf(r.id))
      if (op.op === 'weaponDamageMod' && !(tiring && (op.mode === 'maxUnits' || op.plusUnits))) armOps.push(op);
  // Qualités conférées hors arme (Taille → Percutante, etc.) : non gatées par Épuisante. `extra` = ids stables.
  const extraOps: Extract<GameOp, { op: 'weaponDamageMod' }>[] = [];
  for (const id of extra)
    for (const op of passiveOf(id)) if (op.op === 'weaponDamageMod') extraOps.push(op);
  const ops = [...armOps, ...extraOps];
  if (ops.some((op) => op.negateAtouts)) return { dmgDR: ctx.effDR, bonus: 0 };
  const dmgDR = ops.some((op) => op.mode === 'maxUnits') ? Math.max(ctx.effDR, ctx.units) : ctx.effDR;
  const bonus = ops.some((op) => op.plusUnits) ? ctx.units : 0;
  return { dmgDR, bonus };
}
