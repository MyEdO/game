/**
 * Évaluateur de SORT générique de l'IA — PUR et déterministe (module FEUILLE : importe seulement
 * `engine/*`, `./flow` (spellOps), `./spawn` (spawnEnemy) et la donnée ; JAMAIS `ai.ts`,
 * `combatFlow` ou le store → pas de cycle).
 *
 * Principe (cf. plan « les casters jouent tout leur arsenal ») : la valeur d'un sort n'est PAS lue
 * dans une catégorie — c'est la Σ de la valeur de ses `GameOp` appliqués à l'endroit visé, × fiabilité
 * d'incantation (`landProb`, fourni par l'appelant) × opposition (Sorts de Contact/résistés, LDB 46
 * l.103-105). L'échelle est « Blessures-équivalent pour mon camp » (l'unité déjà employée par `ai.ts`).
 *
 * ZÉRO `battleRng()`/`rollTest`/`Math.random` : le planning doit rester déterministe (coop/tests
 * reproductibles). Les magnitudes de dés sont des MOYENNES (`formulaExpectation`), jamais tirées.
 */
import { tableTotale } from '../lib/tableTotale';
import { Combatant, Weapon, ArmourPoints, CHAR_KEYS } from '../engine/types';
import { bonus, effectiveChar } from '../engine/characteristics';
import { combatValue, attackModifiers, combineMods, woundsFromHit, type ModLine } from '../engine/combat';
import { effectiveWeaponDamage } from '../engine/weaponDamage';
import { missileDamage } from '../engine/magic';
import { formulaExpectation, slBonus, applyOps, type GameOp } from '../engine/ops';
import type { RNG } from '../engine/dice';
import type { SizeCategory } from '../engine/size';
import { groupMatch } from '../engine/groups';
import { spellOps } from './flow';
import { type SpellData, findConditionById } from '../data';
import { RefIrresoluble, spawnEnemy } from './spawn';

/** DR moyen prudent injecté dans l'espérance d'une touche (l'espérance d'un DR ≥ 0 sur une réussite). */
const AVG_DR = 1;
/** DR MÉDIAN supposé pour l'échelle « +N DR » d'une op de sort scorée hors jet (PerSL). */
const MED_DR = 2;
/** RNG CONSTANT déterministe pour `applyOpClone` (renvoie la borne basse) — les ops de buff scorées
 *  (charMod/augment/octroi) ne consomment pas de dé ; ce RNG ne fait que satisfaire la signature. */
const STATIC_RNG: RNG = { int: (min) => min };

/** Garde NaN : une grandeur dérivée du moteur peut être NaN si les Caractéristiques d'un combattant de
 *  test sont absentes (`{} as never`). On retombe alors sur `fallback` (neutre) → scoring déterministe. */
export const finite = (n: number, fallback = 0): number => (Number.isFinite(n) ? n : fallback);

/**
 * Probabilité de TOUCHER (0..1) d'une attaque, dérivée de la valeur cible RAW (base + modificateurs
 * plafonnés par `combineMods`, comme la résolution) : `P = clamp(target, 5, 95) / 100`. PUR, sans dé.
 */
export function hitProbability(attacker: Combatant, target: Combatant, weapon: Weapon, kind: 'melee' | 'ranged', distanceTiles?: number, env?: ModLine[], metresPerTile = 2): number {
  const val = combatValue(attacker, kind, weapon);
  const mods = combineMods(attackModifiers(attacker, target, weapon, { kind, distanceTiles, env, metresPerTile }));
  const targetVal = finite(val + mods, NaN);
  if (!Number.isFinite(targetVal)) return NaN;
  return Math.max(5, Math.min(95, targetVal)) / 100;
}

/**
 * Espérance de Blessures d'une attaque d'arme `attacker → target` (PUR, sans dé) : probabilité de
 * toucher × Blessures d'un coup MOYEN. Les Blessures réelles passent par `woundsFromHit` (BE + PA à
 * la localisation « corps », qualités d'arme) — MÊME résolveur que le combat.
 */
