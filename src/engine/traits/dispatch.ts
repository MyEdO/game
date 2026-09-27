/**
 * Dispatcher PUR des Traits de créature (LDB 85) : normalise chaque chaîne de trait (« Démoniaque 8+ »,
 * « Toile 40 », « Immunité (Poison) ») en { clé canonique, Indice, argument }, puis expose des
 * helpers typés que spawn/combat/IA appellent au lieu de tester des chaînes en dur. Aucune mutation.
 * Même patron que `engine/qualities/dispatch.ts`.
 */
import type { CharKey, Combatant } from '../types';
import { TRAITS, TraitDef } from './registry';
import { parseStatEntry, isOptionalNote, type TraitInstance, type TraitList, type OptionalEntry } from '../statEntry';
import { traitIdByLabel, findTraitById, SPEC_SOURCES, type SpecsSource, type TraitCapabilities, type TraitData } from '../../data';
import { slugId } from '../../data/slug';
import type { PassiveMod } from '../ops';
import { t, type MsgKey } from '../../i18n';

/** Résolution UNIQUE libellé (casse ignorée) → `id` STABLE (slug), DÉRIVÉE de `traits.json` (la
 *  donnée, AUSSI source de `TRAITS`) — source unique de l'import label→id (statblocs / migration).
 *  Les attaques naturelles (Morsure, Cornes…) et marqueurs spéciaux (Venin, Maladie, Mort-vivant…)
 *  sont désormais des traits EN DONNÉE : plus aucune liste de libellés en dur à tenir alignée. */
/** COUTURE libellé→id (#602) : nom de trait SAISI (statbloc, migration) → `id` STABLE. Prend du
 *  TEXTE — le seul sens toléré par la doctrine ; aucun appelant ne l'alimente avec le `.label` d'une
 *  entité qu'il tient déjà (elle porte alors son `id`). Inconnu du registre → slug du texte. */
export function canonTraitId(text: string): string {
  return knownTraitId(text) ?? slugId(text);
}

/** Idem, mais `undefined` si le texte ne nomme AUCUN trait du registre (le repli par slug masquerait
 *  l'inconnu là où l'appelant doit le distinguer). */
export function knownTraitId(text: string): string | undefined {
  return traitIdByLabel(text);
}

/** Inverse : `id` → libellé FR canonique (affichage : inspecteur/Codex/éditeur). Même couverture —
 *  l'id d'un trait EST le slug de son libellé (`engine/traits/parity.test.ts`). */
export const traitLabelById = (id: string): string => findTraitById(id)?.label ?? id;

/** IMPORT (saisie éditeur / migration JSON) : chaîne de statbloc → trait STRUCTURÉ. La clé est
 *  canonicalisée sur le registre (« morsure » → « Morsure ») ; sinon le nom brut est conservé
 *  (« Arme », « À distance », « Griffes »). C'est le SEUL endroit qui parse — le runtime lit les champs. */
export function parseTraitInstance(raw: string): TraitInstance {
  const p = parseStatEntry(raw);
  const t: TraitInstance = { id: canonTraitId(p.name) };
  const value = p.bonus ?? p.indice;
  if (value != null) t.value = value;
  if (p.arg != null) t.arg = p.arg;
  if (p.count != null) t.count = p.count;
  if (p.range != null) t.range = p.range;
  return t;
}

/** Sentinelle « joker » d'un argument de trait (« au choix », « une au choix ») : reste verbatim
 *  (ni id ni libellé — l'auteur a laissé le choix ouvert, on n'a rien à résoudre). */
const ARG_WILDCARD = /^(un |une |deux )?au choix$/i;

/** Résout l'ARGUMENT `arg` d'une instance de trait en LIBELLÉ d'affichage via le catalogue partagé
 *  `SPEC_SOURCES` de sa def : « poison » → « Poison », « sigmar » → « Sigmar », « noble, homme-bete »
 *  → « Noble, Homme-bête ». Sans `specsSource` (trait indice-seul, arg descriptif libre) ou joker
 *  « au choix » → verbatim. `specsMulti` : liste d'ids jointe par virgules, chaque part résolue (une
 *  part joker reste verbatim). Un id INCONNU / texte libre (`specsOpen`) reste verbatim — `SPEC_SOURCES
 *  [source].label` le rend tel quel (repli `?? id`), la saveur libre est donc préservée sans cas spécial. */
