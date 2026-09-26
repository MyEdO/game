export interface ExemptionCylindre {
  fichier: string;
  motif: RegExp;
  raison: string;
}

export const SOCLE: string[];
export const BRANCHE_CYLINDRE: RegExp;
export const MOTIFS: RegExp[];
export const EXEMPTIONS: ExemptionCylindre[];
export function sitesFautifs(texte: string): { ligne: number; texte: string }[];