export function expectedDamage(attacker: Combatant, target: Combatant, weapon: Weapon, kind: 'melee' | 'ranged', distanceTiles?: number, env?: ModLine[], metresPerTile = 2): number {
  const p = hitProbability(attacker, target, weapon, kind, distanceTiles, env, metresPerTile);
  if (!Number.isFinite(p)) return NaN;
  const bf = bonus(effectiveChar(attacker, 'force'));
  const totalDamage = finite(effectiveWeaponDamage(weapon, Number.isFinite(bf) ? bf : 0) + AVG_DR, NaN);
  if (!Number.isFinite(totalDamage)) return NaN;
  return p * safeWounds(weapon, target, totalDamage, attacker.size);
}

/** `woundsFromHit` défensif : un combattant de test minimal peut ne pas porter `armour`. On lui prête
 *  une armure NULLE le cas échéant ; renvoie 0 si NaN. */
export function safeWounds(weapon: Weapon, target: Combatant, totalDamage: number, attackerSize?: SizeCategory): number {
  const safe = target.armour ? target : ({ ...target, armour: {} as Combatant['armour'] });
  return finite(woundsFromHit(weapon, safe, 'corps', totalDamage, 0, 1, attackerSize), 0);
}

// Dangerosité d'un ÉTAT infligé (« Blessures espérées ») : lue en DONNÉE sur `etats.json` (`aiThreat`,
// clé = l'`id` de l'op:'condition'). États inconnus / sans aiThreat → 1 (contrôle mineur).

/**
 * Une cible est NEUTRALISÉE (au sol/inconsciente/0 PB encore là) : aucun intérêt tactique à s'acharner
 * tant qu'une menace DEBOUT existe. Lue en DONNÉE (États + Blessures), sans nom en dur.
 */
