/**
 * Création de personnage (héros) — Livre de base, chapitres 04/05 « Personnage ».
 *
 * Étapes implémentées :
 *  3) Attributs : Caractéristique = base d'espèce + 2d10 (ou saisie manuelle / répartition de
 *     100 Points — cf. engine/creation.ts) ; 5 Augmentations gratuites réparties sur les
 *     3 Caractéristiques de carrière (l.459) ; Destin/Résilience + points supplémentaires.
 *  4) Compétences/Talents : 3 Compétences d'espèce à +5 et 3 à +3 (l.484) ; Talents d'espèce
 *     (choix « A ou B », fixes, « N Talent aléatoire » sur la table d100) ; 8 Compétences de
 *     carrière, 40 augmentations (max 10), 1 Talent de carrière — qui peut être un talent
 *     d'espèce déjà possédé → times 2 (l.535, LDB 10 l.9), dans la limite du Maxi (LDB 10).
 *  5) Possessions : équipement de classe + de carrière (la Richesse initiale est créditée au
 *     groupe par l'appelant — cf. engine/creation.rollInitialWealth).
 *  6) Détails : âge/taille/yeux/cheveux/ambitions (cosmétique).
 *  Blessures (+ Dur à cuire), Mouvement (+ Véloce), Chance/Détermination (Chanceux/Obstiné) et
 *  « +5 Caractéristique de départ » appliqués via engine/talentEffects.
 *
 * Choix et Spécialisations en ids (`ChoixDeCreation`) ; les emplacements de carrière utilisés sont
 * DÉSIGNÉS dans `careerSlotChoices` (cf. engine/careerSlots.ts).
 */
import { RNG, roll, rollDice, fluxDerive, tirerUn } from './dice';
import { findTableEntry } from './tables';
import { garanti } from '../lib/garanti';
import { contexteDeNaissanceDObjet, recomputeLoadout, emptyArmour } from './items';
import { doterLePorteur } from './bourse';
import { groupsFor } from './groups';
import { CharKey, CHAR_KEYS, Characteristics, Combatant, SkillInstance, TalentInstance, HeroDetails, type ItemInstance } from './types';
import {
  SpeciesData,
  CareerLevelData,
  findSpeciesById,
  findCareerById,
  levelsForCareer,
  byId,
  tailleDuTalent,
  specPoolOf,
  findTalentById,
  tableDeTalents,
  especeDApparence,
  findSpellById,
  type AdvancementRef,
} from '../data';
import type { RefDesignee, RefASpecialisation } from '../data/schemas/grammaire/ref';
import {
  refKey,
  skillSlots,
  talentSlots,
  availableChars,
  candidatsDuSlot,
  parseRefKey,
  talentTire,
  type CareerSlot,
  designateSlot,
  freeSlotFor,
  statutOuRefus,
  designationsFor,
  wildcardSpecs,
  prisParLesAutres,
  acquerirTalent,
  type PorteurDeTalents,
} from './careerSlots';
import { dotationsDuHeros, resolveTrappingChoices, type ChoixDeDotation } from './trappingChoices';
import { adresseDeCreation, type AdresseDeCreation } from './adresseDeCreation';
import { appliquerAcquisitions, fortuneMax, resolveMax, careerSkillAdditions } from './talentEffects';
import { applyStarOps, pettySpellQuotaFor } from './creation';
import { sizeFromTalents } from './size';
import { traitsDuPorteur } from './statEntry';
import { indiceSurLeProfil } from './formule';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';
import { CAREER_SKILLS_ADVANCED, careerCompletionAdvances, slotRef, tientUnTalentDuNiveau } from './advancement';
import type { FabriqueDId } from './fabriqueDId';
import { blessuresPosees } from './characteristics';
import { modeleDe } from './modeleDeProgression';
import { cocherLaDotationDeRang } from './casesDeCarriere';

/** Caractéristique d'une Compétence (skills.json) par `id` STABLE — LDB 09 : valeur de Test =
 *  Caractéristique + avances. (≠ re-lookup par libellé — multilangue-safe.) */
export function skillCharacteristicById(id: string): CharKey {
  const data = byId('skill', id);
  return data?.characteristic ?? 'dexterite'; // CharKey stable portée par la donnée (repli prudent)
}

/** `adv` Augmentations à la Compétence `ref` de `skills` : l'instance de même (id, spec) les gagne, sinon une instance
 *  neuve les porte. LDB 09 l.42 */
export function augmenterLaCompetence(skills: SkillInstance[], { id, spec }: RefDesignee, adv: number): void {
  const existing = skills.find((s) => s.id === id && memeSpecialisation(s.spec, spec));
  if (existing) existing.advances += adv;
  else skills.push({ id, spec, characteristic: skillCharacteristicById(id), advances: adv });
}

/** « Répartissez 40 Points d'Augmentations entre vos huit Compétences de départ » (LDB 05 l.535). */
export const CAREER_SKILL_ADVANCES = 40;
/** « sans dépasser plus de 10 Points alloués à une seule Compétence à ce stade » (LDB 05 l.535). */
export const MAX_ADV_PER_SKILL = 10;
/** « Vous pouvez sélectionner 3 Compétences auxquelles ajouter 5 Augmentations à chacune » (LDB 05 l.484). */
export const SPECIES_SKILLS_PLUS5 = 3;
/** « …et 3 Compétences auxquelles ajouter 3 Augmentations à chacune » (LDB 05 l.484). */
export const SPECIES_SKILLS_PLUS3 = 3;

/** Étapes aléatoires de la création, chacune son flux (`fluxDeCreation`). */
export type EtapeDeFlux = 'espece' | 'carriere' | 'niveaux' | 'specialisations' | 'competences-espece' | 'carriere:deux-de-plus' | 'carriere:relance' | 'carriere:variante' | 'caracteristiques' | 'signe' | 'astrologie' | 'talents' | 'bourse' | 'details' | 'possessions';