function resolveTraitArg(def: TraitData | undefined, arg: string): string {
  const source = def?.specsSource;
  if (!source || ARG_WILDCARD.test(arg)) return arg;
  const one = (id: string) => (/au choix/i.test(id) ? id : SPEC_SOURCES[source].label(id));
  return def.specsMulti ? arg.split(',').map((p) => one(p.trim())).join(', ') : one(arg.trim());
}

/** Traits dont la valeur est un BONUS de Dégâts signé (« Morsure +9 », « À distance +8 ») — affichés
 *  « +N » et, pour les attaques typées, « Nom +N (Type) » (l'ordre du livre). Les autres traits à
 *  Indice gardent « Nom (Spec) N » (« Immunité (Poison) »), les sauvegardes « Nom N+ » (« Démoniaque 8+ »). */
/** Rendu lisible et FIDÈLE d'un trait structuré (inverse exact de `parseTraitInstance` pour l'affichage)
 *  — inspecteur / Codex / éditeur / libellé d'attaque. Restitue le signe « + » des Dégâts (attaques),
 *  le « + » de seuil des sauvegardes, sinon l'Indice nu. La NATURE est lue en DONNÉE (jamais une liste
 *  en dur) : une attaque = trait qui octroie des Manœuvres (`grantsManeuvers`, mêlée) OU est une arme
 *  naturelle (`capabilities.naturalWeapon`, dont le tir) → sa valeur s'affiche « +Dégâts ». */
export function formatTrait(t: TraitInstance): string {
  const td = findTraitById(t.id);
  const label = traitLabelById(t.id);
  const head = t.count != null ? `${t.count} ${label}` : label;
  const isAttack = !!td?.grantsManeuvers || !!td?.capabilities?.naturalWeapon;
  const ward = !isAttack && !!td?.capabilities?.wardSave;
  const val = t.value == null ? '' : isAttack ? ` +${t.value}` : ward ? ` ${t.value}+` : ` ${t.value}`;
  const arg = t.arg ? ` (${resolveTraitArg(td, t.arg)})` : '';
  const range = t.range != null ? ` (${t.range})` : '';
  // Attaques : « Nom +Dégâts (Type) [(portée)] » ; autres : « Nom (Spec) Indice ».
  return isAttack ? `${head}${val}${arg}${range}` : `${head}${arg}${val}${range}`;
}

/** `TraitList` → libellés affichables (UI/Codex/éditeur) : chaque `TraitInstance` formatée par
 *  `formatTrait` (inverse fidèle de `parseTraitInstance`). */
export const traitLabels = (traits: TraitList | undefined): string[] =>
  (traits ?? []).map(formatTrait);

/** Libellé d'un OPTIONNEL (LDB 76) : un `TraitInstance` ordinaire est formaté par `formatTrait` ; une
 *  NOTE composée (joker « Tous les traits », variante « swap ») affiche son `label` source VERBATIM.
 *  SOURCE UNIQUE d'affichage des `optionals` — jamais `formatTrait` sur une note (sinon libellé `undefined`). */
export const optionalLabel = (e: OptionalEntry): string =>
  isOptionalNote(e) ? e.label : formatTrait(e);

/** Liste d'optionnels → libellés affichables (Codex/picker), notes composées incluses. */
export const optionalLabels = (list: OptionalEntry[] | undefined): string[] =>
  (list ?? []).map(optionalLabel);

/** Nom du POOL d'une `specsSource` (le TYPE d'argument attendu, pas une valeur) — pour le squelette
 *  d'argument d'un trait (sous-titre du Codex). La carte porte des CLÉS de catalogue, résolues à
 *  l'APPEL (jamais gelées au chargement du module). Une source par ligne : ajouter une `SpecsSource` =
 *  l'ajouter ici, jamais un cas par-trait. */
