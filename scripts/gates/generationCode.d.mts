import type { Generateur } from '../docs/build-all.mjs';
export function argumentsDeGenerationCode(test: boolean, generateurs?: readonly Generateur[]): string[];
export function verdictDeGenerationCode(statut: number | null): 'ok' | 'differe' | 'echec';
