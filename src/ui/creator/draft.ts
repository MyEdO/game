/**
 * Brouillon de création de personnage (état + dérivations PURES de l'assistant) — LDB 04/05.
 *
 * Tout l'aléatoire est FIGÉ par des flux RNG seedés dérivés d'un seed unique tiré à l'ouverture
 * de l'assistant : re-calculer une dérivation redonne le MÊME résultat (anti-savescum), et les
 * bonus de PX des tirages acceptés sont perdus dès qu'on dévie du chemin RAW :
 *  - Espèce (LDB 04 l.91) : d100 figé ; +20 PX si on le garde tel quel ; pas de relance.
 *  - Carrière (LDB 05 l.208-212) : 1er jet accepté = +50 PX ; sinon 2 jets de plus, choix parmi
 *    les 3 = +25 PX ; sinon choix libre / « continuez à relancer » = 0 PX (relances RAW l.212).
 *  - Caractéristiques (LDB 05 l.337-341) : tirage gardé = +50 ; réassignation des dix jets = +25 ;
 *    relance (RAW, 0 PX) ou répartition de 100 Points = 0.
 *  - Talents d'espèce aléatoires (LDB 05 l.484, table l.514) : un flux par tirage et par rang de relance
 *    (`talentRerolls`) → re-résoudre avec d'autres choix « A ou B » ne re-tire pas les dés.
 *
 * AGENTIVITÉ (#393, amendement « ossature enforcée » 2026-07-15) : figé par le seed ≠ pré-affiché.
 * AUCUN résultat aléatoire n'existe à l'écran avant le GESTE du joueur — chaque famille de tirage
 * porte son drapeau de geste (`speciesRoll` absent, `careerRolls` vide, `charsRolled`,
 * `talentsRolled`, `wealthRoll`) ; le geste ne fait que DÉCOUVRIR un résultat déjà déterminé
 * (zéro savescum), et la validation d'étape EXIGE le geste.
 */
import { tableTotale } from '../../lib/tableTotale';
import { CharKey, CHAR_KEYS, Characteristics, Combatant } from '../../engine/types';
import { garanti } from '../../state/combatants';
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
import { t } from '../../i18n';
import {
  createHero,
  resolveSpeciesTalentsDetail,
  competencesDeCarriere,
  repartitionDeCarriere,
  CAREER_SKILL_ADVANCES,
  MAX_ADV_PER_SKILL,
  speciesSkillDefaults,
  designer,
  poolDuJoker,
  adresseDeCreation,
  FORMAT_DES_CHOIX,
  fluxDeCreation,
  cleDOption,
  type ChoixDeCreation,
  type CompetenceDeCarriere,
} from '../../engine/character';
import { refKey, talentMaxReached, acquerirTalent, type PorteurDeTalents, skillSlots, talentSlots, statutOuRefus } from '../../engine/careerSlots';
import { findSpeciesById, findTalentById, specPoolOf, careers, levelsForCareer, advancementLabel, refLabel, findStarById, celestialHouses, SpeciesData, CareerLevelData, trappingRefLabel, type TrappingRef, type AdvancementRef } from '../../data';
import { estSpecialisable, type RefDesignee, type RefASpecialisation } from '../../data/schemas/grammaire/ref';
import type { Appearance } from '../../gameIso/rig/appearance';

export type CharMode = 'rolled' | 'reassigned' | 'pointBuy';

// ── Quotas d'allocation de la création (SOURCE UNIQUE : validation ET rendu les consomment) ──
/** « Vous pouvez sélectionner 3 Compétences auxquelles ajouter 5 Augmentations à chacune » (LDB 05 l.484). */
export const SPECIES_SKILLS_PLUS5 = 3;
/** « …et 3 Compétences auxquelles ajouter 3 Augmentations à chacune » (LDB 05 l.484). */
export const SPECIES_SKILLS_PLUS3 = 3;
export { CAREER_SKILL_ADVANCES, MAX_ADV_PER_SKILL };
/** « répartir comme bon vous semble un total de 5 Augmentations entre les Caractéristiques » (LDB 05 l.459). */
export const CAREER_CHAR_ADVANCES = 5;