/** Le flux figé d'une étape de création, dérivé de la graine racine `seed` (`fluxDerive`). */
export function fluxDeCreation(seed: number, etape: EtapeDeFlux, ...suite: readonly (string | number)[]): RNG {
  return fluxDerive(seed, etape, ...suite);
}

/** Clé de comparaison d'une option de Talent d'espèce. */
export function cleDOption(option: AdvancementRef): string {
  if ('id' in option) return refKey(option.id, option.spec);
  if ('table' in option) return `tirage:${option.table.id}:${option.pick}`;
  return option.of.map(cleDOption).join(' ou ');
}

/** L'option de chaque emplacement des Talents d'espèce, à son rang dans l'espèce : l'entrée elle-même, ou l'option
 *  choisie d'une entrée « A ou B » ; `undefined` tant qu'aucune option de `of` n'est choisie. LDB 05 l.484 */
export function optionsDesTalentsDEspece(sp: SpeciesData, choix: ChoixDeCreation['speciesTalentChoices']): (AdvancementRef | undefined)[] {
  return sp.talents.map((ref, i) => {
    if (!('of' in ref)) return ref;
    const choisie = choix?.[adresseDeCreation.especeTalent(i)];
    return choisie == null ? undefined : ref.of.find((option) => cleDOption(option) === cleDOption(choisie));
  });
}

/** L'option d'une entrée « A ou B » des Talents d'espèce sans choix : tirée au dé sur le flux de son adresse. LDB 05 l.484 */
function optionTiree(ref: AdvancementRef, adresse: AdresseDeCreation, seed: number): AdvancementRef {
  return 'of' in ref ? tirerUn(ref.of, fluxDeCreation(seed, 'talents', adresse))! : ref;
}

/**
 * Les CHOIX de création d'un héros, en ids — la forme commune du brouillon du créateur (`CreatorDraft`) et des
 * options de `createHero`.
 */
export interface ChoixDeCreation {
  /** Graine RACINE de la création : chaque étape aléatoire en dérive son flux (`fluxDeCreation`). */
  seed: number;
  /** Talent de carrière ; peut être un talent d'espèce déjà possédé (LDB 05 l.535, LDB 10 l.9). Absent : tiré au dé
   *  parmi ceux du Niveau 1 dont le Maxi n'est pas atteint (`talentTire`). */
  careerTalent?: RefDesignee;
  /** Spécialisation choisie (id) par ADRESSE d'emplacement (`adresseDeCreation`). */
  specChoices?: Record<AdresseDeCreation, string>;
  /** Option retenue, une option de `of`, par adresse d'une entrée « A ou B » des Talents d'espèce ; comparée par
   *  `cleDOption` ; absente : tirée au dé (`optionTiree`). */
  speciesTalentChoices?: Record<AdresseDeCreation, AdvancementRef>;
  /** Spécialisation (id) d'un Talent aléatoire tiré, par adresse de tirage (`adresseDeCreation.especeTirage`). */
  randomSpecPicks?: Record<AdresseDeCreation, string>;
  /** Relances d'un Talent aléatoire tiré, par adresse de tirage (LDB 05 l.484). Absente : le tirage est gardé. */
  talentRerolls?: Record<AdresseDeCreation, number>;
  /** Les Talents aléatoires sont-ils découverts (#393) ? `false` : ils sont résolus mais n'entrent pas dans
   *  le résultat ; absent : découverts. */
  talentsRolled?: boolean;
  /** Répartition des 40 Augmentations de carrière (LDB 05 l.535), par Compétence : `refKey(id, spec)`
   *  (`cleDeCompetence`). Défaut : `repartitionDeCarriere`. */
  skillAdvances?: Record<string, number>;
  /** Compétences d'espèce recevant +5/+3 (LDB 05 l.484). Défaut : 3 premières / 3 suivantes. */
  speciesSkillAdvances?: { plus5: RefDesignee[]; plus3: RefDesignee[] };
  /** Choix des emplacements de dotation par adresse (`emplacementsDeDotation`). */
  trappingChoices?: ChoixDeDotation;
  /** Sorts de Magie mineure choisis (ids de `spells.json`), dans la limite du quota (LDB 10 l.714). */
  pettySpells?: string[];
}

/** Clé d'allocation d'une Compétence de carrière : l'identité de la Compétence désignée, `refKey(id,
 *  spec)` ; un joker non désigné se keye par son id seul. */
export function cleDeCompetence(r: RefDesignee): string {
  return refKey(r.id, r.spec);
}

/** Pool de spécialisations (ids) d'un emplacement joker. */
export function poolDuJoker(kind: 'skill' | 'talent', ref: RefASpecialisation): string[] {
  return wildcardSpecs({ optionId: ref.id, ...(Array.isArray(ref.choix) ? { specOptions: ref.choix } : {}) }, kind);
}

/** Rang retenu parmi `n` candidats : `proposition` (le 1er, que le créateur propose au joueur) ou `auDe` (tiré). */
type Prendre = (n: number) => number;
const proposition: Prendre = () => 0;
const auDe = (rng: RNG): Prendre => (n) => rng.int(0, n - 1);

/** Désignation d'un emplacement : sa spécialisation fixe, la spécialisation `choisie`, sinon (joker) celle que
 *  `prendre` retient parmi les spécialisations du pool qui satisfont `libre` ; un pool dont aucune spécialisation
 *  n'est libre est refusé. */
export function designer(kind: 'skill' | 'talent', ref: RefASpecialisation, choisie?: string, libre: (spec: string) => boolean = () => true, prendre: Prendre = proposition): RefDesignee {
  if (ref.choix == null) return ref.spec ? { id: ref.id, spec: ref.spec } : { id: ref.id };
  if (choisie) return { id: ref.id, spec: choisie };
  const pool = poolDuJoker(kind, ref);
  if (!pool.length) return { id: ref.id };
  const libres = pool.filter(libre);
  const spec = libres.length ? libres[prendre(libres.length)] : undefined;
  if (!spec) throw new Error(`« ${ref.id} (Au choix) » : chaque spécialisation de son pool est déjà tenue par un autre emplacement.`);
  return { id: ref.id, spec };
}

