export interface ExemptionCylindre {
  fichier: string;
  ancre: string;
  raison: string;
  date: string;
}

export const SOCLE: string[];
export const BRANCHE_CYLINDRE: RegExp;
export const MOTIFS: RegExp[];
export const EXEMPTIONS: ExemptionCylindre[];
export function sitesFautifs(texte: string): { ligne: number; texte: string }[];
