export const DOSSIERS_DU_RIG: readonly string[];
export function estDuRig(rel: string): boolean;
export function retoursDuRig(chemins: readonly string[], lireTexte?: (rel: string) => string): string[];
