/**
 * Tables & bonus de la création de personnage — LDB chapitres 04/05 « Personnage ».
 *
 *  - Races aléatoires (LDB 04 l.91-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121) : au dé de la table de
 *    `especes-aleatoires.json` qui s'applique ; +20 PX si le PREMIER tirage est accepté.
 *  - Classes et Carrières aléatoires (LDB 05 l.208-212) : 1er jet accepté = +50 PX ; sinon
 *    2 jets de plus et choix parmi les 3 = +25 PX ; sinon choix libre / relances = 0 PX.
 *  - Caractéristiques (LDB 05 l.337-341) : tirage 2d10 gardé = +50 PX ; réassignation des dix
 *    jets = +25 PX ; relance ou répartition de 100 Points (min 4, max 18 par Caractéristique,
 *    + bonus d'espèce) = 0 PX.
 *  - Richesse initiale (LDB 05 l.578-583) : Bronze 2d10 sous × Standing ; Argent 1d10 pistoles
 *    × Standing ; Or 1 couronne d'or × Standing.
 *  - Détails (LDB 05 l.701-768) : âge Humain 15+1d10, Nain 15+10d10, Halfling 15+5d10,
 *    Elfe 30+10d10 ; taille Humain 145+5d10 cm, Nain 130+3d10, Halfling 90+2d10,
 *    Elfe 180+2d10 ; yeux/cheveux : au dé de leur table (eyes.json / hairs.json).
 */
import { RNG, roll, rollDice } from './dice';
import { deDeLaTableTiree, findTableEntry, type DeDeTable } from './tables';
import { CharKey, CHAR_KEYS, Characteristics, Combatant } from './types';
import { Money, gainDeStatut, enPieces, type Status } from './money';
import { SpeciesData, findSpeciesById, tableDesRacesAleatoires, tableDeCarrieres, carrieresOffertesAvec, species as allSpecies, eyes as eyesTable, hairs as hairsTable, eyesDie, hairsDie, type DetailColorData, details as detailTables, stars as starsTable, findStarById, starDie, starSubDie } from '../data';
import { idsDeLaSousListe, type RefASpecialisation } from '../data/schemas/grammaire/ref';
import type { RaceKey } from '../data/schemas/grammaire/valeurs';
import { rule } from './policy';
import { garanti } from '../lib/garanti';
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

/** Espèce OUVERTE au joueur : sans `gatedByRule`, ou sa règle optionnelle active. Lue par le tirage et la grille
 *  du créateur. NADJ 14 l.5 ; ADE II 02 l.110 */
export function speciesAllowed(s: SpeciesData): boolean {
  return !s.gatedByRule || !!rule(s.gatedByRule.id);
}

/** Une rangée du Tableau des Races aléatoires : sa fourchette, l'espèce nominale de sa race puis les autres
 *  espèces ouvertes de la même race, au choix du joueur. LDB 04 l.91 ; ADE I 02 l.257 */
export interface RangeeDeRaces { min: number; max: number; ids: string[] }

/** Le Tableau des Races aléatoires qui s'applique : la table dont les races égalent celles des espèces
 *  ouvertes (`tableDesRacesAleatoires`), et son dé. LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121 */
export function randomSpeciesTable(): { die: DeDeTable; entries: RangeeDeRaces[] } {
  const ouvertes = allSpecies.filter(speciesAllowed);
  const table = tableDesRacesAleatoires(new Set(ouvertes.map((s) => s.refChar)));
  return {
    die: deDeLaTableTiree(table),
    entries: table.entries.map(({ id, min, max }) => {
      const race = garanti(findSpeciesById(id), id, 'espèce du Tableau des Races aléatoires').refChar;
      return { min, max, ids: [id, ...ouvertes.filter((s) => s.refChar === race && s.id !== id).map((s) => s.id)] };
    }),
  };
}

