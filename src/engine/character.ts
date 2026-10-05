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
import { RNG, roll, fluxDerive } from './dice';
import { buildInventory, recomputeLoadout, emptyArmour } from './items';
import { groupsFor } from './groups';
import { CharKey, CHAR_KEYS, Characteristics, Combatant, SkillInstance, TalentInstance, HeroDetails } from './types';
import {
  SpeciesData,
  CareerLevelData,
  findSpeciesById,
  firstLevel,
  levelsForCareer,
  byId,
  tailleDuTalent,
  specPoolOf,
  talents as talentTable,
  rigSpeciesId,
  type AdvancementRef,
} from '../data';
import type { RefDesignee, RefASpecialisation } from '../data/schemas/grammaire/ref';
import { refKey, skillSlots, talentSlots, designateSlot, freeSlotFor, statutOuRefus, designationsFor, talentMaxReached, wildcardSpecs, prisParLesAutres, acquerirTalent, type PorteurDeTalents } from './careerSlots';
import { resolveTrappingChoices, type ChoixDeDotation } from './trappingChoices';
import { adresseDeCreation, type AdresseDeCreation } from './adresseDeCreation';
import { appliquerAcquisitions, heroMaxWounds, fortuneMax, resolveMax, careerSkillAdditions } from './talentEffects';
import { applyStarOps, pettySpellQuotaFor } from './creation';
import { sizeFromTalents } from './size';
import { versionCourante } from '../lib/versionCourante';

/** Caractéristique d'une Compétence (skills.json) par `id` STABLE — LDB 09 : valeur de Test =
 *  Caractéristique + avances. (≠ re-lookup par libellé — multilangue-safe.) */
export function skillCharacteristicById(id: string): CharKey {
  const data = byId('skill', id);
  return data?.characteristic ?? 'dexterite'; // CharKey stable portée par la donnée (repli prudent)
}

/** « Répartissez 40 Points d'Augmentations entre vos huit Compétences de départ » (LDB 05 l.535). */
export const CAREER_SKILL_ADVANCES = 40;
/** « sans dépasser plus de 10 Points alloués à une seule Compétence à ce stade » (LDB 05 l.535). */
export const MAX_ADV_PER_SKILL = 10;
/** « vos huit Compétences de départ » (LDB 05 l.535) ; « seules huit doivent être améliorées » d'un
 *  Niveau à dix Compétences (AA 02 l.134 ; VDM 03 l.37). */
export const CAREER_SKILLS_ADVANCED = 8;

/** Migrations du format PERSISTÉ des choix de création (brouillon du roster), keyées par format de DÉPART
 *  (#2226). */
const MIGRATIONS_DES_CHOIX = {
  2: '#1897 tirages de Talents par adresse',
  3: '#1897 flux des tirages de Talents sous l’étape `talents`, option « A ou B » par `cleDOption`',
  4: '#1988 choix de dotation par adresse',
} as const;

/** Format PERSISTÉ des choix de création (brouillon du roster). */
export const FORMAT_DES_CHOIX = versionCourante(MIGRATIONS_DES_CHOIX);

/** Étapes aléatoires de la création, chacune son flux (`fluxDeCreation`). */
export type EtapeDeFlux = 'espece' | 'carriere' | 'carriere:deux-de-plus' | 'carriere:relance' | 'caracteristiques' | 'signe' | 'astrologie' | 'talents' | 'bourse' | 'details';

/** Le flux figé d'une étape de création, dérivé de la graine racine `seed` (`fluxDerive`). */
export function fluxDeCreation(seed: number, etape: EtapeDeFlux, ...suite: readonly (string | number)[]): RNG {
  return fluxDerive(seed, etape, ...suite);
}

/** Clé de COMPARAISON d'une option d'une entrée « A ou B » : `refKey(id, spec)` d'un Talent, `tirage:<n>`
 *  d'une entrée `{random: n}`. */
