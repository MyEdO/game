/**
 * LES EMPLACEMENTS DE SAUVEGARDE du web (Jalon 5) : localStorage + export/import JSON. La forme de la save, sa
 * validation et ses décisions : `noyau/persistance/save.ts`.
 *
 * FORMAT (#2404, `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`) : une save d'un autre format, ou
 * illisible, est REJETÉE et RETIRÉE du stockage à la lecture (`readSlot`), avec un message au joueur (témoin
 * `takeObsoleteNotice`, rendu par `ui/SaveLoadModal`). Aucune migration.
 */
import { stockageWeb } from '../web/stockageWeb';
import { parseSave, type SaveGame, type SaveMeta } from '../noyau/persistance/save';

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;
// #898
const KEY = (slot: AnySlot) => `wfrp4.save.${slot}`;

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
