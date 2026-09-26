/**
 * Brouillon de création de personnage (état + dérivations PURES de l'assistant) — LDB 04/05.
 *
 * Tout l'aléatoire est FIGÉ par des flux RNG seedés dérivés d'un seed unique tiré à l'ouverture
 * de l'assistant : re-calculer une dérivation redonne le MÊME résultat (anti-savescum), et les
 * bonus de PX des tirages acceptés sont perdus dès qu'on dévie du chemin RAW :
 *  - Espèce (LDB 04 l.91) : d100 figé ; +20 PX si on le garde tel quel ; pas de relance.
 *  - Carrière (LDB 05 l.208-212) : 1er jet accepté = +50 PX ; sinon 2 jets de plus, choix parmi
 *    les 3 = +25 PX ; sinon choix libre / « continuez à relancer » = 0 PX (relances RAW l.195).
 *  - Caractéristiques (l.381-385) : tirage gardé = +50 ; réassignation des dix jets = +25 ;
 *    relance (RAW, 0 PX) ou répartition de 100 Points = 0.
 *  - Talents d'espèce aléatoires (l.510) : résolus par un RNG seedé fixe → re-résoudre avec
 *    d'autres choix « A ou B » ne re-tire pas les dés.
 *
 * AGENTIVITÉ (#393, amendement « ossature enforcée » 2026-07-15) : figé par le seed ≠ pré-affiché.
 * AUCUN résultat aléatoire n'existe à l'écran avant le GESTE du joueur — chaque famille de tirage
 * porte son drapeau de geste (`speciesRoll` absent, `careerRolls` vide, `charsRolled`,
 * `talentsRolled`, `wealthRoll`) ; le geste ne fait que DÉCOUVRIR un résultat déjà déterminé
 * (zéro savescum), et la validation d'étape EXIGE le geste.
 */
import { CharKey, CHAR_KEYS, Characteristics, Combatant } from '../../engine/types';
import { makeRNG } from '../../engine/dice';
import { Money } from '../../engine/money';
import {
  rollSpecies,
  rollCareer,
  validatePointBuy,
  parseStatus,
  rollInitialWealth,
  rollAge,
  rollHeight,
  rollEyes,
  rollHair,
  rollStar,
  XP_SPECIES_ACCEPTED,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
  XP_STAR_ROLLED,
  pettySpellQuotaFor,
} from '../../engine/creation';
import { rule } from '../../engine/policy';
import { createHero, resolveSpeciesTalents, RANDOM_ENTRY_RE, talentRefOfLabel } from '../../engine/character';
import { parseEntry, splitLabel, concreteLabel, isUnresolvedChoice, splitTopLevelOu, talentMaxReached, acquerirTalent, type PorteurDeTalents, wildcardSpecs, skillSlots, talentSlots, statutOuRefus } from '../../engine/careerSlots';
import { careerSkillAdditions } from '../../engine/talentEffects';
import { findSpeciesById, rigSpeciesId, findTalent, careers, levelsForCareer, findSpell, advancementLabel, findStarById, celestialHouses, SpeciesData, CareerLevelData, trappingRefLabel, type TrappingRef } from '../../data';
import { slugId } from '../../data/slug';
import type { Appearance } from '../../gameIso/rig/appearance';

export type CharMode = 'rolled' | 'reassigned' | 'pointBuy';

// ── Quotas d'allocation de la création (SOURCE UNIQUE : validation ET rendu les consomment) ──
/** « Vous pouvez sélectionner 3 Compétences auxquelles ajouter 5 Augmentations à chacune » (LDB 05 l.484). */
export const SPECIES_SKILLS_PLUS5 = 3;
/** « …et 3 Compétences auxquelles ajouter 3 Augmentations à chacune » (LDB 05 l.484). */
export const SPECIES_SKILLS_PLUS3 = 3;
/** « Répartissez 40 Points d'Augmentations entre vos huit Compétences de départ » (LDB 05 l.535). */
export const CAREER_SKILL_ADVANCES = 40;
/** « sans dépasser plus de 10 Points alloués à une seule Compétence à ce stade » (LDB 05 l.535). */
export const MAX_ADV_PER_SKILL = 10;
/** « répartir comme bon vous semble un total de 5 Augmentations entre les Caractéristiques » (LDB 05 l.459). */
export const CAREER_CHAR_ADVANCES = 5;

