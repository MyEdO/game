export interface ProgrammerHorsDesSites {
  line: number;
  fonction: string | null;
  appele: string;
}
export function programmerHorsDesSites(rel: string, texte: string, sites: ReadonlyMap<string, { corpsAppelle?: string }>): ProgrammerHorsDesSites[];
