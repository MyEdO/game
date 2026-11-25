export const PROJETS_LIVRES: { readonly dossier: string; readonly suffixe: string; readonly recursif: boolean };
export function estManuscrit(rel: string, racine?: string): boolean;
export function dossierDesProjetsLivres(racine?: string): string;
export function listerProjetsLivres(racine?: string): string[];
export function cheminsDuCorpus(corpus: { readonly dossier: string; readonly suffixe: string; readonly recursif: boolean }, racine?: string): string[];
export function cheminsDesProjetsLivres(racine?: string): string[];