/** Un emplacement de Compétence de carrière de départ : le Niveau 1 ou un ajout de Talent (LDB 10). */
export interface CompetenceDeCarriere {
  adresse: AdresseDeCreation;
  ref: RefASpecialisation;
  /** La Compétence désignée — `null` pour un joker sans spécialisation choisie. */
  designee: RefDesignee | null;
  /** `cleDeCompetence` de la désignée (id seul pour un joker non désigné). */
  cle: string;
  /** Ajout d'un Talent (`grantCareerSkill`) — hors des 40 Augmentations (LDB 05 l.535). */
  ajout: boolean;
  /** Spécialisation que les AUTRES emplacements du Niveau ne tiennent pas (`prisParLesAutres`). */
  libre: (spec: string) => boolean;
}

/** Les Compétences de carrière de départ (LDB 05 l.535) : un emplacement par entrée du Niveau 1, puis les
 *  ajouts des Talents (LDB 10 l.70, l.745, l.891 ; LDB 11 l.204) qu'aucune entrée ne tient déjà (`cle`). */
export function competencesDeCarriere(level: CareerLevelData | undefined, hero: Combatant, specChoices: Record<AdresseDeCreation, string> = {}): CompetenceDeCarriere[] {
  const out: CompetenceDeCarriere[] = [];
  const refs = level?.skills ?? [];
  const slots = level ? skillSlots([level], level.level) : [];
  const designations = Object.fromEntries(refs.flatMap((ref, i) => {
    const choisie = specChoices[adresseDeCreation.carriereCompetence(i)];
    return 'id' in ref && ref.choix != null && choisie ? [[slots[i].key, refKey(ref.id, choisie)]] : [];
  }));
  const designerA = (adresse: AdresseDeCreation, ref: RefASpecialisation, ajout: boolean, libre: (spec: string) => boolean): CompetenceDeCarriere => {
    const choisie = specChoices[adresse];
    const designee = ref.choix == null || choisie ? designer('skill', ref, choisie) : null;
    return { adresse, ref, designee, cle: designee ? cleDeCompetence(designee) : ref.id, ajout, libre };
  };
  refs.forEach((ref, i) => {
    if (!('id' in ref)) return;
    const pris = prisParLesAutres(slots[i], slots, designations);
    out.push(designerA(adresseDeCreation.carriereCompetence(i), ref, false, (spec) => !pris.has(refKey(ref.id, spec))));
  });
  for (const add of careerSkillAdditions(hero)) {
    const c = designerA(adresseDeCreation.ajout(add.id), add, true, () => true);
    if (!out.some((o) => o.cle === c.cle)) out.push(c);
  }
  return out;
}

/** Spécialisation libre pour le joker `ref` de la liste d'espèce (LDB 05 l.484) : ni une entrée fixe de
 *  la liste, ni l'une des `autres` Compétences retenues (celle du joker lui-même exclue par l'appelant). */
export function libreDEspece(sp: SpeciesData, ref: RefASpecialisation, autres: RefDesignee[] = []): (spec: string) => boolean {
  const pris = new Set(sp.skills.flatMap((a) => ('id' in a && a.choix == null ? [refKey(a.id, a.spec)] : [])));
  for (const r of autres) if (r.spec != null) pris.add(refKey(r.id, r.spec));
  return (spec) => !pris.has(refKey(ref.id, spec));
}

/** Barème des Augmentations de carrière de la création : points à répartir, plafond par Compétence, pas d'une
 *  Augmentation. LDB 05 l.535 ; CRB 015 l.12, l.29 */
export interface BaremeDeCarriere { quota: number; plafond: number; pas: number }
/** LDB 05 l.535 */
export const BAREME_DE_CARRIERE_LDB: BaremeDeCarriere = { quota: CAREER_SKILL_ADVANCES, plafond: MAX_ADV_PER_SKILL, pas: 1 };

/** Répartition par défaut des Augmentations de carrière (LDB 05 l.535 ; AA 02 l.134 ; VDM 03 l.37) : le `quota` du
 *  barème également réparti, par `pas`, sur les `CAREER_SKILLS_ADVANCED` premiers emplacements du Niveau, le reste aux
 *  premiers, `plafond` au plus. Clé : `cle`. */
export function repartitionDeCarriere(entrees: CompetenceDeCarriere[], { quota, plafond, pas }: BaremeDeCarriere = BAREME_DE_CARRIERE_LDB): Record<string, number> {
  const dotees = entrees.filter((c) => !c.ajout).slice(0, CAREER_SKILLS_ADVANCED);
  if (!dotees.length) return {};
  const unites = quota / pas;
  const maxi = Math.floor(plafond / pas);
  const base = Math.min(maxi, Math.floor(unites / dotees.length));
  let reste = unites - base * dotees.length;
  return Object.fromEntries(dotees.map((c) => {
    const extra = reste > 0 && base < maxi ? 1 : 0;
    reste -= extra;
    return [c.cle, (base + extra) * pas];
  }));
}

/** Nombre de Compétences d'espèce retenues à +5 et à +3. LDB 05 l.484 ; CRB 008 l.59 */
export interface QuotasDEspece { plus5: number; plus3: number }
/** LDB 05 l.484 */
export const QUOTAS_D_ESPECE_LDB: QuotasDEspece = { plus5: SPECIES_SKILLS_PLUS5, plus3: SPECIES_SKILLS_PLUS3 };

/** Compétences d'espèce retenues à +5/+3 (LDB 05 l.484) : six de la liste et leurs spécialisations, que `prendre`
 *  retient ; par défaut les 3 premières / 3 suivantes, que le créateur propose au joueur. */
