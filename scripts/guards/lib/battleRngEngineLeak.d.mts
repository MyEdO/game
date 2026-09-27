import type { SourceFile } from 'typescript';

export interface EngineLeakFinding {
  line: number;
  name: string;
  detail: string;
}

export function collectEngineImportNames(contenu: string): string[];
/** Contexte d'un passage de scan : AST des modules moteur et décisions, tenus par l'appelant. */
export interface ContexteDeScanRng {
  sources: Map<string, SourceFile>;
  decisions: Map<string, boolean>;
}
export function contexteDeScanRng(): ContexteDeScanRng;
export function scanBattleRngEngineLeak(relPath: string, contenu: string, ctx?: ContexteDeScanRng): EngineLeakFinding[];
