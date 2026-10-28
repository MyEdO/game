/** La ligne d'une zone de `COUCHES` : son dossier, ce qu'elle importe librement (`'*'` : toutes), ce qu'elle ne lit
 *  qu'en type, ses portes, et si elle survit à la bascule. */
export interface Couche {
  /** Le dossier de la zone, relatif à la racine du dépôt ; `src/<zone>` sans lui. */
  readonly dossier?: string;
  readonly importe: readonly string[] | '*';
  readonly types?: readonly string[];
  /** Pour une zone importée, le seul module qu'elle en lit (chemin relatif à la racine). */
  readonly portes?: Readonly<Record<string, string>>;
  /** La zone survit à la bascule : aucun paquet de l'hôte web (`PAQUETS_DE_L_HOTE_WEB`), même pour un type, aucun JSX,
   *  aucun module hors des zones. */
  readonly survit?: true;
  /** Pour un outillage de la zone (clé : `couvre`), les seuls modules hors des zones qu'il lit (chemins relatifs à la racine). */
  readonly outillage?: Readonly<Record<string, readonly string[]>>;
  /** Pour un outillage de la zone (clé : `couvre`), les seuls paquets de l'hôte web que ses modules chargent ; aucun module de
   *  la zone hors de lui ne l'importe. */
  readonly paquetsDOutillage?: Readonly<Record<string, readonly string[]>>;
}

/** La surface du noyau : porte de `noyau`, seul module de `src/state/` et `src/noyau/` qui réexporte. */
export const SURFACE_DU_NOYAU: "src/noyau/index.ts";

/** Les zones dont la production ne réexporte rien hors de la surface du noyau. */
export const ZONES_SANS_REEXPORTATION: readonly string[];

/** Les paquets de l'hôte web : aucune zone qui survit à la bascule ne les charge. */
export const PAQUETS_DE_L_HOTE_WEB: readonly string[];

/** La clé d'outillage `cle` couvre-t-elle `rel` : finie par `/`, `rel` est sous ce dossier ; sinon, `rel` est ce fichier. */
export function couvre(cle: string, rel: string): boolean;

/** Le module hors des zones `cibleRel` est-il ouvert à `importeurRel` : un outillage de la zone `de` qui le déclare ? */
export function horsZoneOuvert(de: string, importeurRel: string, cibleRel: string): boolean;

/** L'outillage de la zone `de` (clé de `paquetsDOutillage`) que l'arc de `importeurRel` vers `cibleRel` atteint du dehors,
 *  `null` sinon. */
export function outillageAtteint(de: string, importeurRel: string, cibleRel: string): string | null;

/** La zone `de` refuse-t-elle le paquet `paquet` à `importeurRel` : elle survit à la bascule, c'est un paquet de l'hôte web,
 *  et aucun outillage de la zone ne le lui ouvre ? Sans importeur, le verdict de la zone. */
export function paquetFerme(de: string, paquet: string | null, importeurRel?: string): boolean;

/** Les zones du dépôt et leurs sens d'import (#2882, #2928). */
export const COUCHES: Readonly<Record<string, Couche>>;

/** Le dossier de la zone `z`, relatif à la racine du dépôt. */
export function dossierDe(z: string): string;

/** Les dossiers de premier niveau du dépôt qui portent une zone. */
export const RACINES_DES_ZONES: readonly string[];

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
