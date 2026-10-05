import type { Ajout, DescRef } from '../../src/data/source/decoupe.ts';

export interface CibleFigee { ch: string; sec: string; secOcc: number; b0: number; b1: number }
export const FICHIER: string;
export const DATE_DE_LA_TABLE: string;
export const ADRESSES: Readonly<Record<string, CibleFigee>>;
export function lieuxDe(livre: string, desc: string): { ch: string; sec: string; secOcc: number; rang: number }[];
export function prouver(
  entree: { id: string; desc: string; source: { book: string } },
  cible: CibleFigee,
): { ref: DescRef; preuve: { unites: number; ajoute: Ajout[]; ecartDeLongueurNormalisee: number; lieux: number }; erreur?: undefined }
  | { erreur: string; ref?: undefined; preuve?: undefined };
export function migrer(brut: string, adresses?: Readonly<Record<string, CibleFigee>>): {
  texte: string;
  gestes: { id: string; adresse: string }[];
  restantes: string[];
  echecs: string[];
};