export interface CreatorDraft {
  /** Seed unique de l'assistant — tous les flux aléatoires en dérivent (figés). */
  seed: number;
  // 1) Espèce
  /** `id` STABLE de l'espèce (`SpeciesData.id`) — ≠ libellé. */
  speciesId: string;
  /** Tirage d'espèce figé — le d100 désigne une BORNE (LDB 04 l.93-101) ; `ids` = toutes les espèces
   *  de cette borne, parmi lesquelles le joueur choisit librement (bonus de PX conservé). Absent
   *  tant que le d100 n'a pas été lancé. */
  speciesRoll?: { roll: number; ids: string[] };
  // 2) Carrière
  /** `id` STABLE de la carrière (`CareerData.id`) — ≠ libellé. */
  careerId: string;
  ignoreRestrictions: boolean;
  /** Remplacer les Riverains par les CÔTIERS dans la table de tirage (MDG 09 l.9 : choix du joueur
   *  AVANT de lancer les dés). Le d100 est figé par le seed : basculer re-lit le MÊME jet sur l'autre
   *  table (zéro savescum) — les jets sont donc réinitialisés au changement. */
  coastalSwap: boolean;
  /** Jets de carrière figés (1 puis 3) ; au-delà : relances libres (0 PX, RAW l.195). Chaque jet
   *  désigne une BORNE → `ids` = toutes les carrières de cette borne (choix libre, PX conservé). */
  careerRolls: { roll: number; ids: string[] }[];
  /** Nombre de relances LIBRES effectuées (annule tout bonus). */
  careerFreeRolls: number;
  // 3) Caractéristiques
  charMode: CharMode;
  /** Les dix 2d10 TIRÉS (geste « Tirer aux dés » requis, #393 agentivité) : avant le geste, aucune
   *  valeur de dé n'existe à l'écran (caracs à « — ») — les jets eux-mêmes restent figés par le
   *  seed (`charRollPairs`), le geste n'en découvre que l'affichage. */
  charsRolled?: boolean;
  /** Nombre de relances des dix 2d10 (0 = tirage initial ; >0 → bonus perdus, RAW l.385). */
  charRerolls: number;
  /** Réassignation : pour chaque Caractéristique, l'INDEX du jet (permutation de 0..9). */
  assignment: Record<CharKey, number>;
  /** Répartition manuelle de 100 Points (min 4 / max 18, l.385). */
  pointBuy: Record<CharKey, number>;
  /** 5 Augmentations gratuites sur les 3 Caractéristiques de carrière (l.488). */
  charAdvancesAlloc: Partial<Record<CharKey, number>>;
  fateSplit: { fate: number; resilience: number };
  // 4) Compétences & Talents
  speciesPlus5: string[];
  speciesPlus3: string[];
  /** Choix de branche des entrées de talents d'espèce « A ou B » (entrée brute → option). */
  speciesTalentChoices: Record<string, string>;
  /** Choix de spec des talents aléatoires tirés (libellé de base → spec). */
  randomSpecPicks: Record<string, string>;
  /** Talents d'espèce aléatoires TIRÉS (geste « Tirer aux dés » de l'étape 5c, #393 agentivité) :
   *  avant le geste, les d100 n'apparaissent NULLE PART (ni volet ni fiche vivante) — la résolution
   *  reste figée par le seed, le geste n'en découvre que l'affichage. */
  talentsRolled?: boolean;
  /** Résolution des entrées « (Au choix) » (entrée brute → libellé concret). */
  specChoices: Record<string, string>;
  skillAdvances: Record<string, number>;
  careerTalent?: string;
  /** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.714) — exactement BFM à choisir. */
  pettySpells: string[];
  // 5) Possessions
  /** Résolution des emplacements `{choice}`/`{wildcard}` des dotations de la carrière (construct de
   *  choix d'équipement) — clé = `trappingRefLabel` de l'EMPLACEMENT (même convention que
   *  `resolveTrappingChoices`), valeur = libellé de la branche (`choice`) ou id de trapping (`wildcard`). */
  trappingChoices?: Record<string, string>;
  /** Bourse de départ TIRÉE (LDB 05 l.578) — geste explicite requis (#393 P5 correctif
   *  d'agentivité : le montant, bien que déterministe côté `draftWealth`, ne s'affiche PLUS avant
   *  que le joueur ait pressé « Tirer aux dés » — jamais un résultat pré-rempli au montage). */
  wealthRoll?: boolean;
  // 6) Détails
  label: string;
  motivation: string;
  ambitionShort: string;
  ambitionLong: string;
  age?: number;
  height?: number;
  eyes?: string;
  hair?: string;
  // 3bis) Signe astral (ADE II 3 — étape optionnelle, gated par la règle creation-signes-astraux)
  /** Signe astral choisi — `id` STABLE (≠ libellé) ; son `effect` est appliqué aux attributs de départ. */
  star?: string;
  /** Signe TIRÉ (1d100 figé, `id`) : si `star` lui reste égal → +25 PX (RAW l.36) ; un choix libre l'écarte. */
  starRoll?: string;
  /** Valeur d100 BRUTE du tirage de signe (même patron que `speciesRoll.roll`/`careerRolls[].roll`) —
   *  seule donnée qui permet à `CreatorDice` d'animer les VRAIES faces (#396 v5) ; `starRoll` ne
   *  conserve que l'id résolu, insuffisant pour `d100Faces`. */
  starRollValue?: number;
  /** Ascendant (ADE II 3 l.492-498) + 5 demeures célestes (ADE II 3 l.500-514) — flavor pur, aucun
   *  effet mécanique (l.492 : « pas directement liés aux mécaniques de jeu »). */
  ascendant?: string;
  dwellings?: { house: string; sign: string }[];
  sex: 'M' | 'F';
  build: number;
  appSeed: number;
  colors?: Appearance['colors'];
  parts?: Appearance['parts'];
}

export function newDraft(seed = (Date.now() & 0xffff) ^ ((Math.random() * 0xffff) | 0)): CreatorDraft {
  // Page blanche cérémonielle (arbitrage 2026-07-13) : aucune race/carrière pré-tirée — l'id vide
  // signifie « non choisi », la fiche vivante démarre grisée et se remplit choix par choix.
  return {
    seed,
    speciesId: '',
    careerId: '',
    ignoreRestrictions: false,
    coastalSwap: false,
    careerRolls: [],
    careerFreeRolls: 0,
    charMode: 'rolled',
    charsRolled: false,
    charRerolls: 0,
    assignment: Object.fromEntries(CHAR_KEYS.map((k, i) => [k, i])) as Record<CharKey, number>,
    pointBuy: Object.fromEntries(CHAR_KEYS.map((k) => [k, 10])) as Record<CharKey, number>,
    charAdvancesAlloc: {},
    fateSplit: { fate: 0, resilience: 0 },
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    talentsRolled: false,
    specChoices: {},
    skillAdvances: {},
    pettySpells: [],
    label: '',
    motivation: '',
    ambitionShort: '',
    ambitionLong: '',
    sex: 'M',
    build: 0.5,
    appSeed: (seed >> 2) & 0xffff,
  };
}

/**
 * Reconstruit un brouillon ÉDITABLE à partir d'un héros déjà construit, pour le rouvrir dans le
 * créateur. RECONSTRUCTION PARTIELLE (best-effort) : un `Combatant` ne retient PAS les tirages
 * figés ni les choix étape par étape (répartition des 40 Augmentations, talent de carrière choisi,
 * compétences d'espèce +5/+3, méthode de Caractéristiques, bonus de PX de création…). On récupère
 * ce qui est portable — espèce, carrière, identité, détails physiques, apparence — et on laisse le
 * reste aux défauts du créateur, à RE-VALIDER étape par étape. Préférer le `draft` sauvegardé du
 * roster quand il existe (round-trip sans perte) ; ce chemin est le repli (pré-tirés, imports,
 * héros d'avant cette fonctionnalité). */
export function draftFromHero(hero: Combatant): CreatorDraft {
  const d = newDraft();
  // `Combatant.species` est l'id LDB (rules) ; `appearance.species` est une clé de rig (libellé) → on
  // reconstruit le brouillon depuis l'id rules, pas depuis l'apparence.
  const speciesId = hero.species ?? d.speciesId;
  const withSp = withSpecies(d, speciesId);
  const withCa = hero.career ? withCareer(withSp, hero.career) : withSp;
  return {
    ...withCa,
    speciesId,
    careerId: hero.career ?? withCa.careerId,
    label: hero.label ?? '',
    motivation: hero.motivation ?? '',
    ambitionShort: hero.details?.ambitionShort ?? '',
    ambitionLong: hero.details?.ambitionLong ?? '',
    age: hero.details?.age,
    height: hero.details?.height,
    eyes: hero.details?.eyes,
    hair: hero.details?.hair,
    star: hero.star,
    ascendant: hero.details?.ascendant,
    dwellings: hero.details?.dwellings,
    sex: hero.appearance?.sex ?? d.sex,
    build: hero.appearance?.build ?? d.build,
    appSeed: hero.appearance?.seed ?? d.appSeed,
    colors: hero.appearance?.colors,
    parts: hero.appearance?.parts,
  };
}

/** Race du brouillon — `undefined` tant qu'aucune n'est choisie (page blanche, id vide). */
export const draftSpecies = (d: CreatorDraft): SpeciesData | undefined => (d.speciesId ? findSpeciesById(d.speciesId) : undefined);
export const draftLevel = (d: CreatorDraft): CareerLevelData | undefined =>
  levelsForCareer(d.careerId).find((l) => l.level === 1);
