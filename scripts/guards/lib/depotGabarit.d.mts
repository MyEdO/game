export type ParamsDepot = {
  fichiers?: Record<string, string>;
  branche?: string;
  origin?: string | null;
  message?: string;
  refs?: Record<string, string>;
  commit?: boolean;
};
export type Depot = { racine: string; sha: string | null };
export function envDeDepotForge(): NodeJS.ProcessEnv;
export function gabaritDeDepot(params?: ParamsDepot): Depot;
export function instanceDeDepot(params?: ParamsDepot): Depot;
export function forgerDepot(racine: string, p?: { branche?: string }): import('./gitPorte.mjs').Depot;