export function speciesSkillDefaults(sp: SpeciesData, prendre: Prendre = proposition, quotas: QuotasDEspece = QUOTAS_D_ESPECE_LDB): { plus5: RefDesignee[]; plus3: RefDesignee[] } {
  const reste = sp.skills.filter((a): a is Extract<typeof a, { id: string }> => 'id' in a);
  const designees: RefDesignee[] = [];
  while (designees.length < quotas.plus5 + quotas.plus3 && reste.length) {
    const [a] = reste.splice(prendre(reste.length), 1);
    designees.push(designer('skill', a, undefined, libreDEspece(sp, a, designees), prendre));
  }
  return { plus5: designees.slice(0, quotas.plus5), plus3: designees.slice(quotas.plus5) };
}

/** Tire un Talent sur le Tableau des Talents aléatoires (LDB 05 l.484, l.514-531). `doublon` : Talent déjà dans
 *  `possedes`, toutes utilisations confondues (LDB 10 l.17). Utilisation : `specChoisie` (`randomSpecPicks`,
 *  écrit par `withRandomTalentSpec`) si `specPoolOf` la propose, sinon tirée sur `rng` parmi les non possédées, sinon parmi toutes. */
function rollRandomTalent(table: ReturnType<typeof tableDeTalents>, rng: RNG, possedes: readonly RefDesignee[], specChoisie?: string): { ref: RefDesignee; doublon: boolean; utilisations: string[] } {
  const rangee = findTableEntry(table.entries, rollDice(table.die, rng));
  const entry = garanti(findTalentById(rangee.id), rangee.id, 'Talent');
  const doublon = possedes.some((p) => p.id === entry.id);
  if (rangee.spec) return { ref: { id: entry.id, spec: rangee.spec }, doublon, utilisations: [] }; // CRB 006 l.35, l.39
  const utilisations = specPoolOf(entry); // tirage JOUEUR : ce que le Talent PROPOSE
  if (!utilisations.length) return { ref: { id: entry.id }, doublon, utilisations };
  if (specChoisie && utilisations.includes(specChoisie)) return { ref: { id: entry.id, spec: specChoisie }, doublon, utilisations };
  const libres = utilisations.filter((s) => !possedes.some((p) => p.id === entry.id && p.spec === s));
  return { ref: { id: entry.id, spec: tirerUn(libres.length ? libres : utilisations, rng)! }, doublon, utilisations };
}

/**
 * Résout les Talents d'espèce (LDB 05 l.484) : une entrée « A ou B » (`pick`) → l'option retenue
 * (`speciesTalentChoices`, par adresse ; absente : tirée au dé ; hors de ses options : refusée) ; un Talent fixe tel
 * quel ; `{pick, table}` → tirages sur la table désignée, y compris comme option d'un choix. Un joker prend la
 * spécialisation choisie (`specChoices`, par adresse), sinon une non possédée tirée au dé.
 */
export function resolveSpeciesTalents(sp: SpeciesData, opts: OptionsDeResolution): RefDesignee[] {
  return resolveSpeciesTalentsDetail(sp, opts).map((t) => t.ref);
}

/** Les choix qui résolvent les Talents d'espèce. Chaque tirage prend son flux, `fluxDeCreation(seed,
 *  'talents', adresse, rang)` ; le rang `r` d'un tirage ne s'applique que si le rang `r - 1` est un doublon. */
type OptionsDeResolution = Pick<ChoixDeCreation, 'seed' | 'speciesTalentChoices' | 'specChoices' | 'randomSpecPicks' | 'talentRerolls' | 'talentsRolled'>;

/** Un Talent d'espèce résolu ; `tirage` pour un Talent tiré (LDB 05 l.484) : son adresse
 *  (`adresseDeCreation.especeTirage`), son rang de relance effectif, `doublon` au regard des Talents
 *  résolus avant lui, et les utilisations que le joueur choisit (vide quand la table fixe la spécialisation). */
export interface TalentDEspece {
  ref: RefDesignee;
  tirage?: { adresse: AdresseDeCreation; rang: number; doublon: boolean; utilisations: string[] };
}

/** `resolveSpeciesTalents`, chaque Talent tiré portant son `tirage`. */
export function resolveSpeciesTalentsDetail(sp: SpeciesData, opts: OptionsDeResolution): TalentDEspece[] {
  const result: TalentDEspece[] = [];
  const possedes = () => result.map((t) => t.ref);
  const tirer = (table: ReturnType<typeof tableDeTalents>, adresse: AdresseDeCreation) => {
    const aRang = (rang: number) => rollRandomTalent(table, fluxDeCreation(opts.seed, 'talents', adresse, rang), possedes(), opts.randomSpecPicks?.[adresse]);
    const relances = opts.talentRerolls?.[adresse] ?? 0;
    let rang = 0;
    let t = aRang(rang);
    while (t.doublon && rang < relances) t = aRang(++rang);
    result.push({ ref: t.ref, tirage: { adresse, rang, doublon: t.doublon, utilisations: t.utilisations } });
  };
  optionsDesTalentsDEspece(sp, opts.speciesTalentChoices).forEach((choisie, i) => {
    const adresse = adresseDeCreation.especeTalent(i);
    const demandee = opts.speciesTalentChoices?.[adresse];
    if (demandee != null && choisie == null) throw new Error(`Talent d'espèce « ${cleDOption(demandee)} » : hors des options de « ${cleDOption(sp.talents[i])} » (LDB 05 l.484).`);
    const option = choisie ?? optionTiree(sp.talents[i], adresse, opts.seed);
    if ('table' in option) {
      const table = tableDeTalents(option.table);
      for (let j = 0; j < option.pick; j++) tirer(table, adresseDeCreation.especeTirage(i, j));
    } else if ('id' in option) {
      result.push({ ref: designer('talent', option, opts.specChoices?.[adresse], (s) => !possedes().some((p) => p.id === option.id && p.spec === s), auDe(fluxDeCreation(opts.seed, 'specialisations', adresse))) });
    }
  });
  return opts.talentsRolled ?? true ? result : result.filter((t) => !t.tirage);
}

