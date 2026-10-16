export interface NamedImportFinding {
  line: number;
  symbol: string;
  source: string;
}
export function scanNamedImport(contenu: string, symbol: string): NamedImportFinding[];
export const RAW_SYMBOL: string;
export const RAW_ALLOWED: string[];
export const CHANNEL_SYMBOL: string;
export const CHANNEL_ALLOWED: string[];
export const PRECIP_SYMBOL: string;
export const PRECIP_ALLOWED: string[];
