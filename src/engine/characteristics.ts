/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics, Combatant, effectRef, type ActiveEffect, type MaximumDesBlessures } from './types';
import { isPrayerFamily } from './combatFeatures/types';
import type { CodexTarget } from './ruleRefs';
import { traumaCharPenaltiesLabeled, passiveCharSum, passiveMods, sommeAttrMods } from './trauma';
import { traitCharMods, traitCapability } from './traits/dispatch';
import { SizeCategory, woundsForSize, effectiveSize } from './size';
import { findTalentById, findSpellById } from '../data';
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

/**
 * Points de Blessure de départ.
 *
 * Livre de base, Tableau des Attributs : « Points de Blessure = BF+(2×BE)+BFM »
 * (et « (2×BE)+BFM » pour les Halflings, qui ont le talent Petit).
 *
 * `traits` : Fabriqué (LDB 85 l.142) substitue le Bonus de Force au Bonus de Force Mentale dans ce calcul.
 */
export function maxWounds(chars: Characteristics, size: SizeCategory = 'moyenne', traits?: TraitList): number {
  const bfm = traitCapability(traits, 'woundsUseForce') ? bonus(chars.force) : bonus(chars['force-mentale']);
  return woundsForSize(bonus(chars.force), bonus(chars.endurance), bfm, size);
}

/** Σ des `charMod` passifs de TALENT (× `times`) pour la Caractéristique `key` — lecture LOCALE
 *  sans importer `talentEffects` (qui importe `characteristics` → cycle). Identique à `baseWithTalents`
 *  moins `c.characteristics[key]`. Utilisé par `effectiveMaxWounds` pour la référence de delta. */
function talentCharModSum(c: Combatant, key: CharKey): number {
  let n = 0;
  for (const t of c.talents ?? []) {
    const passive = findTalentById(t.talentId)?.passive;
    if (passive) for (const op of passive) if (op.op === 'charMod' && op.char === key) n += op.mod * (t.times ?? 1);
  }
  return n;
}

/**
 * Blessures max DYNAMIQUES (LDB 85 — exigence : les sorts modifiant F/E/FM impactent les Blessures).
 * = base (Blessures à vide, snapshot ou surcharge au spawn) + le DELTA dû aux buffs F/E/FM, multiplié
 * par la Taille (via `woundsForSize`). À vide, le delta = 0 → on rend exactement `wounds.base` (préserve
 * les valeurs livre traitées : Coriace, mort-vivant…). La base elle-même n'est jamais recalculée.
 *
 * Référence du delta = MÊME BASE que `wounds.base` : `characteristics + liveTraits + talents`, sans
 * mutations (post-création → contribuent au delta). `eff − raw` = delta VOLATILE (mutations + sorts).
 * Un effet `blessuresAuTotal` n'entre pas dans `eff` : sa source compte par son seul `attrMod` (#3060).
 */
export function effectiveMaxWounds(c: Combatant): number {
  const size = effectiveSize(c.size);
  const base = c.wounds.base ?? c.wounds.max;
  // Fabriqué (LDB 85 l.142) : Bonus de Force au lieu du Bonus de Force Mentale, sur `eff` ET `raw` (le
  // delta doit rester cohérent avec la SUBSTITUTION, pas juste sa valeur BF/BFM de base).
  const woundsUseForce = traitCapability(c.traits, 'woundsUseForce');
  const effBFM = woundsUseForce ? bonus(charDesBlessures(c, 'force')) : bonus(charDesBlessures(c, 'force-mentale'));
  const eff = woundsForSize(bonus(charDesBlessures(c, 'force')), bonus(charDesBlessures(c, 'endurance')), effBFM, size);
  // Référence = base au spawn : characteristics + liveTraitCharMods (créatures) + talentCharMods (héros).
  // Les mutations viennent APRÈS la création → elles restent dans le delta pour affecter effectiveMaxWounds.
  const rawF = c.characteristics.force + (traitCharMods(c.liveTraits).force ?? 0) + talentCharModSum(c, 'force');
  const rawE = c.characteristics.endurance + (traitCharMods(c.liveTraits).endurance ?? 0) + talentCharModSum(c, 'endurance');
  const rawFM = c.characteristics['force-mentale'] + (traitCharMods(c.liveTraits)['force-mentale'] ?? 0) + talentCharModSum(c, 'force-mentale');
  const raw = woundsForSize(bonus(rawF), bonus(rawE), woundsUseForce ? bonus(rawF) : bonus(rawFM), size);
  // Modif. de Blessures PLATS d'effets actifs (op `attrMod{wounds}` exécutée — Bonnet de fou « +4
  // Blessures », LDB 71 l.20) : sommés au delta, repris/rendus par `blessuresReconciliees` (pose + expiration).
  const flat = (c.activeEffects ?? []).reduce((s, e) => s + (e.attrMods?.wounds ?? 0), 0);
  // `attrMod{wounds}` PASSIFS des porteurs hors talents (mutation, objet, Trait, État…) : ceux des talents
  // sont dans `wounds.base` (`extraWounds`), comme leurs `charMod` dans `raw` (#3060).
  const passifs = sommeAttrMods(passiveMods(c, false), 'wounds', c);
  // Nuée : LDB 85 l.253.
  const parCreatureType = c.swarm ? 5 : 1;
  return base + (eff - raw) * parCreatureType + flat + passifs;
}

/**
 * Réconciliation des Blessures (LDB 05 l.1001, LDB 48 l.23) : `wounds.max` recalé sur `effectiveMaxWounds`,
 * `wounds.current` déplacé du même delta, plancher 0 (LDB 48 l.27). PURE : rend l'objet `wounds` reçu quand rien ne
 * bouge, sinon un neuf. Un porteur sans `base` reçoit au premier recalage le `max` qu'il portait, ce qui
 * rend la réconciliation IDEMPOTENTE. Coutures : fin d'`applyOps`, `applyActiveEffect`,
 * `removeActiveEffects`, spawn d'un porteur né mutant (`noyau/monde/spawn.ts`), et toute écriture de l'état
 * (`noyau/transitionDuJeu.ts`).
 */
export function blessuresReconciliees(c: Combatant): Combatant['wounds'] {
  const max = effectiveMaxWounds(c);
  if (Object.is(max, c.wounds.max)) return c.wounds;
  const delta = max - c.wounds.max;
  return { ...c.wounds, base: c.wounds.base ?? c.wounds.max, max: maximumDe(max), current: Math.max(0, c.wounds.current + delta) };
}

/** Les Blessures d'un porteur à vide : `base`, `current` restantes. Le maximum vaut `base` jusqu'à la
 *  couture suivante, qui y ajoute ses porteurs (`blessuresReconciliees`). */
export function blessuresDeBase(base: number, current: number = base): Combatant['wounds'] {
  return { current, max: maximumDe(base), base };
}

const maximumDe = (n: number): MaximumDesBlessures =>
  // eslint-disable-next-line murs/marques -- #1463 : l'unique cast de ce module — forger la marque EST le corps de métier de `blessuresDeBase` et `blessuresReconciliees`.
  n as MaximumDesBlessures;