/** Race choisie ET carrière choisie — la fiche vivante ne se construit qu'une fois les deux posées. */
export const hasSpecies = (d: CreatorDraft): boolean => !!d.speciesId && !!draftSpecies(d);
/** Caractéristiques de carrière du Niveau 1 (clés `CharKey` stables) sur lesquelles se répartissent
 *  les 5 Augmentations gratuites de création (LDB 05 l.459). La donnée EST déjà en `CharKey`
 *  (« CT », « F »… ; cf. le champ characteristics de CareerLevelData) ; on filtre par sûreté. SOURCE UNIQUE
 *  partagée par la grille d'allocation et `validateStep` (plus de re-dérivation divergente). */
export const careerCharKeys = (d: CreatorDraft): CharKey[] =>
  (draftLevel(d)?.characteristics ?? []).filter((k): k is CharKey => CHAR_KEYS.includes(k as CharKey));

// ── 1) Espèce ──
export function rollDraftSpecies(d: CreatorDraft): CreatorDraft {
  if (d.speciesRoll) return d; // FIGÉ : pas de relance (LDB 04 — aucune n'est offerte)
  const r = rollSpecies(makeRNG(d.seed ^ 0x51ec));
  // La borne tirée propose `ids` ; on sélectionne la 1ʳᵉ par défaut, le joueur peut choisir une autre.
  return withSpecies({ ...d, speciesRoll: r }, r.ids[0]);
}
// +20 PX tant que l'espèce choisie appartient à la BORNE tirée (le bonus récompense le tirage, l.87).
export const speciesXp = (d: CreatorDraft): number =>
  d.speciesRoll && d.speciesRoll.ids.includes(d.speciesId) ? XP_SPECIES_ACCEPTED : 0;

export function withSpecies(d: CreatorDraft, id: string): CreatorDraft {
  if (id === d.speciesId) return d;
  // Changer d'espèce invalide les choix dépendants (compétences/talents d'espèce, carrière tirée) —
  // le geste des Talents aléatoires compris (la table des tirages appartient à l'espèce).
  return {
    ...d,
    speciesId: id,
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    talentsRolled: false,
    pettySpells: [],
    careerRolls: [],
    careerFreeRolls: 0,
  };
}

// ── 2) Carrière ──
/** Le remplacement Riverains → Côtiers (MDG 09 l.9) s'offre-t-il à cette espèce ? Uniquement quand SA
 *  colonne du tableau contient les DEUX portions (les 5 colonnes du LDB) : les tables régionales
 *  (Middenheim/ADE II/NADJ) ne sont pas étendues par MDG, et la table Norse embarque déjà les variantes
 *  côtières SANS portion Riverains (rien à remplacer). Dérivé de la DONNÉE, aucune liste de colonnes. */
export const coastalSwapAvailable = (d: CreatorDraft): boolean => {
  const col = draftSpecies(d)?.refCareer;
  if (!col) return false;
  return careers.some((c) => c.class === 'riverains' && c.rand?.[col] != null)
    && careers.some((c) => c.class === 'cotiers' && c.rand?.[col] != null);
};

/** Table de tirage EFFECTIVE : là où la colonne porte les deux portions, les Riverains et les CÔTIERS
 *  ne coexistent JAMAIS dans un même tirage (remplacement, pas cumul) ; ailleurs, la colonne est déjà
 *  la bonne table (Norse : variantes côtières seules ; régionales : Riverains seuls). */
export const careerRollPool = (d: CreatorDraft): typeof careers => {
  if (!coastalSwapAvailable(d)) return careers;
  return careers.filter((c) => c.class !== (d.coastalSwap ? 'riverains' : 'cotiers'));
};

/** Bascule Riverains ↔ Côtiers (MDG 09 l.9 : « avant de lancer les dés ») — VERROUILLÉE dès qu'un
 *  jet existe (`careerRolls` non vide) : sans cette garde, cocher/décocher effaçait les jets et
 *  offrait une relance GRATUITE illimitée (contourne la limite RAW des 2 relances + l'économie de
 *  PX, #393 P2 correctif utilisateur). Garde posée ICI (pas seulement côté UI désactivée) — aucun
 *  appelant ne peut la contourner. Se réactive seulement quand les jets sont vides (choix libre, ou
 *  un futur reset d'étape explicite). */
export function withCoastalSwap(d: CreatorDraft, coastalSwap: boolean): CreatorDraft {
  if (coastalSwap === d.coastalSwap) return d;
  if (d.careerRolls.length > 0) return d;
  return { ...d, coastalSwap, careerRolls: [], careerFreeRolls: 0 };
}

export function rollDraftCareer(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  if (!sp) return d; // pas de tirage de carrière sans race (l'UI empêche d'y arriver)
  const pool = careerRollPool(d);
  const n = d.careerRolls.length;
  if (n === 0) {
    const r = rollCareer(pool, sp, makeRNG(d.seed ^ 0xca1));
    // Chaque jet désigne une borne (`ids`) ; défaut = 1ʳᵉ carrière, le joueur peut en choisir une autre.
    return r ? withCareer({ ...d, careerRolls: [r] }, r.ids[0]) : d;
  }
  if (n === 1) {
    // « Faites deux lancers de plus, ce qui porte votre total à 3 choix » (LDB 05 l.211).
    const rng = makeRNG(d.seed ^ 0xca2);
    const r2 = rollCareer(pool, sp, rng);
    const r3 = rollCareer(pool, sp, rng);
    if (!r2 || !r3) return d;
    return { ...d, careerRolls: [...d.careerRolls, r2, r3] };
  }
  // « continuez à relancer jusqu'à obtenir quelque chose qui vous plaît » (l.195) — 0 PX.
  const r = rollCareer(pool, sp, makeRNG(d.seed ^ (0xca3 + d.careerFreeRolls)));
  return r ? withCareer({ ...d, careerFreeRolls: d.careerFreeRolls + 1 }, r.ids[0]) : d;
}
export function careerXp(d: CreatorDraft): number {
  if (d.careerFreeRolls > 0) return 0;
  // +50 si la carrière choisie est dans la borne du 1ᵉʳ jet ; +25 si elle est dans l'une des 3 bornes.
  if (d.careerRolls.length === 1 && d.careerRolls[0].ids.includes(d.careerId)) return XP_CAREER_FIRST;
  if (d.careerRolls.length === 3 && d.careerRolls.some((r) => r.ids.includes(d.careerId))) return XP_CAREER_TOP3;
  return 0;
}
export function withCareer(d: CreatorDraft, id: string): CreatorDraft {
  if (id === d.careerId) return d;
  return {
    ...d,
    careerId: id,
    skillAdvances: {},
    specChoices: {},
    careerTalent: undefined,
    pettySpells: [],
    charAdvancesAlloc: {},
    trappingChoices: {},
    wealthRoll: false,
  };
}

// ── 3) Caractéristiques ──
/** Les dix jets 2d10 figés (paire RÉELLE [d10, d10], l'ordre suit CHAR_KEYS) — relancés en bloc par
 *  `charRerolls`. Tirée dé par dé (au lieu de `roll(2, 10, rng)`) pour EXPOSER chaque face physique
 *  à l'animation (`CreatorDice`/`DiceRoll`) — même séquence RNG que `roll(2, 10, rng)` (deux tirages
 *  `rng.int(1, 10)` consécutifs par Caractéristique), donc `charRolls` reste bit-à-bit identique. */