/** Le brouillon = les choix de création (`ChoixDeCreation`, en ids) + l'état de l'assistant. */
export interface CreatorDraft
  extends Required<Pick<ChoixDeCreation, 'seed' | 'specChoices' | 'speciesTalentChoices' | 'randomSpecPicks' | 'talentRerolls' | 'skillAdvances' | 'pettySpells'>>,
    Pick<ChoixDeCreation, 'careerTalent' | 'trappingChoices' | 'talentsRolled'> {
  /** Format des choix (`FORMAT_DES_CHOIX`) — un brouillon persisté sans lui n'est pas relu. */
  v: typeof FORMAT_DES_CHOIX;
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
  /** Jets de carrière figés (1 puis 3) ; au-delà : relances libres (0 PX, RAW l.212). Chaque jet
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
  /** Nombre de relances des dix 2d10 (0 = tirage initial ; >0 → bonus perdus, RAW l.341). */
  charRerolls: number;
  /** Réassignation : pour chaque Caractéristique, l'INDEX du jet (permutation de 0..9). */
  assignment: Record<CharKey, number>;
  /** Répartition manuelle de 100 Points (min 4 / max 18, l.341). */
  pointBuy: Record<CharKey, number>;
  /** 5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.459). */
  charAdvancesAlloc: Partial<Record<CharKey, number>>;
  fateSplit: { fate: number; resilience: number };
  // 4) Compétences & Talents
  /** Compétences d'espèce à +5 / +3 (LDB 05 l.484) — `ChoixDeCreation.speciesSkillAdvances`. */
  speciesPlus5: RefDesignee[];
  speciesPlus3: RefDesignee[];
  // 5) Possessions
  /** Bourse de départ TIRÉE (LDB 05 l.578) — geste explicite requis (#393 correctif
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
  /** Apparence du héros d'un seul tenant ; l'espèce de rendu se dérive de `speciesId` (`createHero`). */
  apparence: Omit<Appearance, 'species'>;
}

export function newDraft(seed = (Date.now() & 0xffff) ^ ((Math.random() * 0xffff) | 0)): CreatorDraft {
  // Page blanche cérémonielle (arbitrage 2026-07-13) : aucune race/carrière pré-tirée — l'id vide
  // signifie « non choisi », la fiche vivante démarre grisée et se remplit choix par choix.
  return {
    v: FORMAT_DES_CHOIX,
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
    assignment: tableTotale(CHAR_KEYS, (_k, indice) => indice),
    pointBuy: tableTotale(CHAR_KEYS, () => 10),
    charAdvancesAlloc: {},
    fateSplit: { fate: 0, resilience: 0 },
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    talentRerolls: {},
    talentsRolled: false,
    specChoices: {},
    skillAdvances: {},
    pettySpells: [],
    label: '',
    motivation: '',
    ambitionShort: '',
    ambitionLong: '',
    apparence: { sex: 'M', build: 0.5, seed: (seed >> 2) & 0xffff },
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
  // `Combatant.species` est l'id LDB (rules) ; `appearance.species` est un id de rig → on
  // reconstruit le brouillon depuis l'id rules, pas depuis l'apparence.
  const speciesId = hero.species ?? d.speciesId;
  const withSp = withSpecies(d, speciesId);
  const withCa = hero.career ? withCareer(withSp, hero.career) : withSp;
  const { species: _espece, ...apparence } = hero.appearance ?? { species: undefined, ...d.apparence };
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
    apparence,
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
  const r = rollSpecies(fluxDeCreation(d.seed, 'espece'));
  // La borne tirée propose `ids` ; on sélectionne la 1ʳᵉ par défaut, le joueur peut choisir une autre.
  return withSpecies({ ...d, speciesRoll: r }, r.ids[0]);
}
// +20 PX tant que l'espèce choisie appartient à la BORNE tirée (le bonus récompense le tirage, l.87).
export const speciesXp = (d: CreatorDraft): number =>
  d.speciesRoll && d.speciesRoll.ids.includes(d.speciesId) ? XP_SPECIES_ACCEPTED : 0;

/** Choix par adresse (`adresseDeCreation`) privés des adresses aux préfixes donnés. */
function horsAdresses<V>(parAdresse: Record<string, V>, ...prefixes: string[]): Record<string, V> {
  return Object.fromEntries(Object.entries(parAdresse).filter(([a]) => !prefixes.some((p) => a.startsWith(p))));
}
/** Choix par adresse privés de l'adresse `adresse`. */
function sansAdresse<V>(parAdresse: Record<string, V>, adresse: string): Record<string, V> {
  return Object.fromEntries(Object.entries(parAdresse).filter(([a]) => a !== adresse));
}

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
    talentRerolls: {},
    specChoices: horsAdresses(d.specChoices, 'espece:', 'ajout:'),
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
 *  PX, #393 correctif utilisateur). Garde posée ICI (pas seulement côté UI désactivée) — aucun
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
    const r = rollCareer(pool, sp, fluxDeCreation(d.seed, 'carriere'));
    // Chaque jet désigne une borne (`ids`) ; défaut = 1ʳᵉ carrière, le joueur peut en choisir une autre.
    return r ? withCareer({ ...d, careerRolls: [r] }, r.ids[0]) : d;
  }
  if (n === 1) {
    // « Faites deux lancers de plus, ce qui porte votre total à 3 choix » (LDB 05 l.211).
    const rng = fluxDeCreation(d.seed, 'carriere:deux-de-plus');
    const r2 = rollCareer(pool, sp, rng);
    const r3 = rollCareer(pool, sp, rng);
    if (!r2 || !r3) return d;
    return { ...d, careerRolls: [...d.careerRolls, r2, r3] };
  }
  // « continuez à relancer jusqu'à obtenir quelque chose qui vous plaît » (l.212) — 0 PX.
  const r = rollCareer(pool, sp, fluxDeCreation(d.seed, 'carriere:relance', d.careerFreeRolls));
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
    specChoices: horsAdresses(d.specChoices, 'carriere:', 'ajout:'),
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
  const rng = fluxDeCreation(d.seed, 'caracteristiques', d.charRerolls);
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
  const { roll: r, id } = rollStar(fluxDeCreation(d.seed, 'signe')); // `id` STABLE du signe (≠ libellé)
  return { ...d, starRoll: id, starRollValue: r, star: id };
}

