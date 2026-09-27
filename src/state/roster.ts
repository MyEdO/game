import { Combatant, type TalentInstance } from '../engine/types';
import { Money } from '../engine/money';
import type { CreatorDraft } from '../ui/creator/draft';
import { migrateDoc, type MigrationMap, type RaisonDeRefus } from './migrateDoc';
import { remapCharKeysDeep } from './charKeyMigration';
import { remapNameToLabelDeep } from './instanceIdMigration';
import { remapSkillIdDeep } from './skillIdMigration';
import { remapSortsFusionnesDeep } from '../data/sortsFusionnes';
import { estOpDeTalentAncienne, graphieOpsDeTalentDeep } from '../data/graphieOpsDeTalent';
import { estLInstanceDe, migrerClesDEmplacement } from '../engine/careerSlots';
import type { Mutation } from '../engine/corruption';
import { FORMAT_DES_CHOIX } from '../engine/character';
import { adresseLue, type AdresseDeCreation } from '../engine/adresseDeCreation';
import { emplacementsDeDotation, sousEmplacement, type ChoixDeDotation, type EmplacementDeDotation } from '../engine/trappingChoices';
import { formatDice } from '../engine/dice';
import { findCreatureById, findQualityById, findTrappingById, findVehicleById, type QualityRef, type TrappingRef } from '../data';
import { t } from '../i18n';

/** Roster persistant (localStorage) des personnages créés via le créateur.
 *  Snapshot À LA CRÉATION : le héros tel que sorti de `buildHero`, plus sa
 *  Richesse initiale (créditée au groupe à la création, absente du Combatant —
 *  on la rejoue quand le personnage est repris dans un nouveau groupe).
 *  `draft` (optionnel) = le brouillon EXACT du créateur (tirages figés + choix
 *  étape par étape) : permet de RÉOUVRIR le personnage dans le créateur sans perte
 *  (un Combatant seul ne retient pas ces choix). Absent → édition reconstruite.
 *
 *  NON VERSIONNÉ (cf. `rosterLoad` ci-dessous : liste nue, sans `version`, là où une partie porte
 *  `SAVE_VERSION`) : le brouillon porte son propre format (`CreatorDraft.v`, `brouillonRelu`). */
export interface RosterEntry {
  hero: Combatant;
  wealth: Money;
  draft?: CreatorDraft;
}

const KEY = 'wfrp4.roster.v1';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

export function rosterLoad(): RosterEntry[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Le roster localStorage n'est PAS un doc versionné (liste nue, sans `version`) — le renommage
    // CharKey→slugs (#311), celui de `name`→`label` des porteurs de libellé (#604), celui de
    // `skillId`→`id` des `SkillInstance` (#1548 L2) et celui des ids de sort FUSIONNÉS (#1897,
    // `remapSortsFusionnesDeep`) s'appliquent donc en repli IDEMPOTENT à chaque
    // lecture (aucun ancien token restant après un 1er passage → no-op), plutôt que via `migrateDoc`
    // (réservé au format `EXPORT_VERSION`). Les clés de `careerSlotChoices` en ids (#1924) et la
    // graphie des ops de Talent (#1473) de même, héros par héros.
    return (remapSortsFusionnesDeep(remapSkillIdDeep(remapNameToLabelDeep(remapCharKeysDeep(arr)))) as unknown[])
      .filter((e): e is EntreeLue => !!e && typeof e === 'object' && typeof (e as EntreeLue).hero?.id === 'string')
      .map((e): RosterEntry => ({ ...e, hero: avecOpsDeTalentALaGraphie(avecClesDEmplacementEnIds(e.hero)), draft: brouillonRelu(e.draft) }));
  } catch {
    return [];
  }
}

/** Entrée telle que lue du stockage, avant `brouillonRelu`. */
type EntreeLue = Omit<RosterEntry, 'draft'> & { draft?: BrouillonPersiste };