export function charRollPairs(d: CreatorDraft): [number, number][] {
  const rng = makeRNG((d.seed ^ 0xc4a5) + d.charRerolls * 7919);
  return CHAR_KEYS.map(() => [rng.int(1, 10), rng.int(1, 10)] as [number, number]);
}
export function charRolls(d: CreatorDraft): number[] {
  return charRollPairs(d).map(([a, b]) => a + b);
}
/** Caractéristiques AVANT Augmentations gratuites et talents (base d'espèce incluse). */
export function draftChars(d: CreatorDraft): Characteristics {
  const sp = draftSpecies(d);
  const rolls = charRolls(d);
  const out = {} as Characteristics;
  if (!sp) { for (const k of CHAR_KEYS) out[k] = 0; return out; } // page blanche : aucune base d'espèce
  for (let i = 0; i < CHAR_KEYS.length; i++) {
    const k = CHAR_KEYS[i];
    const base = sp.baseChar[k] ?? 20;
    if (d.charMode === 'pointBuy') out[k] = base + d.pointBuy[k];
    // Agentivité (#393) : avant le geste « Tirer aux dés », aucun jet n'existe — base d'espèce seule.
    else out[k] = base + (d.charsRolled ? rolls[d.charMode === 'reassigned' ? d.assignment[k] : i] : 0);
  }
  return out;
}
/** Pose le geste « Tirer aux dés » des dix 2d10 (LDB 05 l.337) — FIGÉ côté valeurs (`charRollPairs`
 *  dérive du seed), ce geste n'en découvre que l'affichage (#393 agentivité : jamais un résultat
 *  pré-rempli au montage). La relance RAW (l.341, bonus perdus) passe par `charRerolls`. */
export function rollDraftChars(d: CreatorDraft): CreatorDraft {
  return d.charsRolled ? d : { ...d, charsRolled: true };
}
export function charsXp(d: CreatorDraft): number {
  if (!draftSpecies(d)) return 0; // page blanche : pas de bonus 2d10 tant qu'aucune race n'existe
  if (!d.charsRolled || d.charRerolls > 0 || d.charMode === 'pointBuy') return 0;
  return d.charMode === 'rolled' ? XP_CHARS_KEPT : XP_CHARS_REASSIGNED;
}

/** PX du signe astral : +25 si le signe choisi reste celui qui a été TIRÉ (ADE II 3 l.36), sinon 0. */
export const starXp = (d: CreatorDraft): number => (d.starRoll && d.star === d.starRoll ? XP_STAR_ROLLED : 0);

export const xpTotal = (d: CreatorDraft): number => speciesXp(d) + careerXp(d) + charsXp(d) + starXp(d);

// ── 3bis) Signe astral (ADE II 3) ──
/** Tirage 1d100 FIGÉ du signe (anti-savescum, comme l'espèce) : on le garde (+25 PX) ou on choisit
 *  librement ensuite (+0 PX, RAW l.36). Pas de relance — RAW n'en offre aucune. */
export function rollDraftStar(d: CreatorDraft): CreatorDraft {
  const { roll: r, id } = rollStar(makeRNG(d.seed ^ 0x57a2)); // `id` STABLE du signe (≠ libellé)
  return { ...d, starRoll: id, starRollValue: r, star: id };
}

/** Ascendant (ADE II 3 l.496) + un signe par demeure céleste (l.514, la donnée `celestialHouses`
 *  ADE II 3 l.504-512) — flavor pur, tirages figés par le seed. `dwellings[].house` = ID de la demeure
 *  (ids internes, libellés à l'affichage) ; `sign` reste un libellé lisible (flavor stocké sur la
 *  fiche, aucune mécanique n'y référence un signe). */
export function rollDraftAstrology(d: CreatorDraft): CreatorDraft {
  const rng = makeRNG(d.seed ^ 0xa57e);
  const signLabel = (): string => findStarById(rollStar(rng).id)?.label ?? '';
  return { ...d, ascendant: signLabel(), dwellings: celestialHouses.map((h) => ({ house: h.id, sign: signLabel() })) };
}

// ── 4) Compétences & Talents ──
/** Résolution COMPLÈTE (tirages d100 compris) — INTERNE : l'exposition publique passe par
 *  `resolvedSpeciesTalents`, qui retient les tirés tant que le geste 5c n'est pas fait. */
function resolvedSpeciesTalentsAll(d: CreatorDraft): string[] {
  const sp = draftSpecies(d);
  if (!sp) return [];
  return resolveSpeciesTalents(sp, {
    rng: makeRNG(d.seed ^ 0x7a1e),
    choices: { ...d.speciesTalentChoices, ...d.specChoices },
    pickSpec: (base, free) => (d.randomSpecPicks[base] && free.includes(d.randomSpecPicks[base]) ? d.randomSpecPicks[base] : free[0]),
  });
}

/** Talents d'espèce résolus (choix appliqués, tirages aléatoires FIGÉS par le seed) — les TIRÉS AU
 *  D100 n'y figurent qu'une fois le geste « Tirer aux dés » posé (`talentsRolled`, #393 agentivité :
 *  un talent non encore lancé n'apparaît NULLE PART, ni volet ni fiche vivante). */
export function resolvedSpeciesTalents(d: CreatorDraft): string[] {
  const all = resolvedSpeciesTalentsAll(d);
  if (d.talentsRolled) return all;
  for (const label of randomDrawnOf(d)) {
    const i = all.indexOf(label);
    if (i !== -1) all.splice(i, 1);
  }
  return all;
}

/** Geste « Tirer aux dés » des Talents d'espèce aléatoires (LDB 05 l.510 ; un doublon déjà possédé
 *  est relancé D'OFFICE par `resolveSpeciesTalents`, l.484) — tirages figés par le seed, découverts
 *  ici ; RAW n'offre aucune relance au joueur. */
export function rollDraftTalents(d: CreatorDraft): CreatorDraft {
  return d.talentsRolled ? d : { ...d, talentsRolled: true };
}

/** Entrées BRUTES de Talents d'espèce en TROIS lots (LDB 05 l.510, catégorisation de l'écran
 *  Talents — 5c) : FIXES (acquis d'office, aucune décision) / À CHOISIR (« A ou B », un au choix) /
 *  ALÉATOIRES (nombre de tirages d100 sur le Tableau des Talents, résolus par `resolvedSpeciesTalents`
 *  — figés par le seed, aucune relance). Dérivé de la DONNÉE (`sp.talents`), jamais d'un stock parallèle. */