/** Ascendant (ADE II 3 l.496) + un signe par demeure céleste (l.514, la donnée `celestialHouses`
 *  ADE II 3 l.504-512) — flavor pur, tirages figés par le seed. `dwellings[].house` = ID de la demeure
 *  (ids internes, libellés à l'affichage) ; `sign` reste un libellé lisible (flavor stocké sur la
 *  fiche, aucune mécanique n'y référence un signe). */
export function rollDraftAstrology(d: CreatorDraft): CreatorDraft {
  const rng = fluxDeCreation(d.seed, 'astrologie');
  const signLabel = (): string => { const id = rollStar(rng).id; return garanti(findStarById(id), id, 'signe astral').label; };
  return { ...d, ascendant: signLabel(), dwellings: celestialHouses.map((h) => ({ house: h.id, sign: signLabel() })) };
}

// ── 4) Compétences & Talents ──
/** Talents d'espèce résolus (choix appliqués, tirages aléatoires FIGÉS par le seed) — les TIRÉS AU
 *  D100 n'y figurent qu'une fois le geste « Tirer aux dés » posé (`talentsRolled`, #393). */
function resolvedSpeciesTalents(d: CreatorDraft): RefDesignee[] {
  const sp = draftSpecies(d);
  return sp ? resolveSpeciesTalentsDetail(sp, d).map((t) => t.ref) : [];
}

/** Geste « Tirer aux dés » des Talents d'espèce aléatoires (LDB 05 l.484, table l.514) — tirages figés
 *  par le seed, découverts ici ; la relance d'un doublon passe par `rerollDraftTalent`. */
export function rollDraftTalents(d: CreatorDraft): CreatorDraft {
  return d.talentsRolled ? d : { ...d, talentsRolled: true };
}

/** Relance du tirage à `adresse` (LDB 05 l.484) : son rang effectif + 1, s'il est un doublon ; efface
 *  l'utilisation choisie à cette adresse (`randomSpecPicks`). */
export function rerollDraftTalent(d: CreatorDraft, adresse: string): CreatorDraft {
  const tirage = speciesTalentRandomDrawn(d).find((t) => t.adresse === adresse);
  if (!tirage?.doublon) return d;
  return { ...d, talentRerolls: { ...d.talentRerolls, [adresse]: tirage.rang + 1 }, randomSpecPicks: sansAdresse(d.randomSpecPicks, adresse) };
}

/** Utilisation `spec` du Talent tiré à `adresse` (LDB 10 l.17 ; `randomSpecPicks`, lu par `rollRandomTalent`). */
export function withRandomTalentSpec(d: CreatorDraft, adresse: string, spec: string): CreatorDraft {
  return { ...d, randomSpecPicks: spec ? { ...d.randomSpecPicks, [adresse]: spec } : sansAdresse(d.randomSpecPicks, adresse) };
}

/** Option `option` (une option de `of`) de l'entrée « A ou B » à `adresse` ; changer d'option (`cleDOption`)
 *  remet à zéro les relances et les spécialisations des tirages de CETTE entrée (`talentRerolls`, `randomSpecPicks`). */
export function withSpeciesTalentChoice(d: CreatorDraft, adresse: string, option: AdvancementRef): CreatorDraft {
  const speciesTalentChoices = { ...d.speciesTalentChoices, [adresse]: option };
  const avant = d.speciesTalentChoices[adresse];
  if (avant != null && cleDOption(avant) === cleDOption(option)) return { ...d, speciesTalentChoices };
  return { ...d, speciesTalentChoices, talentRerolls: horsAdresses(d.talentRerolls, `${adresse}:`), randomSpecPicks: horsAdresses(d.randomSpecPicks, `${adresse}:`) };
}

