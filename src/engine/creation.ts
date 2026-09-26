/**
 * Tables & bonus de la création de personnage — LDB chapitres 04/05 « Personnage ».
 *
 *  - Races aléatoires (LDB 04 l.93-101) : d100 → 01-90 Humain, 91-94 Halfling, 95-98 Nain,
 *    99 Haut elfe, 00 Elfe sylvain ; +20 PX si le PREMIER tirage est accepté.
 *  - Classes et Carrières aléatoires (LDB 05 l.208-212) : 1er jet accepté = +50 PX ; sinon
 *    2 jets de plus et choix parmi les 3 = +25 PX ; sinon choix libre / relances = 0 PX.
 *  - Caractéristiques (LDB 05 l.337-341) : tirage 2d10 gardé = +50 PX ; réassignation des dix
 *    jets = +25 PX ; relance ou répartition de 100 Points (min 4, max 18 par Caractéristique,
 *    + bonus d'espèce) = 0 PX.
 *  - Richesse initiale (LDB 05 l.578-583) : Bronze 2d10 sous × Standing ; Argent 1d10 pistoles
 *    × Standing ; Or 1 couronne d'or × Standing.
 *  - Détails (LDB 05 l.691-744) : âge Humain 15+1d10, Nain 15+10d10, Halfling 15+5d10,
 *    Elfe 30+10d10 ; taille Humain 145+5d10 cm, Nain 130+3d10, Halfling 90+2d10,
 *    Elfe 180+2d10 ; yeux/cheveux : 2d10 sur les tables (eyes.json / hairs.json).
 */
import { RNG, defaultRNG, roll } from './dice';
import { findTableEntry } from './tables';
import { CharKey, CHAR_KEYS, Characteristics, Combatant } from './types';
import { Money } from './money';
import { SpeciesData, CareerData, species as allSpecies, eyes as eyesTable, hairs as hairsTable, details as detailTables, stars as starsTable, findStarById, advancementLabel, spells as allSpells } from '../data';
import type { RaceKey } from '../data/schemas/grammaire/valeurs';
import { rule } from './policy';
import { bonus } from './characteristics';
import { baseWithTalents } from './talentEffects';
import { castingKindOf } from './combatFeatures/dispatch';

// Bonus de PX des choix aléatoires acceptés (citations en tête de fichier).
export const XP_SPECIES_ACCEPTED = 20; // LDB 04 l.91
export const XP_CAREER_FIRST = 50; // LDB 05 l.210
export const XP_CAREER_TOP3 = 25; // LDB 05 l.211
export const XP_CHARS_KEPT = 50; // LDB 05 l.337
export const XP_CHARS_REASSIGNED = 25; // LDB 05 l.339
export const XP_STAR_ROLLED = 25; // ADE II 3 l.36 (signe astral tiré et accepté)

/**
 * Espèce OUVERTE au joueur : une espèce peut déclarer `gatedByRule` (id d'`OptionalRule`) — elle
 * n'est proposée qu'avec cette règle active. SOURCE UNIQUE du filtre (tirage ET grille du créateur).
 * Porté par `gnomes` (`NADJ 14 l.5`) ; une espèce sans le champ est ouverte, quel que soit
 * son livre.
 */
export function speciesAllowed(s: SpeciesData): boolean {
  return !s.gatedByRule || !!rule(s.gatedByRule);
}

/**
 * Tableau des Races aléatoires (LDB 04 l.93-101) — DÉRIVÉ des données : chaque espèce porte sa
 * borne haute d100 (`SpeciesData.rand`, suppléments inclus). Plusieurs espèces partagent une
 * même borne (variantes régionales d'ADE, Gnome/Ogre…) : c'est VOULU par le RAW. Un jet désigne
 * une BORNE, et le joueur CHOISIT librement parmi toutes les espèces de cette borne en conservant
 * le bonus de PX (l'acceptation récompense d'avoir accepté le TIRAGE, pas une option imposée).
 * On renvoie donc, pour chaque borne, TOUTES les espèces éligibles — sans priorité codée.
 */
export function randomSpeciesTable(): { max: number; ids: string[] }[] {
  const byBound = new Map<number, string[]>();
  for (const s of allSpecies) {
    if (typeof s.rand !== 'number') continue;
    // Espèce gatée par une règle inactive : hors du tableau. Quand elle est active, l'espèce est une
    // option NORMALE de sa borne (Gnome : 98, partagée avec l'Ogre ADE II), sans priorité.
    if (!speciesAllowed(s)) continue;
    byBound.set(s.rand, [...(byBound.get(s.rand) ?? []), s.id]);
  }
  return [...byBound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([max, ids]) => ({ max, ids }));
}

export function rollSpecies(rng: RNG = defaultRNG): { roll: number; ids: string[] } {
  const table = randomSpeciesTable();
  const r = roll(1, 100, rng);
  const entry = table.find((e) => r <= e.max) ?? table[table.length - 1];
  return { roll: r, ids: entry.ids };
}