export function speciesTalentFixedEntries(d: CreatorDraft): string[] {
  const sp = draftSpecies(d);
  if (!sp) return [];
  return sp.talents
    .map((a) => advancementLabel('talents', a).trim())
    .filter((e) => !RANDOM_ENTRY_RE.test(e) && splitTopLevelOu(e).length <= 1);
}
export function speciesTalentChoiceEntries(d: CreatorDraft): string[] {
  const sp = draftSpecies(d);
  if (!sp) return [];
  return sp.talents.map((a) => advancementLabel('talents', a).trim()).filter((e) => splitTopLevelOu(e).length > 1);
}
export function speciesTalentRandomCount(d: CreatorDraft): number {
  const sp = draftSpecies(d);
  if (!sp) return 0;
  let n = 0;
  for (const a of sp.talents) {
    const e = advancementLabel('talents', a).trim();
    const m = e.match(RANDOM_ENTRY_RE);
    if (m) n += parseInt(m[1] ?? '1', 10);
  }
  return n;
}
/** Les N talents TIRÉS au d100 (LDB 05 l.510), tels que le geste 5c les découvre — VIDE tant que le
 *  joueur n'a pas tiré (#393 agentivité). */
export function speciesTalentRandomDrawn(d: CreatorDraft): string[] {
  return d.talentsRolled ? randomDrawnOf(d) : [];
}
/** INTERNE : les tirés au d100 de la résolution complète — le reste de `resolvedSpeciesTalentsAll`
 *  une fois les entrées fixes et choisies retirées (par libellé, doublons respectés via multiset). */
function randomDrawnOf(d: CreatorDraft): string[] {
  const resolved = [...resolvedSpeciesTalentsAll(d)];
  const known = [...speciesTalentFixedEntries(d)];
  for (const raw of speciesTalentChoiceEntries(d)) {
    const chosen = d.speciesTalentChoices[raw] ?? splitTopLevelOu(raw)[0];
    const mRand = chosen.match(RANDOM_ENTRY_RE);
    if (!mRand) known.push(isUnresolvedChoice(chosen) ? (d.specChoices[raw] ?? chosen) : chosen);
  }
  for (const label of known) {
    const i = resolved.indexOf(label);
    if (i !== -1) resolved.splice(i, 1);
  }
  return resolved;
}
/** Toutes les décisions de Talents d'espèce « A ou B » sont-elles tranchées ? */
export function speciesTalentChoicesDone(d: CreatorDraft): boolean {
  return speciesTalentChoiceEntries(d).every((e) => !!d.speciesTalentChoices[e]);
}

/** Probe : héros partiel (caracs + talents d'espèce + talent de carrière) pour Maxi/additions.
 *  `charsAlloc` compose `charAdvancesAlloc` aux Caractéristiques (BFM final requis par
 *  `pettySpellQuota`) — n'affecte QUE les Caractéristiques du probe, pas sa sémantique pour les
 *  autres appelants (Maxi de talent, additions de carrière). */
export function probeHero(d: CreatorDraft, withCareerTalent = true, charsAlloc = false): Combatant {
  const characteristics = draftChars(d);
  const acquis: PorteurDeTalents = { characteristics, talents: [] };
  const add = (label: string) => {
    // Libellé d'authoring → id STABLE (couture tolérée à la frontière du draft, doctrine ids).
    const { name, spec } = splitLabel(label);
    acquerirTalent(acquis, { id: findTalent(name)?.id ?? slugId(name), spec });
  };
  for (const t of resolvedSpeciesTalents(d)) add(t);
  if (withCareerTalent && d.careerTalent) add(d.careerTalent);
  if (charsAlloc) for (const k of CHAR_KEYS) characteristics[k] += d.charAdvancesAlloc[k] ?? 0;
  return { characteristics, talents: acquis.talents ?? [], skills: [], movement: draftSpecies(d)?.movement ?? 0 } as unknown as Combatant;
}

/** Entrées de compétences de carrière allouables : les 8 du Niveau + ajouts de talents (LDB 10).
 *  CLÉS de `d.skillAdvances` — la même que celle qu'indexe `engine/character.ts` au build, donc
 *  `advancementLabel` pour les deux sources (un ajout à emplacement `choix` vaut « Métier (Au choix) »,
 *  jamais « Métier » : `refLabel` ignore `choix` et perdrait l'allocation). */
export function careerSkillEntries(d: CreatorDraft): string[] {
  const base = (draftLevel(d)?.skills ?? []).map((a) => advancementLabel('skills', a));
  return [...base, ...careerSkillAdditions(probeHero(d)).map((a) => advancementLabel('skills', a))];
}

/** « Répartition simple » (étape 5) : « ajouter 5 Augmentations à chaque Compétence de Carrière »
 *  (LDB 05 l.535 — les 40 également réparties sur les 8 Compétences du Niveau). Le RESTE d'une
 *  division non entière est distribué aux premières Compétences (plafond 10/Compétence) : le bouton
 *  produit TOUJOURS un total que `validateStep` accepte, jamais un état invalide. Keyé par LIBELLÉ —
 *  comme la grille, `careerAdvTotal` et `validateStep` ; une clé par objet `AdvancementRef`
 *  donnerait « [object Object] », illisible (jamais comptée). */
export function evenCareerSkillAdvances(d: CreatorDraft): Record<string, number> {
  const entries = draftLevel(d)?.skills ?? [];
  if (!entries.length) return {};
  const base = Math.min(MAX_ADV_PER_SKILL, Math.floor(CAREER_SKILL_ADVANCES / entries.length));
  let rest = CAREER_SKILL_ADVANCES - base * entries.length;
  return Object.fromEntries(entries.map((a) => {
    const extra = rest > 0 && base < MAX_ADV_PER_SKILL ? 1 : 0;
    rest -= extra;
    return [advancementLabel('skills', a), base + extra];
  }));
}

/** Palier (+5/+3/0) d'une Compétence de race dans le brouillon (LDB 05 l.484). */
export function speciesSkillTier(d: CreatorDraft, skill: string): 0 | 3 | 5 {
  return d.speciesPlus5.includes(skill) ? 5 : d.speciesPlus3.includes(skill) ? 3 : 0;
}

/** Pose la Compétence de race `skill` au palier `tier` (0/3/5) en respectant les quotas (3 à +5, 3 à
 *  +3, LDB 05 l.484) : la retire des deux listes puis l'ajoute au palier cible si son quota a de la
 *  place — sinon renvoie le brouillon INCHANGÉ. Source unique consommée par le Stepper de l'étape 5. */
export function withSpeciesSkillTier(d: CreatorDraft, skill: string, tier: 0 | 3 | 5): CreatorDraft {
  const plus5 = d.speciesPlus5.filter((s) => s !== skill);
  const plus3 = d.speciesPlus3.filter((s) => s !== skill);
  if (tier === 5) {
    if (plus5.length >= SPECIES_SKILLS_PLUS5) return d;
    plus5.push(skill);
  } else if (tier === 3) {
    if (plus3.length >= SPECIES_SKILLS_PLUS3) return d;
    plus3.push(skill);
  }
  return { ...d, speciesPlus5: plus5, speciesPlus3: plus3 };
}

/** Palier atteignable au-dessus (`dir=1`) / au-dessous (`dir=-1`) du palier courant, quotas inclus —
 *  `null` = bouton grisé. Le `+` saute +3 quand son quota est plein mais qu'un +5 reste libre (et
 *  inversement le `−`) : le geste reste un Stepper, les paliers valides suivent le RAW. */
