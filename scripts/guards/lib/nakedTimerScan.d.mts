export interface NakedTimerFinding {
  line: number;
  call: string;
}
export function scanNakedTimers(content: string): NakedTimerFinding[];
export const SCAN_DIRS: string[];
export const ALLOWED: string[];
