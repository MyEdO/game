import type { CibleFigee } from '../source/lieux.mjs';

export const FICHIER: string;
export const DATE_DE_LA_TABLE: string;
export const ADRESSES: Readonly<Record<string, CibleFigee>>;
export function migrer(brut: string, adresses?: Readonly<Record<string, CibleFigee>>): {
  texte: string;
  gestes: { id: string; adresse: string }[];
  restantes: string[];
  echecs: string[];
};
