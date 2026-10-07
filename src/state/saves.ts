/**
 * Sauvegarde / chargement de partie (Jalon 5) — localStorage + export/import JSON.
 *
 * Snapshot ZÉRO-MAINTENANCE : on copie les clés de DONNÉES de `getInitialState()` depuis l'état
 * courant (toute nouvelle donnée d'état future est sauvée gratis — même principe que le reset de
 * partie, qui repart de `useGame.getInitialState()` — JAMAIS d'une liste de champs tenue à la main) ;
 * les actions (fonctions zustand) sont ignorées.
 * La scène vivante (mutée : fouilles consommées, entités retirées…), les flags, l'inventaire,
 * l'horloge et le groupe voyagent donc dans la save.
 *
 * Sauvegarde HORS COMBAT uniquement (battle non-null refusé par l'action store) : l'état
 * tactique suspendu (IA, modales de combat) n'est pas un point de reprise sûr.
 *
 * Les règles maison (surcharges de `policy.ts`, hors GameState) voyagent à part dans `rules` :
 * une save reste portable d'une machine à l'autre AVEC ses règles (le localStorage ne suffit pas).
 *
 * FORMAT (#2404, `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`) : `version` vaut
 * `FORMAT_SAVE`, dérivé du type `SaveGame` (`scripts/gen-formats.mjs`). Une save d'un autre
 * format, ou illisible, est REJETÉE et RETIRÉE du stockage à la lecture (`readSlot`), avec un message
 * au joueur (témoin `takeObsoleteNotice`, rendu par `ui/SaveLoadModal`). Aucune migration.
 */
import type { RuleValue } from '../engine/policy';
import type { Scene } from './scene';
import type { GameState } from './store';
import { stockageWeb } from '../lib/stockageWeb';
import { FORMAT_SAVE } from './formats.generated';

export interface SaveMeta {
  version: string;
  /** ISO — horodatage réel de la sauvegarde (méta d'affichage). */
  savedAt: string;
  /** Étiquette du slot (nom de la scène courante). */
  sceneLabel: string;
  /** Horloge de jeu (minutes) au moment de la sauvegarde. */
  gameTime: number;
}

export interface SaveGame extends SaveMeta {
  data: DonneesDeSave;
  /** Surcharges de règles maison (`policy.ts`) actives à la sauvegarde. */
  rules: Record<string, RuleValue>;
}

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;
// #898
const KEY = (slot: AnySlot) => `wfrp4.save.${slot}`;

/**
 * Les clés de DONNÉES qui ne partent PAS en save — l'ensemble NOMMÉ, une raison par clé. Le contrat
 * du snapshot est POSITIF (tout champ de données de l'état initial entre), donc une exclusion qui
 * n'est pas ici n'existe pas : c'est le seul endroit à lire et à amender.
 *
 * La même couture sert la sauvegarde locale ET le snapshot réseau (`state/netFlow.ts`
 * `netSnapshot`) : ce qui sort d'ici ne traverse pas non plus vers un invité coop.
 */
const HORS_SAVE = {
  // #767 · #766
  campaignNarratif: 'couche runtime de projet, re-dérivée de `campaignDoc` (`reposerPaquetDeCampagne`, store.ts)',
  // #1687 — état de la TOUCHE Alt à l'instant, pas une préférence : une save qui le porterait
  // rechargerait une partie aux utilisables révélés, touche relâchée.
  reveler: 'geste clavier en cours, jamais un état de partie',
  // #1478 — drapeaux de RECETTE (`__wfrp.labels`, `__wfrp.roofCut`), jamais une préférence de
  // partie : une save prise en recette rechargerait la carte annotée ou le lève-toit débrayé, et
  // l'invité coop en hériterait par `netSnapshot`.
  debugLabels: 'drapeau de recette (overlay de debug)',
  debugRoofCut: 'drapeau de recette (lève-toit débrayé)',
} as const satisfies Partial<Record<keyof GameState, string>>;

