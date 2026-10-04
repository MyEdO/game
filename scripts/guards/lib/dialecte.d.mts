import type * as TS from 'typescript/unstable/ast';
import type { Diagnostic } from 'typescript/unstable/sync';
export interface FichierSource { rel: string; text: string }
export interface OptionsDialecte { inconnu?: 'TS' | 'refus' }
export interface AnalyseSyntaxique { fichier: FichierSource; sourceFile: TS.SourceFile | null; diagnostics: readonly Diagnostic[] }
export const typescript: () => typeof TS;
export function scriptKindDe(fichier: string, options?: OptionsDialecte): TS.ScriptKind | null;
export function analyserCorpus(fichiers: Iterable<FichierSource>, options?: OptionsDialecte): Generator<AnalyseSyntaxique>;
export function analyserTexte(fichier: FichierSource, options?: OptionsDialecte): AnalyseSyntaxique;
export function ast(fichier: FichierSource, options?: OptionsDialecte): TS.SourceFile | null;
