export interface Finding {
  line: number;
  detail: string;
}

export const MUTATING_ARRAY_METHODS: Set<string>;
export function scanSceneMutation(relPath: string, contenu: string, sourceFile?: SourceFile): Finding[];
import type { SourceFile } from 'typescript/unstable/ast';
