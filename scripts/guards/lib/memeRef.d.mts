export interface Finding {
  line: number;
  detail: string;
}

export const MEME_SPEC_RX: RegExp;
export const MEME_ID_SPEC_RX: RegExp;
export function scanMemeRef(contenu: string): Finding[];
