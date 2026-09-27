export interface FormeDocument { indent: number; nl: boolean }
export function migrationsDatees(dossier: string): string[];
export const CLASSES: string[];
export function reconnaisseurDeRef(racine: string): (texte: string) => boolean;
export const SANS_CROISSANCE: Record<string, string>;
export const FORME_DATA: FormeDocument;
export const FORME_PROJET: FormeDocument;
export const serialise: (doc: unknown, forme: FormeDocument) => string;
export const SUFFIXE: string;
export function croitre(liste: unknown): { id: string } | null;
export function croitreDocuments(racine: string): { faits: string[]; sautes: string[] };
export function lignesDeRefus(sortie: string): { texte: string; surplomb: string }[];
export function refusSansReference(sortie: string, porteRef: (texte: string) => boolean): string[];
export function rejouerEnCroissance(params: { racine: string; ecrire?: (ligne: string) => void }): {
  rouges: string[];
  exemptes: string[];
  lignes: string[];
};
