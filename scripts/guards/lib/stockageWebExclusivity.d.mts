export interface AccesStockageWeb {
  line: number;
  forme: string;
}
export const STOCKAGES_WEB: readonly string[];
export const STOCKAGE_WEB_RX: RegExp;
export const SCAN_DIRS: string[];
export const PROPRIETAIRE: string;
export function scanStockageWeb(relPath: string, contenu: string): AccesStockageWeb[];
export const CLE_DE_STOCKAGE_RX: RegExp;
export function scanClesDeStockage(relPath: string, contenu: string): { line: number; cle: string }[];
