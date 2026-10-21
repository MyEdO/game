/** La ligne d'une zone de `COUCHES` : son dossier, ce qu'elle importe librement (`'*'` : toutes), ce qu'elle ne lit
 *  qu'en type, et ses portes. */
export interface Couche {
  /** Le dossier de la zone, relatif à la racine du dépôt ; `src/<zone>` sans lui. */
  readonly dossier?: string;
  readonly importe: readonly string[] | '*';
  readonly types?: readonly string[];
  /** Pour une zone importée, le seul module qu'elle en lit (chemin relatif à la racine). */
  readonly portes?: Readonly<Record<string, string>>;
}

/** La surface du noyau : porte de `noyau`, entrée de la fermeture, seul module de `src/noyau/` qui réexporte. */
export const SURFACE_DU_NOYAU: "src/noyau/index.ts";

/** Les zones du dépôt et leurs sens d'import (#2882, #2928). */
export const COUCHES: Readonly<Record<string, Couche>>;

/** Le dossier de la zone `z`, relatif à la racine du dépôt. */
export function dossierDe(z: string): string;

/** Les dossiers de premier niveau du dépôt qui portent une zone. */
export const RACINES_DES_ZONES: readonly string[];
export const RACINES_PRESENTES: readonly string[];

/** Les hôtes du noyau : les zones qui ne lisent le noyau que par sa porte. */
export const HOTES_DU_NOYAU: readonly string[];

/** La zone d'un chemin relatif à la racine du dépôt, `null` hors des zones ; sous `src/`, un sous-dossier sans ligne
 *  rend son dossier (`src/<segment>`), qui n'est jamais une zone. */
export function zoneDe(rel: string): string | null;

/** Le verdict d'un arc de la zone `de` vers la zone `vers` : `null` s'il est ouvert, sinon ce qui le
 *  ferme — `'execution'` (un type passerait) ou `'type'` (fermé même pour un type). */
export function fermeture(de: string, vers: string, typeSeul: boolean): null | 'execution' | 'type';

/** `z` est-il une zone de la table ? Clé PROPRE seulement. */
export function estZone(z: unknown): z is string;

/** Les zones que `de` importe librement, et celles qu'elle ne lit qu'en type. */
export function ouvertes(de: string): { libres: string[]; enType: string[] };

/** La porte que la zone `de` impose vers `vers` et que l'arc vers `cibleRel` manque, `null` sinon. */
export function porteManquee(de: string, vers: string, cibleRel: string): string | null;
