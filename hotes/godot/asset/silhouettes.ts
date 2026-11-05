export const CARRURE_MOINS = 'carrure_moins';
export const CARRURE_PLUS = 'carrure_plus';
export const FEMININ = 'feminin';
export const CORPULENCE = 'corpulence';

export const NOMS_DES_SILHOUETTES = [FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS] as const;

export const estSilhouette = (nom: string): boolean => (NOMS_DES_SILHOUETTES as readonly string[]).includes(nom);
