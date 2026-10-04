/**
 * SOUS-LISTES NOMMÉES de la grammaire (#1988) — déclarées UNE fois, lues par le schéma (`idDe`, `refs`,
 * `grammaire/ref.ts`) et par le runtime (`dansLaSousListe`, `trappingsInstanciables`, `data/index.ts`).
 *
 * FEUILLE : aucun import — le schéma, le moteur et les scripts l'atteignent sans cycle.
 */

/** Trappings que le moteur INSTANCIE par leur seul id (`itemFromTrappingById`, `engine/items.ts`) :
 *  l'espace `trappings.json` privé des entrées marquées `service` (LDB 66 l.12-14). */
export const INSTANCIABLE_PAR_ID = { horsMarqueurs: ['service'] } as const;
