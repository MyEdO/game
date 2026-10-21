/** La ligne d'une zone de `COUCHES` : ce qu'elle importe librement (`'*'` : toutes), ce qu'elle ne lit
 *  qu'en type, et ses arêtes transitoires (arcs de type) avec la sous-issue qui les retire. */
export interface Couche {
  readonly importe: readonly string[] | '*';
  readonly types?: readonly string[];
  readonly transitoire?: Readonly<Record<string, { readonly issue: string }>>;
  /** Pour une zone importée, le seul module qu'elle en lit (chemin relatif à la racine). */
  readonly portes?: Readonly<Record<string, string>>;
}

/** La surface du noyau : porte de `noyau`, entrée de la fermeture, seul module de `src/noyau/` qui réexporte. */
export const SURFACE_DU_NOYAU: "src/noyau/index.ts";

/** Les zones de `src/` et leurs sens d'import (#2882). */
export const COUCHES: Readonly<Record<string, Couche>>;

/** Le verdict d'un arc de la zone `de` vers la zone `vers` : `null` s'il est ouvert, sinon ce qui le
 *  ferme — `'execution'` (un type passerait) ou `'type'` (fermé même pour un type). */
export function fermeture(de: string, vers: string, typeSeul: boolean): null | 'execution' | 'type';

/** `z` est-il une zone de la table ? Clé PROPRE seulement. */
export function estZone(z: unknown): z is string;

/** Les zones que `de` importe librement, et celles qu'elle ne lit qu'en type, arêtes transitoires comprises. */
export function ouvertes(de: string): { libres: string[]; enType: string[] };

/** La porte que la zone `de` impose vers `vers` et que l'arc vers `cibleRel` manque, `null` sinon. */
export function porteManquee(de: string, vers: string, cibleRel: string): string | null;
