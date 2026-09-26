export interface LineCitation {
  abbr: string;
  chapter: number;
  line: number;
}

export interface CitedEntry {
  file: string;
  id: string;
  book: string;
  page: number;
  cite: string;
}

export interface AlignViolation {
  key: string;
  file: string;
  id: string;
  cite: string;
  page: number;
  folio: number;
}

export type FolioReason = 'ok' | 'span-a-trou' | 'queue-trouee' | 'sans-ancre' | 'chapitre-absent';

export interface IgnoredEntry {
  key: string;
  file: string;
  id: string;
  cite: string;
  page: number;
  reason: FolioReason | 'hors-forme';
}

export interface AlignReport {
  scanned: number;
  violations: AlignViolation[];
  ignored: IgnoredEntry[];
}

export function parseLineCitation(cite: unknown): LineCitation | null;
export function folioAnchors(lines: string[]): number[];
export function anchorsAt(lines: string[]): { folio: number; line: number }[];
export function folioGoverningWhy(
  chapterLines: (ch: number) => string[] | null,
  chapter: number,
  line: number,
): { folio: number | null; reason: FolioReason };
export function folioGoverning(
  chapterLines: (ch: number) => string[] | null,
  chapter: number,
  line: number,
): number | null;
export function citedEntries(data: unknown, file: string): CitedEntry[];
export function auditAlignment(
  entries: CitedEntry[],
  abbrOf: (bookId: string) => string | undefined,
  chapterLines: (abbr: string, ch: number) => string[] | null,
): AlignReport;
export function makeChapterReader(
  books: { abbr: string; dir?: string }[],
): (abbr: string, ch: number) => string[] | null;
export function auditDataDir(dataDir: string): AlignReport;