export function speciesSkillStep(d: CreatorDraft, skill: string, dir: 1 | -1): (0 | 3 | 5) | null {
  const cur = speciesSkillTier(d, skill);
  const p5free = d.speciesPlus5.filter((s) => s !== skill).length < SPECIES_SKILLS_PLUS5;
  const p3free = d.speciesPlus3.filter((s) => s !== skill).length < SPECIES_SKILLS_PLUS3;
  if (dir === 1) {
    if (cur === 0) return p3free ? 3 : p5free ? 5 : null;
    if (cur === 3) return p5free ? 5 : null;
    return null;
  }
  if (cur === 5) return p3free ? 3 : 0;
  if (cur === 3) return 0;
  return null;
}

/** Options de spec d'une entrée « (Au choix) » (`wildcardSpecs`). */
export function specOptionsFor(entry: string): string[] {
  const opt = parseEntry(entry)[0];
  if (!opt.wildcard) return [];
  return wildcardSpecs(opt);
}

/** Libellés concrets proposés par une entrée de talent à choix (joker, joker restreint,
 *  « A ou B » de premier niveau) — null si l'entrée est déjà concrète. */
export function talentEntryChoices(entry: string): string[] | null {
  const opts = parseEntry(entry);
  if (opts.length === 1 && !opts[0].wildcard) return null;
  const out: string[] = [];
  for (const o of opts) {
    if (!o.wildcard) out.push(concreteLabel(o.label, o.spec));
    else for (const s of wildcardSpecs(o)) out.push(concreteLabel(o.label, s));
  }
  return out;
}

/** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.714) : quota à choisir = BFM FINAL du probe
 *  (Augmentations gratuites + talents « +5 FM » appliqués, même pipeline que createHero) — 0 sans
 *  Talent de `castingKind:'mineure'`. Délègue à `pettySpellQuotaFor` (engine, source UNIQUE — même
 *  fonction que `src/data/pregens.ts`), le probe portant déjà les talents résolus en id. */
export function pettySpellQuota(d: CreatorDraft): number {
  return pettySpellQuotaFor(probeHero(d, true, true));
}

/** Refus du Talent de carrière du brouillon, ou `null` : même lecture des emplacements du Niveau 1
 *  que `createHero` (`statutOuRefus`), puis le Maxi. Un brouillon restauré passe par ici avant
 *  toute construction. */
export function careerTalentMessage(d: CreatorDraft): string | null {
  if (!d.careerTalent) return 'Choisissez votre Talent de carrière.';
  const { talentId, spec } = talentRefOfLabel(d.careerTalent);
  const levels = levelsForCareer(d.careerId);
  const tSlots = talentSlots(levels, 1);
  switch (statutOuRefus(tSlots, {}, talentId, spec, [...skillSlots(levels, 1), ...tSlots])) {
    case 'absent': return `« ${d.careerTalent} » ne figure pas parmi les Talents de votre premier niveau de carrière : choisissez-en un autre.`;
    case 'sansSpec': return `Choisissez la spécialisation de votre Talent de carrière « ${d.careerTalent} ».`;
    case 'nonCouvert': return `« ${d.careerTalent} » n'est proposé par aucun Talent de votre premier niveau de carrière : choisissez-en un autre.`;
  }
  if (talentMaxReached(probeHero(d, false), talentId, spec)) return `« ${d.careerTalent} » : Maxi déjà atteint.`;
  return null;
}

/** Options du talent de carrière (entrées brutes du Niveau 1) : libellé sélectionné + Maxi. */
export function careerTalentOptions(d: CreatorDraft): { entry: string; choices: string[] | null; selected: string | null; maxed: boolean }[] {
  const probe = probeHero(d, false);
  return (draftLevel(d)?.talents ?? []).map((ref) => {
    const entry = advancementLabel('talents', ref);
    const choices = talentEntryChoices(entry);
    const selected = choices ? (d.specChoices[entry] && choices.includes(d.specChoices[entry]) ? d.specChoices[entry] : null) : entry;
    let maxed = false;
    if (selected) {
      const { name, spec } = splitLabel(selected);
      const talentId = findTalent(name)?.id ?? slugId(name);
      maxed = talentMaxReached(probe, talentId, spec);
    }
    return { entry, choices, selected, maxed };
  });
}

// ── 5) Possessions ──
/** Montant de la bourse — PUR/déterministe (`d.seed`), jamais une relance (LDB 05 : un seul jet).
 *  La ceinture d'agentivité (`wealthRoll`, geste requis avant affichage) vit dans l'UI, pas ici. */
export function draftWealth(d: CreatorDraft): Money {
  const status = parseStatus(draftLevel(d)?.status ?? 'Bronze 0');
  return rollInitialWealth(status, makeRNG(d.seed ^ 0x901d));
}
/** Pose le geste « Tirer aux dés » de la bourse — FIGÉ (aucune relance, LDB 05 l.578 n'en offre
 *  aucune) : le montant lui-même est déjà déterminé par `d.seed`, ce geste n'en découvre que
 *  l'affichage (anti-résultat-pré-rempli, #393 P5). */
export function rollDraftWealth(d: CreatorDraft): CreatorDraft {
  return d.wealthRoll ? d : { ...d, wealthRoll: true };
}

/** Un emplacement `{choice}`/`{wildcard}` de la dotation Niveau 1 est-il RÉSOLU par `choices`
 *  (`d.trappingChoices`) ? RÉCURSIF (miroir de `resolveTrappingChoices`) — un `choice` requiert la
 *  branche choisie ET que CETTE branche soit elle-même résolue ; un `wildcard` requiert un id choisi ;
 *  toute autre ref (id/text/vehicleId/creatureId) est déjà concrète. */
export function trappingSlotResolved(ref: TrappingRef, choices: Record<string, string>): boolean {
  if ('choice' in ref) {
    const key = trappingRefLabel(ref);
    const picked = choices[key];
    const branch = picked && ref.choice.find((b) => trappingRefLabel(b) === picked);
    return !!branch && trappingSlotResolved(branch, choices);
  }
  if ('wildcard' in ref) return !!choices[trappingRefLabel(ref)];
  return true;
}
/** Emplacements `{choice}`/`{wildcard}` non résolus des dotations de la carrière Niveau 1 (libellés
 *  d'emplacement, pour message d'erreur) — gate de `validateStep('trappings')`. */
export function unresolvedTrappingSlots(d: CreatorDraft): string[] {
  const level = draftLevel(d);
  if (!level) return [];
  return level.trappings.filter((t) => !trappingSlotResolved(t, d.trappingChoices ?? {})).map(trappingRefLabel);
}

// ── 6) Détails ──
export function rolledDetails(d: CreatorDraft): { age: number; height: number; eyes: string; hair: string } {
  const sp = draftSpecies(d);
  if (!sp) return { age: 0, height: 0, eyes: '', hair: '' };
  const rng = makeRNG(d.seed ^ 0xde7a);
  return { age: rollAge(sp, rng), height: rollHeight(sp, rng), eyes: rollEyes(sp, rng), hair: rollHair(sp, rng) };
}

