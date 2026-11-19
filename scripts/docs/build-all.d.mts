export interface Generateur {
  runner: 'node' | 'tsx';
  script: string;
  targets: readonly string[];
}
export const GENERATORS: readonly Generateur[];
export const LUS_PAR_LES_GENERATEURS: readonly string[];
export function estCiblePure(chemin: string, generateurs: readonly Generateur[]): boolean;
export function renduDe(g: Generateur): Promise<Map<string, string>>;
export function rendreCible(cible: string): Promise<string>;
