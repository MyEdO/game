/**
 * Emplacements de carrière & spécialisations — RAW :
 *
 *  - Compétences groupées (LDB 09 l.33-43) : chaque Spécialisation est UNE Compétence distincte
 *    (l.42, ex. Sigrid). Quand l'entrée de carrière porte « (Au choix) », le joueur choisit la
 *    Spécialisation AU MOMENT où il alloue une Augmentation (l.38, ex. Théodora).
 *  - Talents (LDB 10 l.13-20) : la parenthèse est une « utilisation » distincte — Sens aiguisé
 *    (Vue) ≠ Sens aiguisé (Goût) ; le Maxi (1 ou « Bonus de X ») se compte par spécialisation.
 *  - Disponibilité (LDB 07) : Compétences cumulatives sur les niveaux ≤ courant (l.76),
 *    Talents du niveau courant uniquement (l.103).
 *
 * Modèle des emplacements « (Au choix) » : chaque entrée de liste d'un Niveau de Carrière est un
 * EMPLACEMENT (slot). Le livre fixe QUOI est disponible (Compétences/Talents ci-dessus) mais reste
 * muet sur COMMENT un slot à choix se résout en jeu — le modèle ci-dessous est maison (LDB 07/09/10
 * — silence, valeur maison) :
 *  - un slot se « désigne » sur une spec concrète gratuitement (la désignation ne donne rien, elle
 *    déclare ce que le slot couvre, éventuellement un talent déjà possédé via l'espèce) ; acheter
 *    via un slot libre le désigne automatiquement ;
 *  - au sein d'une MÊME carrière, deux slots ne peuvent pas désigner le même libellé concret ;
 *  - les désignations sont PAR carrière (un changement de carrière rouvre tous les choix).
 * Cas réels en données : Érudit a « Savoir (Au choix) » aux 4 niveaux ; jokers RESTREINTS
 * « Corps à corps (Fléau ou À deux mains) » ; entrée talent « Guide fluvial ou Bonnes jambes ».
 *
 * MOTEUR : `slotsOfLevel` construit ses `SlotOption[]` DIRECTEMENT depuis l'`AdvancementRef` structuré
 * (`slotOptionsFromRef`). `parseAdvancement`
 * (prose→ref) et `parseEntry`/`parseOption`/`splitTopLevelOu` restent les helpers d'AUTHORING/CRÉATION :
 * l'assistant de création (`draft`/`CharacterCreator`) travaille sur des LIBELLÉS concrets (clés de
 * `specChoices`), le Codex sur la prose — c'est leur modèle, pas un chemin de résolution de règle.
 */
import { Combatant, CharKey, CHAR_LABELS, type TalentInstance } from './types';
import { bonus } from './characteristics';
import { byId, specPoolOf, levelsForCareer, findTalentById, findDomainById, findSpeciesById, advancementLabel, refLabel, wildcardSpecIds, talentIdByLabel, CareerLevelData, type AdvancementRef } from '../data';
import { entreeOuverte, refusDeSpec, type RefDesignee } from '../data/schemas/grammaire/ref';
import { domainSpellsKnown } from './grimoire';
import { splitLabel } from './statEntry';
import { effectiveEntry } from './variants';
import { t } from '../i18n';

// `splitLabel` (split nom↔spécialisation) est la primitive UNIQUE de `statEntry` — ré-exportée ici
// pour ses nombreux importeurs historiques (advancement/talentEffects/draft…) : aucune copie locale.
export { splitLabel };

/** Une possibilité concrète ou ouverte couverte par un slot. */
export interface SlotOption {
  /** Nom de groupe (« Sens aiguisé ») ou libellé simple (« Baratiner »). */
  label: string;
  /** Id STABLE du talent/compétence sous-jacent : apparie les entités possédées par id+spec
   *  (langue-indépendant). Absent pour un slot de tirage aléatoire (« N Talent aléatoire »). */
  optionId?: string;
  /** Spécialisation explicite (« Vue ») — absente si non groupé ou joker. */
  spec?: string;
  /** Joker : toute spec du groupe est désignable (« Au choix »). */
  wildcard: boolean;
  /** Joker RESTREINT : specs autorisées (« Fléau ou À deux mains »). */
  specOptions?: string[];
}

