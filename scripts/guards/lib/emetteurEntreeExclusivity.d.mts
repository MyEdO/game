import type { SourceFile } from 'typescript/unstable/ast';
export const EMETTEUR_BRUT: string;
export const EMETTEUR_BRUT_RX: RegExp;
export const SCAN_DIRS: string[];
export const PROPRIETAIRE: string;
export const EMETTEURS: readonly string[];
export function scanEmetteurBrut(relPath: string, contenu: string, sourceFile?: SourceFile): { line: number; dans: string }[];
