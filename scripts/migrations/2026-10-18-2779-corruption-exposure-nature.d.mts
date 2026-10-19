export const FICHIERS: Readonly<Record<string, { indent: number; fin: string }>>;
export const NATURE_DE: Readonly<{ resistance: 'physique'; calme: 'spirituelle' }>;
export function migrerDocument(doc: unknown): { doc: unknown; gestes: number; echecs: string[] };
