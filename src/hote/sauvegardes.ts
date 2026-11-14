/**
 * LES EMPLACEMENTS DE SAUVEGARDE d'un hôte (#3041), sur le `Stockage` qu'il fournit : écrire, lire, retirer, lister.
 * La forme de la save, sa validation, son export et son import, et ses décisions sont au noyau
 * (`noyau/persistance/save.ts`).
 *
 * FORMAT (#2404, `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`) : une save d'un autre format, ou
 * illisible, est REJETÉE et RETIRÉE du stockage à la lecture ; son retrait CUMULE son TÉMOIN dans le même `Stockage`
 * (`hote/temoin.ts`), que `prendreLesRetraitsDeSauvegardes` consomme. Aucune migration. Un stockage
 * absent (`null`) ou qui lève : aucune save, l'écriture rend `false`.
 *
 * LES ZONES (#3009, `zonesDesSauvegardes`) : chaque emplacement en entité, avec le bouton qui le charge
 * (`{ charger }`) et celui qui y écrit la partie ouverte (`{ sauvegarder }`), que le noyau refuse (`refusDeSauvegarde`).
 */
import {
  CAUSES_DE_REFUS_DE_SAVE,
  formatImperial,
  lireSave,
  metaDeSave,
  refusDeSauvegarde,
  type Jeu as Partie,
  type ObsoleteCause,
  type RefusDeSauvegarde,
  type SaveGame,
  type SaveMeta,
} from '../noyau/index';
import { t, type MsgKey } from '../i18n';
import { lireLeTexte, retirerLaCle, type Stockage } from '../lib/stockage';
import { ligne, type Bouton, type Entite, type Ligne } from './elements';
import { prendreLeTemoin, temoigner, type FormeDeTemoin } from './temoin';

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: readonly SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;

/** La clé de stockage de l'emplacement `slot` (#898). */
export const cleDEmplacement = (slot: AnySlot): string => `wfrp4.save.${slot}`;
const CLE_DU_TEMOIN = 'wfrp4.save.temoins';

/** Une sauvegarde retirée du stockage : son emplacement et la cause du retrait. */
export type RetraitDeSave = { slot: AnySlot; cause: ObsoleteCause };

const estEmplacement = (v: unknown): v is AnySlot => v === AUTO_SLOT || SAVE_SLOTS.includes(v as SaveSlot);
const estCause = (v: unknown): v is ObsoleteCause => (CAUSES_DE_REFUS_DE_SAVE as readonly unknown[]).includes(v);

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

/** Le nom, dans un message, d'un emplacement de sauvegarde. */
export const nomDEmplacement = (slot: AnySlot): string => (slot === AUTO_SLOT ? t('saveload.slot.auto.nom') : t('saveload.slot.label', { n: slot }));

/** Le message d'une sauvegarde refusée, par raison. */
export const MESSAGE_DU_REFUS = { combat: 'store.saveInBattle', invite: 'store.saveInvite' } as const satisfies Record<RefusDeSauvegarde, MsgKey>;

/** Le message d'une sauvegarde retirée à la lecture, par cause : l'autre format et le contenu illisible ne se disent
 *  pas d'un même mot. */
export const MESSAGE_DU_RETRAIT = {
  autreFormat: 'saveload.error.autreFormat',
  illisible: 'saveload.error.unreadable',
  sceneInvalide: 'saveload.error.sceneInvalide',
} as const satisfies Record<ObsoleteCause, MsgKey>;

/**
 * @contrat Vue
 * Les zones des sauvegardes, que la méthode `sauvegardes` rend avec ou sans partie ouverte.
 */
export interface ZonesDesSauvegardes {
  /**
   * chaque emplacement en entité, l'automatique d'abord : son nom, puis la scène, la date de jeu et l'heure réelle de
   * sa sauvegarde, ou « vide » ; « Charger » s'il porte une sauvegarde, dont le `jeu` `{ charger }` porte
   * l'emplacement que la méthode `charger` reçoit ; « Sauvegarder » sur un emplacement manuel quand une partie est
   * ouverte, dont le `jeu` `{ sauvegarder }` porte l'emplacement que la méthode `sauvegarder` reçoit, refusé avec la
   * raison du noyau (`refusDeSauvegarde` : en combat, siège invité).
   */
  'sauvegardes.emplacements': Entite[];
  /** une ligne par sauvegarde retirée du stockage à cette lecture (autre format, illisible, scène invalide), dite une fois. */
  'sauvegardes.avis': Ligne[];
  /** « Fermer », dont le `jeu` `{ sauvegardes: false }` ferme le panneau que `{ sauvegardes: true }` ouvre. */
  'sauvegardes.gestes': Bouton[];
}

/** Le bouton `id` de libellé `libelle`, qui joue `jeu`. */
const bouton = (id: string, libelle: string, jeu: Bouton['jeu'], refus: string | null = null): Bouton => ({ type: 'bouton', id, libelle, jeu, presse: false, focus: false, refus });

/** Les zones des sauvegardes de `stockage` ; `etat` : la partie ouverte, `null` sans partie. */
export function zonesDesSauvegardes(stockage: Stockage | null, etat: Partie | null): ZonesDesSauvegardes {
  const refus = etat ? refusDeSauvegarde(etat, etat.net.mySeat) : null;
  const emplacements = [AUTO_SLOT, ...SAVE_SLOTS].map((slot): Entite => {
    const save = lireLaSauvegarde(stockage, slot);
    const fiche = save ? [save.sceneLabel, formatImperial(save.gameTime), new Date(save.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })].join(t('ecran.separateur')) : t('saveload.slot.empty');
    return {
      type: 'entite', id: `emplacement/${slot}`, ton: 'neutre', nom: nomDEmplacement(slot),
      elements: [
        ligne('fiche', fiche),
        ...(save ? [bouton(`charger/${slot}`, t('saveload.btn.load'), { charger: slot })] : []),
        ...(etat && slot !== AUTO_SLOT ? [bouton(`sauvegarder/${slot}`, t('saveload.btn.save'), { sauvegarder: slot }, refus && t(MESSAGE_DU_REFUS[refus]))] : []),
      ],
    };
  });
  return {
    'sauvegardes.emplacements': emplacements,
    'sauvegardes.avis': prendreLesRetraitsDeSauvegardes(stockage).map((r) => ligne(`retrait/${r.slot}`, t(MESSAGE_DU_RETRAIT[r.cause], { emplacement: nomDEmplacement(r.slot) }), 'alerte')),
    'sauvegardes.gestes': [bouton('fermer', t('saveload.btn.close'), { sauvegardes: false })],
  };
}