const SPEC_SOURCE_KEY: Record<SpecsSource, MsgKey> = {
  weaponGroupsMelee: 'specSrc.weaponGroup',
  weaponGroupsRanged: 'specSrc.weaponGroup',
  winds: 'specSrc.wind',
  arcaneDomains: 'specSrc.domain',
  cultBlessings: 'specSrc.cult',
  cultMiracles: 'specSrc.cult',
  cultChaos: 'specSrc.cult',
  seaShanties: 'specSrc.shanty',
  groups: 'specSrc.target',
  diseases: 'specSrc.disease',
  sizes: 'specSrc.size',
  mutations: 'specSrc.mutation',
  breathTypes: 'specSrc.breathType',
  damageTypes: 'specSrc.damageType',
  weaponsMelee: 'specSrc.weapon',
  weaponsRanged: 'specSrc.weapon',
};

/** Squelette d'ARGUMENT d'un Trait DÉRIVÉ de son schéma (sous-titre du Codex, remplace le champ figé
 *  `prefix`) : `(Indice)` (libellé de `indice`), puis le nom du pool `specsSource` (« (Type de dégâts) »),
 *  puis `(Portée)` si `range`. Ex. `{indice:{label:'Indice'}, specsSource:'damageTypes', range:true}`
 *  → « (Indice) (Type de dégâts) (Portée) ». Trait sans argument → undefined (aucun sous-titre). */
export function traitArgSkeleton(def: Pick<TraitData, 'indice' | 'specsSource' | 'range'>): string | undefined {
  const parts: string[] = [];
  if (def.indice) parts.push(t('traitArg.paren', { what: def.indice.label }));
  if (def.specsSource) parts.push(t('traitArg.paren', { what: t(SPEC_SOURCE_KEY[def.specsSource]) }));
  if (def.range) parts.push(t('traitArg.paren', { what: t('traitArg.range') }));
  return parts.length ? parts.join(' ') : undefined;
}

export interface ResolvedTrait {
  /** `id` STABLE du trait (slug, identique à `TraitInstance.id`). */
  id: string;
  def: TraitDef;
  indice?: number;
  arg?: string;
}

/** Traits du registre présents sur la créature (`TraitInstance` structurés, zéro parsing). Traits hors
 *  registre (attaques naturelles, marqueurs) ignorés ici — ils ont leurs propres consommateurs. */
export function resolveTraits(traits: TraitList | undefined): ResolvedTrait[] {
  const out: ResolvedTrait[] = [];
  for (const t of traits ?? []) {
    const def = TRAITS()[t.id];
    if (def) out.push({ id: t.id, def, indice: t.value, arg: t.arg });
  }
  return out;
}

/** La créature possède-t-elle le trait d'`id` donné ? (registre `defs/` UNIQUEMENT). */
export function hasTrait(traits: TraitList | undefined, id: string): boolean {
  return (traits ?? []).some((t) => t.id === id && !!TRAITS()[id]);
}

/** Résout UN trait du registre par son `id` STABLE — source unique des lookups par-id (armure, taille…). */
export function findResolvedTrait(traits: TraitList | undefined, id: string): ResolvedTrait | undefined {
  return resolveTraits(traits).find((x) => x.id === id);
}

/** La créature porte-t-elle un trait/attaque d'`id` donné (registre OU hors registre : Venin, Lanceur
 *  de Sorts, Cornes, Tentacules…) ? Comparaison d'`id` STRICTE — les `TraitInstance` sont déjà structurés. */
export function hasTraitKey(traits: TraitList | undefined, id: string): boolean {
  return (traits ?? []).some((t) => t.id === id);
}

