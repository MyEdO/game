/**
 * Création de personnage (héros) — Livre de base, chapitres 04/05 « Personnage ».
 *
 * Étapes implémentées :
 *  3) Attributs : Caractéristique = base d'espèce + 2d10 (ou saisie manuelle / répartition de
 *     100 Points — cf. engine/creation.ts) ; 5 Augmentations gratuites réparties sur les
 *     3 Caractéristiques de carrière (l.488) ; Destin/Résilience + points supplémentaires.
 *  4) Compétences/Talents : 3 Compétences d'espèce à +5 et 3 à +3 (l.510) ; Talents d'espèce
 *     (choix « A ou B », fixes, « N Talent aléatoire » sur la table d100) ; 8 Compétences de
 *     carrière, 40 augmentations (max 10), 1 Talent de carrière — qui peut être un talent
 *     d'espèce déjà possédé → times 2 (l.502), dans la limite du Maxi (LDB 10).
 *  5) Possessions : équipement de classe + de carrière (la Richesse initiale est créditée au
 *     groupe par l'appelant — cf. engine/creation.rollInitialWealth).
 *  6) Détails : âge/taille/yeux/cheveux/ambitions (cosmétique).
 *  Blessures (+ Dur à cuire), Mouvement (+ Véloce), Chance/Détermination (Chanceux/Obstiné) et
 *  « +5 Caractéristique de départ » appliqués via engine/talentEffects.
 *
 * Spécialisations : identité (name, spec) partout ; les libellés stockés sont CONCRETS (jamais
 * de « (Au choix) » résiduel) ; les emplacements de carrière utilisés sont DÉSIGNÉS dans
 * `careerSlotChoices` (cf. engine/careerSlots.ts).
 */
import { RNG, defaultRNG, roll } from './dice';
import { buildInventory, recomputeLoadout, emptyArmour } from './items';
import { groupsFor } from './groups';
import { CharKey, CHAR_KEYS, Characteristics, Combatant, SkillInstance, TalentInstance, HeroDetails } from './types';
import {
  SpeciesData,
  TrappingRef,
  findSpeciesById,
  findCareerById,
  findClassById,
  firstLevel,
  levelsForCareer,
  byId,
  findTalentById,
  skillIdByLabel,
  talentIdByLabel,
  talentConcrete,
  advancementLabel,
  specPoolOf,
  specCatalogOf,
  specResolves,
  specLabel,
  talents as talentTable,
} from '../data';
import { splitTopLevelOu, splitLabel, parseOption, concreteLabel, refKey, isUnresolvedChoice, skillSlots, talentSlots, designateSlot, freeSlotFor, statutOuRefus, designationsFor, talentMaxReached, wildcardSpecs, acquerirTalent, type PorteurDeTalents } from './careerSlots';
import { resolveTrappingChoices } from './trappingChoices';
import { applyTalentAcquisition, heroMaxWounds, fortuneMax, resolveMax, careerSkillAdditions } from './talentEffects';
import { applyStarOps } from './creation';
import { sizeFromTalents } from './size';

/** Caractéristique d'une Compétence (skills.json) par `id` STABLE — LDB 09 : valeur de Test =
 *  Caractéristique + avances. (≠ re-lookup par libellé — multilangue-safe.) */
export function skillCharacteristicById(id: string): CharKey {
  const data = byId('skill', id);
  return data?.characteristic ?? 'dexterite'; // CharKey stable portée par la donnée (repli prudent)
}

