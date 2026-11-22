// Types des jeux paramétrés du lot des recettes : mêmes signatures que lot-de-recettes.mjs.

export interface JeuParametre { parcours: string; args: string[]; dossier: string; journal: string }

export const JEUX_PARAMETRES: Record<string, (parametres: string) => JeuParametre | null>;