export function cleDOption(option: AdvancementRef): string {
  if ('id' in option) return refKey(option.id, option.spec);
  if ('random' in option) return `tirage:${option.random}`;
  return option.of.map(cleDOption).join(' ou ');
}

/**
 * Les CHOIX de création d'un héros, en ids — la forme commune du brouillon du créateur (`CreatorDraft`),
 * des pré-tirés (`PregenDef`) et des options de `createHero`.
 */
export interface ChoixDeCreation {
  /** Graine RACINE de la création : chaque étape aléatoire en dérive son flux (`fluxDeCreation`). */
  seed: number;
  /** Talent de carrière ; peut être un talent d'espèce déjà possédé (LDB 05 l.535, LDB 10 l.9). Défaut : 1re entrée
   *  du Niveau 1 dont le Maxi n'est pas atteint. */
  careerTalent?: RefDesignee;
  /** Spécialisation choisie (id) par ADRESSE d'emplacement (`adresseDeCreation`). */
  specChoices?: Record<AdresseDeCreation, string>;
  /** Option retenue, une option de `of`, par adresse d'une entrée « A ou B » des Talents d'espèce ; comparée par
   *  `cleDOption` ; défaut : la 1re de `of`. */
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

/** Désignation d'un emplacement : sa spécialisation fixe, la spécialisation `choisie`, sinon (joker) la
 *  1re du pool qui satisfait `libre` ; un pool dont aucune spécialisation n'est libre est refusé. */
export function designer(kind: 'skill' | 'talent', ref: RefASpecialisation, choisie?: string, libre: (spec: string) => boolean = () => true): RefDesignee {
  if (ref.choix == null) return ref.spec ? { id: ref.id, spec: ref.spec } : { id: ref.id };
  if (choisie) return { id: ref.id, spec: choisie };
  const pool = poolDuJoker(kind, ref);
  if (!pool.length) return { id: ref.id };
  const spec = pool.find(libre);
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

/** Répartition par défaut des Augmentations de carrière (LDB 05 l.535 ; AA 02 l.134 ; VDM 03 l.37) :
 *  `CAREER_SKILL_ADVANCES` également réparties sur les `CAREER_SKILLS_ADVANCED` premiers emplacements
 *  du Niveau, le reste aux premiers, `MAX_ADV_PER_SKILL` au plus. Clé : `cle`. */
export function repartitionDeCarriere(entrees: CompetenceDeCarriere[]): Record<string, number> {
  const dotees = entrees.filter((c) => !c.ajout).slice(0, CAREER_SKILLS_ADVANCED);
  if (!dotees.length) return {};
  const base = Math.min(MAX_ADV_PER_SKILL, Math.floor(CAREER_SKILL_ADVANCES / dotees.length));
  let reste = CAREER_SKILL_ADVANCES - base * dotees.length;
  return Object.fromEntries(dotees.map((c) => {
    const extra = reste > 0 && base < MAX_ADV_PER_SKILL ? 1 : 0;
    reste -= extra;
    return [c.cle, base + extra];
  }));
}

/** Compétences d'espèce retenues à +5/+3 par défaut (LDB 05 l.484) : les 3 premières / 3 suivantes. */
export function speciesSkillDefaults(sp: SpeciesData): { plus5: RefDesignee[]; plus3: RefDesignee[] } {
  const designees: RefDesignee[] = [];
  for (const a of sp.skills) if ('id' in a) designees.push(designer('skill', a, undefined, libreDEspece(sp, a, designees)));
  return { plus5: designees.slice(0, 3), plus3: designees.slice(3, 6) };
}

/** Tableau des Talents aléatoires (Livre de base) : talents avec borne d100, triés. */
function randomTalentTable() {
  return talentTable.filter((t) => t.rand != null).sort((a, b) => (a.rand as number) - (b.rand as number));
}

/** Tire un Talent sur le Tableau des Talents aléatoires (LDB 05 l.484). `doublon` : Talent déjà dans
 *  `possedes`, toutes utilisations confondues (LDB 10 l.17). Utilisation : `specChoisie` (`randomSpecPicks`,
 *  écrit par `withRandomTalentSpec`) si `specPoolOf` la propose, sinon la 1re non possédée, sinon la 1re. */
function rollRandomTalent(rng: RNG, possedes: readonly RefDesignee[], specChoisie?: string): { ref: RefDesignee; doublon: boolean } | null {
  const r = roll(1, 100, rng);
  const entry = randomTalentTable().find((t) => r <= (t.rand as number));
  if (!entry) return null;
  const doublon = possedes.some((p) => p.id === entry.id);
  const specs = specPoolOf(entry); // tirage JOUEUR : ce que le Talent PROPOSE
  if (!specs.length) return { ref: { id: entry.id }, doublon };
  const libre = specs.find((s) => !possedes.some((p) => p.id === entry.id && p.spec === s));
  return { ref: { id: entry.id, spec: specChoisie && specs.includes(specChoisie) ? specChoisie : libre ?? specs[0] }, doublon };
}

/**
 * Résout les Talents d'espèce (LDB 05 l.484) : une entrée « A ou B » (`pick`) → l'option retenue
 * (`speciesTalentChoices`, par adresse ; défaut : la 1re) ; un Talent fixe tel quel ; `{random: n}` → n
 * tirages sur le Tableau des Talents aléatoires, y compris comme option d'un choix. Un joker prend la
 * spécialisation choisie (`specChoices`, par adresse), sinon la 1re non possédée.
 */
export function resolveSpeciesTalents(sp: SpeciesData, opts: OptionsDeResolution): RefDesignee[] {
  return resolveSpeciesTalentsDetail(sp, opts).map((t) => t.ref);
}

/** Les choix qui résolvent les Talents d'espèce. Chaque tirage prend son flux, `fluxDeCreation(seed,
 *  'talents', adresse, rang)` ; le rang `r` d'un tirage ne s'applique que si le rang `r - 1` est un doublon. */
type OptionsDeResolution = Pick<ChoixDeCreation, 'seed' | 'speciesTalentChoices' | 'specChoices' | 'randomSpecPicks' | 'talentRerolls' | 'talentsRolled'>;

/** Un Talent d'espèce résolu ; `tirage` pour un Talent tiré (LDB 05 l.484) : son adresse
 *  (`adresseDeCreation.especeTirage`), son rang de relance effectif et `doublon` au regard des Talents
 *  résolus avant lui. */
export interface TalentDEspece {
  ref: RefDesignee;
  tirage?: { adresse: AdresseDeCreation; rang: number; doublon: boolean };
}

/** `resolveSpeciesTalents`, chaque Talent tiré portant son `tirage`. */
export function resolveSpeciesTalentsDetail(sp: SpeciesData, opts: OptionsDeResolution): TalentDEspece[] {
  const result: TalentDEspece[] = [];
  const possedes = () => result.map((t) => t.ref);
  const tirer = (adresse: AdresseDeCreation) => {
    const aRang = (rang: number) => rollRandomTalent(fluxDeCreation(opts.seed, 'talents', adresse, rang), possedes(), opts.randomSpecPicks?.[adresse]);
    const relances = opts.talentRerolls?.[adresse] ?? 0;
    let rang = 0;
    let t = aRang(rang);
    while (t?.doublon && rang < relances) t = aRang(++rang);
    if (t) result.push({ ref: t.ref, tirage: { adresse, rang, doublon: t.doublon } });
  };
  sp.talents.forEach((ref, i) => {
    const adresse = adresseDeCreation.especeTalent(i);
    const choisie = opts.speciesTalentChoices?.[adresse];
    const option = 'pick' in ref ? ref.of.find((o) => choisie != null && cleDOption(o) === cleDOption(choisie)) ?? ref.of[0] : ref;
    if ('random' in option) for (let j = 0; j < option.random; j++) tirer(adresseDeCreation.especeTirage(i, j));
    else if ('id' in option) result.push({ ref: designer('talent', option, opts.specChoices?.[adresse], (s) => !possedes().some((p) => p.id === option.id && p.spec === s)) });
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
  /** PX bonus gagnés pendant la création (choix aléatoires acceptés, LDB 04/05). */
  xpBonus?: number;
  details?: HeroDetails;
  motivation?: string;
  /** Apparence du héros sans son espèce de rendu, dérivée ici de `speciesId` (`rigSpeciesId`). Absente = aucune. */
  apparence?: Omit<NonNullable<Combatant['appearance']>, 'species'>;
  id?: string;
}

let heroCounter = 0;

export function rollCharacteristics(sp: SpeciesData, rng: RNG): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const base = sp.baseChar[k] ?? 20;
    chars[k] = base + roll(2, 10, rng);
  }
  return chars;
}

/** Une Compétence d'espèce désignée sans spécialisation alors que son emplacement est un joker reçoit la
 *  1re spécialisation libre de cet emplacement, les `autres` retenues exclues (`libreDEspece`). */
function completerCompetenceDEspece(sp: SpeciesData, r: RefDesignee, autres: RefDesignee[]): RefDesignee {
  if (r.spec != null) return r;
  const slot = sp.skills.find((a): a is Extract<typeof a, { id: string }> => 'id' in a && a.id === r.id && a.choix != null);
  return slot ? designer('skill', slot, undefined, libreDEspece(sp, slot, autres)) : r;
}

export function createHero(opts: CreateHeroOptions): Combatant {
  const sp = findSpeciesById(opts.speciesId);
  if (!sp) throw new Error(`Espèce inconnue : ${opts.speciesId}`);
  const levels = levelsForCareer(opts.careerId);
  const level = levels.find((l) => l.level === 1) ?? firstLevel(opts.careerId);
  const specChoices = opts.specChoices ?? {};

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

  let chosenTalent = opts.careerTalent;
  if (!chosenTalent) {
    // Défaut : 1re entrée du Niveau dont le Maxi n'est pas atteint (les Maxi 1 déjà possédés
    // via l'espèce sont sautés — cas Nain Lire/Écrire + Agitateur).
    for (const ref of level?.talents ?? []) {
      if (!('id' in ref)) continue;
      const candidate = designer('talent', ref);
      if (!talentMaxReached(acquis, candidate.id, candidate.spec)) {
        chosenTalent = candidate;
        break;
      }
    }
  }
  if (chosenTalent) addTalentRef(chosenTalent);

  // Signe astral (ADE II 3) : effet appliqué AUX ATTRIBUTS DE DÉPART (±carac) + Talents octroyés,
  // AVANT heroSoFar (careerSkillAdditions voit un « Maître artisan » du signe) et avant les effets
  // d'acquisition des Talents.
  if (opts.starId) applyStarOps(opts.starId, chars, (ref, k) => addTalentRef(designer('talent', ref, specChoices[adresseDeCreation.signe(k)])));

  const talents: TalentInstance[] = acquis.talents ?? [];

  // 4b) Compétences de carrière : 40 Augmentations (`repartitionDeCarriere` par défaut), UNE part par
  // Compétence (LDB 05 l.535) ; un ajout de Talent est acquis sans Augmentation.
  const heroSoFar: Combatant = { characteristics: chars, talents } as Combatant;
  const skills: SkillInstance[] = [];
  const addSkill = ({ id, spec }: RefDesignee, adv: number) => {
    const existing = skills.find((s) => s.id === id && (s.spec ?? '') === (spec ?? ''));
    if (existing) existing.advances += adv; // même (id, spec) = même Compétence (LDB 09 l.42)
    else skills.push({ id, spec, characteristic: skillCharacteristicById(id), advances: adv });
  };
  const carriere = competencesDeCarriere(level, heroSoFar, specChoices);
  const allouees: { adresse: AdresseDeCreation; designee: RefDesignee }[] = [];
  const parDefaut = new Set<string>();
  const repartition = opts.skillAdvances ?? repartitionDeCarriere(carriere);
  for (const c of carriere) {
    const adv = c.ajout ? 0 : repartition[c.cle] ?? 0;
    const designee = c.designee ?? designer('skill', c.ref, undefined, (s) => c.libre(s) && !parDefaut.has(refKey(c.ref.id, s)));
    if (!c.designee) parDefaut.add(refKey(designee.id, designee.spec));
    addSkill(designee, adv);
    if (adv > 0) allouees.push({ adresse: c.adresse, designee });
  }

  // 4c) Compétences d'espèce (LDB 05 l.484) : 3 à +5, 3 à +3 ; cumul si même (id, spec) qu'une
  // Compétence de carrière, Compétence séparée sinon.
  const espece = opts.speciesSkillAdvances ?? speciesSkillDefaults(sp);
  const retenues = [...espece.plus5, ...espece.plus3];
  const tenues = new Set<string>();
  retenues.forEach((r, i) => {
    const designee = completerCompetenceDEspece(sp, r, retenues.filter((_, j) => j !== i));
    retenues[i] = designee;
    const cle = refKey(designee.id, designee.spec);
    if (tenues.has(cle)) throw new Error(`Compétence d'espèce « ${cle} » : déjà retenue par un autre emplacement de la liste de « ${sp.id} » (LDB 05 l.484).`);
    tenues.add(cle);
    addSkill(designee, i < espece.plus5.length ? 5 : 3);
  });

  // 5) Possessions : classe + carrière → inventaire à stats, armes/armures équipées. Les refs `{id}`
  //    (catalogue) deviennent des objets ; les refs `{text}` (« Arme (Base) », flavor) n'ont pas de
  //    stats → ignorées par buildInventory (un libellé non catalogué n'est pas trouvé). Les emplacements
  //    de dotation se résolvent par `opts.trappingChoices` AVANT `buildInventory`.
  const rawTrappings = resolveTrappingChoices(opts.careerId, 1, opts.trappingChoices ?? {});
  const items = buildInventory(rawTrappings);

  // Trait RACIAL de l'espèce (#572) — Ogre `{id:'ogre'}` (encombrance/consommation ×2, ADE2 « Ogres
  // et Mutations » l.708 « Un Lourd Fardeau ») : posé sur `Combatant.traits` (MÊME forme/lecture que
  // le spawn de créature bestiaire, #513).
  const speciesTraits: import('./statEntry').TraitList = sp.traits ?? [];

  // Taille (LDB 85 l.344-354) — portée par `TalentData.size` (#572) : `sizeFromTalents` sur les talents
  // résolus (espèce + carrière + signe astral) ci-dessus, sinon Moyenne.
  const size = sizeFromTalents(talents.map((tt) => tt.talentId), tailleDuTalent) ?? 'moyenne';

  // Destin / Résilience
  const fateBase = sp.fate;
  const split = opts.fateSplit ?? autoFateSplit(fateBase.extra);
  const fate = fateBase.fate + split.fate;
  const resilience = fateBase.resilience + split.resilience;

  heroCounter += 1;
  const hero: Combatant = {
    id: opts.id ?? `hero-${heroCounter}`,
    label: opts.label,
    kind: 'hero',
    species: opts.speciesId,
    career: opts.careerId,
    groups: groupsFor({ speciesId: sp.id, careerId: opts.careerId, traits: speciesTraits, talents }), // Groupes déclarés par l'espèce, la carrière/classe et le culte du Talent de Prière (LDB 21, P3)
    size,
    characteristics: chars,
    wounds: { current: 0, max: 0, base: 0 }, // posé après les effets de talents (Dur à cuire)
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: emptyArmour(),
    items,
    skills,
    talents,
    traits: speciesTraits.length ? speciesTraits : undefined, // Trait racial d'espèce (#572) — Ogre : encombrance/consommation ×2 + Taille
    movement: sp.movement,
    fate,
    fortune: fate,
    resilience,
    resolve: resilience,
    motivation: opts.motivation,
    details: opts.details,
    // Avancement : les 5 Augmentations gratuites de la création (LDB 05 l.459) sont comptées dans
    // charAdvances ; les PX bonus des choix aléatoires (LDB 04/05) restent à dépenser.
    xp: opts.xpBonus ?? 0,
    charAdvances,
    careerLevel: 1,
    ...(opts.apparence ? { appearance: { ...opts.apparence, species: rigSpeciesId(opts.speciesId) } } : {}),
  };

  // Effets d'acquisition des Talents (`appliquerAcquisitions`), puis attributs dérivés (Blessures + Dur
  // à cuire, Chance, Détermination).
  appliquerAcquisitions(hero);
  const wmax = heroMaxWounds(hero);
  hero.wounds = { current: wmax, max: wmax, base: wmax };
  hero.fortune = fortuneMax(hero);
  hero.resolve = resolveMax(hero);

  // Désignations des emplacements de carrière utilisés à la création (cf. careerSlots) :
  // compétences « (Au choix) » ayant reçu des augmentations + talent de carrière à choix.
  const sSlots = skillSlots(levels, 1);
  const tSlots = talentSlots(levels, 1);
  const slotsDuNiveau = sSlots.filter((s) => s.level === 1);
  for (const { adresse, designee } of allouees) {
    const i = (level?.skills ?? []).findIndex((_, j) => adresseDeCreation.carriereCompetence(j) === adresse);
    const slot = slotsDuNiveau[i];
    if (!slot?.needsChoice) continue;
    const designation = designateSlot(hero, opts.careerId, slot, designee.id, designee.spec, sSlots);
    if (!designation.ok) throw new Error(`Compétence de carrière « ${refKey(designee.id, designee.spec)} » : ${designation.reason} (LDB 05 l.535).`);
  }
  if (chosenTalent) {
    const { id: talentId, spec } = chosenTalent;
    const all = [...sSlots, ...tSlots];
    const designations = designationsFor(hero, opts.careerId);
    const statut = statutOuRefus(tSlots, designations, talentId, spec, all);
    const quoi = `Talent de carrière « ${refKey(talentId, spec)} »`;
    switch (statut) {
      case 'free': designateSlot(hero, opts.careerId, freeSlotFor(tSlots, designations, talentId, spec, all)!, talentId, spec, all); break;
      case 'explicit': case 'designated': break;
      case 'absent': throw new Error(`${quoi} : absent du Niveau 1 de « ${opts.careerId} » (LDB 05 l.535).`);
      case 'sansSpec': throw new Error(`${quoi} : l'emplacement « (Au choix) » du Niveau 1 de « ${opts.careerId} » exige une spécialisation (LDB 10 l.17).`);
      case 'nonCouvert': throw new Error(`${quoi} : aucun emplacement libre du Niveau 1 de « ${opts.careerId} » ne couvre cette spécialisation.`);
    }
  }

  // Sorts de Magie mineure (LDB 10 l.714), après les Bénédictions déjà octroyées par
  // `applyTalentAcquisition`.
  const quota = pettySpellQuotaFor(hero);
  if (quota && opts.pettySpells?.length) {
    const appris = opts.pettySpells.slice(0, quota).filter((id) => !(hero.spells ?? []).includes(id));
    hero.spells = [...(hero.spells ?? []), ...appris];
  }

  recomputeLoadout(hero); // dérive weapons/armure/encombrement ; auto-génère le loadout par défaut (Mêlée/Distance)
  return hero;
}

/** Répartition automatique des 5 Augmentations gratuites (2/2/1) sur les Caractéristiques de
 *  carrière — utilisée quand l'appelant (pré-tirés) ne fournit pas de répartition. */
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
