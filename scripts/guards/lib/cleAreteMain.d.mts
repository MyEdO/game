export interface ExemptionCleArete {
  fichier: string;
  motif: RegExp;
  raison: string;
}

export const SOCLE: string[];
export const CLE_A_LA_MAIN: RegExp;
export const EXEMPTIONS: ExemptionCleArete[];
export function sitesFautifs(texte: string): { ligne: number; texte: string }[];
