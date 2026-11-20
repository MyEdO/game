import type { Echeance } from './stock.mjs';

export const STRUCTURES_CIBLES: ReadonlyArray<{
  concept: string;
  signature: string;
  pose?: string;
  date: string;
}>;

export const STRUCTURES_REDECLARATIONS: ReadonlyArray<Echeance & {
  def: string;
  champ: string;
  concept: string;
  signature: string;
  statut: string;
  commun: string;
  occurrences: number;
}>;
