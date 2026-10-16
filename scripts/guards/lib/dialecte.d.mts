import type * as TS from 'typescript/unstable/ast';
import type { Diagnostic, Checker } from 'typescript/unstable/sync';
export interface FichierSource { rel: string; text: string }
export interface OptionsDialecte { inconnu?: 'TS' | 'refus' }
export interface AnalyseSyntaxique { fichier: FichierSource; sourceFile: TS.SourceFile | null; diagnostics: readonly Diagnostic[] }
export type AnalyseEmpruntee = AnalyseSyntaxique & ({ sourceFile: TS.SourceFile; checker: Checker } | { sourceFile: null; checker?: never });
export const typescript: () => typeof TS;
export function scriptKindDe(fichier: string, options?: OptionsDialecte): TS.ScriptKind | null;
export function analyserCorpus(fichiers: Iterable<FichierSource>, options?: OptionsDialecte): Generator<AnalyseEmpruntee>;
export function avecAnalyse<T>(fichier: FichierSource, sourceFile: TS.SourceFile | null | undefined, checker: Checker | undefined, fn: (sourceFile: TS.SourceFile, checker: Checker | undefined) => T): T;
export function analyserTexte(fichier: FichierSource, options?: OptionsDialecte): AnalyseSyntaxique;
export function ast(fichier: FichierSource, options?: OptionsDialecte): TS.SourceFile | null;
export function declarationQuiPorte(sf: TS.SourceFile, ligne: number): string;
export function cleDeContenu(rel: string, texte: string, ligne: number): string;
export function lignesDuContenu(rel: string, texte: string, cle: string): number[];