export interface CreateHeroOptions extends ChoixDeCreation {
  /** `id` STABLE de l'espèce (`SpeciesData.id`) — ≠ libellé. */
  speciesId: string;
  /** `id` STABLE de la carrière (`CareerData.id`) — ≠ libellé. */
  careerId: string;
  label: string;
  /** Caractéristiques saisies manuellement (sinon tirage base + 2d10). */
  manualChars?: Partial<Characteristics>;
  /** Signe astral choisi (ADE II) — `id` STABLE (≠ libellé) ; son `effect` (charMod / grantTalent) est
   *  appliqué aux attributs de départ via applyStarOps. Absent = pas de signe. */
  starId?: string;
  /** Les 5 Augmentations gratuites réparties sur les 3 Caractéristiques de carrière (LDB 05
   * l.459). Défaut : 2/2/1 sur les 3 Caractéristiques du Niveau 1. */
  charAdvancesAlloc?: Partial<Record<CharKey, number>>;
  /** Répartition des points supplémentaires Destin/Résilience. */
  fateSplit?: { fate: number; resilience: number };
  /** Espèce jouée, en place de celle de `speciesId` (une espèce surchargée par la procédure de création). */
  espece?: SpeciesData;
  /** Réserves de départ, en place de celles de l'espèce et de `fateSplit`. */
  reserves?: ReservesDeDepart;
  /** Modèle de progression du héros (`Combatant.progression`). */
  progression?: Combatant['progression'];
  /** Langues d'espèce : chacune reçoit `points`. CRB 008 l.55 */
  langues?: { refs: readonly RefDesignee[]; points: number };
  /** Dotations du Niveau suivant acquises à la création, par rang dans la liste du Niveau, chacune cochée. CRB 013 l.11-15 */
  dotationsDuNiveauSuivant?: readonly number[];
  /** PX bonus gagnés pendant la création (choix aléatoires acceptés, LDB 04/05). */
  xpBonus?: number;
  details?: HeroDetails;
  motivation?: string;
  /** Apparence du héros sans son espèce de rendu, dérivée ici de `speciesId` (`especeDApparence`). Absente = aucune. */
  apparence?: Omit<NonNullable<Combatant['appearance']>, 'species'>;
  /** Niveau de carrière de la recrue : chaque Niveau en dessous est achevé par achats (`acheverLeNiveau`). Absent : 1. */
  careerLevel?: number;
  /** Id du héros ; absent = un id neuf de `idNeuf`. */
  id?: string;
  /** Forge l'id du héros sans `id` et les uids de ses objets (`doterLePorteur`). #2907 */
  idNeuf: FabriqueDId;
}

/** Base de la colonne Humain du Tableau des Attributs. LDB 05 l.351-369 */
export const BASE_HUMAINE = 20;

/** Base d'espèce d'une Caractéristique : sa colonne du Tableau des Attributs. LDB 05 l.351-369 */
export function baseDEspece(sp: Pick<SpeciesData, 'baseChar'>, k: CharKey): number {
  return sp.baseChar[k];
}

export function rollCharacteristics(sp: SpeciesData, rng: RNG): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const base = baseDEspece(sp, k);
    chars[k] = base + roll(2, 10, rng);
  }
  return chars;
}

/** Une Compétence d'espèce désignée sans spécialisation alors que son emplacement est un joker reçoit une
 *  spécialisation libre de cet emplacement tirée sur `rng`, les `autres` retenues exclues (`libreDEspece`). */
function completerCompetenceDEspece(sp: SpeciesData, r: RefDesignee, autres: RefDesignee[], rng: RNG): RefDesignee {
  if (r.spec != null) return r;
  const slot = sp.skills.find((a): a is Extract<typeof a, { id: string }> => 'id' in a && a.id === r.id && a.choix != null);
  return slot ? designer('skill', slot, undefined, libreDEspece(sp, slot, autres), auDe(rng)) : r;
}

/** Le flux du tirage `quoi` du Niveau `niveau` d'une recrue sans choix. */
const fluxDuNiveau = (seed: number, niveau: number, quoi: string): RNG => fluxDeCreation(seed, 'niveaux', niveau, quoi);

/** Désigne l'emplacement du Niveau `niveau` que tient le Talent de carrière `ref` de `hero`, ou refuse un Talent qu'aucun
 *  emplacement libre du Niveau ne couvre. LDB 05 l.535 ; LDB 10 l.17 */
function designerLeTalentDeCarriere(hero: Combatant, careerId: string, levels: readonly CareerLevelData[], niveau: number, { id: talentId, spec }: RefDesignee): void {
  const tSlots = talentSlots(levels, niveau);
  const all = [...skillSlots(levels, niveau), ...tSlots];
  const designations = designationsFor(hero, careerId);
  const quoi = `Talent de carrière « ${refKey(talentId, spec)} »`;
  switch (statutOuRefus(tSlots, designations, talentId, spec, all)) {
    case 'free': designateSlot(hero, careerId, freeSlotFor(tSlots, designations, talentId, spec, all)!, talentId, spec, all); break;
    case 'explicit': case 'designated': break;
    case 'absent': throw new Error(`${quoi} : absent du Niveau ${niveau} de « ${careerId} » (LDB 05 l.535).`);
    case 'sansSpec': throw new Error(`${quoi} : l'emplacement « (Au choix) » du Niveau ${niveau} de « ${careerId} » exige une spécialisation (LDB 10 l.17).`);
    case 'nonCouvert': throw new Error(`${quoi} : aucun emplacement libre du Niveau ${niveau} de « ${careerId} » ne couvre cette spécialisation.`);
  }
}

/** L'emplacement à choix non désigné `slot` de `hero` désigné d'un candidat (`candidatsDuSlot`) qu'aucun autre
 *  emplacement de son Niveau ne tient, tiré sur `rng` ; sans candidat libre : `undefined`. LDB 07 l.76 */
