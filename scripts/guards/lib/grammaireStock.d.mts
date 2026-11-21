import type { Echeance } from './stock.mjs';

export const GRAMMAIRE_STOCK: Readonly<Record<string, Echeance & { raison: string }>>;