/** Talents d'espèce en TROIS lots (LDB 05 l.484, écran Talents — 5c), dérivés de la DONNÉE
 *  (`sp.talents`) : FIXES (acquis d'office) / À CHOISIR (« A ou B », par adresse) / ALÉATOIRES
 *  (nombre de tirages d100). */
export function speciesTalentFixedEntries(d: CreatorDraft): RefDesignee[] {
  return (draftSpecies(d)?.talents ?? []).flatMap((a) => ('id' in a ? [designer('talent', a)] : []));
}
export function speciesTalentChoiceEntries(d: CreatorDraft): { adresse: string; ref: AdvancementRef; options: AdvancementRef[] }[] {
  return (draftSpecies(d)?.talents ?? []).flatMap((a, i) => ('pick' in a ? [{ adresse: adresseDeCreation.especeTalent(i), ref: a, options: a.of }] : []));
}
export function speciesTalentRandomCount(d: CreatorDraft): number {
  return (draftSpecies(d)?.talents ?? []).reduce((n, a) => n + ('random' in a ? a.random : 0), 0);
}
/** Un Talent tiré au d100 (`TalentDEspece.tirage`) ; `auMaxi` : doublon dont le Maxi est déjà atteint
 *  (LDB 10 l.18), sans effet s'il est gardé ; `utilisations` : le pool de `rollRandomTalent`
 *  (`specPoolOf`, LDB 10 l.17) ; `utilisationChoisie` : `randomSpecPicks[adresse]` s'il est de ce pool. */
export interface TirageDeTalent {
  ref: RefDesignee;
  adresse: string;
  rang: number;
  doublon: boolean;
  auMaxi: boolean;
  utilisations: string[];
  utilisationChoisie: string | null;
}
/** Les N talents TIRÉS au d100 (LDB 05 l.484, table l.514-531), tels que le geste 5c les découvre — VIDE tant que le
 *  joueur n'a pas tiré (#393 agentivité). Utilisation : `withRandomTalentSpec` ; relance : `rerollDraftTalent`. */
export function speciesTalentRandomDrawn(d: CreatorDraft): TirageDeTalent[] {
  const sp = draftSpecies(d);
  if (!sp || !d.talentsRolled) return [];
  const partiel: Combatant = { ...probeHero(d, false, true), talents: [] };
  return resolveSpeciesTalentsDetail(sp, d).flatMap(({ ref, tirage }) => {
    const auMaxi = !!tirage?.doublon && talentMaxReached(partiel, ref.id, ref.spec);
    acquerirTalent(partiel, ref);
    if (!tirage) return [];
    const utilisations = specPoolOf(garanti(findTalentById(ref.id), ref.id, 'Talent'));
    const choisie = d.randomSpecPicks[tirage.adresse];
    return [{ ref, ...tirage, auMaxi, utilisations, utilisationChoisie: choisie != null && utilisations.includes(choisie) ? choisie : null }];
  });
}
/** Les Talents tirés dont l'utilisation reste à choisir (LDB 10 l.17 ; `withRandomTalentSpec`). */
export function tiragesSansUtilisation(d: CreatorDraft): TirageDeTalent[] {
  return speciesTalentRandomDrawn(d).filter((t) => t.utilisations.length > 0 && t.utilisationChoisie == null);
}
/** Toutes les décisions de Talents d'espèce « A ou B » sont-elles tranchées ? */
export function speciesTalentChoicesDone(d: CreatorDraft): boolean {
  return speciesTalentChoiceEntries(d).every((e) => d.speciesTalentChoices[e.adresse] != null);
}

/** Probe : héros partiel (caracs + talents d'espèce + talent de carrière) pour Maxi/additions.
 *  `charsAlloc` compose `charAdvancesAlloc` aux Caractéristiques (BFM final requis par
 *  `pettySpellQuota`) — n'affecte QUE les Caractéristiques du probe, pas sa sémantique pour les
 *  autres appelants (Maxi de talent, additions de carrière). */
export function probeHero(d: CreatorDraft, withCareerTalent = true, charsAlloc = false): Combatant {
  const characteristics = draftChars(d);
  const acquis: PorteurDeTalents = { characteristics, talents: [] };
  const add = (ref: RefDesignee) => {
    acquerirTalent(acquis, ref);
  };
  for (const t of resolvedSpeciesTalents(d)) add(t);
  if (withCareerTalent && d.careerTalent) add(d.careerTalent);
  if (charsAlloc) for (const k of CHAR_KEYS) characteristics[k] += d.charAdvancesAlloc[k] ?? 0;
  return { characteristics, talents: acquis.talents ?? [], skills: [], movement: draftSpecies(d)?.movement ?? 0 } as unknown as Combatant;
}