function designerLeJoker(hero: Combatant, careerId: string, slot: CareerSlot, slots: CareerSlot[], rng: RNG): RefDesignee | undefined {
  const pris = prisParLesAutres(slot, slots, designationsFor(hero, careerId));
  const cle = tirerUn(candidatsDuSlot(slot).filter((k) => !pris.has(k)), rng);
  if (!cle) return undefined;
  const ref = parseRefKey(cle);
  designateSlot(hero, careerId, slot, ref.id, ref.spec, slots);
  return ref;
}

/** Le Niveau `niveau` de la carrière `careerId` de `hero` achevé par achats (LDB 07 l.124) : chaque Caractéristique de
 *  carrière disponible portée à `careerCompletionAdvances(niveau)` Augmentations ; autant de Compétences de carrière,
 *  les plus augmentées d'abord, jusqu'à `CAREER_SKILLS_ADVANCED` (un emplacement à choix non désigné est désigné au dé,
 *  `designerLeJoker`) ; faute d'en tenir un, un Talent du Niveau tiré au dé (`talentTire`). Chaque tirage prend son flux
 *  de la graine `seed` (`fluxDuNiveau`). Mute `hero`. */
function acheverLeNiveau(hero: Combatant, careerId: string, levels: readonly CareerLevelData[], niveau: number, seed: number): void {
  const req = careerCompletionAdvances(niveau);
  for (const k of new Set(availableChars(levels, niveau))) {
    const manque = req - (hero.charAdvances?.[k] ?? 0);
    if (manque <= 0) continue;
    hero.charAdvances = { ...hero.charAdvances, [k]: req };
    hero.characteristics[k] += manque;
  }
  const slots = skillSlots(levels, niveau);
  const avances = (r: RefDesignee | null) => (r ? hero.skills.find((s) => s.id === r.id && memeSpecialisation(s.spec, r.spec))?.advances ?? 0 : 0);
  const designations = designationsFor(hero, careerId);
  const parAvances = [...slots].sort((a, b) => avances(slotRef(b, designations)) - avances(slotRef(a, designations)));
  let tenues = 0;
  for (const slot of parAvances) {
    if (tenues >= CAREER_SKILLS_ADVANCED) break;
    const ref = slotRef(slot, designationsFor(hero, careerId)) ?? designerLeJoker(hero, careerId, slot, slots, fluxDuNiveau(seed, niveau, slot.key));
    if (!ref) continue;
    augmenterLaCompetence(hero.skills, ref, Math.max(0, req - avances(ref)));
    tenues++;
  }
  if (tientUnTalentDuNiveau(hero, talentSlots(levels, niveau), designationsFor(hero, careerId))) return;
  const talent = talentTire(hero, talentSlots(levels, niveau), [], fluxDuNiveau(seed, niveau, 'talent'));
  if (!talent || !acquerirTalent(hero, talent)) throw new Error(`Niveau ${niveau} de « ${careerId} » : aucun Talent du Niveau n'est acquérable (LDB 07 l.124 ; LDB 10 l.18).`);
  designerLeTalentDeCarriere(hero, careerId, levels, niveau, talent);
}