// ── Profil dérivé au spawn (statblocks d'éditeur — LDB 77 « ajoutez les Traits ») ─────────────────
/** PassiveMod[] de PROFIL des traits — la DONNÉE éditable `TraitData.passive` (vocab GameOp unifié, éditée
 *  par GameOpEditor comme un sort). SOURCE UNIQUE des modificateurs de profil de trait, lue DIRECT par le
 *  collecteur passif (liveTraits). Éditer/créer un trait à modificateur de profil = de la donnée. */
export function traitPassiveMods(traits: TraitList | undefined): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of traits ?? []) {
    const ops = findTraitById(t.id)?.passive; // lecture PAR ID stable (≠ jointure par libellé)
    // `src` = LE trait émetteur : c'est lui qui NOMME la composante d'un détail de jet (« +10 Dressé
    // pour divertir ») et ouvre sa fiche — jamais le repli de famille (`passivePartLine`).
    if (ops) for (const op of ops) out.push({ op, kind: 'intrinseque', src: { category: 'traits', id: t.id } }); // le collecteur affecte le kind (≠ donnée)
  }
  return out;
}

/** Somme des `charMod` du passif (Élite/Coriace/Brutal…) — pour la base de `effectiveChar` (`baseWithTraits`)
 *  et les Blessures (`withTraitChars`). Extrait du vocab d'ops unifié. */
export function traitCharMods(traits: TraitList | undefined): Partial<Record<CharKey, number>> {
  const out: Partial<Record<CharKey, number>> = {};
  for (const m of traitPassiveMods(traits)) if (m.op.op === 'charMod') out[m.op.char] = (out[m.op.char] ?? 0) + m.op.mod;
  return out;
}

/** Somme des `moveMod` du passif (Brutal −1, Rapide +1). */
export function traitMovementMod(traits: TraitList | undefined): number {
  return traitPassiveMods(traits).reduce((s, m) => s + (m.op.op === 'moveMod' ? m.op.mod : 0), 0);
}

/** La créature a-t-elle la CAPACITÉ booléenne `cap` (drapeau de `TraitData.capabilities`, lu PAR ID) ?
 *  SOURCE UNIQUE des helpers de capacité (bestial/stupide/rage/…). Le seuil/type éventuel (Démoniaque 8+,
 *  Immunité (Poison)) vient de l'INDICE/arg de l'INSTANCE, lu par les helpers dédiés (wardSaves, etc.). */
export function traitCapability(traits: TraitList | undefined, cap: keyof TraitCapabilities): boolean {
  const list = traits ?? [];
  // Suppression GÉNÉRIQUE (Dressé (Dompté) « ignore son Trait Bestial », LDB 85 l.85) : un trait porté
  // peut annuler la capacité d'un AUTRE trait du même porteur — aucun code par-nom de discipline.
  if (list.some((t) => findTraitById(t.id)?.suppressesCapabilities?.includes(cap))) return false;
  return list.some((t) => !!findTraitById(t.id)?.capabilities?.[cap]);
}

/** Endurant (LDB 85 l.130) : +Bonus d'Endurance Blessures. */
export function traitBonusWoundsBE(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'bonusWoundsBE');
}

/** Mutation / Corruption mentale (LDB 85) : mutations à appliquer au spawn. `mutationId` = mutation
 *  EXPLICITE figée (l'argument d'auteur « Mutation (Cornes asymétriques) » est résolu en id stable via
 *  `slugId` — runtime 100% id) ; absent = tirage sur le Tableau `kind`. */
export function mutationsAtSpawn(traits: TraitList | undefined): { kind: 'physique' | 'mentale'; mutationId?: string }[] {
  return (traits ?? [])
    .filter((t) => findTraitById(t.id)?.capabilities?.mutationAtSpawn)
    .map((t) => ({ kind: findTraitById(t.id)!.capabilities!.mutationAtSpawn!, mutationId: t.arg ? slugId(t.arg) : undefined }));
}

/** Marque du Chaos (Marque de Tzeentch, EDOC 13 l.522-524) : tirage PLURIEL et ALTERNÉ de Mutations au
 *  spawn — `capabilities.markMutations`, DISTINCT de `mutationsAtSpawn` (singulier, table générique).
 *  Un seul porteur attendu ; le premier trait qui porte la capacité fait foi. */
