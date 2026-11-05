import type { SessionProgramme } from './tsProgram.mjs';

export function champsDeclares(schema: unknown): string[][];
export function mesurerChampsDeSchema(root: string, options?: { definitions?: readonly { file: string; schema: unknown }[]; programme?: unknown; fichiers?: string[] }): { absents: string[]; datasets: { file: string; declares: number; absents: number }[]; chargementsNonResolus: string[] };
export function ciblesDeCatalogue(root: string, session: SessionProgramme, files: string[], definitions?: readonly { file: string; schema: unknown }[]): {
  cibles: { type: string; home: string; cles: string[]; files: string[] }[];
  sorties: { file: string; raison: string }[];
};
