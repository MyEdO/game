/**
 * Les GENRES DE BANDE d'EXPOSITION (#3058) : une feuille sans import, lue au chargement par les tables de
 * `restFlow.ts` comme par `nightBands.ts`.
 */

/** Les `kind` de BANDE d'EXPOSITION (LDB 18 l.326-334) — MÊME règle, MÊME applier, DEUX routes qui la
 *  posent : la nuit de camp / l'effet de scène (`exposition-nocturne`) et l'entretien de MER (`merExposition`,
 *  seul couvert par les ORDRES d'une traversée, cf. `voyageCadence.KINDS_SOUS_ORDRES`). L'escalade
 *  cumulative les compte ENSEMBLE : un héros ne recommence pas à zéro en changeant de route. */
export const EXPOSURE_BAND_KINDS = ['exposition-nocturne', 'merExposition'] as const;
