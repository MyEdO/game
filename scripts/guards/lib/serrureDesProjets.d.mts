/** La racine de CE dépôt, dont la serrure garde le dossier `projets/`. */
export const DEPOT: string;
/** Une passe de la porte des projets, frappée par le sceau que seule la porte reçoit (`porteDesProjets.mjs`). */
export type PasseDesProjets = Readonly<{ lit: 'tous' } | { lit: 'projet'; projet: string }>;
/** Le sceau des passes, remis au seul module de la porte. */
export function sceauDeLaPorte(urlDuModule: string): (lecture: { lit: 'tous' } | { lit: 'projet'; projet: string }) => PasseDesProjets;
/** Refuse que `passerelle` lise `abs` sans passe qui l'admette quand `abs` est sous `projets/` (ou, sous `ancetres`, le contient). */
export function exigerLaPorte(abs: string, porte: PasseDesProjets | undefined, passerelle: string, options?: { ancetres?: boolean }): void;
/** L'erreur est-elle un refus de la serrure (`exigerLaPorte`) ? */
export function estRefusDeLaPorte(erreur: unknown): boolean;
