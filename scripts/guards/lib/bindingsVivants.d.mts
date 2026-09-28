/** Déclaration TS du vocabulaire des bindings vivants (#1692) — cf. `bindingsVivants.mjs`. */
export const RACINE: string;
export function sansCommentaires(src: string): string;
export function bindingsVivants(): Map<string, string>;
export function clesDuSeam(): string[];
export function documentsDesRacinesVivantes(): Set<string>;
export function nomsVivantsDuFichier(chemin: string, src: string, parBinding: Map<string, string>): Map<string, string>;
export function espacesDeNomsDuFichier(src: string): string[];
export function accesseursVivants(): Set<string>;
export function accesseursDuFichier(src: string, vivants: Set<string>): Set<string>;
export function declarationsDeNiveauModule(src: string): { ligne: number; texte: string; boucle?: boolean }[];
export function indexFiges(chemin: string, src: string, parBinding: Map<string, string>, vivants?: Set<string>): string[];
export function resolveursDentree(): Set<string>;
export function ecrituresHorsSeam(chemin: string, src: string, parBinding: Map<string, string>, resolveurs?: Set<string>): string[];
export function fichiersSources(): string[];
export function fichiersDuSeam(): Set<string>;