/** Brouillon tel que lu du stockage : le format 2 rangeait `trappingChoices` par libellé d'emplacement. */
type BrouillonPersiste = Omit<CreatorDraft, 'v' | 'specChoices' | 'speciesTalentChoices' | 'trappingChoices'> & {
  v?: number;
  specChoices?: Record<string, string>;
  speciesTalentChoices?: Record<string, number>;
  trappingChoices?: Record<string, number | string>;
};

/** Le brouillon persisté au format des choix (`FORMAT_DES_CHOIX`), ses clés marquées à la lecture
 *  (`adresseLue`) ; un brouillon au format 2 y est migré (`choixDeDotationDuFormat2`). Un brouillon
 *  antérieur porte des libellés qu'aucune lecture ne résout : aucun, le créateur rouvre le héros par
 *  `draftFromHero`. Idempotent. */
function brouillonRelu(draft: BrouillonPersiste | undefined): CreatorDraft | undefined {
  if (!draft || (draft.v !== FORMAT_DES_CHOIX && draft.v !== 2)) return undefined;
  const { v, specChoices, speciesTalentChoices, trappingChoices, ...choix } = draft;
  return {
    ...choix,
    v: FORMAT_DES_CHOIX,
    specChoices: adressesLues(specChoices),
    speciesTalentChoices: adressesLues(speciesTalentChoices),
    ...(trappingChoices && { trappingChoices: v === 2 ? choixDeDotationDuFormat2(draft.careerId, trappingChoices) : adressesLues(trappingChoices) }),
  };
}

/** Les entrées de `choix` dont la clé est une adresse (`adresseLue`). */
function adressesLues<V>(choix: Record<string, V> = {}): Record<AdresseDeCreation, V> {
  const lues: Record<AdresseDeCreation, V> = {};
  for (const [cle, v] of Object.entries(choix)) {
    const adresse = adresseLue(cle);
    if (adresse) lues[adresse] = v;
  }
  return lues;
}

/** `trappingChoices` d'un brouillon au format 2 (clé = libellé de l'emplacement ; valeur = libellé de la
 *  branche d'un `{choice}`, id d'objet ou d'Atout sinon) rangés par adresse, la branche par son index.
 *  Une clé qui ne nomme aucun emplacement de la carrière, ou une branche qu'aucune ne nomme, n'était
 *  lue par aucun résolveur : elle ne se reporte pas. */
function choixDeDotationDuFormat2(careerId: string, anciens: Record<string, number | string>): ChoixDeDotation {
  const choix: ChoixDeDotation = {};
  for (const e of emplacementsDeDotation(careerId, 1)) {
    const v = anciens[cleDuFormat2(e.ref, e)];
    if (typeof v !== 'string') continue;
    if (e.sorte !== 'branches') choix[e.adresse] = v;
    else {
      const j = e.ref.choice.findIndex((b, k) => cleDuFormat2(b, sousEmplacement(e, k)) === v);
      if (j >= 0) choix[e.adresse] = j;
    }
  }
  return choix;
}

/** Le libellé d'une `TrappingRef` tel que le format 2 le composait (`trappingRefLabel` d'alors), FIGÉ :
 *  le `label` brut de la donnée et les liants du format 2, jamais le catalogue de messages — un
 *  brouillon 2 se relit quelle que soit la langue d'affichage. `e` : l'emplacement que porte `ref`. */
