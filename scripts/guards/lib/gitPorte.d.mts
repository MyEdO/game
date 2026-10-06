/** Déclarations des questions git consommées depuis TypeScript (`cssCouchesAudit.ts`, `horsStrateAudit.ts`, `cssImages.d.mts`, `regenStock.mts`). */

/** La marque d'une poignée `depotDe` (`gitPorte.mjs`, `MARQUE_DEPOT`). */
declare const MARQUE_DEPOT: unique symbol;

/** Le DÉPÔT git d'un `cwd` (`depotDe`) : une poignée opaque et MARQUÉE, premier paramètre de chaque
 *  question ; un `{ cwd }` écrit à la main n'en est pas une. */
export type Depot = Readonly<{ cwd: string; [MARQUE_DEPOT]: true }>;

export type DiagnosticGit = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
  signal?: string;
};
export type EchecGit = {
  disponible: false;
  raison: string;
  issue: 'refus' | 'lancement' | 'interruption' | 'mesure';
  diagnostic?: DiagnosticGit;
};
export type ResultatGit<T = DiagnosticGit> =
  | { disponible: true; valeur: T }
  | { disponible: true; absent: true; diagnostic?: DiagnosticGit }
  | EchecGit;
export function fait<T>(valeur: T): { disponible: true; valeur: T };
export function indisponible(raison: string, details?: Partial<Pick<EchecGit, 'issue' | 'diagnostic'>>): EchecGit;
export function classer(
  vu: Partial<DiagnosticGit> | null | undefined,
  opts?: { cwd?: string; nature?: (chemin: string) => 'repertoire' | 'fichier' | 'absent' },
): ResultatGit;
export class GitIndisponible extends Error {
  constructor(cause: string | EchecGit);
  raison: string;
  issue: EchecGit['issue'];
  diagnostic?: DiagnosticGit;
}
export function reussi(union: ResultatGit): boolean;
export function refusDeGit(vu: ResultatGit | GitIndisponible): string;
export function pousser(depot: Depot, geste: { vers: string; bail?: boolean }): ResultatGit;
export function fetchOrigin(depot: Depot, opts?: { branche?: string }): ResultatGit;

/** Le dépôt git de `cwd`. */
export function depotDe(
  cwd: string,
  opts?: {
    env?: NodeJS.ProcessEnv | (() => NodeJS.ProcessEnv);
    spawn?: typeof import('node:child_process').spawnSync;
    attendre?: (ms: number) => void;
    enPanne?: (raison: string, vu: EchecGit) => void;
  },
): Depot;
/** La racine de l'arbre de travail, `null` hors d'un arbre. */
export function racineDe(depot: Depot): string | null;
/** La valeur de l'attribut `nom` sur `chemin` (`check-attr`), `null` si git ne répond pas. */
export function attributDe(depot: Depot, chemin: string, nom: string): string | null;
export const INDEX: string;
export const SUIVI: string;
export const TRAVAIL: string;