export function rollSpecies(rng: RNG): { roll: number; ids: string[] } {
  const table = randomSpeciesTable();
  const r = rollDice(table.die, rng);
  return { roll: r, ids: findTableEntry(table.entries, r).ids };
}

/**
 * Tire une Carrière sur le Tableau des Classes et Carrières aléatoires (LDB 05 l.214+), colonne de
 * l'espèce (`refCareer`), avec ou sans sa portion (MDG 09 l.9) : le dé de la colonne, puis la rangée
 * atteinte. `ids` = la carrière tirée, puis celles que son tirage offre en plus (`carrieresOffertesAvec`,
 * ADE I 07 l.11 ; AA 02 l.109-111), parmi lesquelles le joueur CHOISIT.
 */
export function rollCareer(sp: SpeciesData, avecPortion: boolean, rng: RNG): { roll: number; ids: string[] } {
  const table = tableDeCarrieres(sp.refCareer, avecPortion);
  const r = rollDice(table.die, rng);
  const tiree = findTableEntry(table.entries, r).id;
  return { roll: r, ids: [tiree, ...carrieresOffertesAvec(tiree, sp)] };
}

/** Répartition manuelle (LDB 05 l.341) : 100 Points, min 4 / max 18 par Caractéristique. */
export const POINT_BUY_TOTAL = 100;
export const POINT_BUY_MIN = 4;
export const POINT_BUY_MAX = 18;

