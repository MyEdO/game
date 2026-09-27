export interface Finding {
  line: number;
  detail: string;
}

export const COMPARATEUR_DE_REF: string;
export const MEME_SPEC_RX: RegExp;
export const MEME_ID_SPEC_RX: RegExp;
export const FILTRE_PAR_ID_RX: RegExp;
export function scanMemeRef(contenu: string): Finding[];
