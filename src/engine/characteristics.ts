/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics, Combatant, effectRef } from './types';
import type { CodexTarget } from './ruleRefs';
import { traumaCharPenaltiesLabeled, passiveCharSum } from './trauma';
import { traitCharMods, traitCapability } from './traits/dispatch';
import { SizeCategory, woundsForSize, effectiveSize } from './size';
import { findTalentById } from '../data';
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

/** Pool des contributions VOLATILES étiquetées à une Caractéristique (effets actifs + pénalités passives
 *  non-cumul) — source UNIQUE pour `effectiveChar` (Σ meilleur bonus + pire pénalité) et `volatileCharLines`
 *  (affichage, issue #202). Sépare la BASE (permanente : `characteristics` + `passiveCharSum`) du pool. */
function volatileCharEntries(c: Combatant, key: CharKey): { label: string; value: number; ref?: CodexTarget }[] {
  // Effet actif : son `label` propre + son renvoi (`effectRef`) — MÊME règle que les passifs (#1153).
  const entries = (c.activeEffects ?? []).filter((e) => e.char === key).map((e) => ({ label: e.label, value: e.bonus, famille: 'jet' as const, ref: effectRef(e) }));
  entries.push(...traumaCharPenaltiesLabeled(c, key).map((p) => ({ label: p.label, value: p.mod, famille: 'jet' as const, ref: p.ref })));
  return entries;
}

/**
 * Valeur effective d'une Caractéristique, modifiée par les effets magiques
 * actifs. Les bonus/pénalités ne se cumulent pas : seuls le MEILLEUR bonus et la
 * PIRE pénalité s'appliquent, et tous deux sont sommés (Livre de base l.168 /
 * p.220). Ex. +20, +10 et -10 sur la même Caractéristique → +20 - 10 = +10 net.
 */
export function effectiveChar(c: Combatant, key: CharKey): number {
  let base = c.characteristics[key];
  // Mutations de Corruption (LDB 19) : modifs PERMANENTES de la caractéristique (« +5 Force », « -10
  // Sociabilité »…) — s'ajoutent à la BASE (hors pool non-cumul : un corps transformé n'est pas un bonus
  // magique), via le collecteur passif unifié (kind `intrinseque`, sommé).
  base += passiveCharSum(c, key);
  // Pénalités PASSIVES non-cumul (pool « pire pénalité », LDB 16 l.13) du collecteur unifié : traumatisme
  // (LDB 18), maladie (LDB 20 : fièvre −10 Physique/Social) et faim (LDB 18 l.342 : −10 F/E puis −10 ailleurs)
  // — toutes en charMod non-`intrinseque`, gating (Détermination…) déjà appliqué par le collecteur.
  const mods = volatileCharEntries(c, key).map((e) => e.value);
  if (mods.length === 0) return base;
  const bestBonus = Math.max(0, ...mods.filter((m) => m > 0));
  const worstPenalty = Math.min(0, ...mods.filter((m) => m < 0));
  return base + bestBonus + worstPenalty;
}

/** Lignes ÉTIQUETÉES (≤2) du MEILLEUR bonus et de la PIRE pénalité volatiles gagnants du pool non-cumul
 *  (issue #202 — affichage dans la modale d'attaque). `famille: 'jet'` : hors table des Difficultés de
 *  Combat (`LDB 14 l.48`) — ces valeurs vivent dans `effectiveChar`, aucun plafond de combinaison. */
export function volatileCharLines(c: Combatant, key: CharKey): ModLine[] {
  const entries = volatileCharEntries(c, key);
  const bonuses = entries.filter((e) => e.value > 0);
  const penalties = entries.filter((e) => e.value < 0);
  const lines: ModLine[] = [];
  if (bonuses.length) {
    const best = bonuses.reduce((a, b) => (b.value > a.value ? b : a));
    lines.push({ label: best.label, value: best.value, famille: 'jet', ref: best.ref });
  }
  if (penalties.length) {
    const worst = penalties.reduce((a, b) => (b.value < a.value ? b : a));
    lines.push({ label: worst.label, value: worst.value, famille: 'jet', ref: worst.ref });
  }
  return lines;
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
 */
export function effectiveMaxWounds(c: Combatant): number {
  const size = effectiveSize(c.size);
  const base = c.wounds.base ?? c.wounds.max;
  // Fabriqué (LDB 85 l.142) : Bonus de Force au lieu du Bonus de Force Mentale, sur `eff` ET `raw` (le
  // delta doit rester cohérent avec la SUBSTITUTION, pas juste sa valeur BF/BFM de base).
  const woundsUseForce = traitCapability(c.traits, 'woundsUseForce');
  const effBFM = woundsUseForce ? bonus(effectiveChar(c, 'force')) : bonus(effectiveChar(c, 'force-mentale'));
  const eff = woundsForSize(bonus(effectiveChar(c, 'force')), bonus(effectiveChar(c, 'endurance')), effBFM, size);
  // Référence = base au spawn : characteristics + liveTraitCharMods (créatures) + talentCharMods (héros).
  // Les mutations viennent APRÈS la création → elles restent dans le delta pour affecter effectiveMaxWounds.
  const rawF = c.characteristics.force + (traitCharMods(c.liveTraits).force ?? 0) + talentCharModSum(c, 'force');
  const rawE = c.characteristics.endurance + (traitCharMods(c.liveTraits).endurance ?? 0) + talentCharModSum(c, 'endurance');
  const rawFM = c.characteristics['force-mentale'] + (traitCharMods(c.liveTraits)['force-mentale'] ?? 0) + talentCharModSum(c, 'force-mentale');
  const raw = woundsForSize(bonus(rawF), bonus(rawE), woundsUseForce ? bonus(rawF) : bonus(rawFM), size);
  // Modif. de Blessures PLATS d'effets actifs (op `attrMod{wounds}` exécutée — Bonnet de fou « +4
  // Blessures », LDB 71 l.20) : sommés au delta, repris/rendus par `refreshWounds` (pose + expiration).
  const flat = (c.activeEffects ?? []).reduce((s, e) => s + (e.attrMods?.wounds ?? 0), 0);
  // Nuée : LDB 85 l.253.
  const parCreatureType = c.swarm ? 5 : 1;
  return base + (eff - raw) * parCreatureType + flat;
}

/**
 * Recale `wounds.max` sur `effectiveMaxWounds` et ajuste `wounds.current` du même delta : on GAGNE des
 * Points de Blessure quand un buff F/E/FM monte le max, on en PERD à l'expiration (clamp ≥ 0). Appelé
 * à chaque changement d'`activeEffects` (application d'un buff, dissipation en fin de Round). Idempotent.
 */
export function refreshWounds(c: Combatant): void {
  const newMax = effectiveMaxWounds(c);
  const delta = newMax - c.wounds.max;
  if (delta === 0) return;
  c.wounds.max = newMax;
  if (delta > 0) c.wounds.current += delta;
  else c.wounds.current = Math.max(0, c.wounds.current + delta);
}
