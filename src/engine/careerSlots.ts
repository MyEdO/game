/**
 * Emplacements de carrière & spécialisations.
 *
 *  - Disponibilité : Compétences LDB 07 l.76 ; Talents LDB 07 l.103.
 *  - Compétences groupées : LDB 09 l.34-44.
 *  - Talents, utilisation et Maxi : LDB 10 l.17-18 ; `grantsArcaneDomain` : LDB 46 l.177.
 *
 * Modèle maison des emplacements « (Au choix) » (LDB 07/09/10 — silence, valeur maison) :
 *  - un slot se « désigne » sur une spec concrète gratuitement (la désignation ne donne rien, elle
 *    déclare ce que le slot couvre, éventuellement un talent déjà possédé via l'espèce) ; acheter
 *    via un slot libre le désigne automatiquement ;
 *  - au sein d'une MÊME carrière, deux slots ne peuvent pas désigner le même libellé concret ;
 *  - les désignations sont PAR carrière (un changement de carrière rouvre tous les choix).
 * Cas réels en données : Érudit a « Savoir (Au choix) » aux 4 niveaux ; jokers RESTREINTS
 * « Corps à corps (Fléau ou À deux mains) » ; entrée talent « Guide fluvial ou Bonnes jambes ».
 *
 * `slotsOfLevel` construit ses `SlotOption[]` depuis l'`AdvancementRef` structuré (`slotOptionsFromRef`) ;
 * les désignations sont keyées par `refKey(id, spec)`, jamais par un libellé.
 */
import { Combatant, CharKey, CHAR_LABELS, type TalentInstance } from './types';
import { bonus } from './characteristics';
import { byId, specPoolOf, levelsForCareer, findTalentById, findDomainById, findSpeciesById, advancementLabel, refLabel, CareerLevelData, type AdvancementRef } from '../data';
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
  /** Clé stable de désignation : `${level}:${kind}:${index}:${résumé}`, le résumé fait des ids des
   *  options (`resumeDesOptions`). */
  key: string;
  level: number;
  kind: 'skill' | 'talent';
  /** Libellé brut de l'entrée de carrière. */
  entry: string;
  options: SlotOption[];
  /** Le slot exige une désignation (joker, joker restreint, ou « A ou B »). */
  needsChoice: boolean;
}

/**
 * Pool de spécialisations PROPOSÉES par une option joker — SOURCE UNIQUE : la liste restreinte
 * `specOptions` (« (A ou B) »), sinon `specPoolOf` de la def, résolue par `optionId` + `kind`. Valeurs
 * = ids de spec. `[]` si la def ne porte aucune spec ou n'est pas au catalogue.
 */
export function wildcardSpecs(o: Pick<SlotOption, 'optionId' | 'specOptions'>, kind: 'skill' | 'talent'): string[] {
  if (o.specOptions) return o.specOptions;
  const def = o.optionId == null ? undefined : defDeJoker(kind, o.optionId);
  return def ? specPoolOf(def) : [];
}

/** Def (Compétence/Talent) d'une option par son id STABLE. */
function defDeJoker(kind: 'skill' | 'talent', id: string) {
  return kind === 'skill' ? byId('skill', id) : findTalentById(id);
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

/** `AdvancementRef` STRUCTURÉ → `SlotOption[]` — lecture DIRECTE de la donnée (id→libellé via `refLabel`,
 *  jamais de re-parse de prose). `label` reste un LIBELLÉ d'affichage. */
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
    return { key: `${positionDeSlot(level.level, kind, i)}:${resumeDesOptions(options)}`, level: level.level, kind, entry, options, needsChoice };
  });
}

/** Position d'un emplacement dans les listes de carrière — le préfixe de sa clé. */
function positionDeSlot(level: number, kind: 'skill' | 'talent', i: number): string {
  return `${level}:${kind}:${i}`;
}

/** Résumé d'un emplacement en ids : `refKey` de chaque option, un joker marqué `*`. */
function resumeDesOptions(options: SlotOption[]): string {
  return options.map((o) => `${refKey(o.optionId ?? '', o.spec)}${o.wildcard ? '*' : ''}`).join('+');
}

/** Position (`niveau:type:index`) d'une clé d'emplacement, quel que soit son résumé. */
function positionDeCle(cle: string): string {
  return cle.split(':').slice(0, 3).join(':');
}

/**
 * Clés de `careerSlotChoices` au résumé en ids (`resumeDesOptions`) : chaque clé prend celle de
 * l'emplacement de la donnée du jour à la même position (`positionDeCle`). Idempotent ; une clé sans
 * emplacement à sa position est gardée telle quelle (`designationsFor` ne la lit pas). Aucun libellé lu.
 */
