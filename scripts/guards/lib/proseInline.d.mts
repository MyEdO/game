/** Descripteur ENTIER d'une racine de documents — aucune clé à résoudre. */
export interface RacineProse {
  readonly dossier: string;
  readonly suffixe: string;
  readonly recursif: boolean;
}

export const RACINE_DEPOT: string;
export const RACINES_PROSE: readonly RacineProse[];
export function estDocumentDeProse(chemin: string, racines?: readonly RacineProse[]): boolean;

export function livresExtraits(): Set<string>;
export function typeDuDocument(doc: unknown, chemin: string): string;
export function mesurerProseInline(
  racines?: readonly RacineProse[],
  root?: string,
): Record<string, { entrees: number; noeuds: string[] }>;
