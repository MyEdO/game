export interface Comment {
  text: string;
  line: number;
}

export interface Finding {
  line: number;
  detail: string;
}

export function extractComments(src: string): Comment[];
export function codeSeul(src: string): string;
export function matchLine(comment: Comment, matchIndex: number): number;
export function excerptAt(comment: Comment, matchIndex: number): string;

/** Périmètre des gardes : source unique des trois portes anti-poison et de `corpusDesGardes`. */
export const PERIMETRE_DES_GARDES: Readonly<{
  racines: readonly string[];
  extensions: readonly string[];
  tests: boolean;
}>;
/** Le corpus du périmètre des gardes (`readCorpus`, mémoïsé). */
export function corpusDesGardes(): readonly import('./sourceCorpus.mjs').CorpusFile[];
export function estFichierScanne(cheminRelatifOuAbsolu: string): boolean;
/** L'ensemble `ART` : les fichiers de l'art du rig, par dossier. */
export function estArtDuRig(rel: string): boolean;

export const TOMBSTONE_FAMILIES: { rx: RegExp; label: string }[];
export function tombstonesIn(text: string): string[];
export function scanTombstones(relPath: string, contenu: string): Finding[];

export const LEGACY_VOCAB_FAMILIES: { rx: RegExp; label: string; domaine?: (rel: string) => boolean }[];
export const LEGACY_VOCAB_EXCLUSIONS: { rx: RegExp; label: string }[];
export function legacyVocabIn(text: string, relPath: string): string[];
export function scanLegacyVocab(relPath: string, contenu: string): Finding[];
export function scanLegacyVocabHorsStock(relPath: string, contenu: string): Finding[];

export const EXCUSE_GUARD_ACTIVE: boolean;
export const EXCUSE_RX: RegExp;
export const RAW_CLAIM_FAMILIES: { rx: RegExp; label: string }[];
export const DECISION_CLAIM_FAMILIES: { rx: RegExp; label: string }[];
export const DECISION_TRACE_RX: RegExp;
export function scanDecisionClaims(relPath: string, contenu: string): Finding[];
export const BOOK_REF_RX: RegExp;
export function scanRawClaims(relPath: string, contenu: string): Finding[];
export const ENTERINE_TAG_RX: RegExp;
export function untaggedExcuseMatch(text: string): RegExpExecArray | null;
export function scanExcuses(relPath: string, contenu: string): Finding[];

export interface BaselineEntry {
  fichier: string;
  motif: string;
  ancre: string;
  raison: string;
  date: string;
}
export interface PlacedFinding {
  file: string;
  line: number;
  detail: string;
}
export interface BaselineVerdict {
  nouveaux: PlacedFinding[];
  connus: { finding: PlacedFinding; entry: BaselineEntry }[];
  perimees: BaselineEntry[];
}
export const DECISIONS_BASELINE_PATH: string;
export function loadDecisionsBaseline(path?: string): BaselineEntry[];
export function decisionsBaselineDe(texte: string | null): BaselineEntry[];
export function matchesBaselineEntry(finding: PlacedFinding, entry: BaselineEntry): boolean;
export function partitionBaseline(
  findings: PlacedFinding[],
  baseline: BaselineEntry[],
  scannedFiles?: Iterable<string>,
): BaselineVerdict;
export function formatBaselineReport(verdict: BaselineVerdict): string[];
