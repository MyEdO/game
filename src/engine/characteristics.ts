/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics, Combatant, effectRef, type ActiveEffect, type MaximumDesBlessures } from './types';
import { isPrayerFamily } from './combatFeatures/types';
import type { CodexTarget } from './ruleRefs';
import { traumaCharPenaltiesLabeled, passiveCharSum, passiveMods, sommeAttrMods } from './trauma';
import { traitCharMods, traitCapability, isSwarm } from './traits/dispatch';
import { SizeCategory, woundsForSize, tailleCourante } from './size';
import { findSpellById } from '../data';
import type { ModLine } from './combat';
import type { TraitList } from './statEntry';

/** Bonus de Caractéristique = chiffre des dizaines (ex. 37 → 3). */
export function bonus(value: number): number {
  return Math.floor(value / 10);
}

/**
 * Caractéristique de BASE + modificateurs de PROFIL des traits `liveTraits` (Élite/Coriace/Brutal…), SANS les
 * effets volatils (mutations/traumas/maladies/buffs). Reproduit EXACTEMENT l'ancienne valeur cuite au spawn
 * (`characteristics` incluait les charMods de trait, mais pas les mutations) — pour les rares lecteurs BRUTS
 * qui lisaient `c.characteristics[key]` et attendaient « base + traits » (roll d'Initiative, capacité
 * d'Encombrement, polymorphe, affichage). Les lecteurs qui veulent l'effectif TOTAL prennent `effectiveChar`.
 */
export function baseWithTraits(c: Combatant, key: CharKey): number {
  return c.characteristics[key] + (traitCharMods(c.liveTraits)[key] ?? 0);
}

/** Pool de NON-CUMUL d'une contribution, déduit de l'id STABLE de son entité source lu au catalogue :
 *  Prière → `priere:<id>` (LDB 40 l.19), Sort → `sort` (LDB 46 l.119), autre catégorie → hors pool,
 *  sommée (LDB 14 l.95). */
export function poolDeNonCumul(ref: CodexTarget | undefined): string | undefined {
  if (ref?.category !== 'spells') return undefined;
  return isPrayerFamily(findSpellById(ref.id)?.family) ? `priere:${ref.id}` : 'sort';
}

/** Pool d'un effet actif (`poolDeNonCumul` de son entité source). */
export function effectPool(e: ActiveEffect): string | undefined {
  return poolDeNonCumul(effectRef(e) ?? (e.spell ? { category: 'spells', id: e.spell.spellId } : undefined));
}

interface VolatileEntry { label: string; value: number; ref?: CodexTarget; pool?: string }

/** Contributions VOLATILES étiquetées RETENUES pour une Caractéristique — source UNIQUE de
 *  `effectiveChar` (leur Σ) et de `volatileCharLines` (leur affichage, issue #202). Un pool ne garde que
 *  son meilleur bonus et sa pire pénalité (`effectPool`) ; le reste — effets hors pool, réductions
 *  passives (traumatisme, faim…, `traumaCharPenaltiesLabeled`) — est retenu en entier. Sépare la BASE
 *  (permanente : `characteristics` + `passiveCharSum`) des contributions volatiles. */
function volatileCharEntries(c: Combatant, key: CharKey, retenu: (e: ActiveEffect) => boolean = () => true): VolatileEntry[] {
  // Effet actif : son `label` propre + son renvoi (`effectRef`) — MÊME règle que les passifs (#1153).
  const entries: VolatileEntry[] = (c.activeEffects ?? []).filter((e) => e.char === key && retenu(e)).map((e) => ({ label: e.label, value: e.bonus, ref: effectRef(e), pool: effectPool(e) }));
  entries.push(...traumaCharPenaltiesLabeled(c, key).map((p) => ({ label: p.label, value: p.mod, ref: p.ref, pool: poolDeNonCumul(p.src) })));
  return retenirParPool(entries);
}