export interface CareerSlot {
  /** Clé stable de désignation : `${level}:${kind}:${index}:${résumé}`. */
  key: string;
  level: number;
  kind: 'skill' | 'talent';
  /** Libellé brut de l'entrée de carrière. */
  entry: string;
  options: SlotOption[];
  /** Le slot exige une désignation (joker, joker restreint, ou « A ou B »). */
  needsChoice: boolean;
}

/** Marqueurs « au choix » des données (Au choix / un au choix / une au choix). */
const CHOICE_RE = /^(au choix|une? au choix)$/i;

/** Sépare « A ou B » à profondeur 0 (préserve « Savoir-vivre (Criminel ou Guilde) »). */
export function splitTopLevelOu(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const tokens = s.split(/(\s+ou\s+|\(|\))/);
  for (const tok of tokens) {
    if (tok === '(') depth++;
    if (tok === ')') depth--;
    if (depth === 0 && /^\s+ou\s+$/.test(tok)) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += tok;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Parse une possibilité « Nom », « Nom (Spec) », « Nom (Au choix) », « Nom (A ou B) ». */
export function parseOption(raw: string): SlotOption {
  const m = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return { label: raw.trim(), wildcard: false };
  const name = m[1].trim();
  const inner = m[2].trim();
  if (CHOICE_RE.test(inner)) return { label: name, wildcard: true };
  if (/\sou\s/i.test(inner)) {
    return { label: name, wildcard: true, specOptions: inner.split(/\s+ou\s+/i).map((x) => x.trim()) };
  }
  return { label: name, spec: inner, wildcard: false };
}

/** Parse une entrée de liste de carrière (gère le « A ou B » de premier niveau). */
export function parseEntry(raw: string): SlotOption[] {
  return splitTopLevelOu(raw).map(parseOption);
}

/**
 * Pool de spécialisations PROPOSÉES par une option joker — SOURCE UNIQUE : la liste restreinte
 * `specOptions` (« (A ou B) »), sinon `specPoolOf` de la def. La def se résout par `optionId` + `kind`
 * (avancement), sinon par libellé via `wildcardSpecIds` (créateur, #1923/#1924). Valeurs = ids de
 * spec. `[]` si la def ne porte aucune spec ou n'est pas au catalogue.
 */
export function wildcardSpecs(o: Pick<SlotOption, 'label' | 'specOptions'>): string[];
export function wildcardSpecs(o: SlotOption, kind: 'skill' | 'talent'): string[];
export function wildcardSpecs(o: Pick<SlotOption, 'label' | 'optionId' | 'specOptions'>, kind?: 'skill' | 'talent'): string[] {
  if (o.specOptions) return o.specOptions;
  if (o.optionId == null || kind == null) return wildcardSpecIds(o.label);
  const def = defDeJoker(kind, o.optionId);
  return def ? specPoolOf(def) : [];
}

/** Def (Compétence/Talent) d'une option par son id STABLE. */
function defDeJoker(kind: 'skill' | 'talent', id: string) {
  return kind === 'skill' ? byId('skill', id) : findTalentById(id);
}

/** Libellé concret d'un talent/compétence : « Nom » ou « Nom (Spec) ». AFFICHAGE seulement — ne
 *  JAMAIS l'utiliser comme identité/clé de désignation (cf. `refKey`). */
export function concreteLabel(name: string, spec?: string): string {
  return spec ? `${name} (${spec})` : name;
}

/**
 * Clé D'IDENTITÉ opaque (id + spec) — encodage interne des désignations (`careerSlotChoices`) et du
 * câblage UI (valeur d'un `<select>`/wiring d'un picker). JAMAIS affichée (cf. `refLabel`/`specLabel`
 * pour l'affichage) ; `id` ne contient jamais `|` → décodage sans ambiguïté par `parseRefKey`.
 * Remplace le libellé concret comme valeur stockée/comparée — fin du « label-comme-identité ».
 */
export function refKey(id: string, spec?: string): string {
  return spec ? `${id}|${spec}` : id;
}

/** Décode une clé produite par `refKey`. Ne JAMAIS l'utiliser sur un libellé d'affichage (cf. `splitLabel`). */
export function parseRefKey(key: string): { id: string; spec?: string } {
  const i = key.indexOf('|');
  return i < 0 ? { id: key } : { id: key.slice(0, i), spec: key.slice(i + 1) };
}

/** Le libellé est-il encore « au choix » (non résolu) ? */
export function isUnresolvedChoice(label: string): boolean {
  const { spec } = splitLabel(label);
  return spec != null && (CHOICE_RE.test(spec) || /\sou\s/i.test(spec));
}

/** Entrée d'avancement (chaîne d'authoring/test) → `AdvancementRef` (id = nom brut, résolu à l'affichage
 *  par `advancementLabel`). Le SCRIPT de migration résout en id réel ; ce parseur runtime garde le nom. */
export function parseAdvancement(entry: string): AdvancementRef {
  const RAND = /^(?:(\d+)\s+)?Talents?\s+al[ée]atoires?$/i;
  const opts = splitTopLevelOu(entry).map((o): AdvancementRef => {
    const m = o.match(RAND);
    if (m) return { random: parseInt(m[1] ?? '1', 10) };
    const so = parseOption(o);
    if (so.wildcard) return { id: so.label, choix: so.specOptions ?? true };
    return so.spec ? { id: so.label, spec: so.spec } : { id: so.label };
  });
  return opts.length > 1 ? { pick: 1, of: opts } : opts[0];
}

/** `AdvancementRef` STRUCTURÉ → `SlotOption[]` — lecture DIRECTE de la donnée (id→libellé via `refLabel`,
 *  jamais de re-parse de prose). `label` reste un LIBELLÉ (consommé par `findSkill`/`concreteLabel`).
 *  Remplace le round-trip `advancementLabel(ref) → parseEntry(prose)`. */
export function slotOptionsFromRef(category: string, a: AdvancementRef): SlotOption[] {
  if ('id' in a) {
    const label = refLabel(category, { id: a.id });
    if (a.choix == null) return [{ label, optionId: a.id, ...(a.spec ? { spec: a.spec } : {}), wildcard: false }];
    return [{ label, optionId: a.id, wildcard: true, ...(Array.isArray(a.choix) ? { specOptions: a.choix } : {}) }];
  }
  if ('pick' in a) return a.of.flatMap((x) => slotOptionsFromRef(category, x));
  return [{ label: advancementLabel(category, a), wildcard: false }]; // tirage aléatoire (« N Talent aléatoire »)
}

function slotsOfLevel(level: CareerLevelData, kind: 'skill' | 'talent'): CareerSlot[] {
  const refs = kind === 'skill' ? level.skills : level.talents;
  const cat = kind === 'skill' ? 'skills' : 'talents';
  return refs.map((ref, i) => {
    const options = slotOptionsFromRef(cat, ref); // DIRECT depuis la structure (zéro re-parse)
    const entry = advancementLabel(cat, ref); // libellé d'AFFICHAGE seulement (formateur)
    const needsChoice = options.length > 1 || options.some((o) => o.wildcard);
    const summary = options.map((o) => o.label).join('|');
    return { key: `${level.level}:${kind}:${i}:${summary}`, level: level.level, kind, entry, options, needsChoice };
  });
}

/** Slots de COMPÉTENCES disponibles au niveau `level` : cumul des niveaux ≤ courant (LDB 07 l.76). */
export function skillSlots(levels: CareerLevelData[], level: number): CareerSlot[] {
  return levels.filter((l) => l.level <= level).flatMap((l) => slotsOfLevel(l, 'skill'));
}

/** Slots de TALENTS achetables : niveau courant UNIQUEMENT (LDB 07 l.103). */
export function talentSlots(levels: CareerLevelData[], level: number): CareerSlot[] {
  const cur = levels.find((l) => l.level === level);
  return cur ? slotsOfLevel(cur, 'talent') : [];
}

/** TOUS les slots de talents des niveaux ≤ courant (pour l'unicité des désignations). */
export function talentSlotsUpTo(levels: CareerLevelData[], level: number): CareerSlot[] {
  return levels.filter((l) => l.level <= level).flatMap((l) => slotsOfLevel(l, 'talent'));
}

/** Caractéristiques de carrière disponibles : cumul des niveaux ≤ courant (LDB 07 l.43). */
export function availableChars(levels: CareerLevelData[], level: number): CharKey[] {
  return levels.filter((l) => l.level <= level).flatMap((l) => l.characteristics);
}

/** Une (id, spec) concrète est-elle couverte par CE slot (désignations ignorées) ? Compare par
 *  `optionId` STABLE — jamais par libellé (i18n-safe). Un joker exige une spec : Compétence `LDB 09 l.40`, Talent `LDB 10 l.17`.
 *  La spec d'un joker doit être ADMISE par l'entrée (`refusDeSpec`, le prédicat du schéma) et, pour un
 *  joker restreint ou une entrée FERMÉE (`entreeOuverte`), appartenir au pool du joker (`wildcardSpecs`). */
export function slotCovers(slot: CareerSlot, optionId: string, spec?: string): boolean {
  return slot.options.some((o) => {
    if (o.optionId !== optionId) return false;
    if (!o.wildcard) return (o.spec ?? '') === (spec ?? '');
    if (spec == null || refusDeSpec(slot.kind, optionId, spec) !== null) return false;
    return (!o.specOptions && entreeOuverte(slot.kind, optionId)) || wildcardSpecs(o, slot.kind).includes(spec);
  });
}

/** Désignations d'un héros pour une carrière : slotKey → clé d'identité `refKey(id, spec)`
 *  (OPAQUE — jamais un libellé concret ; l'affichage se fait via `refLabel`/`specLabel`). Une
 *  désignation persistée que son emplacement ne couvre pas (`slotCovers`) n'est pas lue : l'emplacement
 *  redevient à désigner. */
export function designationsFor(hero: Combatant, career: string): Record<string, string> {
  const stored = hero.careerSlotChoices?.[career] ?? {};
  const levels = levelsForCareer(career);
  const top = Math.max(0, ...levels.map((l) => l.level));
  const slots = new Map([...skillSlots(levels, top), ...talentSlotsUpTo(levels, top)].map((s) => [s.key, s]));
  return Object.fromEntries(Object.entries(stored).filter(([slotKey, key]) => {
    const slot = slots.get(slotKey);
    if (!slot) return true;
    const { id, spec } = parseRefKey(key);
    return slotCovers(slot, id, spec);
  }));
}

/**
 * Références (id+spec, encodées en `refKey`) déjà « prises » par les slots d'une carrière
 * (désignations + entrées explicites) — un nouveau slot ne peut pas reprendre l'une d'elles
 * (arbitrage : au niveau 2, un nouveau « Sens aiguisé (Au choix) » ne peut pas re-désigner la
 * spec du slot du niveau 1). Un slot explicite SANS `optionId` (tirage aléatoire, « N Talent
 * aléatoire ») n'a pas d'identité réelle → n'occupe rien (jamais repris de toute façon).
 */
export function takenRefs(slots: CareerSlot[], designations: Record<string, string>): Set<string> {
  const taken = new Set<string>(Object.values(designations));
  for (const s of slots) {
    if (!s.needsChoice) {
      const o = s.options[0];
      if (o.optionId) taken.add(refKey(o.optionId, o.spec));
    }
  }
  return taken;
}

export type InCareerStatus = 'explicit' | 'designated' | 'free' | null;

/**
 * Statut in-carrière d'un libellé concret vis-à-vis d'un ensemble de slots :
 *  - 'explicit'   : une entrée sans choix le couvre exactement ;
 *  - 'designated' : un slot à choix lui est désigné ;
 *  - 'free'       : un slot à choix NON désigné peut le couvrir (l'achat désignera) et le
 *                   libellé n'est pas déjà pris par un autre slot de la carrière ;
 *  - null         : hors carrière.
 */
export function inCareerStatus(
  slots: CareerSlot[],
  designations: Record<string, string>,
  optionId: string,
  spec?: string,
  allSlotsForUniqueness: CareerSlot[] = slots,
): InCareerStatus {
  const key = refKey(optionId, spec);
  for (const s of slots) {
    if (!s.needsChoice && slotCovers(s, optionId, spec)) return 'explicit';
  }
  for (const s of slots) {
    if (s.needsChoice && designations[s.key] === key) return 'designated';
  }
  const taken = takenRefs(allSlotsForUniqueness, designations);
  if (taken.has(key)) return null; // pris par un AUTRE slot (sinon retourné ci-dessus)
  for (const s of slots) {
    if (s.needsChoice && !designations[s.key] && slotCovers(s, optionId, spec)) return 'free';
  }
  return null;
}

/** Motif pour lequel (optionId, spec) n'entre dans aucun emplacement : `absent` (aucune option de
 *  cet id), `sansSpec` (seuls des jokers le portent, sans spécialisation), `nonCouvert` (sinon). */
export type RefusDEmplacement = 'absent' | 'sansSpec' | 'nonCouvert';

/** `inCareerStatus`, ou le motif de son `null` — une seule lecture pour qui construit (`createHero`)
 *  et qui valide avant de construire (créateur). */
export function statutOuRefus(
  slots: CareerSlot[],
  designations: Record<string, string>,
  optionId: string,
  spec?: string,
  allSlotsForUniqueness: CareerSlot[] = slots,
): Exclude<InCareerStatus, null> | RefusDEmplacement {
  const status = inCareerStatus(slots, designations, optionId, spec, allSlotsForUniqueness);
  if (status) return status;
  const options = slots.flatMap((s) => s.options).filter((o) => o.optionId === optionId);
  if (!options.length) return 'absent';
  if (spec == null && options.every((o) => o.wildcard)) return 'sansSpec';
  return 'nonCouvert';
}

/** Premier slot à choix non désigné pouvant couvrir (optionId, spec) — pour l'auto-désignation. */
export function freeSlotFor(
  slots: CareerSlot[],
  designations: Record<string, string>,
  optionId: string,
  spec?: string,
): CareerSlot | undefined {
  return slots.find((s) => s.needsChoice && !designations[s.key] && slotCovers(s, optionId, spec));
}

/**
 * Désigne un slot sur une (id, spec) concrète (mute le héros). Gratuit — déclare seulement ce que
 * le slot couvre. Refuse : (id, spec) non couverte par le slot, ou déjà prise par un autre slot de
 * la carrière (désignation OU entrée explicite). La désignation stockée est la clé OPAQUE
 * `refKey(optionId, spec)` — jamais un libellé concret (i18n-safe).
 */
export function designateSlot(
  hero: Combatant,
  career: string,
  slot: CareerSlot,
  optionId: string,
  spec: string | undefined,
  allSlots: CareerSlot[],
): { ok: boolean; reason?: string } {
  if (!slotCovers(slot, optionId, spec)) return { ok: false, reason: t('slot.notCovered') };
  const key = refKey(optionId, spec);
  const designations = designationsFor(hero, career);
  if (designations[slot.key] && designations[slot.key] !== key) {
    return { ok: false, reason: t('slot.alreadyDesignated') };
  }
  const others = { ...designations };
  delete others[slot.key];
  if (takenRefs(allSlots, others).has(key)) {
    return { ok: false, reason: t('slot.takenByOther') };
  }
  hero.careerSlotChoices = {
    ...(hero.careerSlotChoices ?? {}),
    [career]: { ...designations, [slot.key]: key },
  };
  return { ok: true };
}

/**
 * Maxi d'un Talent (LDB 10 « Schéma des Talents ») par son `id` STABLE : 1, « Bonus de X »
 * (recalculé sur les Caractéristiques courantes) ou illimité (« Aucun »/absent). Le Maxi se
 * compte PAR spécialisation (côté appelant : le libellé concret porte la spec). Le Maxi lu est celui
 * de l'entrée EFFECTIVE (`effectiveEntry`, `src/engine/variants.ts`) : une variante réglée qui
 * republie « Maxi » (AA 13 l.54-59, l.70-74) fait autorité sur la forme de base.
 */
export function talentMaxById(hero: Pick<Combatant, 'characteristics'>, talentId: string): number | null {
  const max = effectiveEntry(findTalentById(talentId))?.max;
  if (max == null) return null; // sans limite
  if (typeof max === 'number') return max;
  return bonus(hero.characteristics[max.bonusOf]); // Maxi = Bonus de carac (valeur de base du héros)
}

/** Affichage FR du Maxi d'un talent (Compendium), DÉRIVÉ de la donnée structurée, jamais stocké en chaîne. */
export function talentMaxLabel(max: number | { bonusOf: CharKey } | null): string {
  if (max == null) return t('slot.maxNone');
  return typeof max === 'number' ? String(max) : t('slot.maxBonusOf', { char: CHAR_LABELS[max.bonusOf] });
}

/** Maxi par LIBELLÉ — bord authoring/tests : résout l'id (nom seul) puis délègue. */
export function talentMax(hero: Combatant, label: string): number | null {
  const id = talentIdByLabel(splitLabel(label).name);
  return talentMaxById(hero, id);
}

/** Le héros a-t-il atteint le Maxi de ce Talent, par `(talentId, spec)` — identité STABLE, jamais
 *  un libellé re-parsé. */
export function talentMaxReached(hero: PorteurDeTalents, talentId: string, spec?: string): boolean {
  const max = talentMaxById(hero, talentId);
  if (max == null) return false;
  const times = (hero.talents ?? []).find(estLInstanceDe({ id: talentId, spec }))?.times ?? 0;
  return times >= max;
}

/** Ce que l'acquisition d'un Talent lit et écrit sur son porteur. */
export type PorteurDeTalents = Pick<Combatant, 'characteristics'> & { talents?: TalentInstance[] };

const estLInstanceDe = (ref: RefDesignee) => (x: TalentInstance): boolean => x.talentId === ref.id && (x.spec ?? '') === (ref.spec ?? '');

/**
 * ACQUISITION d'une instance de Talent — seule couture qui écrit `talents` : le Maxi borne (`LDB 10
 * l.18`, `talentMaxReached`), puis l'instance existante gagne un `times`, ou une instance neuve est
 * posée. Rend `false`, sans rien écrire, quand le Maxi est atteint.
 */
export function acquerirTalent(porteur: PorteurDeTalents, ref: RefDesignee): boolean {
  if (talentMaxReached(porteur, ref.id, ref.spec)) return false;
  const talents = porteur.talents ?? [];
  const meme = estLInstanceDe(ref);
  porteur.talents = talents.some(meme)
    ? talents.map((x) => (meme(x) ? { ...x, times: x.times + 1 } : x))
    : [...talents, { talentId: ref.id, ...(ref.spec ? { spec: ref.spec } : {}), times: 1 }];
  return true;
}

/** INVERSE d'`acquerirTalent` : l'instance perd un `times`, et disparaît au dernier. */
export function retirerTalent(porteur: PorteurDeTalents, ref: RefDesignee): void {
  const talents = porteur.talents ?? [];
  const meme = estLInstanceDe(ref);
  const instance = talents.find(meme);
  if (!instance) return;
  porteur.talents = instance.times > 1
    ? talents.map((x) => (meme(x) ? { ...x, times: x.times - 1 } : x))
    : talents.filter((x) => !meme(x));
}

/** `VDM 02 l.190-192` (texte identique `LDB 46 l.177`). Voir `arcaneDomainCap`/`arcaneDomainGate`. */
export interface ArcaneDomains { normal: string[]; dark: string[] }

/** Domaines déjà TENUS par le héros — spec de tout Talent dont l'entrée déclare `grantsArcaneDomain`
 *  —, séparés Domaine(s) sombre(s) (`DomainData.dark`) / non sombres. */
export function heldArcaneDomains(hero: Combatant): ArcaneDomains {
  const out: ArcaneDomains = { normal: [], dark: [] };
  for (const t of hero.talents) {
    // « Tenir un Domaine » se lit sur l'entrée du Talent, jamais sur son id. Champ DÉDIÉ (et non le
    // `specsSource` du pool) : `LDB 46 l.177` plafonne l'APPRENTISSAGE de Domaines par ce Talent — un
    // futur Talent qui NOMMERAIT un Domaine sans en octroyer la pratique ne doit pas peser au plafond.
    if (!findTalentById(t.talentId)?.grantsArcaneDomain || !t.spec) continue;
    (findDomainById(t.spec)?.dark ? out.dark : out.normal).push(t.spec);
  }
  return out;
}

/** Plafond de Domaines NON sombres — Bonus de la Caractéristique du lanceur (elfe) désignée par
 *  `SpeciesData.arcaneDomainsBonusOf`, 1 pour les autres espèces (`LDB 46 l.177`, repris `VDM 02 l.190`). */
export function arcaneDomainCap(hero: Combatant): number {
  const bonusOf = findSpeciesById(hero.species)?.arcaneDomainsBonusOf;
  return bonusOf ? Math.max(1, bonus(hero.characteristics[bonusOf])) : 1;
}

/** Achat d'un NOUVEAU Domaine (spec d'un Talent `grantsArcaneDomain`) : autorisé/refusé avec raison
 *  LISIBLE (`LDB 46 l.177`, repris `VDM 02 l.190-192`). `domainId` déjà possédé → toujours autorisé
 *  (relève de `talentMaxReached`, pas de ce gate). */
export function arcaneDomainGate(hero: Combatant, domainId: string): { ok: boolean; reason?: string } {
  const held = heldArcaneDomains(hero);
  if (held.normal.includes(domainId) || held.dark.includes(domainId)) return { ok: true };
  if (findDomainById(domainId)?.dark) {
    if (held.dark.length > 0) return { ok: false, reason: t('slot.darkOnlyOne') };
    if (held.normal.length === 0) return { ok: false, reason: t('slot.darkNeedsNormal') };
    return { ok: true };
  }
  const cap = arcaneDomainCap(hero);
  if (held.normal.length >= cap) return { ok: false, reason: t('slot.domainCap', { cap }) };
  if (held.normal.length > 0) {
    const prev = held.normal[held.normal.length - 1];
    const advances = hero.skills.find((s) => s.id === 'focalisation' && (s.spec ?? '') === prev)?.advances ?? 0;
    const known = domainSpellsKnown(hero, prev);
    if (advances < 20 || known < 8) {
      const prevLabel = findDomainById(prev)?.label ?? prev;
      return { ok: false, reason: t('slot.prevDomain', { domain: prevLabel, advances, known }) };
    }
  }
  return { ok: true };
}