/**
 * Tire une Carrière sur le Tableau des Classes et Carrières aléatoires (LDB 05 l.197+), colonne
 * de l'espèce (`refCareer`). Les bornes des données sont les bornes HAUTES par carrière. Comme
 * pour les espèces, plusieurs carrières peuvent partager une borne : un jet désigne la borne et
 * le joueur CHOISIT librement parmi toutes ses carrières (le bonus de PX récompense le tirage).
 */
export function rollCareer(careers: CareerData[], sp: SpeciesData, rng: RNG = defaultRNG): { roll: number; ids: string[] } | null {
  const col = sp.refCareer;
  const table = careers
    .filter((c) => c.rand?.[col] != null)
    .sort((a, b) => (a.rand[col] as number) - (b.rand[col] as number));
  if (!table.length) return null;
  const r = roll(1, 100, rng);
  const max = (table.find((c) => r <= (c.rand[col] as number)) ?? table[table.length - 1]).rand[col] as number;
  const ids = table.filter((c) => (c.rand[col] as number) === max).map((c) => c.id);
  return { roll: r, ids };
}

/** Répartition manuelle (LDB 05 l.341) : 100 Points, min 4 / max 18 par Caractéristique. */
export const POINT_BUY_TOTAL = 100;
export const POINT_BUY_MIN = 4;
export const POINT_BUY_MAX = 18;

export function validatePointBuy(alloc: Record<CharKey, number>): { ok: boolean; reason?: string } {
  for (const k of CHAR_KEYS) {
    const v = alloc[k];
    if (v == null || !Number.isInteger(v)) return { ok: false, reason: `${k} : valeur manquante` };
    if (v < POINT_BUY_MIN) return { ok: false, reason: `${k} : minimum ${POINT_BUY_MIN} Points` };
    if (v > POINT_BUY_MAX) return { ok: false, reason: `${k} : maximum ${POINT_BUY_MAX} Points` };
  }
  const total = CHAR_KEYS.reduce((a, k) => a + alloc[k], 0);
  if (total !== POINT_BUY_TOTAL) return { ok: false, reason: `total ${total}/${POINT_BUY_TOTAL} Points` };
  return { ok: true };
}

export interface Status {
  tier: 'Bronze' | 'Argent' | 'Or';
  standing: number;
}

/** Parse « Bronze 2 » / « Or 5 » — tolère la typo de données « Agent 1 » (= Argent). */
export function parseStatus(s: string): Status {
  const m = s.trim().match(/^(\S+)\s+(\d+)$/);
  const raw = (m?.[1] ?? s).toLowerCase();
  const standing = m ? parseInt(m[2], 10) : 0;
  const tier: Status['tier'] = raw.startsWith('or') ? 'Or' : raw.startsWith('bron') ? 'Bronze' : 'Argent';
  return { tier, standing };
}

/** Richesse initiale (LDB 05 l.578) : Bronze 2d10 sc × Standing ; Argent 1d10 pa ×
 *  Standing ; Or 1 CO × Standing. Standing 0 (ex. Mendiant « Bronze 0 ») → rien. */
export function rollInitialWealth(status: Status, rng: RNG = defaultRNG): Money {
  const m: Money = { gold: 0, silver: 0, brass: 0 };
  if (status.standing <= 0) return m;
  if (status.tier === 'Bronze') m.brass = roll(2 * status.standing, 10, rng);
  else if (status.tier === 'Argent') m.silver = roll(status.standing, 10, rng);
  else m.gold = status.standing;
  return m;
}

/** Formule « base + N d10 » des tables de détails (details.json), colonne `refChar` (id `RaceKey`,
 *  #313) de l'espèce (repli : colonne humain). N non entier dans les données (Gnome 2,5) → arrondi
 *  au plus près. */
function rollDetailFormula(base: Partial<Record<RaceKey, number>>, dice: Partial<Record<RaceKey, number>>, sp: SpeciesData, rng: RNG): number {
  const b = base[sp.refChar] ?? base.humain ?? 0;
  const n = Math.round(dice[sp.refChar] ?? dice.humain ?? 1);
  return b + (n > 0 ? roll(n, 10, rng) : 0);
}

/** Âge (LDB 05 l.705-711, table par espèce — ex. Humain 15+1d10, Nain 15+10d10). */
export function rollAge(sp: SpeciesData, rng: RNG = defaultRNG): number {
  return rollDetailFormula(detailTables.ageBase, detailTables.ageRoll, sp, rng);
}

/** Taille en cm (LDB 05 l.707 — ex. Humain 145+5d10, Halfling 90+2d10).
 *  (Le dé bonus humain sur un 10 — l.705 — n'est pas simulé.) */
export function rollHeight(sp: SpeciesData, rng: RNG = defaultRNG): number {
  return rollDetailFormula(detailTables.heightBase, detailTables.heightRoll, sp, rng);
}

