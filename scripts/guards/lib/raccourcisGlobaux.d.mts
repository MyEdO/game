type Fichier = { rel: string; text: string };

/** EN-TÊTE d'un fichier, en lignes : la marque `@clavier-hors-registre` s'y ancre (contrat : `raccourcisGlobaux.mjs`). */
export const LIGNES_ENTETE: number;
/** Verdict d'UN fichier, ses imports résolus parmi `depot` : `null` = en règle, sinon la raison. */
export function verdictClavier(fichier: Fichier, depot?: readonly Fichier[]): string | null;
/** Fichiers hors de la règle, imports résolus parmi eux : `chemin : raison`. */
export function fautesClavier(fichiers: readonly Fichier[]): string[];
/** Fichiers marqués `@clavier-hors-registre`, et ceux dont la marque est MORTE. */
export function marquesHorsRegistre(fichiers: readonly Fichier[]): { marques: string[]; mortes: string[] };
