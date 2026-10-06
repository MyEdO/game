import { Combatant, type TalentInstance } from '../engine/types';
import { Money } from '../engine/money';
import type { CreatorDraft } from '../ui/creator/draft';
import { migrateDoc, type MigrationMap, type RaisonDeRefus } from './migrateDoc';
import { versionCourante } from '../lib/versionCourante';
import { remapCharKeysDeep } from './charKeyMigration';
import { remapNameToLabelDeep } from './instanceIdMigration';
import { remapSkillIdDeep } from './skillIdMigration';
import { remapSortsFusionnesDeep } from '../data/sortsFusionnes';
import { objetsEnFKDeep } from '../data/donsDObjet';
import { itemInstanceSchema } from '../data/schemas/grammaire/instanceDObjet';
import { estOpDeTalentAncienne, graphieOpsDeTalentDeep } from '../data/graphieOpsDeTalent';
import { estLInstanceDe, migrerClesDEmplacement } from '../engine/careerSlots';
import type { Mutation } from '../engine/corruption';
import { FORMAT_DES_CHOIX } from '../engine/character';
import { adresseLue, type AdresseDeCreation } from '../engine/adresseDeCreation';
import { resolveursDeDon, type AdvancementRef } from '../data';
import { t } from '../i18n';
import { stockageWeb } from '../lib/stockageWeb';
import { itemLabel } from '../engine/items';

/** Roster persistant (localStorage) des personnages créés via le créateur.
 *  Snapshot À LA CRÉATION : le héros tel que sorti de `buildHero`, plus sa
 *  Richesse initiale (créditée au groupe à la création, absente du Combatant —
 *  on la rejoue quand le personnage est repris dans un nouveau groupe).
 *  `draft` (optionnel) = le brouillon EXACT du créateur (tirages figés + choix
 *  étape par étape) : permet de RÉOUVRIR le personnage dans le créateur sans perte
 *  (un Combatant seul ne retient pas ces choix). Absent → édition reconstruite.
 *
 *  NON VERSIONNÉ (cf. `rosterLoad` ci-dessous : liste nue, sans `version`, là où une partie porte
 *  `SAVE_VERSION`) : le brouillon porte son propre format (`CreatorDraft.v`), `brouillonRelu` écarte tout
 *  format autre que `FORMAT_DES_CHOIX`. */
export interface RosterEntry {
  hero: Combatant;
  wealth: Money;
  draft?: CreatorDraft;
}

const KEY = 'wfrp4.roster.v1';

export function rosterLoad(): RosterEntry[] {
  const s = stockageWeb('localStorage');
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
    // graphie des ops de Talent (#1473) de même, héros par héros. Les objets désignés par id (#1988,
    // `heroAuxObjetsDesignes`) aussi : un héros dont la fiche ne se monte pas est écarté, et le joueur
    // l'apprend par le témoin `takeRosterNotice`.
    return (remapSortsFusionnesDeep(remapSkillIdDeep(remapNameToLabelDeep(remapCharKeysDeep(arr)))) as unknown[])
      .filter((e): e is EntreeLue => !!e && typeof e === 'object' && typeof (e as EntreeLue).hero?.id === 'string')
      .flatMap((e): RosterEntry[] => {
        try {
          return [{ ...e, hero: heroAuxObjetsDesignes(avecOpsDeTalentALaGraphie(avecClesDEmplacementEnIds(e.hero))), draft: brouillonRelu(e.draft) }];
        } catch (err) {
          console.warn(`roster : « ${e.hero.label ?? e.hero.id} » écarté`, err);
          herosEcartes.add(t('picker.roster.ecarte', { heros: e.hero.label ?? e.hero.id, motif: motifJoueur(err) }).trim());
          return [];
        }
      });
  } catch {
    return [];
  }
}

/** Témoin « un personnage a été retiré du roster à la lecture » — une phrase JOUEUR par personnage,
 *  posée par `rosterLoad`, consommée par le sélecteur de héros (`ui/PartyScreen`) ; patron de
 *  `takeObsoleteNotice` (`saves.ts`). Le prochain enregistrement du roster l'efface du stockage. */
