// Types des planches et de leurs étalons : mêmes signatures que planches.mjs.

export function deposerLesPlanches(sortie: string, planches: { nom: string; parametres: { scenario: string }; communes: unknown }[]): void;

export function etalonsSansPlanche(fichiers: string[], noms: string[]): string[];

export const VUE_DE_BASE: Readonly<{ largeur: number; hauteur: number }>;

export const MAQUETTES: string;

export function coteACote(nom: string, capture: Buffer, maquettes: Record<string, { chemin: string; sha256: string; facteur: number; date: string }>): { image: Buffer } | { avis: string } | null;
