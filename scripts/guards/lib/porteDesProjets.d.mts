import type { PasseDesProjets } from './serrureDesProjets.mjs';
/** La passe d'une lecture de tous les projets, et des racines qui contiennent `projets/`. */
export const porteDeTousLesProjets: PasseDesProjets;
/** La passe d'une lecture du seul projet de dossier `projets/<projet>`. */
export function porteDuProjet(projet: string): PasseDesProjets;
/** La passe d'une lecture, à travers les projets, des seuls fichiers finis par `suffixe`. */
export function porteDuSuffixe(suffixe: string): PasseDesProjets;