export function markMutationsAtSpawn(traits: TraitList | undefined): NonNullable<TraitCapabilities['markMutations']> | undefined {
  for (const t of traits ?? []) {
    const spec = findTraitById(t.id)?.capabilities?.markMutations;
    if (spec) return spec;
  }
  return undefined;
}

// ── Mathématique de combat ────────────────────────────────────────────────────────────────────────
/** NOTATION RAW d'une sauvegarde « 1d10 ≥ Indice » — `LDB 47 l.410` écrit « Protection (6+) ».
 *  GRAPHIE UNIQUE du seuil, partout où il s'affiche (journal de combat, Codex, atelier d'op) : le nom du
 *  Trait, son Indice, le « + ». L'Indice peut être une `Formula` déjà résumée (atelier). */
export function formatWardSave(traitId: string, indice: number | string): string {
  return `${traitLabelById(traitId)} (${indice}+)`;
}

/** Sauvegardes « 1d10 ≥ Indice → coup ignoré » (Démoniaque 8+, Protection N). Liste des seuils. */
export function wardSaves(traits: TraitList | undefined): number[] {
  return (traits ?? []).filter((t) => findTraitById(t.id)?.capabilities?.wardSave && t.value != null).map((t) => t.value!);
}

// Défense du champion (LDB 85) : capacité GÉNÉRIQUE `counterOnDefenseWin` (traits ET talents), lue par
// `canCounterOnDefenseWin` (combatFeatures/dispatch), jamais un prédicat par-nom `hasChampionDefense`.


/** AURAS de combat déclarées par les traits du porteur (Perturbant : −20 à BE m, LDB 85 l.262 ; toute
 *  future aura). GÉNÉRIQUE — lue par le hook `recompute-auras`, qui projette leurs `passive` sur les
 *  combattants à portée. Aucun trait nommé en dur. Le `traitId` ÉMETTEUR voyage avec l'aura : c'est
 *  lui qui nomme la pénalité chez la cible (chip « −20 Perturbant » et son renvoi Codex). */
export function traitAuras(traits: TraitList | undefined): { traitId: string; aura: NonNullable<TraitData['aura']> }[] {
  const out: { traitId: string; aura: NonNullable<TraitData['aura']> }[] = [];
  for (const t of traits ?? []) {
    const aura = findTraitById(t.id)?.aura;
    if (aura) out.push({ traitId: t.id, aura });
  }
  return out;
}

/** Immunité (Type) : types de Dégâts totalement ignorés (en minuscules). */
export function immunityTypes(traits: TraitList | undefined): string[] {
  return (traits ?? []).filter((t) => findTraitById(t.id)?.capabilities?.damageImmunity && t.arg).map((t) => t.arg!.toLowerCase());
}

/** Manifestation de Ghur (Middenheim) : id du Domaine de Sort dont les effets n'affectent PAS le porteur
 *  (immunité par lore — capability `spellDomainImmunity`, lue PAR ID). undefined si aucun trait porté ne
 *  confère cette immunité. SOURCE UNIQUE — consommée par le chemin d'incantation (`immuneToSpellDomain`). */
export function spellDomainImmunityOf(traits: TraitList | undefined): string | undefined {
  for (const t of traits ?? []) {
    const dom = findTraitById(t.id)?.capabilities?.spellDomainImmunity;
    if (dom) return dom;
  }
  return undefined;
}

/** Le porteur est-il immunisé aux effets d'un Sort du Domaine `spellDomainId` (Manifestation de Ghur) ?
 *  Comparaison d'id STRICTE — `null`/`undefined` (Sort sans Domaine) ne matche jamais. */
export function immuneToSpellDomain(traits: TraitList | undefined, spellDomainId: string | null | undefined): boolean {
  return spellDomainId != null && spellDomainImmunityOf(traits) === spellDomainId;
}

/** Instable (LDB 85 l.199). */
export function isUnstable(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'unstable');
}