/** Contributions RETENUES d'une liste à pools de non-cumul : chaque pool garde son meilleur bonus et sa
 *  pire pénalité (`poolDeNonCumul`) ; hors pool, tout est retenu (LDB 14 l.95). Les nulles tombent. */
export function retenirParPool<T extends { value: number; pool?: string }>(entries: readonly T[]): T[] {
  const retained: T[] = [];
  const pools = new Map<string, T[]>();
  for (const e of entries) {
    if (!e.value) continue;
    if (e.pool == null) retained.push(e);
    else pools.set(e.pool, [...(pools.get(e.pool) ?? []), e]);
  }
  for (const members of pools.values()) {
    const bonuses = members.filter((e) => e.value > 0);
    const penalties = members.filter((e) => e.value < 0);
    if (bonuses.length) retained.push(bonuses.reduce((a, b) => (b.value > a.value ? b : a)));
    if (penalties.length) retained.push(penalties.reduce((a, b) => (b.value < a.value ? b : a)));
  }
  return retained;
}

/** BASE + contributions volatiles retenues (`volatileCharEntries`) des effets actifs que `retenu` garde,
 *  écartés AVANT les pools de non-cumul. */
function charRetenue(c: Combatant, key: CharKey, retenu?: (e: ActiveEffect) => boolean): number {
  // Mutations de Corruption (LDB 19) : modifs PERMANENTES de la caractéristique (« +5 Force », « -10
  // Sociabilité »…) — s'ajoutent à la BASE via le collecteur passif unifié (kind `intrinseque`, sommé).
  const base = c.characteristics[key] + passiveCharSum(c, key);
  return volatileCharEntries(c, key, retenu).reduce((s, e) => s + e.value, base);
}

/** Valeur effective d'une Caractéristique : tous les effets actifs (`charRetenue`). */
export function effectiveChar(c: Combatant, key: CharKey): number {
  return charRetenue(c, key);
}

/** Caractéristique qui entre dans le recalcul des Blessures max : sans les effets `blessuresAuTotal` (#3060). */
function charDesBlessures(c: Combatant, key: CharKey): number {
  return charRetenue(c, key, (e) => !e.blessuresAuTotal);
}

/** Lignes ÉTIQUETÉES des contributions volatiles retenues (issue #202 — affichage dans la modale
 *  d'attaque). `famille: 'jet'` : hors table des Difficultés de Combat (`LDB 14 l.48`) — ces valeurs
 *  vivent dans `effectiveChar`, aucun plafond de combinaison. */
export function volatileCharLines(c: Combatant, key: CharKey): ModLine[] {
  return volatileCharEntries(c, key).map((e) => ({ label: e.label, value: e.value, famille: 'jet', ref: e.ref }));
}

/**
 * Points d'Armure EFFECTIFS à une localisation : armure portée/naturelle (`c.armour`,
 * mutations comprises via recomputeLoadout) + PA TEMPORISÉS des effets magiques actifs
 * (Armure Aethyrique « +1 PA à toutes les Localisations » — additifs, LDB 47).
 */
export function effectiveArmourAt(c: Combatant, location: keyof Combatant['armour']): number {
  let ap = c.armour[location] ?? 0;
  for (const e of c.activeEffects ?? []) ap += (e.apAll ?? 0) + (e.apAt?.[location] ?? 0);
  // Plancher 0 du TOTAL : un `apAll`/`apAt` NÉGATIF (op `ap` de retrait — VDM 05) érode l'armure portée
  // sans jamais la rendre négative. SEUL point de clamp de la chaîne de PA.
  return Math.max(0, ap);
}

/** Points de Blessure d'un profil (`woundsForSize`) : LDB 05 l.365, LDB 85 l.393-401 ; `traits` : LDB 85 l.142
 *  (Fabriqué), LDB 85 l.130 (Endurant). */
export function maxWounds(chars: Characteristics, size: SizeCategory = 'moyenne', traits?: TraitList): number {
  const be = bonus(chars.endurance);
  const bfm = traitCapability(traits, 'woundsUseForce') ? bonus(chars.force) : bonus(chars['force-mentale']);
  return woundsForSize(bonus(chars.force), be, bfm, size, traitCapability(traits, 'bonusWoundsBE') ? be : 0);
}