export function createHero(opts: CreateHeroOptions): Combatant {
  const trouvee = opts.espece ?? findSpeciesById(opts.speciesId);
  if (!trouvee) throw new Error(`Espèce inconnue : ${opts.speciesId}`);
  const sp = structuredClone(trouvee); // #2097
  const levels = levelsForCareer(opts.careerId);
  const level = levels.find((l) => l.level === 1);
  const specChoices = opts.specChoices ?? {};
  const niveau = opts.careerLevel ?? 1;
  if (!findCareerById(opts.careerId)) throw new Error(`Carrière inconnue : ${opts.careerId}`);
  if (!levels.some((l) => l.level === niveau)) throw new Error(`Niveau ${niveau} absent de la carrière « ${opts.careerId} » (LDB 07 l.137).`);

  // 3) Attributs : base d'espèce + 2d10 (rang 0 : sans relance, LDB 05 l.341), ou saisie manuelle.
  const chars = rollCharacteristics(sp, fluxDeCreation(opts.seed, 'caracteristiques', 0));
  if (opts.manualChars) for (const k of CHAR_KEYS) if (opts.manualChars[k] != null) chars[k] = opts.manualChars[k]!;

  // 3b) 5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.459).
  const careerCharKeys: CharKey[] = level?.characteristics ?? []; // déjà des CharKey (donnée)
  const alloc: Partial<Record<CharKey, number>> = opts.charAdvancesAlloc ?? autoCharAlloc(careerCharKeys);
  const charAdvances: Partial<Record<CharKey, number>> = {};
  for (const [k, n] of Object.entries(alloc) as [CharKey, number][]) {
    if (!n) continue;
    charAdvances[k] = n;
    chars[k] += n; // l'Augmentation s'ajoute à la valeur initiale (LDB 05 l.463)
  }

  // 4a) Talents : Talents d'espèce + 1 Talent de carrière (LDB 05 l.535, LDB 10 l.9, Maxi respecté).
  const speciesTalents = resolveSpeciesTalents(sp, opts);
  const acquis: PorteurDeTalents = { characteristics: chars, talents: [] };
  const addTalentRef = (ref: RefDesignee) => {
    acquerirTalent(acquis, ref);
  };
  for (const t of speciesTalents) addTalentRef(t);

  const chosenTalent = opts.careerTalent ?? talentTire(acquis, talentSlots(levels, 1), [], fluxDuNiveau(opts.seed, 1, 'talent'));
  if (chosenTalent) addTalentRef(chosenTalent);

  // Signe astral (ADE II 3) : effet appliqué AUX ATTRIBUTS DE DÉPART (±carac) + Talents octroyés,
  // AVANT heroSoFar (careerSkillAdditions voit un « Maître artisan » du signe) et avant les effets
  // d'acquisition des Talents.
  if (opts.starId) applyStarOps(opts.starId, chars, (ref, k) => addTalentRef(designer('talent', ref, specChoices[adresseDeCreation.signe(k)], undefined, auDe(fluxDeCreation(opts.seed, 'specialisations', adresseDeCreation.signe(k))))));

  const talents: TalentInstance[] = acquis.talents ?? [];

  // 4b) Compétences de carrière : 40 Augmentations (`repartitionDeCarriere` par défaut), UNE part par
  // Compétence (LDB 05 l.535) ; un ajout de Talent est acquis sans Augmentation.
  const skills: SkillInstance[] = [];
  const heroSoFar: Combatant = { characteristics: chars, charAdvances, talents, skills } as Combatant;
  const addSkill = (ref: RefDesignee, adv: number) => augmenterLaCompetence(skills, ref, adv);
  const carriere = competencesDeCarriere(level, heroSoFar, specChoices);
  const allouees: { adresse: AdresseDeCreation; designee: RefDesignee }[] = [];
  const parDefaut = new Set<string>();
  const repartition = opts.skillAdvances ?? repartitionDeCarriere(carriere);
  for (const c of carriere) {
    const adv = c.ajout ? 0 : repartition[c.cle] ?? 0;
    const designee = c.designee ?? designer('skill', c.ref, undefined, (s) => c.libre(s) && !parDefaut.has(refKey(c.ref.id, s)), auDe(fluxDeCreation(opts.seed, 'specialisations', c.adresse)));
    if (!c.designee) parDefaut.add(refKey(designee.id, designee.spec));
    addSkill(designee, adv);
    if (adv > 0) allouees.push({ adresse: c.adresse, designee });
  }

  // 4c) Compétences d'espèce (LDB 05 l.484) : 3 à +5, 3 à +3 ; cumul si même (id, spec) qu'une
  // Compétence de carrière, Compétence séparée sinon.
  const espece = opts.speciesSkillAdvances ?? speciesSkillDefaults(sp, auDe(fluxDeCreation(opts.seed, 'competences-espece')));
  const retenues = [...espece.plus5, ...espece.plus3];
  const tenues = new Set<string>();
  retenues.forEach((r, i) => {
    const designee = completerCompetenceDEspece(sp, r, retenues.filter((_, j) => j !== i), fluxDeCreation(opts.seed, 'competences-espece', i));
    retenues[i] = designee;
    const cle = refKey(designee.id, designee.spec);
    if (tenues.has(cle)) throw new Error(`Compétence d'espèce « ${cle} » : déjà retenue par un autre emplacement de la liste de « ${sp.id} » (LDB 05 l.484).`);
    tenues.add(cle);
    addSkill(designee, i < espece.plus5.length ? 5 : 3);
  });
  for (const ref of opts.langues?.refs ?? []) addSkill(ref, opts.langues!.points);

  // 5) Possessions de Classe et des Niveaux 1 à `niveau` (LDB 05 l.552, l.572), emplacements résolus par
  //    `opts.trappingChoices` avant `doterLePorteur`.
  const suivant = levels.find((l) => l.level === niveau + 1)?.trappings ?? [];
  const enSus = (opts.dotationsDuNiveauSuivant ?? []).map((i) => garanti(suivant[i], i, `dotation du Niveau ${niveau + 1} de « ${opts.careerId} »`));
  const rawTrappings = resolveTrappingChoices([...dotationsDuHeros(opts.careerId, niveau), ...enSus], opts.trappingChoices ?? {});
  const { items, mentions } = doterLePorteur(rawTrappings, fluxDeCreation(opts.seed, 'possessions'), opts.idNeuf, contexteDeNaissanceDObjet({ species: opts.speciesId, career: opts.careerId }));
  const id = opts.id ?? opts.idNeuf('hero');

  // Destin / Résilience
  const split = opts.fateSplit ?? autoFateSplit(sp.fate.extra);
  const reserves = opts.reserves ?? { fate: sp.fate.fate + split.fate, resilience: sp.fate.resilience + split.resilience };

  // Désignations des emplacements de carrière utilisés à la création (cf. careerSlots) :
  // compétences « (Au choix) » ayant reçu des augmentations + talent de carrière à choix.
  const sSlots = skillSlots(levels, 1);
  const slotsDuNiveau = sSlots.filter((s) => s.level === 1);
  for (const { adresse, designee } of allouees) {
    const i = (level?.skills ?? []).findIndex((_, j) => adresseDeCreation.carriereCompetence(j) === adresse);
    const slot = slotsDuNiveau[i];
    if (!slot?.needsChoice) continue;
    const designation = designateSlot(heroSoFar, opts.careerId, slot, designee.id, designee.spec, sSlots);
    if (!designation.ok) throw new Error(`Compétence de carrière « ${refKey(designee.id, designee.spec)} » : ${designation.reason} (LDB 05 l.535).`);
  }
  if (chosenTalent) designerLeTalentDeCarriere(heroSoFar, opts.careerId, levels, 1, chosenTalent);

  // Niveaux franchis : chacun achevé par achats, puis le suivant commencé. LDB 07 l.124, l.137
  for (let n = 1; n < niveau; n++) acheverLeNiveau(heroSoFar, opts.careerId, levels, n, opts.seed);

  // Sorts de Magie mineure (LDB 10 l.714).
  const quota = pettySpellQuotaFor(heroSoFar);
  const horsMagieMineure = (opts.pettySpells ?? []).filter((id) => findSpellById(id)?.family !== 'mineure');
  if (horsMagieMineure.length) throw new Error(`Sorts de Magie mineure « ${horsMagieMineure.join(', ')} » : absents du catalogue des sorts mineurs (LDB 10 l.714).`);

  const hero = assemblerLeHeros({
    espece: sp,
    progression: opts.progression,
    career: opts.careerId,
    careerLevel: niveau,
    id,
    label: opts.label,
    characteristics: chars,
    charAdvances: heroSoFar.charAdvances ?? {},
    talents: heroSoFar.talents,
    skills,
    items,
    mentions,
    careerSlotChoices: heroSoFar.careerSlotChoices,
    reserves,
    spells: quota ? (opts.pettySpells ?? []).slice(0, quota) : [],
    // Les 5 Augmentations gratuites de la création (LDB 05 l.459) sont comptées dans charAdvances ; les PX
    // bonus des choix aléatoires (LDB 04/05) restent à dépenser.
    xp: opts.xpBonus ?? 0,
    details: opts.details,
    motivation: opts.motivation,
    apparence: opts.apparence,
  });
  for (const i of opts.dotationsDuNiveauSuivant ?? []) cocherLaDotationDeRang(hero, i);
  return hero;
}

