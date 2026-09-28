import type { Echeance, EntreeDeSite, Site } from './stock.mjs';
import type { RegenerationDeStock } from './stockDeSites.mjs';

export interface BlindRef extends Site {
  row: number;
  abbr: string;
  nn: string;
  lo: number;
  hi: number;
}

export interface SiteExemption extends Site {
  row: number;
  raison: string;
  date: string;
}

export interface EmptyLineRef {
  ref: string;
  sites: number;
  blind: number;
  files: Set<string>;
}

export const SRC_DIR: string;
export const EXCLUDE_SRC_PREFIX: string;
export const WINDOW: number;
export const MIN_WORD_LEN: number;
export const STEM_LEN: number;
export const SELF_FILES: string[];
export const SITE_EXEMPTIONS: SiteExemption[];
export const STOCK_NOM: string;
export const STOCK_PATH: URL;

export function chapterFile(abbr: string, nn: string, range?: { from: string; to?: string }):
  { path: string; file: string; dir: string; text?: string } | null;
export function readText(path: string): string;
export function alternationDuRegistre(): string;
export const REGISTRE_LIVRES: { id: string; abbr?: string; dir?: string; language?: string }[];
type LivreDuRegistre = (typeof REGISTRE_LIVRES)[number];
export { estLivreExtrait } from '../../../src/data/source/livre-extrait.ts';
export function livreExtraitDe(id: string, registre?: LivreDuRegistre[]): (LivreDuRegistre & { abbr: string; dir: string }) | null;
export function sigleDe(id: string, registre?: LivreDuRegistre[]): string | null;

export function significantWords(text: string, minLen?: number): Set<string>;
export function sharesSignificantWord(a: string, b: string, minLen?: number): boolean;
export function windowText(lines: string[], lo: number, hi: number, w?: number): string;
export function isBlindRef(
  chapterLines: string[], lo: number, hi: number, contextText: string, w?: number, minLen?: number,
): boolean;
export function refsInLine(ln: string): Generator<{ abbr: string; nn: string; lo: number; hi: number; ref: string }>;
export function isExcludedSrc(rel: string): boolean;
export function scanBlindRefs(srcDir?: string): BlindRef[];
export function scanEmptyLineRefs(srcDir?: string): EmptyLineRef[];
export function sitesAveugles(blind: BlindRef[]): Site[];
export function ecartDesRefsAveugles(
  blind: BlindRef[], stock: (EntreeDeSite & Partial<Echeance>)[],
): { neuves: string[]; perimees: string[] };
export function ecartDuVolet(p: {
  sites: Site[]; stock: (EntreeDeSite & Partial<Echeance>)[]; ou?: string;
}): { neuves: string[]; perimees: string[] };
export function lireEntreesDeSite(path: URL | string): (EntreeDeSite & Partial<Echeance>)[];
export function regenerations(blind?: BlindRef[]): RegenerationDeStock[];