/** Parts du maximum des Blessures (LDB 05 l.1001, LDB 10 l.384, LDB 48 l.23, LDB 71 l.20, LDB 85 l.253) :
 *  `derive` (`maxWounds` sur `charDesBlessures`, à `tailleCourante`), `facteur` (`isSwarm`), `plats`
 *  (`attrMod{wounds}` de `passiveMods` et des effets actifs). */
function partsDesBlessures(c: Combatant): { derive: number; facteur: number; plats: number } {
  const lire = (k: CharKey): number => charDesBlessures(c, k);
  const profil = { ...c.characteristics, force: lire('force'), endurance: lire('endurance'), 'force-mentale': lire('force-mentale') };
  const effets = (c.activeEffects ?? []).reduce((s, e) => s + (e.attrMods?.wounds ?? 0), 0);
  return {
    derive: maxWounds(profil, tailleCourante(c), c.traits),
    facteur: isSwarm(c.traits) ? 5 : 1,
    plats: sommeAttrMods(passiveMods(c), 'wounds', lire) + effets,
  };
}

/** Maximum des Blessures (#1463) : `(derive + wounds.ecart) × facteur + plats` (`partsDesBlessures`). */
export function effectiveMaxWounds(c: Combatant): number {
  const { derive, facteur, plats } = partsDesBlessures(c);
  return (derive + c.wounds.ecart) * facteur + plats;
}

/**
 * Réconciliation des Blessures (LDB 05 l.1001, LDB 48 l.23) : `wounds.max` recalé sur `effectiveMaxWounds`.
 * Les Points perdus se conservent, plancher 0 (LDB 48 l.27) : la part perdue sous 0 par une baisse du
 * maximum reste dans `perduesSousZero` tant que le courant est 0, et s'éteint dès qu'il remonte au-dessus.
 * PURE et IDEMPOTENTE : rend l'objet `wounds` reçu quand rien ne bouge.
 * Coutures : fin d'`applyOps`, `applyActiveEffect`, `removeActiveEffects`, spawn d'un porteur né mutant
 * (`noyau/monde/spawn.ts`), et toute écriture de l'état (`noyau/transitionDuJeu.ts`).
 */
export function blessuresReconciliees(c: Combatant): Combatant['wounds'] {
  const w = c.wounds;
  const max = effectiveMaxWounds(c);
  const sousZero = w.current > 0 ? 0 : w.perduesSousZero ?? 0;
  if (Object.is(max, w.max) && sousZero === (w.perduesSousZero ?? 0)) return w;
  const perdues = w.max - w.current + sousZero;
  return pose(max, Math.max(0, max - perdues), w.ecart, Math.max(0, perdues - max));
}

/** Blessures d'un porteur NÉ, son profil en main : au maximum dérivé (`ecart` 0), ou à `maximum` imprimé
 *  (B explicite d'un statbloc, coque, Puissance), l'écart posé dans l'unité de `derive` (`partsDesBlessures`). */
export function blessuresPosees(c: Omit<Combatant, 'wounds'>, maximum?: number, restantes?: number): Combatant['wounds'] {
  const { derive, facteur, plats } = partsDesBlessures({ ...c, wounds: pose(0, 0, 0, 0) });
  const max = maximum ?? derive * facteur + plats;
  return pose(max, restantes ?? max, (max - plats) / facteur - derive, 0);
}

const pose = (max: number, current: number, ecart: number, perduesSousZero: number): Combatant['wounds'] =>
  ({ current, max: maximumDe(max), ecart, ...(perduesSousZero ? { perduesSousZero } : {}) });

const maximumDe = (n: number): MaximumDesBlessures =>
  // eslint-disable-next-line murs/marques -- #1463 : l'unique cast de ce module — forger la marque EST le corps de métier de `blessuresPosees` et `blessuresReconciliees`.
  n as MaximumDesBlessures;
