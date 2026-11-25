// Types de la construction de l'hôte Godot : mêmes signatures que construire.mjs.

export function lireOptions(argv: readonly string[]):
  | { options: { mode: string | null; sortie: string | null; entree: string | undefined; rendus: string[] }; erreur?: undefined }
  | { erreur: string; options?: undefined };

export function empaqueter(sortie: string | null, mode: 'production' | 'development'): Promise<{ code: string; modules: string[] }>;

export function lecturesDuBundle(code: string): Record<string, number>;

export function empaqueterLeProcessus(sortie: string): Promise<{ chemin: string; modules: string[] }>;

export function piloter(options: {
  args: string[];
  env: Record<string, string>;
  rendu?: string;
  lance: (tuer: () => void) => void;
  encore: () => boolean;
  planches?: string;
  fenetre: { largeur: number; hauteur: number };
}): Promise<{ lignes: string[]; erreurs: string[] }>;

export function signaturesDu(dossier: string): Record<string, string>;

export function ecartsDeLaCopie(avant: Readonly<Record<string, string>>, apres: Readonly<Record<string, string>>): { copier: string[]; retirer: string[] };

export function erreursDeLaRecette(recette: string, source: string, lignes: readonly string[]): string[];

export function fichiersAuDelaDeGitHub(dossier: string): { fichier: string; taille: number }[];