let herosEcartes = new Set<string>();

/** Consomme le témoin (et le remet à zéro) : les personnages retirés depuis la dernière consommation,
 *  chacun une fois même si le roster a été relu entre-temps. */
export function takeRosterNotice(): string[] {
  const ecartes = [...herosEcartes];
  herosEcartes = new Set();
  return ecartes;
}

/** Entrée telle que lue du stockage, avant `brouillonRelu`. */
type EntreeLue = Omit<RosterEntry, 'draft'> & { draft?: BrouillonPersiste };

/** Brouillon tel que lu du stockage : ses choix par adresse sont des clés brutes. */
type BrouillonPersiste = Omit<CreatorDraft, 'v' | 'specChoices' | 'speciesTalentChoices' | 'randomSpecPicks' | 'talentRerolls' | 'trappingChoices'> & {
  v?: number;
  specChoices?: Record<string, string>;
  speciesTalentChoices?: Record<string, AdvancementRef>;
  randomSpecPicks?: Record<string, string>;
  talentRerolls?: Record<string, number>;
  trappingChoices?: Record<string, number | string>;
};

/** Le brouillon persisté s'il est au format `FORMAT_DES_CHOIX`, ses clés marquées à la lecture
 *  (`adresseLue`) ; tout autre format (`v` absent, antérieur ou autre) est écarté, le créateur rouvre
 *  alors le héros par `draftFromHero`. Idempotent. */
