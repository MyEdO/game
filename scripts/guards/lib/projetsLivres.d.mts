export const PROJETS_LIVRES: { readonly dossier: string; readonly suffixe: string; readonly recursif: boolean };
export const PROJETS_MANUSCRITS: Readonly<Record<string, string>>;
export function dossierDesProjetsLivres(racine?: string): string;
export function listerProjetsLivres(racine?: string): string[];
