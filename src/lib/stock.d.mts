export const CHAMPS_D_ECHEANCE: readonly ['lot', 'date'];

/** L'ÉCHÉANCE d'une entrée : le chantier qui l'éteint (`lot`), la mesure d'origine (`date`). */
export type Echeance = { [C in (typeof CHAMPS_D_ECHEANCE)[number]]: string };
