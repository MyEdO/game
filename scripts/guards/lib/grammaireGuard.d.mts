/** Une forme de la grammaire re-tapée, ou une porte étendue, à un site précis. */
export interface TrouvailleGrammaire {
  ligne: number;
  /** Const (ou fonction) porteuse du site ; `<anonyme>` si le littéral n'en a pas. */
  symbole: string;
  /** Chemin des clés d'objet traversées jusqu'au littéral (`''` = le littéral racine du symbole). */
  champ: string;
  motif: 'redeclaration' | 'alias' | 'extend';
  detail: string;
}

/** Règles du scan — dérivées des SCHÉMAS par l'appelant, jamais recopiées dans la mécanique. */
export interface ReglesGrammaire {
  signatures: readonly { nom: string; cles: readonly string[] }[];
  alias: readonly string[];
  /** Le fichier est une FABRIQUE de la grammaire : seul `.extend` y est scanné. */
  sansRedeclaration?: boolean;
}

export function scan(rel: string, contenu: string, regles: ReglesGrammaire, sourceFile?: SourceFile): TrouvailleGrammaire[];
import type { SourceFile } from 'typescript/unstable/ast';
