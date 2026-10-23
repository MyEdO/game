export function isCitedItem(item: unknown): boolean;

export interface DatasetCoverage {
  total: number;
  cited: number;
  missing: string[];
  shape: 'array' | 'map-of-lists' | 'single';
}

export function auditDataset(data: unknown): DatasetCoverage;

export const EXEMPT_DATASETS: Record<string, string>;
export function exemptionDeDataset(fichier: string): string | undefined;
