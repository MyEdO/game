export interface Finding {
  line: number;
  detail: string;
}

export const SYNTH_RX: RegExp;
export const LECTURE_RX: RegExp;
export function scanArmurePortee(relPath: string, contenu: string): Finding[];