/** Couleur des yeux (2d10, table LDB 05 l.742-754) pour la colonne d'espèce (refChar). */
export function rollEyes(sp: SpeciesData, rng: RNG = defaultRNG): string {
  return rollDetail(eyesTable, sp, rng);
}

/** Couleur des cheveux (2d10, table LDB 05 l.756-768). */
export function rollHair(sp: SpeciesData, rng: RNG = defaultRNG): string {
  return rollDetail(hairsTable, sp, rng);
}

function rollDetail(
  table: { rand: number; randByRace?: Partial<Record<RaceKey, number>>; color: Partial<Record<RaceKey, string>> }[],
  sp: SpeciesData,
  rng: RNG,
): string {
  const r = roll(2, 10, rng);
  const randFor = (e: { rand: number; randByRace?: Partial<Record<RaceKey, number>> }) => e.randByRace?.[sp.refChar] ?? e.rand;
  const sorted = [...table].sort((a, b) => randFor(a) - randFor(b));
  const entry = sorted.find((e) => r <= randFor(e)) ?? sorted[sorted.length - 1];
  return entry.color[sp.refChar] ?? entry.color.humain ?? '';
}

/** Signe astral (Tableau des Signes astrologiques, ADE II 3 l.40) → `id` STABLE du signe (≠ libellé —
 *  multilangue-safe ; `Combatant.star` stocke l'id). `rand` = borne haute cumulée du 1d100. L'Étoile du
 *  Sorcier (l.62) regroupe plusieurs variantes sur la même borne, départagées par un 1d10 interne
 *  (`sub` = la fourchette de la variante) → table partagée, lue telle quelle par `findTableEntry`. */
export function rollStar(rng: RNG = defaultRNG): { roll: number; id: string } {
  const sorted = [...starsTable].sort((a, b) => a.rand - b.rand);
  const r = roll(1, 100, rng);
  const hit = sorted.find((e) => r <= e.rand) ?? sorted[0];
  const variants = sorted.flatMap((e) => (e.rand === hit.rand && e.sub ? [{ ...e.sub, id: e.id }] : []));
  if (variants.length > 1) return { roll: r, id: findTableEntry(variants, roll(1, 10, rng)).id };
  return { roll: r, id: hit.id };
}

/** Applique les `ops` ADE II d'un signe astral AUX ATTRIBUTS DE DÉPART (ch.03 l.38) : `charMod` ajuste
 *  une Caractéristique de départ, `grantTalent` octroie un Talent via `addTalent` (le résolveur de la
 *  création). Le signe est résolu par son `id` STABLE (`findStarById` — ≠ libellé). Le Talent est passé
 *  en LIBELLÉ (`advancementLabel` : « Maître artisan (Au choix) » pour un `choix`) que le consommateur
 *  re-résout (#1924). Effet baked une fois à la création — PAS un passif. */
export function applyStarOps(starId: string, chars: Characteristics, addTalent: (label: string) => void): void {
  for (const op of findStarById(starId)?.ops ?? []) {
    if (op.op === 'charMod') chars[op.char] += op.mod;
    else if (op.op === 'grantTalent') addTalent(advancementLabel('talents', op.talent));
  }
}

/** Quota de Sorts de Magie mineure INCLUS AU TALENT (LDB 10 l.714 : « vous mémorisez… un nombre de
 *  Sorts égal à votre Bonus de Force Mentale ») — 0 sans un Talent de `castingKind:'mineure'`
 *  (Magie mineure/Béni…) parmi ceux du héros. Le BFM passe par `baseWithTalents` (source unique des
 *  +5 de Talent), jamais une relecture manuelle des Caractéristiques brutes. Fonction PURE partagée
 *  par `createHero`-adjacent (`src/data/pregens.ts`) ET le créateur joueur (`src/ui/creator/draft.ts`). */
export function pettySpellQuotaFor(hero: Combatant): number {
  if (!(hero.talents ?? []).some((t) => castingKindOf(t.talentId) === 'mineure')) return 0;
  return bonus(baseWithTalents(hero, 'force-mentale'));
}

/** Complète une liste de Sorts de Magie mineure AUTHORÉS (ids) jusqu'au `quota` (LDB 10 l.714) —
 *  les ids authorés sont GARDÉS tels quels (identité), seul un manque est comblé par d'autres sorts
 *  de la famille `mineure` du catalogue, jamais un remplacement. `quota` nul renvoie `authoredIds`
 *  inchangé (aucun Talent de Magie mineure). */
export function fillPettySpellsToQuota(authoredIds: string[], quota: number): string[] {
  if (!quota || authoredIds.length >= quota) return authoredIds;
  const minorIds = allSpells.filter((s) => s.family === 'mineure').map((s) => s.id);
  const topUp = minorIds.filter((id) => !authoredIds.includes(id)).slice(0, quota - authoredIds.length);
  return [...authoredIds, ...topUp];
}
