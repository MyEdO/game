import type * as TS from 'typescript';

/** Le compilateur TypeScript du dépôt, chargé au PREMIER appel. */
export const typescript: () => typeof TS;
/** `ts.ScriptKind` du fichier, d'après sa seule extension (contrat : `dialecte.mjs`). */
export function scriptKindDe(fichier: string, options?: { inconnu?: 'TS' | 'refus' }): TS.ScriptKind | null;
/** Arbre syntaxique d'un fichier lu, dans le dialecte de son extension (contrat : `dialecte.mjs`). */
export function ast(fichier: { rel: string; text: string }, options?: { inconnu?: 'TS' | 'refus' }): TS.SourceFile | null;