export function validatePointBuy(alloc: Record<CharKey, number>): { ok: true } | { ok: false; reason: string } {
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

/** Un tirage de richesse : la face de chaque dé, et le montant qu'elles font. */
export interface TirageDeRichesse { faces: number[]; montant: Money }

/** Richesse initiale : la grille de `gainDeStatut`, en pièces de son Échelon. LDB 05 l.576-578 */
export function rollInitialWealth(status: Status, rng: RNG): TirageDeRichesse {
  const { de, unite } = gainDeStatut(status.tier, status.standing);
  const faces = Array.from({ length: de.n }, () => roll(1, de.sides, rng));
  return { faces, montant: enPieces(unite, faces.reduce((a, f) => a + f, de.plus ?? 0)) };
}

/** Âge, colonne de la race `race`. LDB 05 l.711 ; NADJ 15 l.80 ; ADE II 02 l.278 */
export function rollAge(race: RaceKey, rng: RNG): number {
  return rollDice(detailTables.age[race], rng);
}

/** Taille en cm, colonne de la race `race`. LDB 05 l.724, l.728 ; NADJ 15 l.112 ; ADE II 02 l.315 */
export function rollHeight(race: RaceKey, rng: RNG): number {
  return rollDice(detailTables.taille[race], rng);
}

/** Couleur des yeux, colonne de la race `race`. LDB 05 l.742-754 */
export function rollEyes(race: RaceKey, rng: RNG): string {
  return rollDetail(eyesTable, rollDice(eyesDie(), rng), race);
}

/** Couleur des cheveux, colonne de la race `race`. LDB 05 l.756-768 */
export function rollHair(race: RaceKey, rng: RNG): string {
  return rollDetail(hairsTable, rollDice(hairsDie(), rng), race);
}

/** Âge, taille, yeux et cheveux de la race `race`, tirés dans cet ordre sur `rng`. LDB 05 l.701-768 */
export function tirerLesDetails(race: RaceKey, rng: RNG): { age: number; height: number; eyes: string; hair: string } {
  return { age: rollAge(race, rng), height: rollHeight(race, rng), eyes: rollEyes(race, rng), hair: rollHair(race, rng) };
}

/** La couleur de la colonne `race` atteinte par le jet `r` : première rangée dont la borne haute cumulée
 *  (`randByRace` de la colonne, sinon `rand`) couvre `r`. */
function rollDetail(table: DetailColorData[], r: number, race: RaceKey): string {
  const randFor = (e: DetailColorData) => e.randByRace?.[race] ?? e.rand;
  const sorted = [...table].sort((a, b) => randFor(a) - randFor(b));
  const entry = sorted.find((e) => r <= randFor(e)) ?? sorted[sorted.length - 1];
  return entry.color[race] ?? entry.color.humain ?? '';
}

/** Signe astral (Tableau des Signes astrologiques, ADE II 3 l.40) → `id` STABLE du signe (≠ libellé —
 *  multilangue-safe ; `Combatant.star` stocke l'id). `rand` = borne haute cumulée du dé de la table
 *  (`starDie`). L'Étoile du Sorcier (l.62) regroupe plusieurs variantes sur la même borne, départagées
 *  par le dé du sous-tirage (`starSubDie` ; `sub` = la fourchette de la variante) → table partagée, lue
 *  telle quelle par `findTableEntry`. */
export function rollStar(rng: RNG): { roll: number; id: string } {
  const sorted = [...starsTable].sort((a, b) => a.rand - b.rand);
  const r = rollDice(starDie(), rng);
  const hit = sorted.find((e) => r <= e.rand) ?? sorted[0];
  const variants = sorted.flatMap((e) => (e.rand === hit.rand && e.sub ? [{ ...e.sub, id: e.id }] : []));
  if (variants.length > 1) return { roll: r, id: findTableEntry(variants, rollDice(starSubDie(), rng)).id };
  return { roll: r, id: hit.id };
}

/** Applique les `ops` ADE II d'un signe astral AUX ATTRIBUTS DE DÉPART (ch.03 l.38) : `charMod` ajuste
 *  une Caractéristique de départ, `grantTalent` octroie son emplacement de Talent (`talent`, un `choix`
 *  pour une spécialisation « Au choix ») via `addTalent`, avec le rang `k` de l'op dans le signe
 *  (l'adresse de son emplacement). Effet baked une fois à la création — PAS un passif. */
export function applyStarOps(starId: string, chars: Characteristics, addTalent: (ref: RefASpecialisation, k: number) => void): void {
  (findStarById(starId)?.ops ?? []).forEach((op, k) => {
    if (op.op === 'charMod') chars[op.characteristic] += op.mod;
    else if (op.op === 'grantTalent') addTalent(op.talent, k);
  });
}

/** Quota de Sorts de Magie mineure INCLUS AU TALENT (LDB 10 l.714 : « vous mémorisez… un nombre de
 *  Sorts égal à votre Bonus de Force Mentale ») — 0 sans un Talent de `castingKind:'mineure'`
 *  (Magie mineure/Béni…) parmi ceux du héros. Le BFM passe par `baseWithTalents` (source unique des
 *  +5 de Talent), jamais une relecture manuelle des Caractéristiques brutes. Fonction PURE partagée
 *  par `createHero`, les sorts d'un PNJ (`sortsDuPnj`) et le créateur joueur (`src/noyau/creation/brouillon.ts`). */
export function pettySpellQuotaFor(hero: Combatant): number {
  if (!(hero.talents ?? []).some((t) => castingKindOf(t.talentId) === 'mineure')) return 0;
  return bonus(baseWithTalents(hero, 'force-mentale'));
}

/** Complète une liste de Sorts de Magie mineure AUTHORÉS (ids) jusqu'au `quota` (LDB 10 l.714) —
 *  les ids authorés sont GARDÉS tels quels (identité), seul un manque est comblé par d'autres sorts
 *  de la sous-liste `mineure` (`idDe('spell', 'mineure')`, `idsDeLaSousListe`), jamais un remplacement. `quota` nul renvoie `authoredIds`
 *  inchangé (aucun Talent de Magie mineure). */
export function fillPettySpellsToQuota(authoredIds: string[], quota: number): string[] {
  if (!quota || authoredIds.length >= quota) return authoredIds;
  const minorIds = idsDeLaSousListe('spell', 'mineure');
  const topUp = minorIds.filter((id) => !authoredIds.includes(id)).slice(0, quota - authoredIds.length);
  return [...authoredIds, ...topUp];
}