/** Compétences de carrière allouables : un emplacement par entrée du Niveau 1 (LDB 05 l.535) — `cle`
 *  indexe `d.skillAdvances` (`competencesDeCarriere`, la lecture de `createHero`). */
export function careerSkillEntries(d: CreatorDraft): CompetenceDeCarriere[] {
  return competencesDeCarriere(draftLevel(d), probeHero(d), d.specChoices).filter((c) => !c.ajout);
}

/** « Répartition simple » (étape 5) : la répartition par défaut de `createHero`
 *  (`repartitionDeCarriere`). */
export function evenCareerSkillAdvances(d: CreatorDraft): Record<string, number> {
  return repartitionDeCarriere(careerSkillEntries(d));
}

/** Pose la spécialisation `spec` de la Compétence de carrière `c` (LDB 09 l.38) ; ses Augmentations
 *  suivent la Compétence désignée (`cle`). */
export function withCareerSkillSpec(d: CreatorDraft, c: CompetenceDeCarriere, spec: string): CreatorDraft {
  const specChoices = { ...d.specChoices };
  if (spec) specChoices[c.adresse] = spec;
  else delete specChoices[c.adresse];
  const next = { ...d, specChoices };
  const cle = careerSkillEntries(next).find((e) => e.adresse === c.adresse)?.cle;
  if (!cle || cle === c.cle) return next;
  const skillAdvances = { ...d.skillAdvances };
  const adv = skillAdvances[c.cle] ?? 0;
  delete skillAdvances[c.cle];
  if (adv) skillAdvances[cle] = Math.min(MAX_ADV_PER_SKILL, (skillAdvances[cle] ?? 0) + adv);
  return { ...next, skillAdvances };
}

/** Les Compétences d'espèce (LDB 05 l.484), emplacements de `sp.skills`. */
export function speciesSkillRefs(d: CreatorDraft): RefASpecialisation[] {
  return (draftSpecies(d)?.skills ?? []).flatMap((a) => ('id' in a ? [a] : []));
}

/** La Compétence retenue qui occupe l'emplacement d'espèce `ref` : même (id, spec) pour un emplacement
 *  fixe ; même id, hors des spécialisations fixes de la liste, pour un joker. */
function occupe(d: CreatorDraft, ref: RefASpecialisation): (r: RefDesignee) => boolean {
  if (ref.choix == null) return (r) => r.id === ref.id && (r.spec ?? '') === (ref.spec ?? '');
  const fixes = speciesSkillRefs(d).filter((x) => x.choix == null && x.id === ref.id).map((x) => x.spec ?? '');
  return (r) => r.id === ref.id && !fixes.includes(r.spec ?? '');
}

/** La Compétence d'espèce retenue (+5/+3) pour l'emplacement `ref`, s'il y en a une. */
export function speciesSkillPick(d: CreatorDraft, ref: RefASpecialisation): RefDesignee | undefined {
  return [...d.speciesPlus5, ...d.speciesPlus3].find(occupe(d, ref));
}

/** Palier (+5/+3/0) d'une Compétence de race dans le brouillon (LDB 05 l.484). */
export function speciesSkillTier(d: CreatorDraft, ref: RefASpecialisation): 0 | 3 | 5 {
  const m = occupe(d, ref);
  return d.speciesPlus5.some(m) ? 5 : d.speciesPlus3.some(m) ? 3 : 0;
}

/** Pose la Compétence de race `ref` au palier `tier` (0/3/5) en respectant les quotas (3 à +5, 3 à
 *  +3, LDB 05 l.484) : la retire des deux listes puis l'ajoute au palier cible si son quota a de la
 *  place — sinon renvoie le brouillon INCHANGÉ. Source unique consommée par le Stepper de l'étape 5. */
export function withSpeciesSkillTier(d: CreatorDraft, ref: RefASpecialisation, tier: 0 | 3 | 5): CreatorDraft {
  const m = occupe(d, ref);
  const retenue = speciesSkillPick(d, ref) ?? (ref.choix == null ? designer('skill', ref) : { id: ref.id });
  const plus5 = d.speciesPlus5.filter((r) => !m(r));
  const plus3 = d.speciesPlus3.filter((r) => !m(r));
  if (tier === 5) {
    if (plus5.length >= SPECIES_SKILLS_PLUS5) return d;
    plus5.push(retenue);
  } else if (tier === 3) {
    if (plus3.length >= SPECIES_SKILLS_PLUS3) return d;
    plus3.push(retenue);
  }
  return { ...d, speciesPlus5: plus5, speciesPlus3: plus3 };
}

