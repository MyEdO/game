export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const PARTY_RX: RegExp;
export const HORS_ACTION_RX: RegExp;
export const WOUNDS_CMP_RX: RegExp;
export const FENETRE: number;
export function aplatir(contenu: string): { plat: string; ligneDe: (i: number) => number };
export function fenetreDInstruction(plat: string, i: number): string;
export function scanHeroDebout(relPath: string, contenu: string): Finding[];
