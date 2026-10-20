export interface SetScanFileEntry {
  file: string;
  setCalls: number;
  adHocPendingResets: number;
  adHocLines: number[];
}
export interface SetScanResult {
  totalCalls: number;
  totalAdHocResets: number;
  files: SetScanFileEntry[];
}

export function stateFieldKeys(dir: string): Set<string>;
export function extractSetLiteral(text: string, callStart: number): string | null;
export function topLevelKeys(lit: string): string[];
export function scanFile(path: string): { line: number; keys: string[] }[];
export function runSetScan(root: string): SetScanResult;