/** Pose la spécialisation `spec` de la Compétence d'espèce retenue à l'emplacement joker `ref`. */
export function withSpeciesSkillSpec(d: CreatorDraft, ref: RefASpecialisation, spec: string): CreatorDraft {
  const m = occupe(d, ref);
  const poser = (r: RefDesignee): RefDesignee => (m(r) ? (spec ? { id: r.id, spec } : { id: r.id }) : r);
  return { ...d, speciesPlus5: d.speciesPlus5.map(poser), speciesPlus3: d.speciesPlus3.map(poser) };
}

/** Palier atteignable au-dessus (`dir=1`) / au-dessous (`dir=-1`) du palier courant, quotas inclus —
 *  `null` = bouton grisé. Le `+` saute +3 quand son quota est plein mais qu'un +5 reste libre (et
 *  inversement le `−`) : le geste reste un Stepper, les paliers valides suivent le RAW. */
export function speciesSkillStep(d: CreatorDraft, ref: RefASpecialisation, dir: 1 | -1): (0 | 3 | 5) | null {
  const cur = speciesSkillTier(d, ref);
  const m = occupe(d, ref);
  const p5free = d.speciesPlus5.filter((r) => !m(r)).length < SPECIES_SKILLS_PLUS5;
  const p3free = d.speciesPlus3.filter((r) => !m(r)).length < SPECIES_SKILLS_PLUS3;
  if (dir === 1) {
    if (cur === 0) return p3free ? 3 : p5free ? 5 : null;
    if (cur === 3) return p5free ? 5 : null;
    return null;
  }
  if (cur === 5) return p3free ? 3 : 0;
  if (cur === 3) return 0;
  return null;
}

/** Une Compétence retenue attend-elle sa spécialisation (joker, LDB 09 l.38) ? */
export const attendSaSpec = (r: RefDesignee): boolean => r.spec == null && estSpecialisable('skill', r.id);

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
  const { id, spec } = d.careerTalent;
  const nom = refLabel('talents', d.careerTalent);
  const levels = levelsForCareer(d.careerId);
  const tSlots = talentSlots(levels, 1);
  switch (statutOuRefus(tSlots, {}, id, spec, [...skillSlots(levels, 1), ...tSlots])) {
    case 'absent': return `« ${nom} » ne figure pas parmi les Talents de votre premier niveau de carrière : choisissez-en un autre.`;
    case 'sansSpec': return `Choisissez la spécialisation de votre Talent de carrière « ${nom} ».`;
    case 'nonCouvert': return `« ${nom} » n'est proposé par aucun Talent de votre premier niveau de carrière : choisissez-en un autre.`;
  }
  if (talentMaxReached(probeHero(d, false), id, spec)) return `« ${nom} » : Maxi déjà atteint.`;
  return null;
}

/** Options du Talent de carrière (emplacements du Niveau 1) : les désignations proposées par un joker
 *  (`choices`, sinon `null`), la désignation portée par CET emplacement (`selected` : la sienne pour un
 *  emplacement fixe, le Talent de carrière qu'il couvre pour un joker) et son Maxi. */
export function careerTalentOptions(d: CreatorDraft): { ref: RefASpecialisation; choices: RefDesignee[] | null; selected: RefDesignee | null; maxed: boolean }[] {
  const probe = probeHero(d, false);
  return (draftLevel(d)?.talents ?? []).flatMap((ref) => {
    if (!('id' in ref)) return [];
    const choices = ref.choix == null ? null : poolDuJoker('talent', ref).map((spec) => ({ id: ref.id, spec }));
    const t = d.careerTalent;
    const selected = !choices ? designer('talent', ref) : t && choices.some((c) => refKey(c.id, c.spec) === refKey(t.id, t.spec)) ? t : null;
    return [{ ref, choices, selected, maxed: !!selected && talentMaxReached(probe, selected.id, selected.spec) }];
  });
}

// ── 5) Possessions ──
/** Montant de la bourse — PUR/déterministe (`d.seed`), jamais une relance (LDB 05 : un seul jet).
 *  La ceinture d'agentivité (`wealthRoll`, geste requis avant affichage) vit dans l'UI, pas ici. */
export function draftWealth(d: CreatorDraft): Money {
  const status = parseStatus(draftLevel(d)?.status ?? 'Bronze 0');
  return rollInitialWealth(status, fluxDeCreation(d.seed, 'bourse'));
}
/** Pose le geste « Tirer aux dés » de la bourse — FIGÉ (aucune relance, LDB 05 l.578 n'en offre
 *  aucune) : le montant lui-même est déjà déterminé par `d.seed`, ce geste n'en découvre que
 *  l'affichage (anti-résultat-pré-rempli, #393). */
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
  const rng = fluxDeCreation(d.seed, 'details');
  return { age: rollAge(sp, rng), height: rollHeight(sp, rng), eyes: rollEyes(sp, rng), hair: rollHair(sp, rng) };
}