export type StepId = 'species' | 'career' | 'chars' | 'star' | 'skills' | 'trappings' | 'details' | 'presentation';

/** Étapes du créateur dans l'ordre — `star` insérée après `chars` quand la règle optionnelle ADE II
 *  `creation-signes-astraux` est active. SOURCE UNIQUE de l'ordre ET de la présence des étapes (le
 *  rendu et la validation en dérivent — plus d'index positionnel fragile). Étape 8 renommée
 *  « Présentation » (#393 P5, arbitrage README maquettes : « le personnage se PRÉSENTE »). */
export function stepIds(): StepId[] {
  const ids: StepId[] = ['species', 'career', 'chars', 'skills', 'trappings', 'details', 'presentation'];
  if (rule('creation-signes-astraux')) ids.splice(3, 0, 'star');
  return ids;
}

// ── Validation par étape ──
/** Contexte dérivé du brouillon, calculé UNE fois par validation et passé à l'étape. */
interface StepCtx { d: CreatorDraft; sp: ReturnType<typeof draftSpecies>; level: ReturnType<typeof draftLevel> }

/**
 * Validateurs PAR étape — table EXHAUSTIVE `Record<StepId, …>` : ajouter une étape à `StepId` force
 * son entrée ICI à la compilation. `star` et `presentation` n'imposent aucune saisie (`null`).
 */
const STEP_VALIDATORS: Record<StepId, (c: StepCtx) => string | null> = {
  species: ({ sp }) => (sp ? null : 'Choisissez votre race.'),
  career: ({ d, level }) => {
    if (!d.careerId) return 'Choisissez votre carrière.';
    if (!level) return 'Carrière sans Niveau 1 dans les données.';
    return null;
  },
  chars: ({ d, sp }) => {
    if (!sp) return 'Choisissez votre race.';
    if (d.charMode !== 'pointBuy' && !d.charsRolled) return 'Tirez vos Caractéristiques aux dés.';
    if (d.charMode === 'pointBuy') {
      const v = validatePointBuy(d.pointBuy as Record<CharKey, number>);
      if (!v.ok) return `Répartition des 100 Points : ${v.reason}.`;
    }
    if (d.charMode === 'reassigned') {
      const idx = CHAR_KEYS.map((k) => d.assignment[k]);
      if (new Set(idx).size !== 10) return 'Réassignation : chaque jet doit être utilisé une seule fois.';
    }
    const careerChars = careerCharKeys(d).length;
    const alloc = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
    if (careerChars && alloc !== CAREER_CHAR_ADVANCES)
      return `Répartissez ${CAREER_CHAR_ADVANCES} Augmentations sur les Caractéristiques de carrière (actuel : ${alloc}).`;
    const split = d.fateSplit.fate + d.fateSplit.resilience;
    if (split !== sp.fate.extra) return `Répartissez les ${sp.fate.extra} points entre Destin et Résilience (actuel : ${split}).`;
    return null;
  },
  star: () => null,
  skills: ({ d, sp }) => {
    if (!sp) return 'Choisissez votre race.';
    if (d.speciesPlus5.length !== SPECIES_SKILLS_PLUS5 || d.speciesPlus3.length !== SPECIES_SKILLS_PLUS3)
      return `Choisissez ${SPECIES_SKILLS_PLUS5} Compétences d'espèce à +5 et ${SPECIES_SKILLS_PLUS3} à +3.`;
    if (d.speciesPlus5.some((s) => d.speciesPlus3.includes(s))) return 'Une Compétence d\'espèce ne peut pas être à la fois +5 et +3.';
    for (const raw of [...d.speciesPlus5, ...d.speciesPlus3]) {
      if (isUnresolvedChoice(raw) && !d.specChoices[raw]) return `Choisissez la Spécialisation de « ${raw} ».`;
    }
    // Entrées d'espèce « A ou B » : un choix requis quand il y en a.
    for (const ref of sp.talents) {
      const entry = advancementLabel('talents', ref);
      if (splitTopLevelOu(entry).length > 1 && !d.speciesTalentChoices[entry]) return `Choisissez : « ${entry} ».`;
    }
    if (speciesTalentRandomCount(d) > 0 && !d.talentsRolled) return 'Tirez vos Talents aléatoires aux dés.';
    const entries = careerSkillEntries(d);
    const total = entries.reduce((a, e) => a + (d.skillAdvances[e] ?? 0), 0);
    if (total !== CAREER_SKILL_ADVANCES) return `Répartissez ${CAREER_SKILL_ADVANCES} Augmentations de carrière (actuel : ${total}).`;
    for (const e of entries) {
      const adv = d.skillAdvances[e] ?? 0;
      if (adv < 0 || adv > MAX_ADV_PER_SKILL) return `Maximum ${MAX_ADV_PER_SKILL} Augmentations par Compétence à la création (« ${e} »).`;
      if (adv > 0 && isUnresolvedChoice(e) && !d.specChoices[e]) return `Choisissez la Spécialisation de « ${e} ».`;
    }
    const refusTalent = careerTalentMessage(d);
    if (refusTalent) return refusTalent;
    const quota = pettySpellQuota(d);
    if (quota && d.pettySpells.length !== quota) {
      return `Choisissez vos ${quota} sorts de Magie mineure (actuel : ${d.pettySpells.length}).`;
    }
    return null;
  },
  trappings: ({ d }) => {
    if (!d.wealthRoll) return 'Tirez la bourse de départ aux dés.';
    const unresolved = unresolvedTrappingSlots(d);
    if (unresolved.length) return `Choisissez : « ${unresolved[0]} ».`;
    return null;
  },
  details: ({ d }) => {
    if (!d.label.trim()) return 'Donnez un nom à votre personnage.';
    return null;
  },
  presentation: () => null,
};

export function validateStep(d: CreatorDraft, id: StepId): string | null {
  return STEP_VALIDATORS[id]({ d, sp: draftSpecies(d), level: draftLevel(d) });
}

