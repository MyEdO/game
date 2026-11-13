// Types des avis de licence d'une fabrication : mêmes signatures que avis.mjs.

export const AVIS: string;

export type Avis = { oeuvre: string; fichier: string; source: string; texte: string | null };

export type AvisDuMoteur = {
  texte: string;
  composants: { name: string; parts: { files: string[]; copyright: string[]; license: string }[] }[];
  licences: Record<string, string>;
};

export function avisDesPaquets(modules: readonly string[]): Avis[];

export function avisDeNode(executable: string, licence: string, version: string): Avis;

export function avisDesAssets(projet: string): Avis[];

export function avisDeGodot(moteur: AvisDuMoteur | null): Avis;

export function deposerLesAvis(sortie: string, liste: readonly Avis[]): string[];