function cleDuFormat2(ref: TrappingRef, e: EmplacementDeDotation | undefined): string {
  if (e?.sorte === 'branches') return e.ref.choice.map((b, j) => cleDuFormat2(b, sousEmplacement(e, j))).join(' ou ');
  if (e?.sorte === 'joker') return e.ref.wildcard === 'arme' ? 'Arme (au choix)' : `${e.ref.wildcard} (au choix)`;
  const base = 'text' in ref
    ? ref.text
    : 'vehicleId' in ref
      ? (findVehicleById(ref.vehicleId)?.label ?? ref.vehicleId)
      : 'creatureId' in ref
        ? (findCreatureById(ref.creatureId)?.label ?? ref.creatureId)
        : 'id' in ref ? avecSpecDuFormat2(findTrappingById(ref.id)?.label ?? ref.id, ref.spec) : '';
  const count = 'count' in ref && ref.count ? ('fixed' in ref.count ? ` (${ref.count.fixed})` : ` (${formatDice(ref.count.roll)})`) : '';
  const qualite = e?.sorte === 'atout'
    ? ' (qualité au choix)'
    : 'id' in ref && ref.qualities?.length ? ` (${ref.qualities.map(qualiteDuFormat2).join(', ')})` : '';
  return base + count + qualite;
}

function avecSpecDuFormat2(base: string, spec: string | undefined): string {
  return spec ? `${base} (${spec})` : base;
}

function qualiteDuFormat2(q: QualityRef): string {
  const data = findQualityById(q.id);
  const base = avecSpecDuFormat2(data?.label ?? q.id, q.spec);
  if (q.value == null) return base;
  const unite = data?.indice?.unite;
  return unite ? `${base} (${q.value}${unite})` : `${base} ${q.value}`;
}

/** `careerSlotChoices` du héros aux clés en ids (#1924, `migrerClesDEmplacement`) — idempotent. */
function avecClesDEmplacementEnIds<T>(hero: T): T {
  const choix = (hero as { careerSlotChoices?: Combatant['careerSlotChoices'] } | null)?.careerSlotChoices;
  return choix ? { ...hero, careerSlotChoices: migrerClesDEmplacement(choix) } : hero;
}

/** Les ops de Talent du héros (armes, effets, mutations, traumatismes, consommables) à la graphie
 *  `talent: { id, spec? }` (#1473, train 2a, `graphieOpsDeTalentDeep`) — idempotent.
 *  Avant le lot, `attachMutation` posait une instance NEUVE du Talent octroyé, doublon compris, et le
 *  détachement retirait une instance par `grantTalent` de la mutation ; ces ops portent encore
 *  `talentId`, sans `talentsAcquis` (`engine/corruption.ts`). Le héros d'une telle mutation reçoit une
 *  instance par Talent (`instancesFusionnees`) et la mutation ses `talentsAcquis`, AVANT la graphie qui
 *  efface la marque de l'ancienne attache. */
function avecOpsDeTalentALaGraphie<T>(hero: T): T {
  const { mutations, talents } = (hero ?? {}) as { mutations?: unknown; talents?: unknown };
  if (!Array.isArray(mutations)) return graphieOpsDeTalentDeep(hero) as T;
  const instances = Array.isArray(talents) ? instancesFusionnees(talents as TalentInstance[]) : [];
  return graphieOpsDeTalentDeep({
    ...hero,
    ...(Array.isArray(talents) ? { talents: instances } : {}),
    mutations: mutations.map((m: unknown) => (m && typeof m === 'object' ? avecTalentsAcquisDAvantLeLot(m as Mutation, instances) : m)),
  }) as T;
}

/** `talentsAcquis` d'une mutation attachée avant le lot : ses `grantTalent` à l'ancienne graphie dont le
 *  héros porte le Talent. Une mutation qui a ses `talentsAcquis`, ou sans op ancienne, traverse. */
function avecTalentsAcquisDAvantLeLot(m: Mutation, talents: TalentInstance[]): Mutation {
  const acquis = (Array.isArray(m.passive) ? (m.passive as unknown[]) : [])
    .filter(estOpDeTalentAncienne)
    .filter((op) => op.op === 'grantTalent')
    .map((op) => ({ id: op.talentId, ...(op.spec ? { spec: op.spec } : {}) }))
    .filter((ref) => talents.some(estLInstanceDe(ref)));
  return acquis.length && !m.talentsAcquis ? { ...m, talentsAcquis: acquis } : m;
}