export function isNeutralized(h: Combatant): boolean {
  const cond = h.conditions ?? [];
  return cond.some((c) => c.id === 'a-terre' || c.id === 'inconscient') || h.wounds.current <= 0;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Évaluateur de sort générique (op-driven)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Cible neutre STABLE pour `bestAttackEV` quand aucun ennemi de référence n'existe (carac. moyennes). */
const GENERIC_DUMMY: Combatant = {
  id: '__ai-dummy__', label: 'cible', kind: 'enemy',
  characteristics: tableTotale(CHAR_KEYS, () => 30),
  wounds: { current: 12, max: 12, base: 12 },
  advantage: 0, conditions: [], weapons: [], armour: {} as ArmourPoints,
  skills: [], talents: [], movement: 4,
};

/** Contexte de scoring d'UNE op : ennemi de référence (cible des buffs offensifs) + horizon de buff. */
export interface OpEvalCtx { refEnemy: Combatant | null; horizon: number }
/** Contexte de scoring d'UN sort lancé : ajoute la fiabilité d'incantation `landProb` (fournie). */
export interface SpellEvalCtx extends OpEvalCtx { landProb: number }
/** Endroit où le sort est lancé : sur soi, sur une unité, ou en ZdE couvrant `covered`. */
export type SpellPlacement =
  | { kind: 'self' }
  | { kind: 'unit'; subject: Combatant }
  | { kind: 'area'; covered: Combatant[] };

/** PA « corps » statiques de la cible (≥0) — calque la mitigation de l'op `wounds` (ops.ts). */
const bodyPA = (target: Combatant): number => Math.max(0, target.armour?.corps ?? 0);
/** Blessures réellement RÉCUPÉRABLES par un soin (PB manquants, ≥0). */
const missingWounds = (c: Combatant): number => Math.max(0, c.wounds.max - c.wounds.current);

/** Composante de Projectile magique (flag `missile`, hors `GameOp`) : `Dégâts + BFM + DR moyen`, mitigée
 *  BE/PA selon `ignoreBE/ignorePA` (LDB 46 l.99-101), plancher 0. 0 si non-missile (ou pas de cible). */
function missileComponent(caster: Combatant, target: Combatant | null, spell: SpellData): number {
  const md = missileDamage(spell);
  if (!md) return 0;
  const bfm = finite(bonus(effectiveChar(caster, 'force-mentale')), 0);
  let dmg = md.damage + bfm + AVG_DR;
  if (target) dmg -= (md.ignoreBE ? 0 : finite(bonus(effectiveChar(target, 'endurance')), 0)) + (md.ignorePA ? 0 : bodyPA(target));
  return Math.max(0, dmg);
}

/** Sortie BRUTE (Blessures, sans escompte de réussite) d'UNE op de DÉGÂTS (`wounds`/`reduceToZero`/
 *  `banish`) sur `target` ; 0 pour toute autre op. Gates de Groupe (`onlyGroups`) honorés. */
function damageOpOutput(op: GameOp, caster: Combatant, target: Combatant | null): number {
  if (op.op === 'wounds') {
    if (target && op.onlyGroups && !op.onlyGroups.some((g) => groupMatch(g, target.groups ?? []))) return 0;
    let dmg = finite(formulaExpectation(op.amount, caster), 0) + slBonus(MED_DR, op.perSL);
    // RAW (ops.ts:170-174) : `wounds` IGNORE BE+PA par DÉFAUT — on ne déduit que si explicitement `false`.
    if (target) dmg -= (op.ignoreTB === false ? finite(bonus(effectiveChar(target, 'endurance')), 0) : 0) + (op.ignoreAP === false ? bodyPA(target) : 0);
    return Math.max(op.min ?? 0, dmg);
  }
  if (op.op === 'reduceToZero') return target ? Math.max(0, target.wounds.current) : 0;
  if (op.op === 'banish') {
    if (!target) return 0;
    if (op.onlyGroups && !op.onlyGroups.some((g) => groupMatch(g, target.groups ?? []))) return 0;
    return Math.max(0, target.wounds.current);
  }
  return 0;
}

/**
 * Sortie de DÉGÂTS BRUTE d'un sort (sans escompte de réussite) sur `target` : composante Projectile
 * (flag) + Σ des ops de dégâts à la cible. Réutilisé par `spellActionValue` (ZdE) et la sentinelle
 * « sort invisible ». `target` null = pas de mitigation (estimation prudente).
 */
export function expectedSpellOutput(caster: Combatant, target: Combatant | null, spell: SpellData): number {
  let total = missileComponent(caster, target, spell);
  for (const op of spellOps(spell.effects, 'target')) total += damageOpOutput(op, caster, target);
  return total;
}

/**
 * MAL total qu'un sort inflige à UNE cible (Blessures-équivalent) : dégâts (`expectedSpellOutput`) PLUS la
 * menace des ÉTATS/contrôle hostiles posés sur la cible (op `condition`, `charMod<0`, `castPenalty`…). Sert
 * la PÉNALITÉ DE TIR AMI d'une ZdE (alliés couverts), SYMÉTRIQUE au mal fait aux ennemis — l'ancien calcul ne
 * comptait QUE les dégâts, donc une ZdE de CONTRÔLE/débuff n'avait aucune pénalité d'ami (l'IA KO ses alliés).
 * HORS `on:caster` (effets du lanceur, pas un mal à la cible) et hors escompte de réussite (l'appelant ×landProb).
 */
export function spellTargetHarm(caster: Combatant, target: Combatant, spell: SpellData): number {
  let harm = expectedSpellOutput(caster, target, spell);
  for (const op of spellOps(spell.effects, 'target')) {
    if (op.op === 'wounds' || op.op === 'reduceToZero' || op.op === 'banish') continue; // déjà dans expectedSpellOutput
    if (opIsHostileControl(op)) harm += opValue(op, caster, target, { refEnemy: null, horizon: 1 });
  }
  return harm;
}

/** Σ EV de la meilleure arme de `c` contre `foe` (réutilise `expectedDamage`). 0 sans arme. */
function bestAttackEV(c: Combatant, foe: Combatant | null): number {
  const target = foe ?? GENERIC_DUMMY;
  let best = 0;
  for (const w of c.weapons ?? []) {
    const ev = finite(expectedDamage(c, target, w, w.type), 0);
    if (ev > best) best = ev;
  }
  return best;
}

/** Clone PROFOND de `c` avec `op` appliquée (charMod/augment/octroi…) — déterministe (RNG constant non
 *  consommé par ces ops). Sert au BÉNÉFICE MARGINAL d'un buff (delta réel de l'EV d'attaque). */
function applyOpClone(c: Combatant, op: GameOp): Combatant {
  const clone = structuredClone(c);
  applyOps(clone, [op], { caster: c, rng: STATIC_RNG });
  return clone;
}

/** Bénéfice MARGINAL d'un buff de combat sur `subject` (générique, AUCUNE liste de carac) : `horizon ×
 *  Δ(meilleure EV d'attaque AVEC l'op − SANS)`. Un buff qui n'améliore pas le combat → ≈0 → non lancé. */
function marginalBuff(_caster: Combatant, subject: Combatant, op: GameOp, ctx: OpEvalCtx): number {
  const before = bestAttackEV(subject, ctx.refEnemy);
  const after = bestAttackEV(applyOpClone(subject, op), ctx.refEnemy);
  return ctx.horizon * Math.max(0, after - before);
}

/** Valeur d'une INVOCATION alliée ≈ `count × (Blessures + ½ EV d'attaque)` de la créature invoquée
 *  (durabilité + sortie). Sa fiche sort de `spawnEnemy` (déterministe sans extras) ; une réf qui ne
 *  se résout pas vaut un proxy borné. */
function summonValue(op: Extract<GameOp, { op: 'summon' }>, caster: Combatant, ctx: OpEvalCtx): number {
  const count = Math.max(1, Math.round(finite(formulaExpectation(op.count, caster), 1)));
  try {
    const c = spawnEnemy({ ref: op.ref }, '__ai-eval__', { x: 0, y: 0 });
    return count * ((c.wounds?.max ?? 6) + 0.5 * bestAttackEV(c, ctx.refEnemy));
  } catch (e) {
    if (e instanceof RefIrresoluble) return count * 6;
    throw e;
  }
}

/** Une op est-elle BÉNÉFIQUE ? (data-driven, par `op` — pas de nom de sort.) Couvre octrois, `charMod`/
 *  `skillMod` POSITIFS et soins. Sert le DÉFAUT signé de `opValue` (longue traîne des ops). */
function opIsBeneficial(op: GameOp): boolean {
  switch (op.op) {
    case 'heal': case 'healCaster': case 'cureCriticalWound': case 'cureDisease':
    case 'reduceDiseaseDays': case 'diseaseTestMod': case 'suppressSymptom': case 'preventInfection': case 'removeCondition': case 'endPsych':
    case 'grantTalent': case 'grantTrait': case 'augmentWeapon': case 'grantWeapon':
    case 'grantNaturalWeapon': case 'ap': case 'gainResource': case 'gainAdvantage':
    case 'freeReroll': case 'critTwice': case 'ignoreStatePenalties': case 'suppressPsych':
    case 'noBreath': case 'noHunger': case 'weatherWard': case 'castWard': case 'arrowWard':
    case 'domeWard': case 'attackWardFM': case 'martyr': case 'giveTrapping':
      return true;
    case 'charMod': return op.mod > 0;
    case 'skillMod': return op.mod > 0;
    default: return false;
  }
}

/** Une op est-elle HOSTILE sans dégât direct ? (État négatif, `charMod`/`skillMod`/`testMod` négatif,
 *  corruption, suffocation, maladie…). Les dégâts (`wounds`/`reduceToZero`/`banish`) sont exclus ici. */
function opIsHostileControl(op: GameOp): boolean {
  switch (op.op) {
    case 'condition': return true;
    case 'corruption': return op.amount > 0;
    case 'suffocate': case 'exposeDisease': case 'contractDisease': case 'castPenalty':
    case 'damageArmour':
      return true;
    case 'charMod': return op.mod < 0;
    case 'skillMod': return op.mod < 0;
    case 'testMod': return op.amount < 0;
    default: return false;
  }
}

/**
 * Valeur (≥0, échelle « Blessures-équivalent ») d'UNE op pour le camp du lanceur, `subject` = la cible
 * effective de l'op (un ennemi pour les dégâts/contrôle, un allié/soi pour soin/buff). EXHAUSTIF par
 * classification ; aucun défaut faux silencieux (longue traîne → `opIsBeneficial`/`opIsHostileControl`).
 */
export function opValue(op: GameOp, caster: Combatant, subject: Combatant, ctx: OpEvalCtx): number {
  switch (op.op) {
    // DÉGÂTS — sur un ennemi.
    case 'wounds': case 'reduceToZero': case 'banish':
      return damageOpOutput(op, caster, subject);
    // SOIN — sur un allié/soi (plafonné aux PB manquants) ; `perSL` estimé à `MED_DR`, comme les dégâts.
    case 'heal':
      return Math.min(finite(formulaExpectation(op.amount, caster), 0) + slBonus(MED_DR, op.perSL), missingWounds(subject));
    case 'healCaster':
      return Math.min(finite(formulaExpectation(op.amount, caster), 0), missingWounds(subject));
    case 'cureCriticalWound':
      return 4 * (op.count ?? 1);
    // BUFF de combat GÉNÉRIQUE — bénéfice marginal réel (delta d'EV d'attaque).
    case 'charMod':
      return op.mod > 0 ? marginalBuff(caster, subject, op, ctx) : Math.abs(op.mod) / 10;
    case 'skillMod':
      return op.mod > 0 ? marginalBuff(caster, subject, op, ctx) : Math.abs(op.mod) / 10;
    case 'augmentWeapon': case 'grantWeapon': case 'grantNaturalWeapon':
    case 'gainAdvantage': case 'grantFreeAttack':
      return marginalBuff(caster, subject, op, ctx);
    // CONTRÔLE hostile.
    case 'condition':
      return findConditionById(op.id)?.aiThreat ?? 1;
    case 'testMod':
      return op.amount < 0 ? Math.abs(op.amount) / 10 : 0;
    case 'castPenalty': case 'suffocate': case 'damageArmour':
      return 2.5;
    case 'corruption':
      return op.amount > 0 ? 2.5 : 0;
    // BÉNÉFICE allié NON-combat.
    case 'removeCondition': case 'endPsych': case 'suppressPsych': case 'ignoreStatePenalties':
      return 2;
    case 'ap':
      return finite(formulaExpectation(op.amount, caster), 0);
    case 'gainResource':
      return 3 * op.amount;
    // INVOCATION — un démon « hors de contrôle » (allyOfCaster=false) ne vaut rien pour le lanceur.
    case 'summon':
      return op.allyOfCaster === false ? 0 : summonValue(op, caster, ctx);
    // FORME DE COMBAT alternative (lycanthrope — op `transform`) : bénéfice = amélioration RÉELLE d'EV
    // d'attaque de la forme (charMod, delta du clone transformé) × horizon + ~2 par Trait hybride accordé
    // (attaque/Peur/armure). Le coût de 2 Actions est absorbé (buff PERSISTANT sur tout le combat) ; le gate
    // d'applicabilité (déjà transformé) empêche le spam. `endTransform` (reprendre sa forme) → jamais un gain.
    case 'transform':
      return marginalBuff(caster, subject, op, ctx) + op.ops.filter((o) => o.op === 'grantTrait').length * 2;
    case 'endTransform':
      return 0;
    // DÉFAUT signé (longue traîne) — jamais de défaut faux silencieux.
    default:
      return opIsBeneficial(op) ? 2 : opIsHostileControl(op) ? 2 : 0;
  }
}

/** Polarité d'un sort, DATA-DRIVEN (jamais un nom) : OFFENSIF s'il est un Projectile magique OU s'il porte
 *  une op de DÉGÂT (`wounds`/`reduceToZero`/`banish`) ou de CONTRÔLE hostile sur la cible. Sinon BÉNÉFIQUE
 *  (soin/buff/invocation). Sert l'énumération (cibles ennemies vs alliées) de l'IA. */
export function spellIsOffensive(spell: SpellData): boolean {
  if (spell.missile === true) return true;
  return spellOps(spell.effects, 'target').some(
    (o) => o.op === 'wounds' || o.op === 'reduceToZero' || o.op === 'banish' || opIsHostileControl(o),
  );
}

/** Escompte d'OPPOSITION (RAW Sorts de Contact/résistés, LDB 46 l.103-105), déterministe : un Sort de
 *  Contact frappe via un Test opposé (CC lanceur vs meilleure défense de la cible) ; un Sort résisté
 *  réussit ~½ ; un sort non opposé passe à coup sûr (×1). */
export function oppositionDiscount(spell: SpellData, caster: Combatant, target: Combatant | null): number {
  const opp = spell.opposed;
  if (!opp) return 1;
  if (opp.kind === 'resist') return 0.5;
  if (!target) return 0.5;
  const cc = effectiveChar(caster, 'capacite-de-combat');
  const def = Math.max(effectiveChar(target, 'capacite-de-combat'), effectiveChar(target, 'agilite'));
  if (!Number.isFinite(cc) || !Number.isFinite(def)) return 0.5;
  return Math.max(0.1, Math.min(0.95, 0.5 + (cc - def) / 200));
}

/**
 * Valeur d'un SORT lancé à `placement` : `(Σ_op opValue + composante missile) × landProb ×
 * oppositionDiscount`. Route chaque op par son `on` (`caster` → le lanceur ; `target` → le(s) sujet(s)
 * du placement). Pour une ZdE, somme sur `covered`. PUR, déterministe.
 */
export function spellActionValue(caster: Combatant, spell: SpellData, placement: SpellPlacement, ctx: SpellEvalCtx): number {
  const opCtx: OpEvalCtx = { refEnemy: ctx.refEnemy, horizon: ctx.horizon };
  const targetSubjects = placement.kind === 'self' ? [caster]
    : placement.kind === 'unit' ? [placement.subject]
      : placement.covered;
  const tgtOps = spellOps(spell.effects, 'target');
  let raw = 0;
  // Par sujet : DÉGÂTS (Projectile + ops de dégâts) via `expectedSpellOutput` (couverture réelle d'une
  // ZdE = Σ sur les couverts) + valeur des ops NON-dégât « à la cible » (contrôle/soin/buff).
  for (const s of targetSubjects) {
    raw += expectedSpellOutput(caster, s, spell);
    for (const op of tgtOps) {
      if (op.op === 'wounds' || op.op === 'reduceToZero' || op.op === 'banish') continue; // déjà comptés par expectedSpellOutput
      raw += opValue(op, caster, s, opCtx);
    }
  }
  // Ops « au lanceur » (invocation, vol de vie, auto-buff) — appliquées une seule fois (les ops de dégât
  // sur le lanceur n'existent pas en pratique ; on les ignore plutôt que de les compter comme un gain).
  for (const op of spellOps(spell.effects, 'caster')) {
    if (op.op === 'wounds' || op.op === 'reduceToZero' || op.op === 'banish') continue;
    raw += opValue(op, caster, caster, opCtx);
  }
  const primary = placement.kind === 'self' ? null : (targetSubjects[0] ?? null);
  return raw * ctx.landProb * oppositionDiscount(spell, caster, primary);
}