export function migrerClesDEmplacement(choix: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  return Object.fromEntries(Object.entries(choix).map(([career, stored]) => {
    const levels = levelsForCareer(career);
    const top = Math.max(0, ...levels.map((l) => l.level));
    const parPosition = new Map([...skillSlots(levels, top), ...talentSlotsUpTo(levels, top)].map((s) => [positionDeCle(s.key), s.key]));
    return [career, Object.fromEntries(Object.entries(stored).map(([cle, v]) => [parPosition.get(positionDeCle(cle)) ?? cle, v]))];
  }));
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

/** Références (`refKey`) tenues par des emplacements d'une carrière : désignations et entrées
 *  explicites ; un emplacement tiré sans `optionId` n'en tient aucune (LDB 05 l.535). */
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

/** Références tenues par les AUTRES emplacements du niveau de `slot` (`takenRefs`) : le pool libre
 *  d'un joker en est privé (LDB 05 l.535 ; LDB 08 l.140). */
export function prisParLesAutres(slot: CareerSlot, allSlots: CareerSlot[], designations: Record<string, string>): Set<string> {
  const autres = allSlots.filter((s) => s.level === slot.level && s.key !== slot.key);
  const cles = new Set(autres.map((s) => s.key));
  return takenRefs(autres, Object.fromEntries(Object.entries(designations).filter(([k]) => cles.has(k))));
}

export type InCareerStatus = 'explicit' | 'designated' | 'free' | null;

/**
 * Statut in-carrière d'un libellé concret vis-à-vis d'un ensemble de slots :
 *  - 'explicit'   : une entrée sans choix le couvre exactement ;
 *  - 'designated' : un slot à choix lui est désigné ;
 *  - 'free'       : un slot à choix NON désigné peut le couvrir (l'achat désignera) et le
 *                   libellé n'est pas déjà pris par un autre slot de son niveau (`prisParLesAutres`) ;
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
  return freeSlotFor(slots, designations, optionId, spec, allSlotsForUniqueness) ? 'free' : null;
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

/** Premier slot à choix non désigné pouvant couvrir (optionId, spec), qu'aucun autre slot de son
 *  niveau ne tient (`prisParLesAutres`) — pour l'auto-désignation. */
export function freeSlotFor(
  slots: CareerSlot[],
  designations: Record<string, string>,
  optionId: string,
  spec?: string,
  allSlots: CareerSlot[] = slots,
): CareerSlot | undefined {
  const key = refKey(optionId, spec);
  return slots.find((s) => s.needsChoice && !designations[s.key] && slotCovers(s, optionId, spec) && !prisParLesAutres(s, allSlots, designations).has(key));
}

/**
 * Désigne un slot sur une (id, spec) concrète (mute le héros). Gratuit — déclare seulement ce que
 * le slot couvre. Refuse : (id, spec) non couverte par le slot, ou déjà prise par un autre slot de
 * son niveau (`prisParLesAutres`). La désignation stockée est la clé OPAQUE
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
  if (prisParLesAutres(slot, allSlots, designations).has(key)) {
    return { ok: false, reason: t('slot.takenByOther') };
  }
  hero.careerSlotChoices = {
    ...(hero.careerSlotChoices ?? {}),
    [career]: { ...designations, [slot.key]: key },
  };
  return { ok: true };
}

/**
 * Maxi d'un Talent par son `id` STABLE (LDB 10 l.18) : 1, Bonus de Caractéristique (LDB 05 l.406)
 * ou illimité (absent). Lu sur l'entrée EFFECTIVE (`effectiveEntry`, `src/engine/variants.ts` ;
 * AA 13 l.54-59, l.70-74).
 */
export function talentMaxById(hero: Pick<Combatant, 'characteristics'>, talentId: string): number | null {
  const max = effectiveEntry(findTalentById(talentId))?.max;
  if (max == null) return null;
  if (typeof max === 'number') return max;
  return bonus(hero.characteristics[max.bonusOf]); // LDB 07 l.47 : `characteristics` porte les Augmentations (`buyCharAdvance`)
}

/** Affichage FR du Maxi d'un talent (Compendium), DÉRIVÉ de la donnée structurée, jamais stocké en chaîne. */
export function talentMaxLabel(max: number | { bonusOf: CharKey } | null): string {
  if (max == null) return t('slot.maxNone');
  return typeof max === 'number' ? String(max) : t('slot.maxBonusOf', { char: CHAR_LABELS[max.bonusOf] });
}

/** Acquisitions déjà faites du Talent, TOUTES utilisations confondues (LDB 10 l.17-18, l.548) — lues par
 *  le Maxi (LDB 10 l.18) et le coût (LDB 07 l.105, l.156). `spec` ne sert qu'à un Talent `grantsArcaneDomain` :
 *  chaque Domaine est un Talent (LDB 46 l.177), le nombre de Domaines relevant de `arcaneDomainGate`. */
export function talentAcquisitions(hero: Pick<PorteurDeTalents, 'talents'>, talentId: string, spec?: string): number {
  const parDomaine = findTalentById(talentId)?.grantsArcaneDomain === true;
  return (hero.talents ?? [])
    .filter((t) => t.talentId === talentId && (!parDomaine || (t.spec ?? '') === (spec ?? '')))
    .reduce((n, t) => n + t.times, 0);
}

/** Le héros a-t-il atteint le Maxi de ce Talent (`talentAcquisitions`). */
export function talentMaxReached(hero: PorteurDeTalents, talentId: string, spec?: string): boolean {
  const max = talentMaxById(hero, talentId);
  return max != null && talentAcquisitions(hero, talentId, spec) >= max;
}

/** Ce que l'acquisition d'un Talent lit et écrit sur son porteur. */
export type PorteurDeTalents = Pick<Combatant, 'characteristics'> & { talents?: TalentInstance[] };

/** L'instance `x` est-elle le Talent `ref` (id et spécialisation) ? */
export const estLInstanceDe = (ref: RefDesignee) => (x: TalentInstance): boolean => x.talentId === ref.id && (x.spec ?? '') === (ref.spec ?? '');

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