/** Une instance par Talent (id et spécialisation), les `times` des doublons additionnés. */
function instancesFusionnees(talents: TalentInstance[]): TalentInstance[] {
  return talents.reduce<TalentInstance[]>((acc, x) => {
    const meme = estLInstanceDe({ id: x.talentId, ...(x.spec ? { spec: x.spec } : {}) });
    return acc.some(meme) ? acc.map((y) => (meme(y) ? { ...y, times: y.times + x.times } : y)) : [...acc, x];
  }, []);
}

export function rosterAdd(entry: RosterEntry): void {
  save([...rosterLoad().filter((e) => e.hero.id !== entry.hero.id), entry]);
}

export function rosterRemove(heroId: string): void {
  save(rosterLoad().filter((e) => e.hero.id !== heroId));
}

/** Met à jour l'entrée roster d'un héros DÉJÀ présent (édition de bio en jeu) — n'AJOUTE pas un héros
 *  absent du roster (un prétiré édité ne s'y invite pas). Resynchronise aussi `draft` (motivation/ambitions)
 *  pour le round-trip créateur. */
export function rosterUpdate(hero: Combatant): void {
  const list = rosterLoad();
  const i = list.findIndex((e) => e.hero.id === hero.id);
  if (i < 0) return;
  const prev = list[i];
  const draft: CreatorDraft | undefined = prev.draft
    ? { ...prev.draft, motivation: hero.motivation ?? '', ambitionShort: hero.details?.ambitionShort ?? '', ambitionLong: hero.details?.ambitionLong ?? '' }
    : prev.draft;
  list[i] = { ...prev, hero, draft };
  save(list);
}

const EXPORT_KIND = 'wfrp4-hero';
export const EXPORT_VERSION = 7;

/** Migrations SÉQUENTIELLES de l'export roster. À CHAQUE bump d'`EXPORT_VERSION`, ajouter ici
 *  l'entrée `vN → vN+1` — sinon les exports antérieurs sont refusés (jamais acceptés en silence
 *  avec des champs manquants). Chaînée par `migrateDoc` (primitive générique, `migrateDoc.ts`). */
export const ROSTER_MIGRATIONS: MigrationMap = {
  // v1 → v2 : renommage CharKey → slugs pleins (#311) — primitive `charKeyMigration.ts`.
  1: (doc) => ({ ...doc, version: 2, hero: remapCharKeysDeep(doc.hero) }),
  // v2 → v3 (#604) : renommage `name` → `label` du héros exporté (nom du personnage, de ses objets et
  // de ses armes) — primitive `instanceIdMigration.ts`.
  2: (doc) => ({ ...doc, version: 3, hero: remapNameToLabelDeep(doc.hero) }),
  // v3 → v4 (#1548 L2) : renommage `skillId` → `id` des `SkillInstance` du héros exporté —
  // primitive `skillIdMigration.ts`. Sans elle, les avancements de Compétence sont perdus en silence.
  3: (doc) => ({ ...doc, version: 4, hero: remapSkillIdDeep(doc.hero) }),
  // v4 → v5 (#1897) : les ids de sort du livre fan FUSIONNÉS désignent l'entrée qui les absorbe —
  // primitive `remapSortsFusionnesDeep` (`src/data/sortsFusionnes.ts`). Sans elle, un sort appris est
  // perdu en silence (`findSpellById` ne le résout plus).
  4: (doc) => ({ ...doc, version: 5, hero: remapSortsFusionnesDeep(doc.hero) }),
  // v5 → v6 (#1924) : les clés de `careerSlotChoices` se résument en ids — `migrerClesDEmplacement`
  // (`engine/careerSlots.ts`). Sans elle, chaque joker de carrière désigné redevient à désigner.
  5: (doc) => ({ ...doc, version: 6, hero: avecClesDEmplacementEnIds(doc.hero) }),
  // v6 → v7 (#1473, train 2a) : les ops de Talent que le héros porte s'écrivent
  // `talent: { id, spec? }`, et une mutation attachée avant le lot reçoit ses `talentsAcquis` —
  // `avecOpsDeTalentALaGraphie`. Sans elle, l'op importée n'a pas de `talent` et son application
  // lève (`engine/ops.ts`, `grantTalent`).
  6: (doc) => ({ ...doc, version: 7, hero: avecOpsDeTalentALaGraphie(doc.hero) }),
};