// ── Construction finale ──
export function buildHero(d: CreatorDraft, id?: string): Combatant {
  const sp = draftSpecies(d);
  if (!sp) throw new Error('Aucune race choisie'); // page blanche : previewHero catch → fiche grisée
  const plus5 = d.speciesPlus5.length === SPECIES_SKILLS_PLUS5
    ? d.speciesPlus5
    : sp.skills.slice(0, SPECIES_SKILLS_PLUS5).map((a) => advancementLabel('skills', a));
  const plus3 = d.speciesPlus3.length === SPECIES_SKILLS_PLUS3
    ? d.speciesPlus3
    : sp.skills.slice(SPECIES_SKILLS_PLUS5, SPECIES_SKILLS_PLUS5 + SPECIES_SKILLS_PLUS3).map((a) => advancementLabel('skills', a));
  const hero = createHero({
    speciesId: d.speciesId,
    careerId: d.careerId,
    label: d.label.trim() || 'Aventurier',
    manualChars: draftChars(d),
    charAdvancesAlloc: d.charAdvancesAlloc,
    careerTalent: d.careerTalent ? talentRefOfLabel(d.careerTalent) : undefined,
    skillAdvances: d.skillAdvances,
    speciesSkillAdvances: { plus5, plus3 },
    speciesTalentsResolved: resolvedSpeciesTalents(d),
    specChoices: d.specChoices,
    starId: d.star,
    fateSplit: d.fateSplit,
    xpBonus: xpTotal(d),
    trappingChoices: d.trappingChoices,
    details: {
      age: d.age,
      height: d.height,
      eyes: d.eyes,
      hair: d.hair,
      ambitionShort: d.ambitionShort.trim() || undefined,
      ambitionLong: d.ambitionLong.trim() || undefined,
      ascendant: d.ascendant,
      dwellings: d.dwellings?.length ? d.dwellings : undefined,
    },
    motivation: d.motivation.trim() || undefined,
    rng: makeRNG(d.seed ^ 0xf17a1),
    id,
  });
  // appearance.species = id d'espèce RIG (slug, via rigSpeciesId) ≠ Combatant.species (id rules).
  hero.appearance = { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  if (d.star) hero.star = d.star;
  // Sorts de Magie mineure inclus au Talent (LDB 10 l.714) — choisis à l'étape 4, mémorisés.
  // (Les Bénédictions de Béni sont déjà octroyées par applyTalentAcquisition dans createHero.)
  const quota = pettySpellQuota(d);
  if (quota && d.pettySpells.length) {
    // pettySpells = libellés (choix UI) → ids runtime ; dédup par id.
    const pickedIds = d.pettySpells.slice(0, quota).map((l) => findSpell(l)?.id ?? l).filter((id) => !(hero.spells ?? []).includes(id));
    hero.spells = [...(hero.spells ?? []), ...pickedIds];
  }
  return hero;
}

/** Le total déjà alloué des 40 Augmentations de carrière. */
export function careerAdvTotal(d: CreatorDraft): number {
  return careerSkillEntries(d).reduce((a, e) => a + (d.skillAdvances[e] ?? 0), 0);
}

// ── Étape 5 « Compétences & Talents » — complétion PAR SOUS-ÉCRAN (5a/5b/5c, charte Atelier) : la
// fiche vivante et les onglets de sous-étape en dérivent — SOURCE UNIQUE, jamais un `ahead('skills')`
// tout-ou-rien pour ce qui se joue À L'INTÉRIEUR de l'étape.
/** 5a — Compétences de race : quotas 3×+5/3×+3 posés ET Spécialisations résolues (LDB 05 l.484). */
export function speciesSkillsDone(d: CreatorDraft): boolean {
  if (d.speciesPlus5.length !== SPECIES_SKILLS_PLUS5 || d.speciesPlus3.length !== SPECIES_SKILLS_PLUS3) return false;
  return [...d.speciesPlus5, ...d.speciesPlus3].every((raw) => !isUnresolvedChoice(raw) || !!d.specChoices[raw]);
}
/** 5b — Compétences de carrière : les 40 Augmentations réparties ET Spécialisations résolues. */
export function careerSkillsDone(d: CreatorDraft): boolean {
  if (careerAdvTotal(d) !== CAREER_SKILL_ADVANCES) return false;
  return careerSkillEntries(d).every((e) => (d.skillAdvances[e] ?? 0) === 0 || !isUnresolvedChoice(e) || !!d.specChoices[e]);
}
/** 5c — Talents : aléatoires TIRÉS + choix « A ou B » d'espèce tranché + Talent de carrière choisi
 *  + Magie mineure. */
export function talentsDone(d: CreatorDraft): boolean {
  if (speciesTalentRandomCount(d) > 0 && !d.talentsRolled) return false;
  if (!speciesTalentChoicesDone(d)) return false;
  if (careerTalentMessage(d)) return false;
  const quota = pettySpellQuota(d);
  if (quota && d.pettySpells.length !== quota) return false;
  return true;
}

/** Trois sous-écrans de l'étape 5 (charte Atelier, dock d'onglets « a/b/c »). */
export type SkillsSub = 'race' | 'career' | 'talents';

/** Bandeau de pied PAR SOUS-ONGLET (5a/5b/5c) — chaque volet reflète SA propre complétion au lieu
 *  du premier blocage toutes-branches de `validateStep('skills')` (agent-œil, LOT de clôture). */
export function skillsSubMessage(d: CreatorDraft, sub: SkillsSub): string {
  const sp = draftSpecies(d);
  if (!sp) return 'Choisissez votre race.';
  switch (sub) {
    case 'race': {
      if (d.speciesPlus5.length !== SPECIES_SKILLS_PLUS5 || d.speciesPlus3.length !== SPECIES_SKILLS_PLUS3)
        return `Choisissez ${SPECIES_SKILLS_PLUS5} Compétences d'espèce à +5 et ${SPECIES_SKILLS_PLUS3} à +3.`;
      if (d.speciesPlus5.some((s) => d.speciesPlus3.includes(s))) return 'Une Compétence d\'espèce ne peut pas être à la fois +5 et +3.';
      for (const raw of [...d.speciesPlus5, ...d.speciesPlus3]) {
        if (isUnresolvedChoice(raw) && !d.specChoices[raw]) return `Choisissez la Spécialisation de « ${raw} ».`;
      }
      return `Compétences de race posées — ${SPECIES_SKILLS_PLUS5} à +5, ${SPECIES_SKILLS_PLUS3} à +3.`;
    }
    case 'career': {
      const entries = careerSkillEntries(d);
      const total = careerAdvTotal(d);
      if (total !== CAREER_SKILL_ADVANCES) return `Répartissez ${CAREER_SKILL_ADVANCES} Augmentations de carrière (actuel : ${total}).`;
      for (const e of entries) {
        const adv = d.skillAdvances[e] ?? 0;
        if (adv > 0 && isUnresolvedChoice(e) && !d.specChoices[e]) return `Choisissez la Spécialisation de « ${e} ».`;
      }
      return `Compétences de carrière posées — ${CAREER_SKILL_ADVANCES} Augmentations réparties.`;
    }
    case 'talents': {
      if (speciesTalentRandomCount(d) > 0 && !d.talentsRolled) return 'Tirez vos Talents aléatoires aux dés.';
      for (const ref of sp.talents) {
        const entry = advancementLabel('talents', ref);
        if (splitTopLevelOu(entry).length > 1 && !d.speciesTalentChoices[entry]) return `Choisissez : « ${entry} ».`;
      }
      const refusTalent = careerTalentMessage(d);
      if (refusTalent) return refusTalent;
      const quota = pettySpellQuota(d);
      if (quota && d.pettySpells.length !== quota) return `Choisissez vos ${quota} sorts de Magie mineure (actuel : ${d.pettySpells.length}).`;
      return 'Talents tranchés — race, carrière et Magie mineure réglés.';
    }
  }
}

export { splitLabel, concreteLabel, isUnresolvedChoice, splitTopLevelOu, parseEntry };
