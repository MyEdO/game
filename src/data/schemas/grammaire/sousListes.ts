/**
 * SOUS-LISTES NOMMÉES de la grammaire (#1988) — déclarées UNE fois, lues par le schéma (`idDe`, `refs`,
 * `grammaire/ref.ts`) et par le runtime (`dansLaSousListe`, `trappingsInstanciables`, `data/index.ts`).
 *
 * FEUILLE : aucun import — le schéma, le moteur et les scripts l'atteignent sans cycle.
 */

/** Trappings que le moteur INSTANCIE par leur seul id (`itemFromTrappingById`, `engine/items.ts`) :
 *  l'espace `trappings.json` privé des entrées marquées `service` (LDB 66 l.12-14). */
export const INSTANCIABLE_PAR_ID = { horsMarqueurs: ['service'] } as const;

/** Les RACINES du catalogue des apparences (`defs/apparences.ts`) : l'espace `apparences.json` privé
 *  des entrées marquées `forme`, qui sont des variantes. Cible de `forme` et de `trappings.json ›
 *  shape`/`formChoices`. */
export const RACINE_D_APPARENCE = { horsMarqueurs: ['forme'] } as const;

/** Groupes qu'un PORTEUR déclare (`grantGroups`, `groups`) : l'espace `groups.json` privé des Groupes-Cibles
 *  jokers (`matchesAll`) et relatifs (`relatif`) — ils visent, ils ne se déclarent pas. #3045 */
export const DECLARABLE_PAR_UN_PORTEUR = { horsMarqueurs: ['matchesAll', 'relatif'] } as const;

/** Groupes qu'une Cible d'APPARTENANCE lit sans porteur de Trait psy (`onlyGroups`, `exceptGroups`,
 *  `blockGroups`, Condition `has`) : l'espace `groups.json` privé des Groupes relatifs, qui n'ont de sens
 *  que rapportés à ce porteur. #3045 */
export const CIBLE_D_APPARTENANCE = { horsMarqueurs: ['relatif'] } as const;
