export interface FolioRange {
  lo: number;
  hi: number | null;
  file: string;
}

export type FolioVerdict =
  | 'folio-ok'
  | 'folio-ment'
  | 'folio-impossible'
  | 'desc-introuvable'
  | 'livre-hors-atlas'
  | 'desc-trop-courte'
  | 'sans-marqueur';

export interface FolioViolation {
  key: string;
  file: string;
  id: string;
  book: string;
  page: number;
  voie: 'encadrement' | 'hors-livre';
  ranges: FolioRange[];
  max: number | null;
}

export interface FolioMulti {
  key: string;
  page: number;
  ranges: FolioRange[];
}

export type TitleVerdict =
  | 'titre-ok'
  | 'titre-ment'
  | 'titre-page-attestee'
  | 'titre-homonyme-lointain'
  | 'titre-introuvable'
  | 'titre-sans-marqueur'
  | 'titre-trop-court'
  | 'livre-hors-atlas';

export interface TitleViolation {
  key: string;
  file: string;
  id: string;
  book: string;
  page: number;
  ecart: number;
  proche: FolioRange | null;
  ranges: FolioRange[];
}

export interface NoteAuthoredEntry {
  key: string;
  file: string;
  page: number;
  note: string;
  proche: FolioRange | null;
}

export interface UnresolvedEntry {
  key: string;
  file: string;
  page: number;
  descVerdict: string;
  titreVerdict: string;
}

export const MIN_DESC: number;
export const MIN_TITLE: number;
export const MAX_ECART_TITRE: number;
export const OPEN: null;

export function normMap(s: string): { text: string; idx: number[] };
export function bookDocs(abbr: string): {
  file: string;
  text: string;
  idx: number[];
  folios: [number, number][];
  heads: [number, string][];
}[];
export function marqueursDeFolio(raw: string): [number, number][];
export function bookMaxFolio(abbr: string): number;
export function folioRange(folios: [number, number][], a: number, b: number): { lo: number; hi: number | null } | null;
export function normHeading(title: string): string;
export function preMarkerRange(docs: { folios: [number, number][] }[], i: number): { lo: number; hi: number } | null;
export function pageSlices(abbr: string, page: number): { file: string; text: string }[];
export function labelSurLaPage(book: string, page: number, label: string | undefined): string | null;
export function auditFolio(entry: { book: string; page: number; desc: string }): {
  verdict: FolioVerdict;
  ranges?: FolioRange[];
  max?: number;
};
export function auditFolioByTitle(entry: { book: string; page: number; label: string | undefined }): {
  verdict: TitleVerdict;
  ranges?: FolioRange[];
  ecart?: number;
  proche?: FolioRange;
  atteste?: string;
};
export function citedEntriesOf(
  data: unknown,
): { id: string; book: string; page: number; desc: string; label: string | undefined; note: string | undefined }[];
export function auditFolios(dataDir: string): {
  violations: FolioViolation[];
  titleViolations: TitleViolation[];
  noteAuthored: NoteAuthoredEntry[];
  unresolved: UnresolvedEntry[];
  stats: Record<string, number>;
  total: number;
  multi: FolioMulti[];
};
export function renderStock(violations: FolioViolation[], entete: string): string;
export function renderTitleStock(violations: TitleViolation[], entete: string): string;

export interface SecondaryEntry {
  key: string;
  book: string;
  page: number;
  label: string | undefined;
  quote: string | undefined;
}

export type SecondaryVerdict = 'attesté' | 'non-attesté' | 'folio-impossible' | 'livre-hors-atlas';

export function secondaryEntriesOf(data: unknown): SecondaryEntry[];
export function auditSecondaryRef(entry: {
  book: string;
  page: number;
  label: string | undefined;
  quote: string | undefined;
}): { verdict: SecondaryVerdict; via?: 'label' | 'quote'; max?: number };
export function auditSecondaries(dataDir: string): {
  violations: {
    key: string;
    file: string;
    book: string;
    page: number;
    verdict: 'non-attesté' | 'folio-impossible';
    max?: number;
  }[];
  total: number;
};