/** Ramène une valeur de spec issue d'un ROUND-TRIP par libellé d'affichage (`advancementLabel`/
 *  `refLabel` → texte → `splitLabel`) à son id STABLE (`SpecEntry` {id,label} OU `specsSource` —
 *  Groupe d'arme/Vent/Domaine/Culte/Chanson MIROIRÉS d'un registre partagé) — sans ça, la création
 *  de personnage stockerait le LABEL FR (« Base », « Magick ») au lieu de l'id (« base », « magick »)
 *  dès qu'une entrée de carrière/espèce FIXE (non « Au choix ») traverse ce round-trip. Compare via
 *  `specLabel` (résolveur UNIQUE, gère `specsSource` — `specEntryLabel` seul ne suffit PAS pour ces
 *  domaines : l'entrée `specs[]` y est un id nu, PAS le libellé d'affichage réel, cf. bug « Corps à
 *  corps (Base) » stocké « Base » au lieu de « base »). Une valeur DÉJÀ un id matche direct par la
 *  porte de VALIDITÉ (`specResolves` — y compris une entrée hors pool, `SpecEntry.pool: false`) ; une
 *  spec libre (domaine ouvert, hors catalogue) ne matche rien → renvoyée verbatim (inchangé). */
function resolveSpecId(category: 'skills' | 'talents', defId: string, raw: string): string {
  const def = category === 'skills' ? byId('skill', defId) : findTalentById(defId);
  if (!def) return raw;
  if (specResolves(def, raw)) return raw;
  for (const id of specCatalogOf(def)) {
    if (specLabel(category, defId, id) === raw) return id;
  }
  return raw;
}

/**
 * Identité STABLE d'un talent à spécialisation depuis un libellé CONCRET
 * (« Sens aiguisé (Vue) ») → `refKey(talentId, specId)`, via `talentRefOfLabel`
 * (mêmes résolveurs que `addTalent` : `findTalent` pour le nom, `resolveSpecId` pour la spec, qui
 * ramène un libellé de spec issu d'un round-trip à son id de `specs[]`/`specsSource`, et laisse
 * verbatim une spec libre — domaine `specsOpen`, où la valeur saisie EST l'identité persistée).
 * C'est cette clé qui identifie « Métier (Forgeron) » vs « Métier (Charpentier) » dans les
 * collections du moteur — plus jamais `concreteLabel` (affichage, multilangue).
 */
export function talentRefKeyOf(label: string): string {
  const { talentId, spec } = talentRefOfLabel(label);
  return refKey(talentId, spec);
}

/** Talent désigné par id (et id de spécialisation) — la forme que `createHero` reçoit pour le Talent
 *  de carrière. */
export type TalentChoisi = Pick<TalentInstance, 'talentId' | 'spec'>;

/** Libellé CONCRET (« Béni (Sigmar) ») → `{ talentId, spec }` en ids : `talentIdByLabel` pour le nom,
 *  `resolveSpecId` pour la spec. */
export function talentRefOfLabel(label: string): TalentChoisi {
  const { name, spec } = splitLabel(label);
  const talentId = talentIdByLabel(name);
  return { talentId, spec: spec != null ? resolveSpecId('talents', talentId, spec) : spec };
}

/**
 * Augmentations de Compétences d'espèce (Livre de base l.510) : 3 Compétences
 * reçoivent +5, 3 autres +3. Par défaut les 3 premières / 3 suivantes de la
 * liste d'espèce ; surchargeable.
 */
export function speciesSkillAdvanceMap(
  sp: SpeciesData,
  override?: { plus5: string[]; plus3: string[] },
): Record<string, number> {
  const plus5 = override?.plus5 ?? sp.skills.slice(0, 3).map((a) => advancementLabel('skills', a));
  const plus3 = override?.plus3 ?? sp.skills.slice(3, 6).map((a) => advancementLabel('skills', a));
  const map: Record<string, number> = {};
  for (const s of plus5) map[s] = (map[s] ?? 0) + 5;
  for (const s of plus3) map[s] = (map[s] ?? 0) + 3;
  return map;
}

/** Tableau des Talents aléatoires (Livre de base) : talents avec borne d100, triés. */
function randomTalentTable() {
  return talentTable.filter((t) => t.rand != null).sort((a, b) => (a.rand as number) - (b.rand as number));
}

