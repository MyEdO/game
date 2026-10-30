// Types de l'écriture atomique : mêmes signatures que ecritureJsonAtomique.mjs.

export const LECTURE_PARTAGEE_REFUSEE: 'EBUSY';

export function lireTextePublie(chemin: string): string | undefined;

export function ecrireTexteAtomique(chemin: string, texte: string | Uint8Array, options?: { attendre?: (ms: number) => void; paliers?: readonly number[] }): void;

export function ecrireJsonAtomique(chemin: string, valeur: unknown, options?: { indentation?: number; attendre?: (ms: number) => void; paliers?: readonly number[] }): void;

export function publierJsonSiAbsent(chemin: string, valeur: unknown): boolean;
