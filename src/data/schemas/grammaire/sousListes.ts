/**
 * SOUS-LISTES NOMMÉES de la grammaire (#1988) — déclarées UNE fois, lues par le schéma (`idDe`, `refs`,
 * `grammaire/ref.ts`) et par le runtime (`dansLaSousListe`, `trappingsInstanciables`, `data/index.ts`).
 * Chaque nom de marqueur s'y écrit une fois : une sous-liste qui en exclut davantage COMPOSE la précédente.
 *
 * FEUILLE : aucun import — le schéma, le moteur et les scripts l'atteignent sans cycle.
 */

/** Trappings qu'un DON peut remettre (Effet `giveTrapping`) : l'espace `trappings.json` privé des
 *  entrées marquées `service` (LDB 66 l.12-14). */
export const DONNABLE = { horsMarqueurs: ['service'] } as const;

/** Marqueur des trappings qui exigent une créature (`TrappingData.exigeUneCreature`, ZI 13 l.294, l.319). */
export const EXIGE_UNE_CREATURE = 'exigeUneCreature';

/** Trappings que le moteur INSTANCIE par leur seul id (`itemFromTrappingById`, `engine/items.ts`) :
 *  `DONNABLE` privé des entrées marquées `EXIGE_UNE_CREATURE`. */
export const INSTANCIABLE_PAR_ID = { horsMarqueurs: [...DONNABLE.horsMarqueurs, EXIGE_UNE_CREATURE] } as const;

/** Créatures qui portent un profil de récolte (`CreatureData.harvest`, ZI 13 l.319-385). */
export const RECOLTABLE = { avecMarqueur: 'harvest' } as const;