/** Motif « N Talent(s) aléatoire(s) » / « Talent aléatoire » des listes d'espèce. */
/** Entrée « N Talent(s) aléatoire(s) » (LDB 05 l.510) — exportée pour la catégorisation UI des
 *  Talents d'espèce en TROIS lots (fixes / à choisir / tirés au d100, créateur étape 5c). */
export const RANDOM_ENTRY_RE = /^(?:(\d+)\s+)?Talents?\s+al[ée]atoires?$/i;

/**
 * Tire un Talent sur le Tableau des Talents aléatoires (1d100). Le tirage est FIGÉ : si le
 * talent tiré est groupé (« un au choix » — Sens aiguisé, Résistance, Maître artisan, Artiste),
 * on CHOISIT une Spécialisation non possédée (via `pickSpec`, défaut : la première libre) au
 * lieu de relancer ; on ne relance que si le talent est déjà possédé sur toutes ses specs
 * (Livre de base l.510 : « vous pouvez relancer »).
 */
export function rollRandomTalent(
  rng: RNG,
  /** Talents déjà possédés, keyés par IDENTITÉ STABLE `refKey(talentId, specId)` (cf.
   *  `talentRefKeyOf` pour la conversion depuis un libellé concret d'authoring). */
  owned: Set<string>,
  pickSpec?: (base: string, options: string[]) => string | null,
): string | null {
  const table = randomTalentTable();
  if (!table.length) return null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const r = roll(1, 100, rng);
    const entry = table.find((t) => r <= (t.rand as number));
    if (!entry) continue;
    const specs = specPoolOf(entry); // tirage JOUEUR : ce que le Talent PROPOSE
    if (specs.length) {
      const free = specs.filter((s) => !owned.has(refKey(entry.id, s)));
      if (!free.length) continue; // toutes les specs possédées → relance
      const spec = pickSpec?.(entry.label, free) ?? free[0];
      return concreteLabel(entry.label, spec);
    }
    if (!owned.has(refKey(entry.id))) return entry.label;
  }
  return null;
}

/**
 * Résout les Talents d'espèce : « A ou B » → choix (défaut : le 1er — découpe à profondeur 0,
 * pour préserver « Savoir-vivre (Criminel ou Guilde) ») ; Talents fixes tels quels ; « N Talent
 * aléatoire » → N tirages FIGÉS sur le Tableau des Talents aléatoires — y compris comme branche
 * d'un choix mixte (« Destinée ou Talent aléatoire »). Les options à spec ouverte (« Maître
 * artisan (Au choix) », « Savoir-vivre (Criminel ou Guilde) ») sont résolues via `choices`
 * (clé = entrée brute) ou par défaut la première spec proposée.
 */
