/**
 * LES EMPLACEMENTS DE SAUVEGARDE d'un hôte (#3041), sur le `Stockage` qu'il fournit : écrire, lire, retirer, lister.
 * La forme de la save, sa validation, son export et son import, et ses décisions sont au noyau
 * (`noyau/persistance/save.ts`).
 *
 * FORMAT (#2404, `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`) : une save d'un autre format, ou
 * illisible, est REJETÉE et RETIRÉE du stockage à la lecture ; son retrait CUMULE son TÉMOIN dans le même `Stockage`
 * (`hote/temoin.ts`), que `prendreLesRetraitsDeSauvegardes` consomme. Aucune migration. Un stockage
 * absent (`null`) ou qui lève : aucune save, l'écriture rend `false`.
 */
import { lireSave, metaDeSave, type ObsoleteCause, type SaveGame, type SaveMeta } from '../noyau/index';
import { lireLeTexte, retirerLaCle, type Stockage } from '../lib/stockage';
import { prendreLeTemoin, temoigner, type FormeDeTemoin } from './temoin';

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: readonly SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;

/** La clé de stockage de l'emplacement `slot` (#898). */
const cleDEmplacement = (slot: AnySlot): string => `wfrp4.save.${slot}`;
const CLE_DU_TEMOIN = 'wfrp4.save.temoins';

/** Une sauvegarde retirée du stockage : son emplacement et la cause du retrait. */
export type RetraitDeSave = { slot: AnySlot; cause: ObsoleteCause };

const estEmplacement = (v: unknown): v is AnySlot => v === AUTO_SLOT || SAVE_SLOTS.includes(v as SaveSlot);
const estCause = (v: unknown): v is ObsoleteCause => v === 'autreFormat' || v === 'illisible';

/** Le témoin des saves retirées, dans l'ordre des lectures : un emplacement n'y figure qu'une fois. */
const RETRAITS_DE_SAVES: FormeDeTemoin<RetraitDeSave[]> = {
  lire: (v) => {
    if (!Array.isArray(v)) return null;
    return v.flatMap((r: unknown) => {
      const { slot, cause } = (r ?? {}) as Partial<Record<keyof RetraitDeSave, unknown>>;
      return estEmplacement(slot) && estCause(cause) ? [{ slot, cause }] : [];
    });
  },
  cumuler: (avant, nouveau) => [...(avant ?? []), ...nouveau.filter((n) => !avant?.some((r) => r.slot === n.slot))],
};

/** Les saves retirées par les lectures de `stockage` depuis la dernière prise, RETIRÉES du témoin : `[]` sans retrait. */
export function prendreLesRetraitsDeSauvegardes(stockage: Stockage | null): readonly RetraitDeSave[] {
  return prendreLeTemoin(stockage, CLE_DU_TEMOIN, RETRAITS_DE_SAVES) ?? [];
}

/** Écrit `save` à l'emplacement `slot` de `stockage` ; `true` si la relecture la confirme (quota plein → `false`). */
export function ecrireLaSauvegarde(stockage: Stockage | null, slot: AnySlot, save: SaveGame): boolean {
  if (!stockage) return false;
  try {
    stockage.setItem(cleDEmplacement(slot), JSON.stringify(save));
    return stockage.getItem(cleDEmplacement(slot)) != null;
  } catch {
    return false;
  }
}

/** La save de l'emplacement `slot` de `stockage` au `FORMAT_SAVE`, ou `null`. Tout contenu d'une AUTRE forme ou
 *  illisible est RETIRÉ, et son retrait témoigné. */
export function lireLaSauvegarde(stockage: Stockage | null, slot: AnySlot): SaveGame | null {
  const brut = lireLeTexte(stockage, cleDEmplacement(slot));
  if (brut == null) return null;
  const lu = lireSave(brut);
  if (typeof lu !== 'string') return lu;
  retirerLaSauvegarde(stockage, slot);
  temoigner(stockage, CLE_DU_TEMOIN, RETRAITS_DE_SAVES, [{ slot, cause: lu }]);
  return null;
}

/** Vide l'emplacement `slot` de `stockage`. */
export function retirerLaSauvegarde(stockage: Stockage | null, slot: AnySlot): void {
  retirerLaCle(stockage, cleDEmplacement(slot));
}

/** Les métadonnées des emplacements manuels de `stockage` (`null` = vide), dans l'ordre de `SAVE_SLOTS`. */
export function listerLesSauvegardes(stockage: Stockage | null): ({ slot: SaveSlot } & SaveMeta | null)[] {
  return SAVE_SLOTS.map((slot) => {
    const s = lireLaSauvegarde(stockage, slot);
    return s ? { slot, ...metaDeSave(s) } : null;
  });
}
