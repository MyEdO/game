/** La ligne d'une zone de `COUCHES` : ce qu'elle importe librement (`'*'` : toutes), ce qu'elle ne lit
 *  qu'en type, et ses arêtes transitoires avec la sous-issue qui les retire. */
export interface Couche {
  readonly importe: readonly string[] | '*';
  readonly types?: readonly string[];
  readonly transitoire?: Readonly<Record<string, { readonly issue: string; readonly types?: boolean }>>;
}

/** Les zones de `src/` et leurs sens d'import (#2882). */
export const COUCHES: Readonly<Record<string, Couche>>;

/** Le verdict d'un arc de la zone `de` vers la zone `vers` : `null` s'il est ouvert, sinon ce qui le
 *  ferme — `'execution'` (un type passerait) ou `'type'` (fermé même pour un type). */
export function fermeture(de: string, vers: string, typeSeul: boolean): null | 'execution' | 'type';

/** `z` est-il une zone de la table ? Clé PROPRE seulement. */
export function estZone(z: unknown): z is string;

/** Les zones que `de` importe librement, et celles qu'elle ne lit qu'en type, arêtes transitoires comprises. */
export function ouvertes(de: string): { libres: string[]; enType: string[] };