export function resolveSpeciesTalents(
  sp: SpeciesData,
  opts: {
    rng?: RNG;
    choices?: Record<string, string>;
    /** Talents déjà possédés, en libellés CONCRETS d'authoring (convertis en identité stable au bord). */
    owned?: Iterable<string>;
    pickSpec?: (base: string, options: string[]) => string | null;
  } = {},
): string[] {
  const rng = opts.rng ?? defaultRNG;
  // `opts.owned` arrive en libellés CONCRETS (contrat d'authoring de l'assistant de création) ;
  // la collection, elle, est keyée par identité stable — conversion au bord (`talentRefKeyOf`).
  const owned = new Set<string>([...(opts.owned ?? [])].map(talentRefKeyOf));
  const result: string[] = [];
  const add = (name: string) => {
    result.push(name);
    owned.add(talentRefKeyOf(name));
  };
  const rollN = (n: number) => {
    for (let i = 0; i < n; i++) {
      const t = rollRandomTalent(rng, owned, opts.pickSpec);
      if (t) add(t);
    }
  };
  /** Résout une option en libellé concret (spec choisie si « au choix » / « A ou B »). */
  const resolveOption = (entryKey: string, opt: string): string => {
    if (!isUnresolvedChoice(opt)) return opt;
    const chosen = opts.choices?.[entryKey];
    if (chosen && !isUnresolvedChoice(chosen)) return chosen;
    const joker = parseOption(opt);
    const name = joker.label;
    const specOptions = wildcardSpecs(joker);
    // Les options d'un joker RESTREINT sont des libellés de spec d'authoring, celles d'un joker plein
    // des ids (`wildcardSpecs`) : `talentRefKeyOf` normalise les deux vers l'identité stable.
    const free = specOptions.find((s) => !owned.has(talentRefKeyOf(concreteLabel(name, s)))) ?? specOptions[0];
    return free ? concreteLabel(name, free) : name;
  };
  for (const ref of sp.talents) {
    const e = advancementLabel('talents', ref).trim(); // AdvancementRef → libellé (parsing inchangé)
    const mRand = e.match(RANDOM_ENTRY_RE);
    if (mRand) {
      rollN(parseInt(mRand[1] ?? '1', 10));
      continue;
    }
    const options = splitTopLevelOu(e);
    if (options.length > 1) {
      const choice = opts.choices?.[e] ?? options[0];
      const mChoiceRand = choice.match(RANDOM_ENTRY_RE);
      if (mChoiceRand) rollN(parseInt(mChoiceRand[1] ?? '1', 10));
      else add(resolveOption(e, choice));
      continue;
    }
    add(resolveOption(e, e));
  }
  return result;
}

export interface CreateHeroOptions {
  /** `id` STABLE de l'espèce (`SpeciesData.id`) — ≠ libellé. */
  speciesId: string;
  /** `id` STABLE de la carrière (`CareerData.id`) — ≠ libellé. */
  careerId: string;
  label: string;
  /** Caractéristiques saisies manuellement (sinon tirage base + 2d10). */
  manualChars?: Partial<Characteristics>;
  /** Talent de carrière choisi, en ids ; peut être un talent d'espèce déjà possédé (→ times 2,
   *  l.502). Défaut : 1re entrée du Niveau (résolue). */
  careerTalent?: TalentChoisi;
  /** Répartition des 40 augmentations, clé = entrée BRUTE de la liste de carrière ou ajoutée
   *  par un talent (sinon +5 sur les 8 entrées du Niveau). */
  skillAdvances?: Record<string, number>;
  /** Compétences d'espèce recevant +5/+3, entrées BRUTES (défaut : 3 premières / 3 suivantes). */
  speciesSkillAdvances?: { plus5: string[]; plus3: string[] };
  /** Pour les Talents d'espèce « A ou B » : le talent choisi (concret), par entrée brute. */
  speciesTalentChoices?: Record<string, string>;
  /** Talents d'espèce DÉJÀ résolus par l'assistant (tirages aléatoires figés inclus) — court-
   *  circuite resolveSpeciesTalents pour ne pas re-tirer. */
  speciesTalentsResolved?: string[];
  /** Résolution des entrées « (Au choix) » : entrée brute → libellé concret
   *  (ex. « Métier (Au choix) » → « Métier (Forgeron) »). */
  specChoices?: Record<string, string>;
  /** Signe astral choisi (ADE II) — `id` STABLE (≠ libellé) ; son `effect` (charMod / grantTalent) est
   *  appliqué aux attributs de départ via applyStarOps. Absent = pas de signe. */
  starId?: string;
  /** Les 5 Augmentations gratuites réparties sur les 3 Caractéristiques de carrière (LDB 05
   *  l.488). Défaut : 2/2/1 sur les 3 Caractéristiques du Niveau 1. */
  charAdvancesAlloc?: Partial<Record<CharKey, number>>;
  /** Répartition des points supplémentaires Destin/Résilience. */
  fateSplit?: { fate: number; resilience: number };
  /** PX bonus gagnés pendant la création (choix aléatoires acceptés, LDB 04/05). */
  xpBonus?: number;
  details?: HeroDetails;
  motivation?: string;
  rng?: RNG;
  id?: string;
  /** Résolution des emplacements `{choice}`/`{wildcard}` d'une `TrappingRef` (construct de choix
   *  d'équipement, Lot 1/3) : clé = `trappingRefLabel` de l'emplacement, valeur = libellé de la
   *  branche choisie (`choice`) ou id de trapping choisi (`wildcard`). Défaut (absent) : 1re
   *  branche pour `choice`, `wildcard` laissé non résolu. Voir `resolveTrappingChoices`. */
  trappingChoices?: Record<string, string>;
}

