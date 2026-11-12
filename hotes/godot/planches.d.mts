// Types des planches et de leurs étalons : mêmes signatures que planches.mjs.

export const DOSSIER_DES_ETALONS: string;

export const VALIDES: string;

export const EPINGLE: Readonly<{ playwright: string; chrome: string }>;

export function deposerLesPlanches(sortie: string, planches: { nom: string; parametres: { scenario: string }; monde: unknown }[]): void;

export function refusDuNavigateur(navigateur: string, machine: { plateforme: string; architecture: string }): string | null;

export function etalonsSansPlanche(fichiers: string[], noms: string[]): string[];

export function enDeuxFiles<E, R>(elements: E[], travail: (element: E) => Promise<R>): Promise<R[]>;
