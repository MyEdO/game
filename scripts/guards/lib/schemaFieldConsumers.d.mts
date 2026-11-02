export function champsDeclares(schema: unknown): string[][];
export function mesurerChampsDeSchema(root: string, options?: { definitions?: readonly { file: string; schema: unknown }[]; programme?: unknown; fichiers?: string[] }): { absents: string[]; datasets: { file: string; declares: number; absents: number }[]; chargementsNonResolus: string[] };
