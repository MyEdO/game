import type { Site } from './stock.mjs';

export const FEUILLES_PARTAGEES: readonly string[];
export const RACINE_DES_MODULES: string;
export function moduleHorsCouche(fichier: string, css: string): boolean;

export interface RegleCss {
  selecteurs: string[];
  corps: string;
  /** Préludes at-rule empilés, joints par ` && ` — `null` au premier niveau. */
  media: string | null;
}

export function reglesCss(texte: string): RegleCss[];
/** Découpe une liste de sélecteurs sur ses virgules de NIVEAU 0 (hors `:has()`/`:is()`/`[attr]`). */
export function decoupeSelecteurs(tete: string): string[];
export function declarations(corps: string): { prop: string; valeur: string }[];
/** Corps interne d'une tranche `@media` — lève si la tranche est absente. */
export function mediaBlock(css: string, requete: string): string;
/** La feuille privée de toutes ses tranches `@media`. */
export function baseSection(css: string): string;
export const PROPRIETES_DE_PLACEMENT: ReadonlySet<string>;
export const PROPRIETES_A_ECHELLE: ReadonlySet<string>;
export function estPlacement(prop: string, valeur: string): boolean;
export function physique(prop: string): string;
export function valeurHorsEchelle(valeur: string): boolean;

/** Un fichier lu (disque, image git) — ou une FIXTURE de même forme. */
export interface Fichier { rel: string; text: string }
/** Un site mesuré, forme d'entrée de `sitesEnEntrees` : le `Site` de `stock.mjs`. */
export type { Site };
/** Une entrée du manifeste des primitives, réduite à ce que la frontière CSS lit. */
export interface EntreeManifeste { id: string; fichier?: string; css?: string }
/** Une IMAGE mesurable : les feuilles, le manifeste, la liste `FEUILLES_PARTAGEES` et les `fichier`s
 *  réutilisés d'un même arbre (#1806 L1). */
export interface ImageCss {
  fichiers: readonly Fichier[];
  manifeste: readonly EntreeManifeste[];
  partagees: readonly string[];
  reutilises: ReadonlySet<string>;
}
export interface MesureDeZone { identite: Site[]; espacement: Site[] }
/** Un volet ventilé d'un commit contre son parent (#1806 D6″). */
export interface VoletVentile {
  stock: [number, number];
  exempte: [number, number];
  SORTI: number;
  APPARU: number;
  RETOURNE: number;
  ENTRE: number;
  RECLASSE: number;
  PRIMITIVISE: number;
  DISPARU: number;
  /** Les clés RETOURNÉES au stock, et leur compte. */
  retournes: Retour[];
}
/** Une clé (fichier, réf) rendue au stock, `n` fois. */
export interface Retour { fichier: string; ref: string; n: number }
/** Une entrée de stock réduite à sa clé. */
export interface CleDeStock { fichier: string; ref: string }
/** Un module franchi, et son prix par volet ; `n` = identité + espacement. */
export interface Franchissement { module: string; identite: number; espacement: number; n: number }

export const FEUILLE_LAYOUT: string;
export const CHEMIN_MANIFESTE: string;
export const CHEMIN_COUCHES: string;
export function manifesteDe(texte: string | null): EntreeManifeste[];
export function feuillesPartageesDe(texte: string | null): string[];
/** Le sélecteur NORMALISÉ d'une règle (espaces réduits, `@media` hors clé). */
export function cleDeRegle(selecteurs: readonly string[]): string;
export function sitesIdentiteEcran(fichiers: readonly Fichier[]): Site[];
export function variablesHorsEchelle(text: string): Set<string>;
export function sitesEspacementHorsEchelle(fichiers: readonly Fichier[]): Site[];
export function modulesDePrimitive(manifeste: readonly EntreeManifeste[]): Set<string>;
export function importeurCompte(chemin: string): boolean;
export function fichiersReutilises(
  manifeste: readonly EntreeManifeste[],
  imports: Iterable<readonly [string, readonly string[]]>,
): Set<string>;
export function modulesExemptes(image: Pick<ImageCss, 'manifeste' | 'partagees' | 'reutilises'>): Set<string>;
export function modulesDEcran(image: ImageCss): Fichier[];
export function partitionCss(image: ImageCss): { stock: MesureDeZone; exempte: MesureDeZone };
export function franchissements(parent: ImageCss, commit: ImageCss): string[];
export function ventiler(
  parent: ImageCss,
  commit: ImageCss,
  options?: {
    renommages?: ReadonlyMap<string, string>;
    stockAvant?: Record<'identite' | 'espacement', Iterable<CleDeStock>>;
  },
): { identite: VoletVentile; espacement: VoletVentile; franchis: Franchissement[] };
export function ligneDeVentilation(nom: string, v: VoletVentile): string;
export function admisAuRetour<E extends CleDeStock & { occurrence: number }>(
  mesurees: readonly E[],
  stockDeTete: Iterable<CleDeStock>,
  retournes: readonly Retour[],
): E[];
