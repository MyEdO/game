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
import { fabriqueLocale, type FabriqueDId } from '../../engine/fabriqueDId';
import { tableTotale } from '../../lib/tableTotale';
import { CharKey, CHAR_KEYS, Characteristics, Combatant, type HeroDetails, type ReferenceDeCouleur } from '../../engine/types';
import { garanti } from '../../lib/garanti';
import type { Status } from '../../engine/money';
import {
  rollSpecies,
  rollCareer,
  rollVariante,
  validatePointBuy,
  POINT_BUY_TOTAL,
  rollInitialWealth,
  type TirageDeRichesse,
  tirerLesDetails,
  nombreDeTiragesDesYeux,
  rollStar,
  XP_STAR_ROLLED,
  pettySpellQuotaFor,
} from '../../engine/creation';
import { rule } from '../../engine/policy';
import { listeEt, t } from '../../i18n';
import {
  createHero,
  resolveSpeciesTalentsDetail,
  competencesDeCarriere,
  repartitionDeCarriere,
  speciesSkillDefaults,
  designer,
  poolDuJoker,
  fluxDeCreation,
  cleDOption,
  optionsDesTalentsDEspece,
  baseDEspece,
  type ChoixDeCreation,
  type ReservesDeDepart,
  type CompetenceDeCarriere,
} from '../../engine/character';
import { adresseDeCreation, deFamille, tirageSous, type AdresseDeCreation } from '../../engine/adresseDeCreation';
import {
  dotationsDuHeros,
  emplacementsDeDotation,
  emplacementTranche,
  estEmplacementRacine,
  porteurDeLEspece,
  type PorteurDArme,
} from '../../engine/trappingChoices';
import { refKey, talentMaxReached, acquerirTalent, type PorteurDeTalents, skillSlots, talentSlots, statutOuRefus } from '../../engine/careerSlots';
import {
  findSpeciesById,
  findCareerById,
  species,
  especesCrb,
  careersForSpecies,
  carrieresTirables,
  offreDuJet,
  varianteDe,
  portionDeLaColonne,
  levelsForCareer,
  advancementLabel,
  refLabel,
  findStarById,
  eyes,
  celestialHouses,
  SpeciesData,
  CareerLevelData,
  trappingRefLabel,
  type AdvancementRef,
  type CareerData,
  type JetDeCarriere,
  type TrappingRef,
  ouvertParSaRegle,
} from '../../data';
import { modeleDe, type CleDeProgression } from '../../engine/modeleDeProgression';
import { procedureDe, type CharMode, type Gain, type MethodeTenue } from './procedure';
import { estSpecialisable, type RefDesignee, type RefASpecialisation, memeSpecialisation } from '../../data/schemas/grammaire/ref';
import type { TirageDeTalents } from '../../data/schemas/grammaire/avancement';
import type { Appearance } from '../../engine/authoringAppearance';
import { generateName } from '../../engine/names';
import { makeRNG } from '../../engine/dice';
import { sexeSchema, type Sexe } from '../../data/schemas/grammaire/valeurs';