let heroCounter = 0;

export function rollCharacteristics(sp: SpeciesData, rng: RNG = defaultRNG): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const base = sp.baseChar[k] ?? 20;
    chars[k] = base + roll(2, 10, rng);
  }
  return chars;
}

/** Résout une entrée brute en libellé concret : `specChoices[raw]` porte la VALEUR DE SPEC seule
 *  (un id de Groupe d'arme ou un texte FR — jamais un libellé complet re-parsé), combinée au nom de
 *  base tiré de `raw` ; sinon 1re spec proposée par les données (skills.json / talents.json /
 *  liste restreinte « (A ou B) »). */
function resolveEntry(raw: string, specChoices?: Record<string, string>): string {
  if (!isUnresolvedChoice(raw)) return raw;
  const joker = parseOption(raw);
  const choice = specChoices?.[raw];
  if (choice) return concreteLabel(joker.label, choice);
  const options = wildcardSpecs(joker);
  const concrete = options.filter((o) => !/au choix/i.test(o));
  return concrete.length ? concreteLabel(joker.label, concrete[0]) : joker.label;
}

export function createHero(opts: CreateHeroOptions): Combatant {
  const rng = opts.rng ?? defaultRNG;
  const sp = findSpeciesById(opts.speciesId);
  if (!sp) throw new Error(`Espèce inconnue : ${opts.speciesId}`);
  const levels = levelsForCareer(opts.careerId);
  const level = levels.find((l) => l.level === 1) ?? firstLevel(opts.careerId);

  // 3) Attributs : base d'espèce + 2d10, ou saisie manuelle (réassignation / 100 Points).
  const chars = rollCharacteristics(sp, rng);
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

  // 4a) Talents : 1 Talent de carrière (`TalentChoisi`, ids) + Talents d'espèce. Le talent de
  // carrière peut être un talent d'espèce → times 2 (l.502), Maxi respecté.
  const speciesTalents = opts.speciesTalentsResolved
    ?? resolveSpeciesTalents(sp, { rng, choices: opts.speciesTalentChoices });
  const acquis: PorteurDeTalents = { characteristics: chars, talents: [] };
  const addTalentRef = ({ talentId, spec }: TalentChoisi) => {
    acquerirTalent(acquis, { id: talentId, spec });
  };
  const addTalent = (label: string) => addTalentRef(talentRefOfLabel(label));
  for (const t of speciesTalents) addTalent(t);

  const talentEntries = level?.talents ?? [];
  let chosenTalent = opts.careerTalent;
  if (!chosenTalent) {
    // Défaut : 1re entrée du Niveau dont le Maxi n'est pas atteint (les Maxi 1 déjà possédés
    // via l'espèce sont sautés — cas Nain Lire/Écrire + Agitateur).
    for (const ref of talentEntries) {
      const candidate = talentRefOfLabel(resolveEntry(advancementLabel('talents', ref), opts.specChoices));
      if (!talentMaxReached(acquis, candidate.talentId, candidate.spec)) {
        chosenTalent = candidate;
        break;
      }
    }
  }
  if (chosenTalent) addTalentRef(chosenTalent);

  // Signe astral (ADE II 3) : effet appliqué AUX ATTRIBUTS DE DÉPART (±carac) + Talents octroyés.
  // AVANT heroSoFar (careerSkillAdditions voit un « Maître artisan » du signe) et avant les effets
  // d'acquisition des Talents (l. ~377). Talent « (Au choix) » résolu via specChoices (resolveEntry).
  if (opts.starId) applyStarOps(opts.starId, chars, (label) => addTalent(resolveEntry(label, opts.specChoices)));

  const talents: TalentInstance[] = acquis.talents ?? [];
  for (const t of talents) {
    if (isUnresolvedChoice(talentConcrete(t))) throw new Error(`Talent non résolu : ${talentConcrete(t)}`);
  }

  // 4b) Compétences de carrière : 40 augmentations (+5 par défaut sur les 8 entrées du Niveau),
  // + entrées ajoutées par les talents (« Ajoutez X à n'importe quelle Carrière », LDB 10).
  const heroSoFar: Combatant = { characteristics: chars, talents } as Combatant;
  const skills: SkillInstance[] = [];
  const addSkill = (label: string, adv: number) => {
    const { name, spec: rawSpec } = splitLabel(label);
    if (isUnresolvedChoice(label)) throw new Error(`Compétence non résolue : ${label}`);
    const id = skillIdByLabel(name);
    const spec = rawSpec != null ? resolveSpecId('skills', id, rawSpec) : rawSpec;
    const existing = skills.find((s) => s.id === id && (s.spec ?? '') === (spec ?? ''));
    if (existing) existing.advances += adv; // même (id, spec) = même Compétence (LDB 09 l.42)
    else skills.push({ id: id, spec, characteristic: skillCharacteristicById(id), advances: adv });
  };
  const advancedEntries: { raw: string; label: string }[] = [];
  for (const ref of level?.skills ?? []) {
    const raw = advancementLabel('skills', ref);
    const adv = opts.skillAdvances?.[raw] ?? 5;
    const label = resolveEntry(raw, opts.specChoices);
    addSkill(label, adv);
    if (adv > 0) advancedEntries.push({ raw, label });
  }
  for (const add of careerSkillAdditions(heroSoFar)) {
    const raw = advancementLabel('skills', add); // ref structurée (spec OU choix) → CLÉ d'authoring (index de opts.skillAdvances)
    const adv = opts.skillAdvances?.[raw] ?? 0; // les compétences ajoutées ne reçoivent rien par défaut
    addSkill(resolveEntry(raw, opts.specChoices), adv);
  }

  // 4c) Compétences d'espèce (l.510) : 3 à +5, 3 à +3 ; cumul si même (name, spec) qu'une
  // Compétence de carrière, Compétence séparée sinon.
  for (const [raw, adv] of Object.entries(speciesSkillAdvanceMap(sp, opts.speciesSkillAdvances))) {
    addSkill(resolveEntry(raw, opts.specChoices), adv);
  }

  // 5) Possessions : classe + carrière → inventaire à stats, armes/armures équipées. Les refs `{id}`
  //    (catalogue) deviennent des objets ; les refs `{text}` (« Arme (Base) », flavor) n'ont pas de
  //    stats → ignorées par buildInventory (un libellé non catalogué n'est pas trouvé). Résolution des
  //    emplacements `{choice}`/`{wildcard}` (construct de choix d'équipement, Lot 1/2/3) via
  //    `opts.trappingChoices` AVANT `buildInventory`.
  const rawTrappings = resolveTrappingChoices(dotationRefsForHero(opts.careerId, 1), opts.trappingChoices ?? {});
  const items = buildInventory(rawTrappings);

  // Trait RACIAL de l'espèce (#572) — Ogre `{id:'ogre'}` (encombrance/consommation ×2, ADE2 « Ogres
  // et Mutations » l.708 « Un Lourd Fardeau ») : posé sur `Combatant.traits` (MÊME forme/lecture que
  // le spawn de créature bestiaire, #513).
  const speciesTraits: import('./statEntry').TraitList = sp.traits ?? [];

  // Taille (LDB 85 l.344-354) — portée par `TalentData.size` (DATA-DRIVEN, jamais un id de talent
  // nommé dans le moteur, #572) : la plus grande catégorie parmi les talents résolus (espèce +
  // carrière + signe astral) ci-dessus, sinon Moyenne.
  const size = sizeFromTalents(talents.map((tt) => tt.talentId), (id) => findTalentById(id)?.size);

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
    // Avancement : les 5 Augmentations gratuites de la création (l.488) sont comptées dans
    // charAdvances ; les PX bonus des choix aléatoires (LDB 04/05) restent à dépenser.
    xp: opts.xpBonus ?? 0,
    charAdvances,
    careerLevel: 1,
  };

  // Effets d'acquisition des Talents (+5 Caractéristique de départ, Véloce) — une fois par
  // acquisition —, puis attributs dérivés (Blessures + Dur à cuire, Chance, Détermination).
  for (const t of hero.talents) for (let i = 0; i < t.times; i++) applyTalentAcquisition(hero, t.talentId, t.spec);
  const wmax = heroMaxWounds(hero);
  hero.wounds = { current: wmax, max: wmax, base: wmax };
  hero.fortune = fortuneMax(hero);
  hero.resolve = resolveMax(hero);

  // Désignations des emplacements de carrière utilisés à la création (cf. careerSlots) :
  // compétences « (Au choix) » ayant reçu des augmentations + talent de carrière à choix.
  // Les compétences arrivent en libellés concrets, résolus en (id, spec) par `skillIdByLabel` avant
  // `designateSlot`, qui ne reçoit que des ids.
  const sSlots = skillSlots(levels, 1);
  const tSlots = talentSlots(levels, 1);
  for (const { raw, label } of advancedEntries) {
    const slot = sSlots.find((s) => s.needsChoice && s.entry === raw);
    if (slot) {
      const { name, spec } = splitLabel(label);
      const optionId = skillIdByLabel(name);
      designateSlot(hero, opts.careerId, slot, optionId, spec, sSlots);
    }
  }
  if (chosenTalent) {
    const { talentId, spec } = chosenTalent;
    const all = [...sSlots, ...tSlots];
    const designations = designationsFor(hero, opts.careerId);
    const statut = statutOuRefus(tSlots, designations, talentId, spec, all);
    const quoi = `Talent de carrière « ${refKey(talentId, spec)} »`;
    switch (statut) {
      case 'free': designateSlot(hero, opts.careerId, freeSlotFor(tSlots, designations, talentId, spec)!, talentId, spec, all); break;
      case 'explicit': case 'designated': break;
      case 'absent': throw new Error(`${quoi} : absent du Niveau 1 de « ${opts.careerId} » (LDB 05 l.535).`);
      case 'sansSpec': throw new Error(`${quoi} : l'emplacement « (Au choix) » du Niveau 1 de « ${opts.careerId} » exige une spécialisation (LDB 10 l.17).`);
      case 'nonCouvert': throw new Error(`${quoi} : aucun emplacement libre du Niveau 1 de « ${opts.careerId} » ne couvre cette spécialisation.`);
    }
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

function classForCareer(careerId: string) {
  // careerLevels n'a pas la classe ; on la retrouve via la carrière (par id stable).
  return findClassById(findCareerById(careerId)?.class);
}

/** Dotations de Classe + Niveau de carrière (`TrappingRef[]`) — PUR, réutilisé par `createHero`
 *  (5, sac de départ) ET par le seam de semis de Possessions au démarrage d'une partie neuve
 *  (#617/#618 Lot 1, `state/possessionsFlow.ts`). `careerLevel` défaut 1 (création). */
export function dotationRefsForHero(careerId: string, careerLevel: number = 1): TrappingRef[] {
  const levels = levelsForCareer(careerId);
  const level = levels.find((l) => l.level === careerLevel) ?? firstLevel(careerId);
  return [...(classForCareer(careerId)?.trappings ?? []), ...(level?.trappings ?? [])];
}