function brouillonRelu(draft: BrouillonPersiste | undefined): CreatorDraft | undefined {
  if (draft?.v !== FORMAT_DES_CHOIX) return undefined;
  const { specChoices, speciesTalentChoices, randomSpecPicks, talentRerolls, trappingChoices, ...choix } = draft;
  return {
    ...choix,
    v: FORMAT_DES_CHOIX,
    specChoices: adressesLues(specChoices),
    speciesTalentChoices: adressesLues(speciesTalentChoices),
    randomSpecPicks: adressesLues(randomSpecPicks),
    talentRerolls: adressesLues(talentRerolls),
    ...(trappingChoices && { trappingChoices: adressesLues(trappingChoices) }),
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

/** Héros dont des objets ne se montent pas (#1988) : leurs NOMS tels que la fiche les portait, et la
 *  raison technique de chacun (`message`, pour le journal du développeur). */
class HerosNonMontable extends Error {
  constructor(readonly objets: readonly string[], raisons: readonly string[]) {
    super(raisons.join(' ; '));
  }
}

/** La raison d'un refus, en langue JOUEUR : les objets non reconnus, nommés ; rien d'autre à dire sinon. */
function motifJoueur(err: unknown): string {
  return err instanceof HerosNonMontable ? t('picker.roster.motif.objets', { objets: err.objets.map((o) => `« ${o} »`).join(', ') }) : '';
}

/** Le nom qu'une instance d'avant #1988 portait : son `label`, sinon celui de son entrée du catalogue
 *  (un roster ne porte aucun objet de campagne), sinon son id. */
const nomHerite = (it: unknown): string => {
  const { label, trappingId, uid } = (it ?? {}) as { label?: unknown; trappingId?: unknown; uid?: unknown };
  if (typeof label === 'string') return label;
  if (typeof trappingId === 'string') return itemLabel({ trappingId: trappingId });
  return String(uid);
};

/** Les objets du héros désignés par id (#1988) : `objetsEnFKDeep` (`data/donsDObjet.ts`) sur les résolveurs
 *  du catalogue — un roster ne porte aucun objet de campagne —, chaque instance de `items` montée puis
 *  jugée par `itemInstanceSchema`, une à une ; puis le reste de la fiche (dons, Conditions). LÈVE
 *  `HerosNonMontable`, qui nomme TOUS les objets refusés. Idempotent. */
function heroAuxObjetsDesignes<T>(hero: T): T {
  const resolveurs = resolveursDeDon([]);
  const items = (hero as { items?: unknown } | null)?.items;
  const refus: { nom: string; raison: string }[] = [];
  const montes = (Array.isArray(items) ? items : []).map((it: unknown) => {
    try {
      const monte = objetsEnFKDeep(it, resolveurs);
      const jugee = itemInstanceSchema.safeParse(monte);
      if (!jugee.success) throw new Error(jugee.error.issues.map((i) => i.message).join(' ; '));
      return monte;
    } catch (err) {
      refus.push({ nom: nomHerite(it), raison: err instanceof Error ? err.message : String(err) });
      return it;
    }
  });
  if (refus.length) throw new HerosNonMontable(refus.map((r) => r.nom), refus.map((r) => `« ${r.nom} » : ${r.raison}`));
  return objetsEnFKDeep(Array.isArray(items) ? { ...hero, items: montes } : hero, resolveurs) as T;
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

/** Migrations SÉQUENTIELLES de l'export roster, keyées par version de DÉPART : `EXPORT_VERSION` en
 *  dérive (`versionCourante`, #2226). Un export d'une version sans entrée est refusé (jamais accepté
 *  en silence avec des champs manquants). Chaînée par `migrateDoc` (primitive générique, `migrateDoc.ts`). */
export const ROSTER_MIGRATIONS = {
  // v1 → v2 : renommage CharKey → slugs pleins (#311) — primitive `charKeyMigration.ts`.
  1: (doc) => ({ ...doc, hero: remapCharKeysDeep(doc.hero) }),
  // v2 → v3 (#604) : renommage `name` → `label` du héros exporté (nom du personnage, de ses objets et
  // de ses armes) — primitive `instanceIdMigration.ts`.
  2: (doc) => ({ ...doc, hero: remapNameToLabelDeep(doc.hero) }),
  // v3 → v4 (#1548 L2) : renommage `skillId` → `id` des `SkillInstance` du héros exporté —
  // primitive `skillIdMigration.ts`. Sans elle, les avancements de Compétence sont perdus en silence.
  3: (doc) => ({ ...doc, hero: remapSkillIdDeep(doc.hero) }),
  // v4 → v5 (#1897) : les ids de sort du livre fan FUSIONNÉS désignent l'entrée qui les absorbe —
  // primitive `remapSortsFusionnesDeep` (`src/data/sortsFusionnes.ts`). Sans elle, un sort appris est
  // perdu en silence (`findSpellById` ne le résout plus).
  4: (doc) => ({ ...doc, hero: remapSortsFusionnesDeep(doc.hero) }),
  // v5 → v6 (#1924) : les clés de `careerSlotChoices` se résument en ids — `migrerClesDEmplacement`
  // (`engine/careerSlots.ts`). Sans elle, chaque joker de carrière désigné redevient à désigner.
  5: (doc) => ({ ...doc, hero: avecClesDEmplacementEnIds(doc.hero) }),
  // v6 → v7 (#1473, train 2a) : les ops de Talent que le héros porte s'écrivent
  // `talent: { id, spec? }`, et une mutation attachée avant le lot reçoit ses `talentsAcquis` —
  // `avecOpsDeTalentALaGraphie`. Sans elle, l'op importée n'a pas de `talent` et son application
  // lève (`engine/ops.ts`, `grantTalent`).
  6: (doc) => ({ ...doc, hero: avecOpsDeTalentALaGraphie(doc.hero) }),
  // v7 → v8 (#1988) : les objets du héros désignés par id, `label` mort — `heroAuxObjetsDesignes`. Un
  // objet qui ne se monte pas LÈVE : l'import est refusé (`migrateur-en-echec`), jamais un objet sans nom.
  7: (doc) => ({ ...doc, hero: heroAuxObjetsDesignes(doc.hero) }),
} satisfies MigrationMap;

export const EXPORT_VERSION = versionCourante(ROSTER_MIGRATIONS);

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
  const issue = migrateDoc(normalized, ROSTER_MIGRATIONS);
  if (!issue.ok) return { error: `${t(MESSAGE_DU_REFUS_DE_MIGRATION[issue.raison])} ${motifJoueur(issue.erreur)}`.trim() };
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
    stockageWeb('localStorage')?.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}