/** Le brouillon = les choix de création (`ChoixDeCreation`, en ids) + l'état de l'assistant. */
export interface CreatorDraft
  extends Required<Pick<ChoixDeCreation, 'seed' | 'specChoices' | 'speciesTalentChoices' | 'randomSpecPicks' | 'talentRerolls' | 'skillAdvances' | 'pettySpells'>>,
    Pick<ChoixDeCreation, 'careerTalent' | 'trappingChoices' | 'talentsRolled'>,
    Pick<HeroDetails, 'age' | 'height' | 'eyes' | 'hair'> {
  /** Clé de la procédure de création (`procedureDe`), posée à l'ouverture depuis la règle `creation-5e`. */
  procedure: CleDeProgression;
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
  /** Jets de carrière figés, dans l'ordre : le premier, les deux de plus, puis les relances libres. Chacun porte son
   *  second lancer s'il a été fait ; son offre se lit par `offreDuJet`. LDB 05 l.208-212 ; AA 02 l.109-113 */
  careerRolls: JetDeCarriere[];
  /** Dotations du Niveau 2 retenues au titre des jets de carrière gardés, par rang dans la liste du Niveau. CRB 013 l.11-15 */
  dotationsDuNiveauSuivant: number[];
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
  /** Répartition sur les 3 Caractéristiques de carrière (`repartition(d, 'augmentation')`). LDB 05 l.459 ; CRB 014 l.11, l.15 */
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

export function newDraft(seed: number): CreatorDraft {
  // Page blanche cérémonielle (arbitrage 2026-07-13) : aucune race/carrière pré-tirée — l'id vide
  // signifie « non choisi », la fiche vivante démarre grisée et se remplit choix par choix.
  return {
    procedure: rule('creation-5e') ? '5e' : '4e',
    seed,
    speciesId: '',
    careerId: '',
    ignoreRestrictions: false,
    coastalSwap: false,
    careerRolls: [],
    dotationsDuNiveauSuivant: [],
    charMode: 'tire',
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
    apparence: { sex: 'M' },
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
export function draftFromHero(hero: Combatant, seed: number): CreatorDraft {
  const d = newDraft(seed);
  // `Combatant.species` est l'id LDB (rules) ; `appearance.species` est un id d'APPARENCE → on
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

/** L'espèce `id` telle que la procédure du brouillon la joue : celle de `species.json`, ou surchargée par son entrée
 *  d'`especesCrb.json` (sans entrée : absente). Une espèce du CRB n'a ni Résilience ni points supplémentaires de Destin.
 *  CRB 006 l.19-29 */
export function especeDuBrouillon(d: Pick<CreatorDraft, 'procedure'>, id: string): SpeciesData | undefined {
  const sp = findSpeciesById(id);
  const especes = procedureDe(d).especes;
  switch (especes.type) {
    case 'ldb': return sp;
    case 'crb': {
      const e = especesCrb.find((x) => x.id === id);
      return sp && e ? { ...sp, movement: e.movement, baseChar: e.baseChar, skills: e.skills, talents: e.talents, fate: { fate: e.fate, resilience: 0, extra: 0 } } : undefined;
    }
  }
}
/** Les espèces que la procédure du brouillon offre, dans l'ordre de leur donnée. LDB 04 l.91 ; CRB 006 l.5 */
export function especesOffertes(d: Pick<CreatorDraft, 'procedure'>): SpeciesData[] {
  const especes = procedureDe(d).especes;
  switch (especes.type) {
    case 'ldb': return species.filter(ouvertParSaRegle);
    case 'crb': return especesCrb.flatMap((e) => especeDuBrouillon(d, e.id) ?? []);
  }
}
/** Les langues d'espèce du brouillon et leurs points. CRB 008 l.55 */
export function languesDEspece(d: CreatorDraft): { refs: RefDesignee[]; points: number } {
  const especes = procedureDe(d).especes;
  switch (especes.type) {
    case 'ldb': return { refs: [], points: 0 };
    case 'crb': return { refs: especesCrb.find((e) => e.id === d.speciesId)?.langues ?? [], points: especes.pointsDesLangues };
  }
}
/** Les réserves de départ du brouillon : celles de l'espèce (Destin, Résilience et leurs points supplémentaires ; ou
 *  Destin et Fortune du CRB), plus la Fortune d'une espèce tirée gardée et le Destin d'Oh Fickle Fate. LDB 05 l.426 ;
 *  CRB 006 l.7, l.27 ; CRB 016 l.69 */
export function reservesDeDepart(d: CreatorDraft): ReservesDeDepart {
  const sp = draftSpecies(d);
  const especes = procedureDe(d).especes;
  const base: ReservesDeDepart = (() => {
    switch (especes.type) {
      case 'ldb': return { fate: (sp?.fate.fate ?? 0) + d.fateSplit.fate, resilience: (sp?.fate.resilience ?? 0) + d.fateSplit.resilience };
      case 'crb': {
        const e = especesCrb.find((x) => x.id === d.speciesId);
        return { fate: e?.fate ?? 0, fortuneDeBase: e?.fortune ?? 0 };
      }
    }
  })();
  const champ = modeleDe({ progression: procedureDe(d).progression }).reserves.baseDeLaFortune;
  const reserves: ReservesDeDepart = { ...base, fate: base.fate + ohFickleFate(d) };
  reserves[champ] = (reserves[champ] ?? 0) + (gainDEspece(d).fortune ?? 0);
  return reserves;
}

/** Race du brouillon — `undefined` tant qu'aucune n'est choisie (page blanche, id vide). */
export const draftSpecies = (d: CreatorDraft): SpeciesData | undefined => (d.speciesId ? especeDuBrouillon(d, d.speciesId) : undefined);
/** Porteur d'arme du brouillon : celui de sa race (`porteurDeLEspece`), sans Taille ni Groupe sans race (Moyenne,
 *  `effectiveSize`). */
export const draftPorteur = (d: CreatorDraft): PorteurDArme => {
  const sp = draftSpecies(d);
  return sp ? porteurDeLEspece(sp) : {};
};
export const draftLevel = (d: CreatorDraft): CareerLevelData | undefined =>
  levelsForCareer(d.careerId).find((l) => l.level === 1);
/** Caractéristiques de carrière du Niveau 1 (clés `CharKey` stables) sur lesquelles se répartissent
 *  les 5 Augmentations gratuites de création (LDB 05 l.459). La donnée EST déjà en `CharKey`
 *  (« CT », « F »… ; cf. le champ characteristics de CareerLevelData). SOURCE UNIQUE
 *  partagée par la grille d'allocation et `validateStep` (plus de re-dérivation divergente). */
export const careerCharKeys = (d: CreatorDraft): CharKey[] =>
  draftLevel(d)?.characteristics ?? [];

// ── 1) Espèce ──
export function rollDraftSpecies(d: CreatorDraft): CreatorDraft {
  if (d.speciesRoll) return d; // FIGÉ : pas de relance (LDB 04 — aucune n'est offerte)
  const r = rollSpecies(fluxDeCreation(d.seed, 'espece'), especesOffertes(d));
  // La rangée tirée offre `ids`, sa première choisie par défaut. LDB 04 l.91 ; ADE I 02 l.257
  return withSpecies({ ...d, speciesRoll: r }, r.ids[0]);
}
/** L'espèce choisie est-elle de la rangée tirée ? LDB 04 l.91 ; CRB 006 l.7 */
const especeTireeGardee = (d: CreatorDraft): boolean => !!d.speciesRoll && d.speciesRoll.ids.includes(d.speciesId);
/** Le gain du tirage d'espèce, tant que l'espèce choisie est de la rangée tirée. LDB 04 l.91 ; CRB 006 l.7 */
export const gainDEspece = (d: CreatorDraft): Gain => (especeTireeGardee(d) ? procedureDe(d).especeAcceptee : {});
export const speciesXp = (d: CreatorDraft): number => gainDEspece(d).px ?? 0;

/** Choix par adresse (`adresseDeCreation`) privés des adresses que `ecartee` désigne (`deFamille`, `tirageSous`). */
function horsAdresses<V>(parAdresse: Record<AdresseDeCreation, V>, ecartee: (cle: string) => boolean): Record<AdresseDeCreation, V> {
  return Object.fromEntries(Object.entries(parAdresse).filter(([a]) => !ecartee(a)));
}
/** Choix par adresse privés de l'adresse `adresse`. */
function sansAdresse<V>(parAdresse: Record<AdresseDeCreation, V>, adresse: AdresseDeCreation): Record<AdresseDeCreation, V> {
  return Object.fromEntries(Object.entries(parAdresse).filter(([a]) => a !== adresse));
}

export function withSpecies(d: CreatorDraft, id: string): CreatorDraft {
  if (id === d.speciesId) return d;
  // Changer d'espèce invalide les choix dépendants (compétences/talents d'espèce, carrière tirée, dotations offertes
  // au porteur de l'espèce, `draftPorteur`) — le geste des Talents aléatoires compris (la table des tirages appartient à l'espèce).
  return {
    ...d,
    speciesId: id,
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    talentRerolls: {},
    specChoices: horsAdresses(d.specChoices, (a) => deFamille(a, 'espece', 'ajout')),
    talentsRolled: false,
    pettySpells: [],
    careerRolls: [],
    trappingChoices: {},
  };
}

// ── 2) Carrière ──
/** Le remplacement d'une portion de la colonne (MDG 09 l.9) s'offre-t-il à cette espèce ? Oui si une
 *  portion porte sa colonne. */
export const coastalSwapAvailable = (d: CreatorDraft): boolean => {
  const col = draftSpecies(d)?.refCareer;
  return col !== undefined && portionDeLaColonne(col) !== undefined;
};

/** Les carrières offertes au brouillon : toutes sans le filtre de race (`careersForSpecies`), sinon celles que le tirage
 *  offre sur la table effective de son espèce, au remplacement près (`carrieresTirables`) ; aucune sans espèce. */
export function carrieresOffertes(d: CreatorDraft): CareerData[] {
  const sp = draftSpecies(d);
  if (!sp) return [];
  return d.ignoreRestrictions ? careersForSpecies(sp, true) : carrieresTirables(sp, d.coastalSwap);
}

/** Bascule Riverains ↔ Côtiers (MDG 09 l.9 : « avant de lancer les dés ») — VERROUILLÉE dès qu'un
 *  jet existe (`careerRolls` non vide) : sans cette garde, cocher/décocher effaçait les jets et
 *  offrait une relance GRATUITE illimitée (contourne la limite RAW des 2 relances + l'économie de
 *  PX, #393 correctif utilisateur). Garde posée ICI (pas seulement côté UI désactivée) — aucun
 *  appelant ne peut la contourner. Se réactive seulement quand les jets sont vides (choix libre, ou
 *  un futur reset d'étape explicite). */
export function withCoastalSwap(d: CreatorDraft, coastalSwap: boolean): CreatorDraft {
  if (coastalSwap === d.coastalSwap) return d;
  if (d.careerRolls.length > 0) return d;
  return { ...d, coastalSwap, careerRolls: [] };
}

/** Lève ou rétablit le filtre des carrières par espèce (`carrieresOffertes`). */
export function withIgnoreRestrictions(d: CreatorDraft, ignoreRestrictions: boolean): CreatorDraft {
  return ignoreRestrictions === d.ignoreRestrictions ? d : { ...d, ignoreRestrictions };
}

/** Nombre de jets de carrière à bonus : le premier, puis les deux de plus. LDB 05 l.210-211 */
const JETS_DE_CARRIERE_A_BONUS = 3;
export function rollDraftCareer(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  if (!sp) return d; // pas de tirage de carrière sans race (l'UI empêche d'y arriver)
  const n = d.careerRolls.length;
  if (n === 0) {
    const r = rollCareer(sp, d.coastalSwap, fluxDeCreation(d.seed, 'carriere'));
    return withCareer({ ...d, careerRolls: [r] }, r.id);
  }
  if (n === 1) {
    // LDB 05 l.211
    const rng = fluxDeCreation(d.seed, 'carriere:deux-de-plus');
    const r2 = rollCareer(sp, d.coastalSwap, rng);
    const r3 = rollCareer(sp, d.coastalSwap, rng);
    return { ...d, careerRolls: [...d.careerRolls, r2, r3] };
  }
  // LDB 05 l.212
  const r = rollCareer(sp, d.coastalSwap, fluxDeCreation(d.seed, 'carriere:relance', n - JETS_DE_CARRIERE_A_BONUS));
  return withCareer({ ...d, careerRolls: [...d.careerRolls, r] }, r.id);
}
/** Le second lancer du jet de carrière `i`, au dé de la variante de sa carrière tirée (`varianteDe`) : il engage, sa
 *  carrière devient celle du brouillon. Refusé si ce jet l'a déjà fait, ou si sa carrière n'a pas de variante pour
 *  l'espèce. AA 02 l.109-113 ; VDM 03 l.17-19 */
export function tirerLaVariante(d: CreatorDraft, i: number): CreatorDraft {
  const sp = draftSpecies(d);
  const jet = d.careerRolls[i];
  const variante = sp && jet && !jet.second ? varianteDe(jet.id, sp) : undefined;
  if (!sp || !variante) return d;
  const tire = { ...jet, second: rollVariante(variante, fluxDeCreation(d.seed, 'carriere:variante', i)) };
  return withCareer({ ...d, careerRolls: d.careerRolls.map((r, k) => (k === i ? tire : r)) }, offreDuJet(sp, tire)[0]);
}
/** Le jet de carrière gardé qui vaut un gain : le premier, ou l'un des trois premiers ; `null` sinon. LDB 05 l.210-212 ;
 *  CRB 013 l.11-13 */
function tirageDeCarriereGarde(d: CreatorDraft): 'premier' | 'troisJets' | null {
  const sp = draftSpecies(d);
  const n = d.careerRolls.length;
  if (!sp || n > JETS_DE_CARRIERE_A_BONUS) return null;
  // AA 05 l.137
  const borne = findCareerById(d.careerId)?.talentALaPlaceDe;
  const borneTenue = !borne || d.careerTalent?.id !== borne.id || poolDuJoker('talent', borne).includes(d.careerTalent.spec ?? '');
  const offert = d.careerRolls.some((r) => {
    const offre = offreDuJet(sp, r);
    return offre[0] === d.careerId || (borneTenue && offre.includes(d.careerId));
  });
  if (n === 1 && offert) return 'premier';
  if (n === JETS_DE_CARRIERE_A_BONUS && offert) return 'troisJets';
  return null;
}
/** Le gain du jet de carrière gardé. LDB 05 l.210-212 ; CRB 013 l.11-13 */
export function gainDeCarriere(d: CreatorDraft): Gain {
  const garde = tirageDeCarriereGarde(d);
  return garde ? procedureDe(d).carriere[garde] : {};
}
export const careerXp = (d: CreatorDraft): number => gainDeCarriere(d).px ?? 0;
/** Le gain qu'offre le prochain jet de carrière : le 1ᵉʳ, les deux de plus, puis aucun pour la relance libre.
 *  LDB 05 l.210-212 ; CRB 013 l.11-13 */
export function gainDuProchainJet(d: CreatorDraft): Gain {
  if (d.careerRolls.length >= JETS_DE_CARRIERE_A_BONUS) return {};
  return procedureDe(d).carriere[d.careerRolls.length === 0 ? 'premier' : 'troisJets'];
}

/** Les dotations du Niveau 2 de la carrière du brouillon, au choix d'un jet de carrière gardé. CRB 013 l.11-13 */
export const dotationsDuNiveauSuivantOffertes = (d: CreatorDraft): readonly TrappingRef[] =>
  levelsForCareer(d.careerId).find((l) => l.level === 2)?.trappings ?? [];
/** Retient ou rend la dotation du Niveau 2 de rang `i` : retenue, elle se rend ; sinon elle se retient tant que le gain du
 *  jet de carrière gardé a de la place — au-delà, le brouillon est INCHANGÉ. CRB 013 l.11-15 */
export function withDotationDuNiveauSuivant(d: CreatorDraft, i: number): CreatorDraft {
  if (d.dotationsDuNiveauSuivant.includes(i)) return { ...d, dotationsDuNiveauSuivant: d.dotationsDuNiveauSuivant.filter((x) => x !== i) };
  if (!dotationsDuNiveauSuivantOffertes(d)[i] || d.dotationsDuNiveauSuivant.length >= (gainDeCarriere(d).dotations ?? 0)) return d;
  return { ...d, dotationsDuNiveauSuivant: [...d.dotationsDuNiveauSuivant, i] };
}
export function withCareer(d: CreatorDraft, id: string): CreatorDraft {
  if (id === d.careerId) return d;
  return {
    ...d,
    careerId: id,
    dotationsDuNiveauSuivant: [],
    skillAdvances: {},
    specChoices: horsAdresses(d.specChoices, (a) => deFamille(a, 'carriere', 'ajout')),
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
    const base = baseDEspece(sp, k);
    if (d.charMode === 'repartition') out[k] = base + d.pointBuy[k];
    // Agentivité (#393) : avant le geste « Tirer aux dés », aucun jet n'existe — base d'espèce seule.
    else out[k] = base + (d.charsRolled ? rolls[d.charMode === 'reassigne' ? d.assignment[k] : i] : 0);
  }
  return out;
}
/** Pose le geste « Tirer aux dés » des dix 2d10 (LDB 05 l.337) — FIGÉ côté valeurs (`charRollPairs`
 *  dérive du seed), ce geste n'en découvre que l'affichage (#393 agentivité : jamais un résultat
 *  pré-rempli au montage). La relance RAW (l.341, bonus perdus) passe par `charRerolls`. */
export function rollDraftChars(d: CreatorDraft): CreatorDraft {
  return d.charsRolled ? d : { ...d, charsRolled: true };
}
/** La méthode des Caractéristiques tenue au regard de ses gains : les jets gardés ou réassignés tant qu'ils sont tirés
 *  sans relance, sinon `autre` ; `null` sur une page blanche. LDB 05 l.337-341 ; CRB 014 l.5-17 */
function methodeTenue(d: CreatorDraft): MethodeTenue | null {
  if (!draftSpecies(d)) return null;
  if (d.charMode === 'repartition' || d.charRerolls > 0) return 'autre';
  return d.charsRolled ? d.charMode : null;
}
/** Le gain de la méthode des Caractéristiques tenue. LDB 05 l.337-341 ; CRB 014 l.11, l.15, l.17 */
export function gainDesCaracteristiques(d: CreatorDraft): Gain {
  const m = methodeTenue(d);
  return m ? procedureDe(d).caracteristiques.methodes[m] : {};
}
export const charsXp = (d: CreatorDraft): number => gainDesCaracteristiques(d).px ?? 0;
/** Le gain qu'offre la méthode `mode` une fois les dix jets tirés. LDB 05 l.337-341 ; CRB 014 l.5-17 */
export const gainDeLaMethode = (d: CreatorDraft, mode: CharMode): Gain => gainDesCaracteristiques({ ...d, charMode: mode, charsRolled: true });

/** Le Destin d'Oh Fickle Fate : l'espèce, la carrière et les Caractéristiques ont gardé leur premier tirage. CRB 016 l.69 */
export function ohFickleFate(d: CreatorDraft): number {
  const { destin, methodes } = procedureDe(d).ohFickleFate;
  const m = methodeTenue(d);
  return especeTireeGardee(d) && tirageDeCarriereGarde(d) === 'premier' && m !== null && methodes.includes(m) ? destin : 0;
}
/** Relance les dix 2d10 (LDB 05 l.341). */
export const rerollDraftChars = (d: CreatorDraft): CreatorDraft => ({ ...d, charRerolls: d.charRerolls + 1 });
/** Méthode des Caractéristiques (LDB 05 l.337-341). */
export function withCharMode(d: CreatorDraft, charMode: CharMode): CreatorDraft {
  return charMode === d.charMode ? d : { ...d, charMode };
}
/** Réassignation (LDB 05 l.339) : le jet `idx` passe à `k`, la Caractéristique qui le portait prend l'ancien jet de `k`
 *  — `assignment` reste une permutation ; un `idx` hors des dix jets rend le brouillon INCHANGÉ. */
export function withAssignment(d: CreatorDraft, k: CharKey, idx: number): CreatorDraft {
  const holder = CHAR_KEYS.find((kk) => d.assignment[kk] === idx);
  if (!holder || holder === k) return d;
  return { ...d, assignment: { ...d.assignment, [k]: idx, [holder]: d.assignment[k] } };
}

/** PX du signe astral : +25 si le signe choisi reste celui qui a été TIRÉ (ADE II 3 l.36), sinon 0. */
export const starXp = (d: CreatorDraft): number => (d.starRoll && d.star === d.starRoll ? XP_STAR_ROLLED : 0);

export const xpTotal = (d: CreatorDraft): number => speciesXp(d) + careerXp(d) + charsXp(d) + starXp(d);

/** La répartition sur les Caractéristiques de carrière, ventilée vers les Augmentations ou la valeur de base selon la
 *  procédure. LDB 05 l.463 ; CRB 014 l.11, l.21 */
function ventilation(d: CreatorDraft): Record<'augmentations' | 'base', Partial<Record<CharKey, number>>> {
  return { augmentations: {}, base: {}, [procedureDe(d).caracteristiques.repartitionVers]: d.charAdvancesAlloc };
}

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

/** Signe astral `star` (`id`), ou aucun (ADE II 3 l.36) ; changer de signe efface les spécialisations de l'ancien
 *  (famille `signe` de `specChoices`). */
export function withStar(d: CreatorDraft, star: string | undefined): CreatorDraft {
  if (star === d.star) return d;
  return { ...d, star, specChoices: horsAdresses(d.specChoices, (a) => deFamille(a, 'signe')) };
}
/** Spécialisation `spec` du Talent que le signe octroie par son op `k` (`adresseDeCreation.signe`) ; vide, l'efface. */
export function withStarTalentSpec(d: CreatorDraft, k: number, spec: string): CreatorDraft {
  const adresse = adresseDeCreation.signe(k);
  return { ...d, specChoices: spec ? { ...d.specChoices, [adresse]: spec } : sansAdresse(d.specChoices, adresse) };
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
export function rerollDraftTalent(d: CreatorDraft, adresse: AdresseDeCreation): CreatorDraft {
  const tirage = speciesTalentRandomDrawn(d).find((t) => t.adresse === adresse);
  if (!tirage?.doublon) return d;
  return { ...d, talentRerolls: { ...d.talentRerolls, [adresse]: tirage.rang + 1 }, randomSpecPicks: sansAdresse(d.randomSpecPicks, adresse) };
}

/** Utilisation `spec` du Talent tiré à `adresse` (LDB 10 l.17 ; `randomSpecPicks`, lu par `rollRandomTalent`). */
export function withRandomTalentSpec(d: CreatorDraft, adresse: AdresseDeCreation, spec: string): CreatorDraft {
  return { ...d, randomSpecPicks: spec ? { ...d.randomSpecPicks, [adresse]: spec } : sansAdresse(d.randomSpecPicks, adresse) };
}

/** Option `option` (une option de `of`) de l'entrée « A ou B » à `adresse` ; changer d'option (`cleDOption`)
 *  remet à zéro les relances et les spécialisations des tirages de CETTE entrée (`talentRerolls`, `randomSpecPicks`). */
export function withSpeciesTalentChoice(d: CreatorDraft, adresse: AdresseDeCreation, option: AdvancementRef): CreatorDraft {
  const speciesTalentChoices = { ...d.speciesTalentChoices, [adresse]: option };
  const avant = d.speciesTalentChoices[adresse];
  if (avant != null && cleDOption(avant) === cleDOption(option)) return { ...d, speciesTalentChoices };
  return { ...d, speciesTalentChoices, talentRerolls: horsAdresses(d.talentRerolls, (a) => tirageSous(a, adresse)), randomSpecPicks: horsAdresses(d.randomSpecPicks, (a) => tirageSous(a, adresse)) };
}

/** Talents d'espèce en TROIS lots (LDB 05 l.484, écran Talents — 5c), dérivés de la DONNÉE
 *  (`sp.talents`) : FIXES (acquis d'office) / À CHOISIR (« A ou B », par adresse) / ALÉATOIRES
 *  (nombre de tirages sur les tables désignées). */
export function speciesTalentFixedEntries(d: CreatorDraft): RefDesignee[] {
  return (draftSpecies(d)?.talents ?? []).flatMap((a) => ('id' in a ? [designer('talent', a)] : []));
}
export function speciesTalentChoiceEntries(d: CreatorDraft): { adresse: AdresseDeCreation; ref: AdvancementRef; options: AdvancementRef[] }[] {
  return (draftSpecies(d)?.talents ?? []).flatMap((a, i) => ('of' in a ? [{ adresse: adresseDeCreation.especeTalent(i), ref: a, options: a.of }] : []));
}
export function speciesTalentRandomTables(d: CreatorDraft): TirageDeTalents[] {
  const sp = draftSpecies(d);
  return sp ? optionsDesTalentsDEspece(sp, d.speciesTalentChoices).filter((option): option is TirageDeTalents => option != null && 'table' in option) : [];
}

export function speciesTalentRandomCount(d: CreatorDraft): number {
  return speciesTalentRandomTables(d).reduce((n, a) => n + a.pick, 0);
}
/** Un Talent tiré (`TalentDEspece.tirage`) ; `auMaxi` : doublon dont le Maxi est déjà atteint
 *  (LDB 10 l.18), sans effet s'il est gardé ; `utilisations` : le pool de `rollRandomTalent`
 *  (`specPoolOf`, LDB 10 l.17), vide quand la table fixe la spécialisation (CRB 006 l.35) ; `utilisationChoisie` :
 *  `randomSpecPicks[adresse]` s'il est de ce pool. */
export interface TirageDeTalent {
  ref: RefDesignee;
  adresse: AdresseDeCreation;
  rang: number;
  doublon: boolean;
  auMaxi: boolean;
  utilisations: string[];
  utilisationChoisie: string | null;
}
/** Les Talents tirés (LDB 05 l.484, l.514-531), tels que le geste 5c les découvre — VIDE tant que le
 *  joueur n'a pas tiré (#393 agentivité). Utilisation : `withRandomTalentSpec` ; relance : `rerollDraftTalent`. */
export function speciesTalentRandomDrawn(d: CreatorDraft): TirageDeTalent[] {
  const sp = draftSpecies(d);
  if (!sp || !d.talentsRolled) return [];
  const partiel: Combatant = { ...probeHero(d, false, true), talents: [] };
  return resolveSpeciesTalentsDetail(sp, d).flatMap(({ ref, tirage }) => {
    const auMaxi = !!tirage?.doublon && talentMaxReached(partiel, ref.id, ref.spec);
    acquerirTalent(partiel, ref);
    if (!tirage) return [];
    const choisie = d.randomSpecPicks[tirage.adresse];
    return [{ ref, ...tirage, auMaxi, utilisationChoisie: choisie != null && tirage.utilisations.includes(choisie) ? choisie : null }];
  });
}
/** Les Talents tirés dont l'utilisation reste à choisir (LDB 10 l.17 ; `withRandomTalentSpec`). */
export function tiragesSansUtilisation(d: CreatorDraft): TirageDeTalent[] {
  return speciesTalentRandomDrawn(d).filter((t) => t.utilisations.length > 0 && t.utilisationChoisie == null);
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
  return repartitionDeCarriere(careerSkillEntries(d), procedureDe(d).competencesDeCarriere);
}

/** Pose la « Répartition simple » (`evenCareerSkillAdvances`). */
export function withEvenCareerSkillAdvances(d: CreatorDraft): CreatorDraft {
  return { ...d, skillAdvances: evenCareerSkillAdvances(d) };
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
  if (adv) skillAdvances[cle] = Math.min(plafondDeLaCompetence(d, cle), (skillAdvances[cle] ?? 0) + adv);
  return { ...next, skillAdvances };
}

/** Les Compétences d'espèce (LDB 05 l.484), emplacements de `sp.skills`. */
export function speciesSkillRefs(d: CreatorDraft): RefASpecialisation[] {
  return (draftSpecies(d)?.skills ?? []).flatMap((a) => ('id' in a ? [a] : []));
}

/** La Compétence retenue qui occupe l'emplacement d'espèce `ref` : même (id, spec) pour un emplacement
 *  fixe ; même id, hors des spécialisations fixes de la liste, pour un joker. */
function occupe(d: CreatorDraft, ref: RefASpecialisation): (r: RefDesignee) => boolean {
  if (ref.choix == null) return (r) => r.id === ref.id && memeSpecialisation(r.spec, ref.spec);
  const fixes = speciesSkillRefs(d).filter((x) => x.choix == null && x.id === ref.id).map((x) => x.spec ?? '');
  return (r) => r.id === ref.id && !fixes.includes(r.spec ?? '');
}

/** La Compétence d'espèce retenue (+5/+3) pour l'emplacement `ref`, s'il y en a une. */
export function speciesSkillPick(d: CreatorDraft, ref: RefASpecialisation): RefDesignee | undefined {
  return [...d.speciesPlus5, ...d.speciesPlus3].find(occupe(d, ref));
}

/** Palier (+5/+3/0) d'une Compétence de race dans le brouillon (LDB 05 l.484), pour l'emplacement d'espèce ou la
 *  Compétence désignée `ref`. */
export function speciesSkillTier(d: CreatorDraft, ref: RefASpecialisation): 0 | 3 | 5 {
  const m = occupe(d, ref);
  return d.speciesPlus5.some(m) ? 5 : d.speciesPlus3.some(m) ? 3 : 0;
}

/** Pose la Compétence de race `ref` au palier `tier` (0/3/5) en respectant les quotas de la procédure (LDB 05 l.484 ;
 *  CRB 008 l.59) : la retire des deux listes puis l'ajoute au palier cible si son quota a de la
 *  place — sinon renvoie le brouillon INCHANGÉ. Source unique consommée par le Stepper de l'étape 5. */
export function withSpeciesSkillTier(d: CreatorDraft, ref: RefASpecialisation, tier: 0 | 3 | 5): CreatorDraft {
  const m = occupe(d, ref);
  const retenue = speciesSkillPick(d, ref) ?? (ref.choix == null ? designer('skill', ref) : { id: ref.id });
  const plus5 = d.speciesPlus5.filter((r) => !m(r));
  const plus3 = d.speciesPlus3.filter((r) => !m(r));
  const quotas = procedureDe(d).competencesDEspece;
  if (tier === 5) {
    if (plus5.length >= quotas.plus5) return d;
    plus5.push(retenue);
  } else if (tier === 3) {
    if (plus3.length >= quotas.plus3) return d;
    plus3.push(retenue);
  }
  return { ...d, speciesPlus5: plus5, speciesPlus3: plus3 };
}

/** Pose la répartition par défaut des Compétences de race (`speciesSkillDefaults`, LDB 05 l.484). */
export function withSpeciesSkillDefaults(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  if (!sp) return d;
  const { plus5, plus3 } = speciesSkillDefaults(sp, undefined, procedureDe(d).competencesDEspece);
  return { ...d, speciesPlus5: plus5, speciesPlus3: plus3 };
}

/** Pose la spécialisation `spec` de la Compétence d'espèce retenue à l'emplacement joker `ref`. */
export function withSpeciesSkillSpec(d: CreatorDraft, ref: RefASpecialisation, spec: string): CreatorDraft {
  const m = occupe(d, ref);
  const poser = (r: RefDesignee): RefDesignee => (m(r) ? (spec ? { id: r.id, spec } : { id: r.id }) : r);
  return { ...d, speciesPlus5: d.speciesPlus5.map(poser), speciesPlus3: d.speciesPlus3.map(poser) };
}

/** Une Compétence retenue attend-elle sa spécialisation (joker, LDB 09 l.38) ? */
export const attendSaSpec = (r: RefDesignee): boolean => r.spec == null && estSpecialisable('skill', r.id);

/** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.714) : quota à choisir = BFM FINAL du probe
 *  (Augmentations gratuites + talents « +5 FM » appliqués, même pipeline que createHero) — 0 sans
 *  Talent de `castingKind:'mineure'`. Délègue à `pettySpellQuotaFor` (engine, source UNIQUE), le probe portant déjà les talents résolus en id. */
export function pettySpellQuota(d: CreatorDraft): number {
  return pettySpellQuotaFor(probeHero(d, true, true));
}

/** Retient ou bascule le sort de Magie mineure `id` (LDB 10 l.714) : retenu, il se retire ; sinon il s'ajoute tant que
 *  le quota (`pettySpellQuota`) a de la place — au-delà, le brouillon est INCHANGÉ. */
export function withPettySpellToggled(d: CreatorDraft, id: string): CreatorDraft {
  if (d.pettySpells.includes(id)) return { ...d, pettySpells: d.pettySpells.filter((x) => x !== id) };
  return d.pettySpells.length < pettySpellQuota(d) ? { ...d, pettySpells: [...d.pettySpells, id] } : d;
}

/** Refus du Talent de carrière du brouillon, ou `null` : même lecture des emplacements du Niveau 1
 *  que `createHero` (`statutOuRefus`), puis le Maxi. Un brouillon restauré passe par ici avant
 *  toute construction. */
export function careerTalentMessage(d: CreatorDraft): string | null {
  if (!d.careerTalent) return t('crea.choisirTalentCarriere');
  const { id, spec } = d.careerTalent;
  const nom = refLabel('talents', d.careerTalent);
  const levels = levelsForCareer(d.careerId);
  const tSlots = talentSlots(levels, 1);
  switch (statutOuRefus(tSlots, {}, id, spec, [...skillSlots(levels, 1), ...tSlots])) {
    case 'absent': return t('crea.talentCarriereAbsent', { nom });
    case 'sansSpec': return t('crea.talentCarriereSansSpec', { nom });
    case 'nonCouvert': return t('crea.talentCarriereNonCouvert', { nom });
  }
  if (talentMaxReached(probeHero(d, false), id, spec)) return t('crea.maxiAtteint', { nom });
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

/** Talent de carrière `talent`, ou aucun (LDB 05 l.535). */
export function withCareerTalent(d: CreatorDraft, talent: RefDesignee | null | undefined): CreatorDraft {
  return { ...d, careerTalent: talent ?? undefined };
}
/** Spécialisation `spec` du Talent de carrière joker `ref` (LDB 10 l.17) : il devient le Talent de carrière ; vide, le
 *  Talent de carrière tiré de ce joker se retire, un autre reste. */
export function withCareerTalentSpec(d: CreatorDraft, ref: RefASpecialisation, spec: string): CreatorDraft {
  if (spec) return withCareerTalent(d, { id: ref.id, spec });
  return d.careerTalent?.id === ref.id ? withCareerTalent(d, undefined) : d;
}

// ── 5) Possessions ──
/** Statut d'un brouillon dont aucun Niveau n'est encore choisi : il ne gagne rien (`draftWealth`). */
const STATUT_SANS_NIVEAU: Status = { tier: 'bronze', standing: 0 };

/** Le Statut du Niveau choisi, ou `STATUT_SANS_NIVEAU`. */
export function draftStatus(d: CreatorDraft): Status {
  const lvl = draftLevel(d);
  return lvl ? lvl.status : STATUT_SANS_NIVEAU;
}
/** La bourse — faces et montant d'UN tirage, terme fixe de la procédure compris (CRB 016 l.15-21), PUR/déterministe (`d.seed`), jamais une relance (LDB 05 :
 *  un seul jet). La ceinture d'agentivité (`wealthRoll`, geste requis avant affichage) vit dans l'UI. */
export function draftWealth(d: CreatorDraft): TirageDeRichesse {
  const statut = draftStatus(d);
  return rollInitialWealth(statut, fluxDeCreation(d.seed, 'bourse'), procedureDe(d).richesse[statut.tier]);
}
/** Pose le geste « Tirer aux dés » de la bourse — FIGÉ (aucune relance, LDB 05 l.578 n'en offre
 *  aucune) : le montant lui-même est déjà déterminé par `d.seed`, ce geste n'en découvre que
 *  l'affichage (anti-résultat-pré-rempli, #393). */
export function rollDraftWealth(d: CreatorDraft): CreatorDraft {
  return d.wealthRoll ? d : { ...d, wealthRoll: true };
}

/** Libellés des emplacements de dotation du Niveau 1 que le joueur n'a pas tranchés
 *  (`emplacementTranche`) — gate de `validateStep('trappings')`. */
/** Les dotations du brouillon : celles de sa classe et de son Niveau 1, puis celles du Niveau 2 retenues
 *  (`dotationsDuNiveauSuivant`) — la liste que `createHero` dote. LDB 05 l.552 ; CRB 013 l.11-13 ; CRB 016 l.9-11 */
export function dotationsDuBrouillon(d: CreatorDraft): TrappingRef[] {
  const offertes = dotationsDuNiveauSuivantOffertes(d);
  return [...dotationsDuHeros(d.careerId), ...d.dotationsDuNiveauSuivant.flatMap((i) => offertes[i] ?? [])];
}

export function unresolvedTrappingSlots(d: CreatorDraft): string[] {
  if (!draftLevel(d)) return [];
  return emplacementsDeDotation(dotationsDuBrouillon(d))
    .filter((e) => estEmplacementRacine(e) && !emplacementTranche(e, d.trappingChoices ?? {}))
    .map((e) => trappingRefLabel(e.ref));
}

/** Option `v` de l'emplacement de dotation `adresse` (`ChoixDeDotation`). */
export function withTrappingChoice(d: CreatorDraft, adresse: AdresseDeCreation, v: number | string): CreatorDraft {
  return { ...d, trappingChoices: { ...d.trappingChoices, [adresse]: v } };
}

// ── 6) Détails ──
/** Les champs d'état civil du brouillon, saisis librement par le joueur. */
export type EtatCivil = Pick<CreatorDraft, 'label' | 'motivation' | 'ambitionShort' | 'ambitionLong' | 'age' | 'height' | 'eyes' | 'hair'>;
/** Pose `patch` sur l'état civil ; une clé à `undefined` efface le trait facultatif. */
export function withEtatCivil(d: CreatorDraft, patch: Partial<EtatCivil>): CreatorDraft {
  return { ...d, ...patch };
}

/** LDB 05 l.703, l.716, l.742-754 */
export function choixDesYeux(d: CreatorDraft): {
  couleurs: ReferenceDeCouleur[];
  premierePourUnePaire: ReferenceDeCouleur | undefined;
} {
  const colonne = draftSpecies(d)?.refChar;
  if (!colonne) return { couleurs: [], premierePourUnePaire: undefined };
  const couleurs = eyes.filter((rangee) => !rangee.choixLibrePour?.includes(colonne)).map(({ id }) => ({ id, colonne }));
  const actuelle = d.eyes?.[0];
  const premierePourUnePaire = nombreDeTiragesDesYeux(colonne) === 2 && actuelle && 'id' in actuelle && actuelle.colonne === colonne
    ? couleurs.find((c) => c.id === actuelle.id)
    : undefined;
  return { couleurs, premierePourUnePaire };
}

/** LDB 05 l.703 */
export function withCouleurDesYeux(d: CreatorDraft, rang: 0 | 1, id: string | null): CreatorDraft {
  const { couleurs, premierePourUnePaire } = choixDesYeux(d);
  const couleur = couleurs.find((c) => c.id === id);
  if (rang === 0) {
    if (!couleur) return d;
    const seconde = d.eyes?.[1];
    return withEtatCivil(d, { eyes: seconde && seconde.colonne === couleur.colonne ? [couleur, seconde] : [couleur] });
  }
  if (!premierePourUnePaire || (id !== null && !couleur)) return d;
  return withEtatCivil(d, { eyes: couleur ? [premierePourUnePaire, couleur] : [premierePourUnePaire] });
}

/** Sexe `sex` de l'apparence. */
export function withSexe(d: CreatorDraft, sex: Sexe): CreatorDraft {
  return { ...d, apparence: { ...d.apparence, sex } };
}
/** Sexe suivant de `sexeSchema`, en boucle. */
export function withSexeSuivant(d: CreatorDraft): CreatorDraft {
  const options = sexeSchema.options;
  return withSexe(d, options[(options.indexOf(d.apparence.sex) + 1) % options.length]);
}
/** Nom tiré au générateur de l'espèce (`generateName`) avec la graine `graine` ; sans espèce ni table de noms, le
 *  brouillon est INCHANGÉ. */
export function rollDraftName(d: CreatorDraft, graine: number, style?: 'humain'): CreatorDraft {
  const sp = draftSpecies(d);
  const label = sp ? generateName(sp.refChar, d.apparence.sex, makeRNG(graine), style) : null;
  return label ? withEtatCivil(d, { label }) : d;
}
/** Geste « Aux dés » du physique ; sans espèce, le brouillon est INCHANGÉ. */
export function rollDraftDetails(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  return sp ? withEtatCivil(d, tirerLesDetails(sp.refChar, fluxDeCreation(d.seed, 'details'))) : d;
}

export type StepId = 'species' | 'career' | 'chars' | 'star' | 'skills' | 'trappings' | 'details' | 'presentation';

/** Étapes du créateur dans l'ordre — `star` insérée après `chars` quand la règle optionnelle ADE II
 *  `creation-signes-astraux` est active. SOURCE UNIQUE de l'ordre ET de la présence des étapes (le
 *  rendu et la validation en dérivent — plus d'index positionnel fragile). Étape 8 renommée
 *  « Présentation » (#393, arbitrage README maquettes : « le personnage se PRÉSENTE »). */
export function stepIds(d: Pick<CreatorDraft, 'procedure'>): StepId[] {
  const ids: StepId[] = ['species', 'career', 'chars', 'skills', 'trappings', 'details', 'presentation'];
  if (procedureDe(d).signeAstral && rule('creation-signes-astraux')) ids.splice(3, 0, 'star');
  return ids;
}

/** L'étape de rang `i` de l'assistant du brouillon `d` ; au-delà de la dernière (la règle des signes astraux a retiré une
 *  étape), la dernière. */
export function etapeDeRang(d: Pick<CreatorDraft, 'procedure'>, i: number): StepId {
  const ids = stepIds(d);
  return ids[i] ?? garanti(ids[ids.length - 1], i, 'dernière étape de l’assistant');
}

// ── Validation par étape ──
/** Contexte dérivé du brouillon, calculé UNE fois par validation et passé à l'étape. */
interface StepCtx { d: CreatorDraft; sp: ReturnType<typeof draftSpecies>; level: ReturnType<typeof draftLevel> }

/**
 * Validateurs PAR étape — table TOTALE `Record<StepId, …>` : ajouter une étape à `StepId` force
 * son entrée ICI à la compilation. `star` et `presentation` n'imposent aucune saisie (`null`).
 */
const STEP_VALIDATORS: Record<StepId, (c: StepCtx) => string | null> = {
  species: ({ sp }) => (sp ? null : t('crea.choisirRace')),
  career: ({ d, sp, level }) => {
    if (!d.careerId) return t('crea.choisirCarriere');
    // La carrière reste offerte au brouillon (`carrieresOffertes`) : changer d'espèce, rétablir le filtre ou basculer
    // le remplacement ne laisse pas passer une carrière hors liste.
    if (sp && !carrieresOffertes(d).some((c) => c.id === d.careerId)) return t('crea.carriereHorsEspece');
    if (!level) return t('crea.carriereSansNiveau1');
    const quota = gainDeCarriere(d).dotations ?? 0;
    if (d.dotationsDuNiveauSuivant.length > quota) return t('crea.dotationsDuNiveauSuivant', { n: quota, actuel: d.dotationsDuNiveauSuivant.length });
    return null;
  },
  chars: ({ d, sp }) => {
    if (!sp) return t('crea.choisirRace');
    if (d.charMode !== 'repartition' && !d.charsRolled) return t('crea.tirerCaracteristiques');
    if (d.charMode === 'repartition') {
      const v = validatePointBuy(d.pointBuy as Record<CharKey, number>, procedureDe(d).caracteristiques.points);
      if (!v.ok) return t('crea.repartitionDesPoints', { raison: v.reason });
    }
    if (d.charMode === 'reassigne') {
      const idx = CHAR_KEYS.map((k) => d.assignment[k]);
      if (new Set(idx).size !== 10) return t('crea.reassignationUnique');
    }
    const augmentations = repartition(d, 'augmentation');
    if (procedureDe(d).caracteristiques.quotaExact ? augmentations.total !== augmentations.quota : augmentations.total > augmentations.quota)
      return t(procedureDe(d).caracteristiques.quotaExact ? 'crea.augmentationsDeCaracteristiques' : 'crea.bonusDeCaracteristiques', { n: augmentations.quota, actuel: augmentations.total });
    const destin = repartition(d, 'destin');
    if (destin.total !== destin.quota) return t('crea.destinEtResilience', { n: destin.quota, actuel: destin.total });
    return null;
  },
  star: () => null,
  skills: ({ d, sp }) => {
    if (!sp) return t('crea.choisirRace');
    return messageDesCompetencesDeRace(d) ?? messageDesTalentsDeRace(d) ?? messageDesCompetencesDeCarriere(d) ?? careerTalentMessage(d) ?? messageDeMagieMineure(d);
  },
  trappings: ({ d }) => {
    if (!d.wealthRoll) return t('crea.tirerBourse');
    const unresolved = unresolvedTrappingSlots(d);
    if (unresolved.length) return t('crea.choisirOption', { option: unresolved[0] });
    return null;
  },
  details: ({ d }) => {
    if (!d.label.trim()) return t('crea.nommerPersonnage');
    return null;
  },
  presentation: () => null,
};

export function validateStep(d: CreatorDraft, id: StepId): string | null {
  return STEP_VALIDATORS[id]({ d, sp: draftSpecies(d), level: draftLevel(d) });
}

// ── Construction finale ──
/** Le héros que bâtit le brouillon `d`, sous l'id `id` (absent : un id neuf de `idNeuf`) ; `idNeuf` forge aussi les uids de
 *  ses objets (`createHero`). */
export function buildHero(d: CreatorDraft, idNeuf: FabriqueDId, id?: string): Combatant {
  const sp = draftSpecies(d);
  if (!sp) throw new Error('Aucune race choisie'); // page blanche : previewHero catch → fiche grisée
  const proc = procedureDe(d);
  const quotas = proc.competencesDEspece;
  const { pas } = proc.competencesDeCarriere;
  const horsPas = Object.entries(d.skillAdvances).find(([, v]) => v % pas !== 0);
  if (horsPas) throw new Error(`Compétence de carrière « ${horsPas[0]} » : ${horsPas[1]} points, hors du pas de ${pas} (CRB 014 l.21 ; CRB 015 l.7).`);
  const defauts = speciesSkillDefaults(sp, undefined, quotas);
  const { base, augmentations } = ventilation(d);
  const chars = draftChars(d);
  for (const [k, n] of Object.entries(base) as [CharKey, number][]) chars[k] += n;
  const hero = createHero({
    speciesId: d.speciesId,
    careerId: d.careerId,
    espece: sp,
    progression: proc.progression,
    reserves: reservesDeDepart(d),
    langues: languesDEspece(d),
    dotationsDuNiveauSuivant: d.dotationsDuNiveauSuivant,
    label: d.label.trim() || 'Aventurier',
    manualChars: chars,
    charAdvancesAlloc: augmentations,
    careerTalent: d.careerTalent,
    skillAdvances: d.skillAdvances,
    speciesSkillAdvances: {
      plus5: d.speciesPlus5.length === quotas.plus5 ? d.speciesPlus5 : defauts.plus5,
      plus3: d.speciesPlus3.length === quotas.plus3 ? d.speciesPlus3 : defauts.plus3,
    },
    seed: d.seed,
    speciesTalentChoices: d.speciesTalentChoices,
    randomSpecPicks: d.randomSpecPicks,
    talentRerolls: d.talentRerolls,
    talentsRolled: d.talentsRolled,
    specChoices: d.specChoices,
    starId: d.star,
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
    idNeuf,
  });
  if (d.star) hero.star = d.star;
  return hero;
}

/** Id du héros d'un aperçu de création (`apercuDuHeros`). */
export const ID_D_APERCU = 'preview';

/** Le héros que le brouillon `d` bâtirait, pour un APERÇU (fiche vivante, page de présentation) : une lecture, qui
 *  n'entre jamais dans l'état. Il ne prend donc ni id de héros neuf ni uid d'objet à la source de l'état : ses objets
 *  tirent leurs uids d'une fabrique locale jetable. #2907 */
export function apercuDuHeros(d: CreatorDraft): Combatant {
  return buildHero(d, fabriqueLocale(ID_D_APERCU), ID_D_APERCU);
}

/** Le total déjà alloué des 40 Augmentations de carrière. */
export function careerAdvTotal(d: CreatorDraft): number {
  return careerSkillEntries(d).reduce((a, c) => a + (d.skillAdvances[c.cle] ?? 0), 0);
}

// ── Compteurs d'allocation (étapes 3 et 5) : valeur, bornes et écriture BORNÉE, lues par l'écran ET le geste ──
/** Un compteur d'allocation : la Caractéristique `k` des 100 Points (LDB 05 l.341), ses Augmentations de carrière
 *  (LDB 05 l.459), Destin ou Résilience (LDB 05 l.426), les Augmentations de la Compétence de carrière `cle`
 *  (LDB 05 l.535). */
export type Compteur =
  | { genre: 'points'; k: CharKey }
  | { genre: 'augmentation'; k: CharKey }
  | { genre: 'destin'; k: 'fate' | 'resilience' }
  | { genre: 'competence'; cle: string };
export type Repartition = Compteur['genre'];

/** Le total posé et le quota de la répartition `r` ; l'étape la valide quand ils sont égaux. */
export function repartition(d: CreatorDraft, r: Repartition): { total: number; quota: number } {
  switch (r) {
    case 'points':
      return { total: CHAR_KEYS.reduce((a, k) => a + d.pointBuy[k], 0), quota: POINT_BUY_TOTAL };
    case 'augmentation': {
      const quota = procedureDe(d).caracteristiques.augmentationsDeCarriere + (gainDesCaracteristiques(d).bonusDeCarriere ?? 0);
      return { total: Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0), quota: careerCharKeys(d).length ? quota : 0 };
    }
    case 'destin':
      return { total: d.fateSplit.fate + d.fateSplit.resilience, quota: draftSpecies(d)?.fate.extra ?? 0 };
    case 'competence':
      return { total: careerAdvTotal(d), quota: procedureDe(d).competencesDeCarriere.quota };
  }
}

export function valeurDuCompteur(d: CreatorDraft, c: Compteur): number {
  switch (c.genre) {
    case 'points': return d.pointBuy[c.k];
    case 'augmentation': return d.charAdvancesAlloc[c.k] ?? 0;
    case 'destin': return d.fateSplit[c.k];
    case 'competence': return d.skillAdvances[c.cle] ?? 0;
  }
}

/** Les points d'espèce de la Compétence de clé `cle` (`cleDeCompetence`) : +5, +3 ou 0. LDB 05 l.484 ; CRB 008 l.59 */
function pointsDEspece(d: CreatorDraft, cle: string): number {
  const tenue = (r: RefDesignee) => refKey(r.id, r.spec) === cle;
  return d.speciesPlus5.some(tenue) ? 5 : d.speciesPlus3.some(tenue) ? 3 : 0;
}
/** Le plafond des Augmentations de carrière de la Compétence de clé `cle` : le plafond du barème, moins ses points
 *  d'espèce quand il se lit sur le total. LDB 05 l.535 ; CRB 015 l.29 */
export function plafondDeLaCompetence(d: CreatorDraft, cle: string): number {
  const { plafond, plafondAvecLEspece } = procedureDe(d).competencesDeCarriere;
  return plafondAvecLEspece ? plafond - pointsDEspece(d, cle) : plafond;
}
/** Le pas du compteur `c` : celui du barème de carrière pour une Compétence, 1 sinon. CRB 015 l.7 */
export const pasDuCompteur = (d: CreatorDraft, c: Compteur): number => (c.genre === 'competence' ? procedureDe(d).competencesDeCarriere.pas : 1);

/** Les bornes du compteur `c` : les 100 Points dans les bornes de la procédure ; une Augmentation, Destin ou Résilience
 *  jusqu'à ce que reste de sa répartition, une Compétence de carrière au plus `plafondDeLaCompetence`. */
export function bornesDuCompteur(d: CreatorDraft, c: Compteur): { min: number; max: number } {
  if (c.genre === 'points') return procedureDe(d).caracteristiques.points;
  const { total, quota } = repartition(d, c.genre);
  const plafond = c.genre === 'competence' ? plafondDeLaCompetence(d, c.cle) : quota;
  return { min: 0, max: Math.min(plafond, valeurDuCompteur(d, c) + quota - total) };
}

/** Pose `v` au compteur `c` dans ses bornes (`bornesDuCompteur`) et à son pas (`pasDuCompteur`) ; une valeur hors bornes
 *  ou hors pas rend le brouillon INCHANGÉ, sauf une baisse vers le plancher. */
export function withCompteur(d: CreatorDraft, c: Compteur, v: number): CreatorDraft {
  const { min, max } = bornesDuCompteur(d, c);
  if (v < min || v % pasDuCompteur(d, c) !== 0 || (v > max && v > valeurDuCompteur(d, c))) return d;
  switch (c.genre) {
    case 'points': return { ...d, pointBuy: { ...d.pointBuy, [c.k]: v } };
    case 'augmentation': return { ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [c.k]: v } };
    case 'destin': return { ...d, fateSplit: { ...d.fateSplit, [c.k]: v } };
    case 'competence': return { ...d, skillAdvances: { ...d.skillAdvances, [c.cle]: v } };
  }
}

// ── Étape 5 « Compétences & Talents » — complétion PAR SOUS-ÉCRAN (5a/5b/5c, charte Atelier) : la
// fiche vivante et les onglets de sous-étape en dérivent — SOURCE UNIQUE, jamais un `ahead('skills')`
// tout-ou-rien pour ce qui se joue À L'INTÉRIEUR de l'étape.
/** 5a — Compétences de race : quotas de la procédure posés, sans doublon, Spécialisations choisies (LDB 05 l.484). */
function messageDesCompetencesDeRace(d: CreatorDraft): string | null {
  const { plus5, plus3 } = procedureDe(d).competencesDEspece;
  if (d.speciesPlus5.length !== plus5 || d.speciesPlus3.length !== plus3)
    return t(plus3 ? 'crea.competencesDEspece' : 'crea.competencesDEspeceA5', { plus5, plus3 });
  const cles = [...d.speciesPlus5, ...d.speciesPlus3].map((r) => refKey(r.id, r.spec));
  if (new Set(cles).size !== cles.length) return t('crea.competenceDEspeceDouble');
  const sansSpec = [...d.speciesPlus5, ...d.speciesPlus3].find(attendSaSpec);
  if (sansSpec) return t('crea.choisirSpecialisation', { nom: refLabel('skills', sansSpec) });
  return null;
}
/** Entrées d'espèce « A ou B » : un choix requis quand il y en a (LDB 05 l.484). */
function messageDesTalentsDeRace(d: CreatorDraft): string | null {
  const ouvert = speciesTalentChoiceEntries(d).find((e) => d.speciesTalentChoices[e.adresse] == null);
  if (ouvert) return t('crea.choisirOption', { option: advancementLabel('talents', ouvert.ref) });
  if (speciesTalentRandomCount(d) > 0 && !d.talentsRolled) return t('crea.tirerTalents');
  const [sansUtilisation] = tiragesSansUtilisation(d);
  if (sansUtilisation) return t('crea.utilisationDuTalentTire', { nom: refLabel('talents', { id: sansUtilisation.ref.id }) });
  return null;
}
/** 5b — les Augmentations de carrière réparties, à leur pas, au plus `plafondDeLaCompetence`, Spécialisations choisies.
 *  LDB 05 l.535 ; CRB 015 l.12, l.29 */
function messageDesCompetencesDeCarriere(d: CreatorDraft): string | null {
  const prise = careerSkillEntries(d).find((c) => c.ref.choix != null && c.designee?.spec != null && !c.libre(c.designee.spec));
  if (prise?.designee) return t('crea.competencePrise', { nom: refLabel('skills', prise.designee), raison: t('slot.takenByOther') });
  const { total, quota } = repartition(d, 'competence');
  const { plafond, pas } = procedureDe(d).competencesDeCarriere;
  if (total !== quota) return t('crea.augmentationsDeCarriere', { n: quota / pas, actuel: total / pas });
  for (const c of careerSkillEntries(d)) {
    const adv = d.skillAdvances[c.cle] ?? 0;
    const nom = c.designee ? refLabel('skills', c.designee) : advancementLabel('skills', c.ref);
    if (adv < 0 || adv > plafondDeLaCompetence(d, c.cle)) return t('crea.maxAugmentationsParCompetence', { max: plafond / pas, nom });
    if (adv % pas !== 0) return t('crea.augmentationsParPas', { pas, nom });
    if (adv > 0 && !c.designee) return t('crea.choisirSpecialisation', { nom });
  }
  return null;
}
/** Sorts de Magie mineure : exactement le quota (LDB 10 l.714). */
function messageDeMagieMineure(d: CreatorDraft): string | null {
  const quota = pettySpellQuota(d);
  return quota && d.pettySpells.length !== quota ? t('crea.sortsDeMagieMineure', { n: quota, actuel: d.pettySpells.length }) : null;
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

const SOUS_ECRAN_SOLDE: Record<SkillsSub, (d: CreatorDraft) => boolean> = { race: speciesSkillsDone, career: careerSkillsDone, talents: talentsDone };
/** Le sous-écran `sub` de l'étape 5 est-il soldé ? */
export const skillsSubDone = (d: CreatorDraft, sub: SkillsSub): boolean => SOUS_ECRAN_SOLDE[sub](d);

/** Bandeau de pied PAR SOUS-ONGLET (5a/5b/5c) — chaque volet reflète SA propre complétion au lieu
 *  du premier blocage toutes-branches de `validateStep('skills')` (agent-œil, LOT de clôture). */
export function skillsSubMessage(d: CreatorDraft, sub: SkillsSub): string {
  const sp = draftSpecies(d);
  if (!sp) return t('crea.choisirRace');
  switch (sub) {
    case 'race': {
      const { plus5, plus3 } = procedureDe(d).competencesDEspece;
      return messageDesCompetencesDeRace(d) ?? t(plus3 ? 'crea.competencesDeRacePosees' : 'crea.competencesDeRacePoseesA5', { plus5, plus3 });
    }
    case 'career':
      return messageDesCompetencesDeCarriere(d) ?? t('crea.competencesDeCarrierePosees', { n: procedureDe(d).competencesDeCarriere.quota / procedureDe(d).competencesDeCarriere.pas });
    case 'talents': {
      const refus = messageDesTalentsDeRace(d) ?? careerTalentMessage(d) ?? messageDeMagieMineure(d);
      if (refus) return refus;
      // Ce qui a été réglé pour CETTE carrière (#1607).
      const regles = [
        ...(speciesTalentChoiceEntries(d).length || speciesTalentRandomCount(d) ? [t('crea.regleRace')] : []),
        t('crea.regleCarriere'),
        ...(pettySpellQuota(d) ? [t('crea.regleMagieMineure')] : []),
      ];
      return t('crea.talentsTranches', { liste: listeEt(regles) });
    }
  }
}
