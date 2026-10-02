export const FORBIDDEN_SOURCES: string[];
export interface NavalImportFinding {
  line: number;
  source: string;
}
export function scanBatchNavalQuarantine(fichier: string, contenu: string): NavalImportFinding[];
