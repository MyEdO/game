import type { Checker } from 'typescript/unstable/sync';
export interface Finding {
  line: number;
  detail: string;
  /** Présent seulement en mode `includeExcluded` : la forme qui a écarté ce site (#1426). */
  excludedBy?: 'S' | 'M';
}

export const ROLL_SEAM_RX: RegExp;
export function scanRollSeamExclusivity(
  relPath: string,
  contenu: string,
  opts?: { includeExcluded?: boolean },
  sourceFile?: SourceFile,
): Finding[];

/** Registre des chemins de jet (#1066) — famille (F) « fabrication d'un pending de jet ». */
export const PENDING_JET_RX: RegExp;
export function scanPendingJetFabrication(relPath: string, contenu: string, sourceFile?: SourceFile): Finding[];

/** Registre des chemins de jet (#1066) — famille (D) « roulage délégué à un export de src/engine ». */
export function engineRollerExports(
  engineFiles: { rel: string; text: string }[],
  amorce?: readonly string[],
): Map<string, { file: string; line: number }>;
export function engineHomonyms(
  engineFiles: { rel: string; text: string }[],
): Map<string, { files: string[]; rollsDirectly: boolean }>;
export function scanEngineDelegatedRoll(
  relPath: string,
  contenu: string,
  table: Readonly<Record<string, readonly string[]>>,
  sourceFile?: SourceFile,
  checker?: Checker,
): { line: number; name: string }[];

/** Garde SŒUR (#1508) — famille (X) « tout dé tiré hors porte » : le SITE OÙ LE DÉ TOMBE. */
export const AMORCE_TEST: readonly string[];
export const AMORCE_DES: readonly string[];
export const DES_HORS_PORTE_RX: RegExp;
export function engineDiceRollers(
  engineFiles: { rel: string; text: string }[],
): Readonly<Record<string, readonly string[]>>;
export function scanDesHorsPorte(
  relPath: string,
  contenu: string,
  table: Readonly<Record<string, readonly string[]>>,
  sourceFile?: SourceFile,
  checker?: Checker,
): { line: number; name: string }[];
import type { SourceFile } from 'typescript/unstable/ast';
