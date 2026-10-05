export interface SiteDeRecopie {
  line: number;
  forme: string;
  valeurs: string[];
}

export interface ExemptionDeSite {
  fichier: string;
  ligne: number;
  forme: string;
  raison: string;
  date: string;
}

export const SITE_EXEMPTIONS: ExemptionDeSite[];

export const SCAN_DIRS: string[];
export const SCAN_EXTS: string[];
export const SEUIL: number;

export function estExclu(rel: string): boolean;
export function identitesDe(registre: { id?: string; abbr?: string }[]): Map<string, string>;
export function identitesReelles(): Map<string, string>;
export function scanLivresRecopies(relPath: string, contenu: string, identites?: Map<string, string>, sourceFile?: SourceFile): SiteDeRecopie[];
import type { SourceFile } from 'typescript/unstable/ast';