/** Les clés de DONNÉES de `GameState` (ni action, ni `HORS_SAVE`) : la forme du `data` d'une save. */
export type DonneesDeSave = {
  [K in keyof GameState as GameState[K] extends (...args: never[]) => unknown ? never : K extends keyof typeof HORS_SAVE ? never : K]: GameState[K];
};

/** Snapshot des clés de DONNÉES de l'état courant (les fonctions/actions sont ignorées). */
export function snapshotSave(
  state: Record<string, unknown>,
  initial: Record<string, unknown>,
  savedAt: string,
  rules: Record<string, RuleValue> = {},
): SaveGame {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(initial)) {
    if (k in HORS_SAVE) continue; // exclusions NOMMÉES, avec leur raison, ci-dessus
    const v = state[k];
    if (typeof v === 'function') continue;
    data[k] = v === undefined ? null : v;
  }
  // Le document de scène est TYPÉ ici (jamais une forme structurelle ad hoc) : le `state` d'entrée est
  // un `Record` opaque, et un cast maison sur les noms de champs rendrait un renommage de `Scene`
  // INVISIBLE au typecheck — `sceneLabel` retomberait en silence sur l'id. Garde : `saves-flow.test.ts`.
  const scene = state.scene as Pick<Scene, 'label' | 'id'> | null;
  const copie = JSON.parse(JSON.stringify(data)) as DonneesDeSave; // deep copy JSON-sûre
  purgeFoldMemo(copie.pendingCascade);
  purgeFoldMemo(copie.suspendedCascades);
  return {
    version: FORMAT_SAVE,
    savedAt,
    sceneLabel: scene?.label ?? scene?.id ?? 'Sans scène',
    gameTime: typeof state.gameTime === 'number' ? state.gameTime : 0,
    data: copie,
    rules: { ...rules },
  };
}

/**
 * SECRET DES POSES — le mémo de pli d'une étape à table (`CascadeStep.foldMemo`, `cascade.
 * tableStepResolved`) porte les conséquences des dés EXPLORÉS PUIS ABANDONNÉS par le siège qui pose.
 * Il ne quitte JAMAIS ce siège : ni dans la sauvegarde, ni dans le snapshot coop diffusé aux autres
 * tables. Une seule couture pour les deux — `netFlow.netSnapshot` passe par `snapshotSave`.
 * Un rechargement re-dérive le pli à la première re-pose (le mémo est un cache, pas une donnée).
 */
function purgeFoldMemo(v: unknown): void {
  if (Array.isArray(v)) { for (const x of v) purgeFoldMemo(x); return; }
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  delete o.foldMemo;
  for (const k of Object.keys(o)) purgeFoldMemo(o[k]);
}

// ── Règles maison dans le snapshot COOP (parité hôte/invité) ──────────────────────────────────
// Le snapshot réseau n'a qu'un champ `data` opaque (cf. net/session) : les surcharges de `policy.ts`
// y voyagent sous une clé RÉSERVÉE. Helpers PURS (testés), réutilisés par netFlow.

/** Clé réservée du payload coop transportant les règles maison (hors GameState). */
export const HOUSE_RULES_KEY = '__houseRules';

/** Joint les règles maison au snapshot coop (sous la clé réservée). */
export function packHouseRules(data: Record<string, unknown>, rules: Record<string, RuleValue>): Record<string, unknown> {
  return { ...data, [HOUSE_RULES_KEY]: rules };
}

/** Sépare les règles maison du reste de l'état (clé réservée retirée de `game` → pas de pollution). */
export function unpackHouseRules(data: Record<string, unknown>): { game: Record<string, unknown>; rules?: Record<string, RuleValue> } {
  const { [HOUSE_RULES_KEY]: rules, ...game } = data;
  return { game, rules: rules as Record<string, RuleValue> | undefined };
}

/** Validation de forme d'une save (format COURANT + data objet). */
export function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === FORMAT_SAVE
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

