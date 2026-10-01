export interface Generateur {
  runner: 'node' | 'tsx';
  script: string;
  targets: readonly string[];
  injecte?: readonly string[];
}
export const GENERATORS: readonly Generateur[];
export function estCiblePure(chemin: string, generateurs: readonly Generateur[]): boolean;
export function renduDe(g: Generateur): Promise<Map<string, string>>;
export function rendreCible(cible: string): Promise<string>;
