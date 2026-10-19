import type { SourceFile } from 'typescript/unstable/ast';
export const SCAN_DIRS: string[];
export function scanClesDeStockage(relPath: string, contenu: string, sourceFile?: SourceFile): { line: number; cle: string }[];