/** Lit un document de save parsé : la version DOIT être `FORMAT_SAVE`. Toute autre forme rend `null`. */
export function parseSave(parsed: unknown): SaveGame | null {
  return isValidSave(parsed) ? parsed : null;
}

/** CAUSE du rejet d'une sauvegarde — l'écran de chargement en fait un message DISTINCT : une save d'un
 *  autre format et un contenu illisible ne se disent pas d'un même mot. */
export type ObsoleteCause = 'autreFormat' | 'illisible';

/** Une sauvegarde retirée du stockage : son emplacement et la cause du retrait. */
export type RetraitDeSave = { slot: AnySlot; cause: ObsoleteCause };

/** Témoin des sauvegardes trouvées puis retirées, dans l'ordre des lectures — posé par `readSlot`,
 *  consommé par l'écran de chargement. Un emplacement n'y figure qu'une fois. */
let retraits: RetraitDeSave[] = [];

/** Consomme le témoin de rejet (et le remet à zéro) — les retraits survenus depuis la dernière
 *  consommation, `[]` sinon. */
export function takeObsoleteNotice(): readonly RetraitDeSave[] {
  const r = retraits;
  retraits = [];
  return r;
}

/** JETTE le contenu d'un emplacement et pose le témoin de message avec sa cause. Un stockage qui
 *  refuse la suppression ne fait pas échouer la lecture — le message part quand même. */
function discardSlot(s: Storage, slot: AnySlot, cause: ObsoleteCause): void {
  if (!retraits.some((r) => r.slot === slot)) retraits.push({ slot, cause });
  try {
    s.removeItem(KEY(slot));
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

export function saveToSlot(slot: AnySlot, save: SaveGame): boolean {
  const s = stockageWeb('localStorage');
  if (!s) return false;
  try {
    s.setItem(KEY(slot), JSON.stringify(save));
    return s.getItem(KEY(slot)) != null; // confirme l'écriture (quota plein → null)
  } catch {
    return false;
  }
}

/** Lit l'emplacement : une save à `FORMAT_SAVE`, ou `null`. Tout contenu d'une AUTRE forme ou
 *  illisible est JETÉ, témoin posé. */
export function readSlot(slot: AnySlot): SaveGame | null {
  const s = stockageWeb('localStorage');
  if (!s) return null;
  let raw: string | null;
  try {
    raw = s.getItem(KEY(slot));
  } catch {
    return null;
  }
  if (raw == null) return null;
  const lu = lireSave(raw);
  if (typeof lu === 'string') {
    discardSlot(s, slot, lu);
    return null;
  }
  return lu;
}

/** Un texte de save : la save au `FORMAT_SAVE`, ou la CAUSE de son refus. SOURCE UNIQUE de la lecture
 *  d'un emplacement (`readSlot`) et de l'import (`importSave`). */
function lireSave(raw: string): SaveGame | ObsoleteCause {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'illisible';
  }
  return parseSave(parsed) ?? 'autreFormat';
}

export function deleteSlot(slot: AnySlot): void {
  try {
    const s = stockageWeb('localStorage');
    if (!s) return;
    s.removeItem(KEY(slot));
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

/** Métadonnées des 3 slots (null = vide) — pour l'UI de la modale Sauvegarde/Chargement. */
export function listSaves(): ({ slot: SaveSlot } & SaveMeta | null)[] {
  return SAVE_SLOTS.map((slot) => {
    const s = readSlot(slot);
    return s ? { slot, version: s.version, savedAt: s.savedAt, sceneLabel: s.sceneLabel, gameTime: s.gameTime } : null;
  });
}

/** Export : JSON lisible (téléchargement / presse-papier). */
export function exportSave(save: SaveGame): string {
  return JSON.stringify(save, null, 2);
}

/** Import : la save au `FORMAT_SAVE`, ou la cause de son refus (illisible, ou d'un autre format). */
export function importSave(json: string): SaveGame | ObsoleteCause {
  return lireSave(json);
}
