export const FICHIER: string;
export function migrer(brut: string): {
  texte: string;
  gestes: { id: string; verdict: string }[];
  restantes: string[];
  echecs: string[];
};