/** Sérialise un héros (avec sa Richesse) en chaîne portable — sauvegarde, transfert d'appareil,
 *  ou partage pour rejoindre la coop d'un ami. Format taggé pour une réimportation robuste. */
export function rosterExport(entry: RosterEntry): string {
  return JSON.stringify({ kind: EXPORT_KIND, v: EXPORT_VERSION, hero: entry.hero, wealth: entry.wealth }, null, 2);
}

/** Résultat de `rosterImport` : soit l'entrée reconstruite, soit un message d'erreur EXPLICITE
 *  (jamais un `null` muet) — l'appelant UI l'affiche tel quel. */
export type RosterImportResult = { entry: RosterEntry; error?: undefined } | { entry?: undefined; error: string };

/** Message d'import par raison de refus de la migration : un export sans version (antérieur au tag
 *  `v`) ou d'une version que la chaîne ne sait pas monter se ré-exporte ; un fichier que la migration
 *  ne sait pas lire est invalide. */
const MESSAGE_DU_REFUS_DE_MIGRATION: Record<RaisonDeRefus, 'picker.import.error' | 'picker.import.error.version'> = {
  'non-objet': 'picker.import.error',
  'version-absente': 'picker.import.error.version',
  'version-future': 'picker.import.error.version',
  'migrateur-manquant': 'picker.import.error.version',
  'migrateur-immobile': 'picker.import.error.version',
  'migrateur-en-echec': 'picker.import.error',
};

/** Lit une chaîne `rosterExport` (ou un `RosterEntry` nu antérieur au tag `kind`/`v`) → `RosterEntry`,
 *  ou une erreur EXPLICITE si invalide. Passe par `migrateDoc` (chaîne `ROSTER_MIGRATIONS`) : un
 *  export `kind` différent, ou de version future/inconnue, est REFUSÉ avec un message dédié —
 *  jamais accepté en silence avec des champs manquants (le format `{ v }` du fil est normalisé en
 *  `version` pour la primitive générique). Richesse par défaut (0) si absente. */
export function rosterImport(str: string): RosterImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(str);
  } catch {
    return { error: t('picker.import.error') };
  }
  if (!parsed || typeof parsed !== 'object') return { error: t('picker.import.error') };
  const raw = parsed as { kind?: unknown; v?: unknown; version?: unknown };
  if (raw.kind !== undefined && raw.kind !== EXPORT_KIND) return { error: t('picker.import.error.version') };
  const normalized = { ...raw, version: typeof raw.v === 'number' ? raw.v : raw.version };
  const issue = migrateDoc(normalized, EXPORT_VERSION, ROSTER_MIGRATIONS);
  if (!issue.ok) return { error: t(MESSAGE_DU_REFUS_DE_MIGRATION[issue.raison]) };
  const doc = issue.doc;
  const hero = (doc as { hero?: { id?: unknown } }).hero;
  if (!hero || typeof hero !== 'object' || typeof hero.id !== 'string') return { error: t('picker.import.error') };
  const w = (doc as { wealth?: unknown }).wealth;
  const wealth: Money =
    w && typeof w === 'object' ? (w as Money) : { gold: 0, silver: 0, brass: 0 };
  return { entry: { hero: hero as unknown as Combatant, wealth } };
}

function save(list: RosterEntry[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}
