export interface Finding {
  line: number;
  detail: string;
}

export function scanAjoutRangee(relPath: string, contenu: string): Finding[];
