import type { DescRef } from '../../src/data/source/decoupe.ts';

export interface CibleFigee { ch: string; parts: { sec: string; secOcc: number; b0: number; finSec?: string; finSecOcc?: number; b1: number }[] }
export const FICHIER: string;
export const ADRESSES: Readonly<Record<string, CibleFigee>>;
export function prouver(
  entree: { id: string; desc: string; source: { book: string } },
  cible: CibleFigee,
): { ref: DescRef; erreur?: undefined } | { erreur: string; ref?: undefined };
export function migrer(brut: string): {
  texte: string;
  gestes: { id: string; adresse: string }[];
  restantes: string[];
  echecs: string[];
};