/** Insensible à la douleur (LDB 85 l.195) : pénalités de Critiques (hors amputations) ignorées. */
export function isPainless(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'painless');
}


// ── Psychologie / IA ──────────────────────────────────────────────────────────────────────────────
/** Belliqueux (LDB 85 l.51) : immunité psy si plus d'Avantages que `foesMaxAdvantage`. */
export function bellicosePsychImmune(c: Pick<Combatant, 'traits' | 'advantage'>, foesMaxAdvantage: number): boolean {
  return traitCapability(c.traits, 'psychImmuneIfAhead') && (c.advantage ?? 0) > foesMaxAdvantage;
}

/** Fabriqué (LDB 85 l.142) : pas d'Int/FM/Soc → Tests psychologiques auto-réussis. */
export function isMindless(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'mindless');
}

/** Bestial (LDB 85 l.59). */
export function isBestial(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'bestial');
}

/** À sang-froid (LDB 85 l.13) : peut inverser ses Tests de FM échoués. */
export function isColdBlooded(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'coldBlooded');
}

/** Stupide (LDB 85 l.335). */
export function isStupid(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'stupid');
}

/** Rage (LDB 85 l.282). */
export function hasRage(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'rage');
}

/** Territorial (LDB 85 l.413) : annule la fuite de Bestial (combat jusqu'à la mort). */
export function isTerritorial(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'territorial');
}

/** Monture ombrageuse (Nerveux, LDB 14 l.182) : MONTÉE, ne prend pas sa propre Action d'attaque. */
export function isSkittishMount(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'skittishMount');
}

// ── Mouvement & vision ────────────────────────────────────────────────────────────────────────────
/** Vol (Indice) : distance de vol en MÈTRES, ou null. */
export function flyMeters(traits: TraitList | undefined): number | null {
  const t = (traits ?? []).find((t) => findTraitById(t.id)?.capabilities?.fly);
  return t ? t.value ?? 0 : null;
}

/** Bond (LDB 85 l.63) : Charge/Course ×2 (et ignore les obstacles traversés). */
export function hasLeap(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!findTraitById(t.id)?.capabilities?.leap);
}

/** Trait Nuée (LDB 85 l.251-253) : SOURCE UNIQUE de la détection d'amas — pilote le gabarit « swarm » et le
 *  build ×5 PB — lue par le rendu, la classification et le spawn. */
export function isSwarm(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'swarm');
}

/** Foulée (LDB 85 l.146) : Course ×1,5. */
export function hasStride(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!findTraitById(t.id)?.capabilities?.stride);
}

/** Grimpant (LDB 85 l.160-162) : réussite automatique de tout Test d'Escalade — aucun jet. */
export function hasAutoClimb(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'autoClimb');
}

/** Grimpant (LDB 85 l.160-162) : vitesse de Mouvement MAXIMALE (coût normal) sur les surfaces
 *  d'escalade, au lieu de la ½ vitesse du Talent Grimpeur (LDB 15 l.53, joueur). */
export function hasClimbFullSpeed(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'climbFullSpeed');
}

/** Rampant (MSRC 15 l.171) : « Elle ne peut pas réaliser d'Action de Course. » Capacité NON exprimable
 *  en GameOp → drapeau `capabilities.noRun`, interrogé par `runMultiplier`. */
export function hasNoRun(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!findTraitById(t.id)?.capabilities?.noRun);
}

/** Multiplicateur de Mouvement de COURSE/CHARGE dû aux traits : Rampant ×0 (aucune Course — le budget de
 *  Course tombe à 0, la Marche reste intacte), Bond ×2 (prioritaire), Foulée ×1,5. */
export function runMultiplier(traits: TraitList | undefined): number {
  if (hasNoRun(traits)) return 0;
  if (hasLeap(traits)) return 2;
  if (hasStride(traits)) return 1.5;
  return 1;
}

/** Vision nocturne / Infravision : voit dans l'obscurité (annule la pénalité d'obscurité). */
export function traitSeesInDark(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!findTraitById(t.id)?.capabilities?.seesInDark);
}