export type StepId = 'species' | 'career' | 'chars' | 'star' | 'skills' | 'trappings' | 'details' | 'presentation';

/** Étapes du créateur dans l'ordre — `star` insérée après `chars` quand la règle optionnelle ADE II
 *  `creation-signes-astraux` est active. SOURCE UNIQUE de l'ordre ET de la présence des étapes (le
 *  rendu et la validation en dérivent — plus d'index positionnel fragile). Étape 8 renommée
 *  « Présentation » (#393, arbitrage README maquettes : « le personnage se PRÉSENTE »). */
export function stepIds(): StepId[] {
  const ids: StepId[] = ['species', 'career', 'chars', 'skills', 'trappings', 'details', 'presentation'];
  if (rule('creation-signes-astraux')) ids.splice(3, 0, 'star');
  return ids;
}

// ── Validation par étape ──
/** Contexte dérivé du brouillon, calculé UNE fois par validation et passé à l'étape. */
interface StepCtx { d: CreatorDraft; sp: ReturnType<typeof draftSpecies>; level: ReturnType<typeof draftLevel> }

/**
 * Validateurs PAR étape — table TOTALE `Record<StepId, …>` : ajouter une étape à `StepId` force
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
    return messageDesCompetencesDeRace(d) ?? messageDesTalentsDeRace(d) ?? messageDesCompetencesDeCarriere(d) ?? careerTalentMessage(d) ?? messageDeMagieMineure(d);
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
  const defauts = speciesSkillDefaults(sp);
  const hero = createHero({
    speciesId: d.speciesId,
    careerId: d.careerId,
    label: d.label.trim() || 'Aventurier',
    manualChars: draftChars(d),
    charAdvancesAlloc: d.charAdvancesAlloc,
    careerTalent: d.careerTalent,
    skillAdvances: d.skillAdvances,
    speciesSkillAdvances: {
      plus5: d.speciesPlus5.length === SPECIES_SKILLS_PLUS5 ? d.speciesPlus5 : defauts.plus5,
      plus3: d.speciesPlus3.length === SPECIES_SKILLS_PLUS3 ? d.speciesPlus3 : defauts.plus3,
    },
    seed: d.seed,
    speciesTalentChoices: d.speciesTalentChoices,
    randomSpecPicks: d.randomSpecPicks,
    talentRerolls: d.talentRerolls,
    talentsRolled: d.talentsRolled,
    specChoices: d.specChoices,
    starId: d.star,
    fateSplit: d.fateSplit,
    xpBonus: xpTotal(d),
    trappingChoices: d.trappingChoices,
    pettySpells: d.pettySpells,
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
    apparence: d.apparence,
    id,
  });
  if (d.star) hero.star = d.star;
  return hero;
}

/** Le total déjà alloué des 40 Augmentations de carrière. */
export function careerAdvTotal(d: CreatorDraft): number {
  return careerSkillEntries(d).reduce((a, c) => a + (d.skillAdvances[c.cle] ?? 0), 0);
}