/** Les réserves de départ d'un héros, par champ du héros. LDB 05 l.426 ; CRB 006 l.27 */
export interface ReservesDeDepart { fate: number; resilience?: number; fortuneDeBase?: number }

/** Un héros aux valeurs DÉJÀ résolues — ni tirage ni choix par adresse : l'entrée d'`assemblerLeHeros`. */
export interface HerosResolu {
  espece: SpeciesData;
  progression?: Combatant['progression'];
  /** Carrière actuelle, son Niveau, et le parcours qui la contient (`Combatant.careerHistory`). */
  career: string;
  careerLevel: number;
  careerHistory?: string[];
  id: string;
  label: string;
  /** Valeurs stockées : Augmentations comprises, sans les `charMod` des Talents (passifs). LDB 05 l.463 */
  characteristics: Characteristics;
  charAdvances: Partial<Record<CharKey, number>>;
  talents: TalentInstance[];
  skills: SkillInstance[];
  items: ItemInstance[];
  mentions?: Combatant['mentions'];
  careerSlotChoices?: Combatant['careerSlotChoices'];
  reserves: ReservesDeDepart;
  /** Sorts appris en plus des Bénédictions qu'octroient les Talents (`appliquerAcquisitions`). */
  spells: readonly string[];
  xp: number;
  details?: HeroDetails;
  motivation?: string;
  apparence?: CreateHeroOptions['apparence'];
}

/** Le héros des valeurs résolues `r`, sans tirage : Traits d'espèce, Taille, Blessures, effets d'acquisition des
 *  Talents, Chance et Détermination, sorts, loadout. */
export function assemblerLeHeros(r: HerosResolu): Combatant {
  const sp = r.espece;
  // Trait RACIAL de l'espèce (#572) — Ogre `{id:'ogre'}` (encombrance/consommation ×2, ADE2 « Ogres
  // et Mutations » l.708 « Un Lourd Fardeau ») : résolu et posé sur `Combatant.traits` (MÊME résolution
  // que le spawn de créature bestiaire, #513).
  const speciesTraits = traitsDuPorteur(sp.traits ?? [], { id: r.id, indice: indiceSurLeProfil((k) => r.characteristics[k]) });

  // Taille (LDB 85 l.344-354) — portée par `TalentData.size` (#572) : `sizeFromTalents` sur les talents, sinon Moyenne.
  const size = sizeFromTalents(r.talents.map((tt) => tt.talentId), tailleDuTalent) ?? 'moyenne';

  const { fate: _destin, ...horsDestin } = r.reserves;
  const sansBlessures: Omit<Combatant, 'wounds'> = {
    id: r.id,
    label: r.label,
    kind: 'heros',
    species: sp.id,
    career: r.career,
    groups: groupsFor({ speciesId: sp.id }), // Groupes déclarés par l'espèce ; carrière, classe, culte et Traits lus en direct (`groupesDe`). LDB 21
    size,
    characteristics: r.characteristics,
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: emptyArmour(),
    items: r.items,
    ...(r.mentions ? { mentions: r.mentions } : {}),
    skills: r.skills,
    talents: r.talents,
    traits: speciesTraits.length ? speciesTraits : undefined, // Trait racial d'espèce (#572) — Ogre : encombrance/consommation ×2 + Taille
    movement: sp.movement,
    fate: r.reserves.fate,
    fortune: 0,
    ...horsDestin,
    [modeleDe(r).reserves.determination]: 0,
    ...(r.progression ? { progression: r.progression } : {}),
    motivation: r.motivation,
    details: r.details,
    xp: r.xp,
    charAdvances: r.charAdvances,
    careerLevel: r.careerLevel,
    ...(r.careerHistory ? { careerHistory: r.careerHistory } : {}),
    ...(r.careerSlotChoices ? { careerSlotChoices: r.careerSlotChoices } : {}),
    ...(r.apparence ? { appearance: { ...r.apparence, species: especeDApparence(sp.id) } } : {}),
  };

  // Blessures du profil (LDB 05 l.1001), effets d'acquisition des Talents (`appliquerAcquisitions`), puis
  // Chance et Détermination.
  const hero: Combatant = { ...sansBlessures, wounds: blessuresPosees(sansBlessures) };
  appliquerAcquisitions(hero);
  hero.fortune = fortuneMax(hero);
  hero[modeleDe(hero).reserves.determination] = resolveMax(hero);

  // Sorts appris, après les Bénédictions déjà octroyées par `applyTalentAcquisition`.
  const appris = r.spells.filter((id) => !(hero.spells ?? []).includes(id));
  if (appris.length) hero.spells = [...(hero.spells ?? []), ...appris];

  recomputeLoadout(hero); // dérive weapons/armure/encombrement ; auto-génère le loadout par défaut (Mêlée/Distance)
  return hero;
}

/** Répartition automatique des 5 Augmentations gratuites (2/2/1) sur les Caractéristiques de
 *  carrière — utilisée quand l'appelant ne fournit pas de répartition. */
function autoCharAlloc(careerChars: CharKey[]): Partial<Record<CharKey, number>> {
  const out: Partial<Record<CharKey, number>> = {};
  const parts = [2, 2, 1];
  careerChars.slice(0, 3).forEach((k, i) => {
    out[k] = parts[i] ?? 0;
  });
  return out;
}

function autoFateSplit(extra: number): { fate: number; resilience: number } {
  const fate = Math.ceil(extra / 2);
  return { fate, resilience: extra - fate };
}
