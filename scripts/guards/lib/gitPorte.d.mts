/** Déclarations des questions git consommées depuis TypeScript (`cssCouchesAudit.ts`, `horsStrateAudit.ts`, `cssImages.d.mts`, `regenStock.mts`). */

/** La marque d'une poignée `depotDe` (`gitPorte.mjs`, `MARQUE_DEPOT`). */
declare const MARQUE_DEPOT: unique symbol;

/** Le DÉPÔT git d'un `cwd` (`depotDe`) : une poignée opaque et MARQUÉE, premier paramètre de chaque
 *  question ; un `{ cwd }` écrit à la main n'en est pas une. */
export type Depot = Readonly<{ cwd: string; [MARQUE_DEPOT]: true }>;

/** Le dépôt git de `cwd`. */
export function depotDe(
  cwd: string,
  opts?: { env?: NodeJS.ProcessEnv | (() => NodeJS.ProcessEnv); enPanne?: (raison: string) => void },
): Depot;
/** La racine de l'arbre de travail, `null` hors d'un arbre. */
export function racineDe(depot: Depot): string | null;
/** La valeur de l'attribut `nom` sur `chemin` (`check-attr`), `null` si git ne répond pas. */
export function attributDe(depot: Depot, chemin: string, nom: string): string | null;
export const INDEX: string;
export const SUIVI: string;
export const TRAVAIL: string;