// ── Étape 5 « Compétences & Talents » — complétion PAR SOUS-ÉCRAN (5a/5b/5c, charte Atelier) : la
// fiche vivante et les onglets de sous-étape en dérivent — SOURCE UNIQUE, jamais un `ahead('skills')`
// tout-ou-rien pour ce qui se joue À L'INTÉRIEUR de l'étape.
/** 5a — Compétences de race : quotas 3×+5/3×+3 posés, sans doublon, Spécialisations choisies (LDB 05 l.484). */
function messageDesCompetencesDeRace(d: CreatorDraft): string | null {
  if (d.speciesPlus5.length !== SPECIES_SKILLS_PLUS5 || d.speciesPlus3.length !== SPECIES_SKILLS_PLUS3)
    return `Choisissez ${SPECIES_SKILLS_PLUS5} Compétences d'espèce à +5 et ${SPECIES_SKILLS_PLUS3} à +3.`;
  const cles = [...d.speciesPlus5, ...d.speciesPlus3].map((r) => refKey(r.id, r.spec));
  if (new Set(cles).size !== cles.length) return 'Une Compétence d\'espèce ne peut pas être à la fois +5 et +3.';
  const sansSpec = [...d.speciesPlus5, ...d.speciesPlus3].find(attendSaSpec);
  if (sansSpec) return `Choisissez la Spécialisation de « ${refLabel('skills', sansSpec)} ».`;
  return null;
}
/** Entrées d'espèce « A ou B » : un choix requis quand il y en a (LDB 05 l.484). */
function messageDesTalentsDeRace(d: CreatorDraft): string | null {
  const ouvert = speciesTalentChoiceEntries(d).find((e) => d.speciesTalentChoices[e.adresse] == null);
  if (ouvert) return `Choisissez : « ${advancementLabel('talents', ouvert.ref)} ».`;
  if (speciesTalentRandomCount(d) > 0 && !d.talentsRolled) return 'Tirez vos Talents aléatoires aux dés.';
  const [sansUtilisation] = tiragesSansUtilisation(d);
  if (sansUtilisation) return `Choisissez l'utilisation du Talent tiré « ${refLabel('talents', { id: sansUtilisation.ref.id })} ».`;
  return null;
}
/** 5b — les 40 Augmentations réparties, 10 au plus par Compétence, Spécialisations choisies (LDB 05 l.535). */
function messageDesCompetencesDeCarriere(d: CreatorDraft): string | null {
  const prise = careerSkillEntries(d).find((c) => c.ref.choix != null && c.designee?.spec != null && !c.libre(c.designee.spec));
  if (prise?.designee) return `« ${refLabel('skills', prise.designee)} » : ${t('slot.takenByOther')}.`;
  const total = careerAdvTotal(d);
  if (total !== CAREER_SKILL_ADVANCES) return `Répartissez ${CAREER_SKILL_ADVANCES} Augmentations de carrière (actuel : ${total}).`;
  for (const c of careerSkillEntries(d)) {
    const adv = d.skillAdvances[c.cle] ?? 0;
    const nom = c.designee ? refLabel('skills', c.designee) : advancementLabel('skills', c.ref);
    if (adv < 0 || adv > MAX_ADV_PER_SKILL) return `Maximum ${MAX_ADV_PER_SKILL} Augmentations par Compétence à la création (« ${nom} »).`;
    if (adv > 0 && !c.designee) return `Choisissez la Spécialisation de « ${nom} ».`;
  }
  return null;
}
/** Sorts de Magie mineure : exactement le quota (LDB 10 l.714). */
function messageDeMagieMineure(d: CreatorDraft): string | null {
  const quota = pettySpellQuota(d);
  return quota && d.pettySpells.length !== quota ? `Choisissez vos ${quota} sorts de Magie mineure (actuel : ${d.pettySpells.length}).` : null;
}

export function speciesSkillsDone(d: CreatorDraft): boolean {
  return messageDesCompetencesDeRace(d) === null;
}
export function careerSkillsDone(d: CreatorDraft): boolean {
  return messageDesCompetencesDeCarriere(d) === null;
}
/** 5c — Talents : aléatoires TIRÉS + choix « A ou B » d'espèce tranché + Talent de carrière choisi
 *  + Magie mineure. */
export function talentsDone(d: CreatorDraft): boolean {
  const sp = draftSpecies(d);
  return !!sp && messageDesTalentsDeRace(d) === null && careerTalentMessage(d) === null && messageDeMagieMineure(d) === null;
}

/** Trois sous-écrans de l'étape 5 (charte Atelier, dock d'onglets « a/b/c »). */
export type SkillsSub = 'race' | 'career' | 'talents';

/** Bandeau de pied PAR SOUS-ONGLET (5a/5b/5c) — chaque volet reflète SA propre complétion au lieu
 *  du premier blocage toutes-branches de `validateStep('skills')` (agent-œil, LOT de clôture). */
export function skillsSubMessage(d: CreatorDraft, sub: SkillsSub): string {
  const sp = draftSpecies(d);
  if (!sp) return 'Choisissez votre race.';
  switch (sub) {
    case 'race':
      return messageDesCompetencesDeRace(d) ?? `Compétences de race posées — ${SPECIES_SKILLS_PLUS5} à +5, ${SPECIES_SKILLS_PLUS3} à +3.`;
    case 'career':
      return messageDesCompetencesDeCarriere(d) ?? `Compétences de carrière posées — ${CAREER_SKILL_ADVANCES} Augmentations réparties.`;
    case 'talents': {
      const refus = messageDesTalentsDeRace(d) ?? careerTalentMessage(d) ?? messageDeMagieMineure(d);
      if (refus) return refus;
      // Ce qui a été réglé pour CETTE carrière (#1607).
      const regles = [
        ...(speciesTalentChoiceEntries(d).length || speciesTalentRandomCount(d) ? ['race'] : []),
        'carrière',
        ...(pettySpellQuota(d) ? ['Magie mineure'] : []),
      ];
      const liste = regles.length > 1 ? `${regles.slice(0, -1).join(', ')} et ${regles[regles.length - 1]}` : regles[0];
      return `Talents tranchés — ${liste} réglés.`;
    }
  }
}
