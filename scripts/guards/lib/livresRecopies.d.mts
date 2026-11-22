export interface SiteDeRecopie {
  line: number;
  forme: string;
  valeurs: string[];
}

export interface ExemptionDeSite {
  fichier: string;
  ancre: string;
  empreinte: string;
  forme: string;
  raison: string;
  date: string;
}

export const SITE_EXEMPTIONS: ExemptionDeSite[];

export const SCAN_DIRS: string[];
export const SEUIL: number;

export function estExclu(rel: string): boolean;
export function identitesDe(registre: { id?: string; abbr?: string }[]): Map<string, string>;
export function identitesReelles(): Map<string, string>;
export function analyserLivresRecopies(
  relPath: string, contenu: string, identites?: Map<string, string>, sourceFile?: SourceFile,
): { fautes: SiteDeRecopie[]; perimees: ExemptionDeSite[]; ambigues: ExemptionDeSite[] };
export function scanLivresRecopies(relPath: string, contenu: string, identites?: Map<string, string>, sourceFile?: SourceFile): SiteDeRecopie[];
import type { SourceFile } from 'typescript/unstable/ast';
