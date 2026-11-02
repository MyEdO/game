// Types de `adresses.mjs` pour ses consommateurs TypeScript (`src/data/**/*.test.ts`) — même
// convention que `scripts/guards/lib/lister.d.mts` : un module ESM JS lu depuis `src` se DÉCLARE,
// il ne se laisse pas tomber en `any`.
/** Un nœud porteur d'adresse, et d'où il vient. */
export interface Adresse {
  /** Chemin POSIX du document, relatif à la racine du dépôt. */
  fichier: string;
  /** Chemin de clés jusqu'au nœud (`[3].effects[0]`). */
  chemin: string;
  /** `id` STABLE de l'entrée porteuse, ou son `chemin` à défaut. */
  id: string;
  /** La valeur BRUTE lue dans le document : le walk ne la valide pas, les consommateurs l'affinent
   *  (le parseur la juge, `resoudreAdresse`). La typer `DescRef` ici serait une promesse sur parole. */
  ref: unknown;
  noeud: Record<string, unknown>;
}

export const RACINE_DEPOT: string;
export function cheminDuDepot(chemin: string): string;
export const RACINES_PAR_DEFAUT: string[];
export function fichiersJsonDe(racineRelative: string, racine?: string): string[];
export function fichiersJson(racines?: string[], racine?: string): string[];
export function adressesDuDepot(racines?: string[], racine?: string): Adresse[];
export function fichiersAdresses(racines?: string[], racine?: string): { fichier: string; adresses: Adresse[] }[];
