import type { EntreeDeSite, Echeance, Site } from './stock.mjs';

/** Une entrée telle qu'un fichier de stock de sites la porte : sa clé, la mesure de son site, son
 *  échéance et sa `preuve` quand elle en a. */
export type EntreeEnPlace = EntreeDeSite & Partial<Echeance> & Record<string, unknown>;

export function lireStockJson(path: string | URL): { quoi?: unknown; entrees?: EntreeEnPlace[]; [cle: string]: unknown };
export function texteEnPlace(chemin: string): string | null;
export function naissanceEnPlace(path: string | URL, familles: readonly string[]): Record<string, number> | null;
export function lireEntreesDeSite(path: string | URL): EntreeEnPlace[];
export function texteDeStock(quoi: unknown, entrees: readonly object[]): string;
export function parCleDeSite(a: Partial<EntreeDeSite>, b: Partial<EntreeDeSite>): number;

/** L'image d'un fichier de stock lu par son format : ce qui est hors des collections, et les
 *  collections par nom. */
export interface ImageDeStock {
  horsCollections: unknown;
  collections: Map<string, EntreeEnPlace[]>;
  chemin?: string;
}

/** Un FORMAT de fichier de stock de sites. */
export interface FormatDeStock {
  /** L'état soldé du format est-il l'ABSENCE du fichier ? */
  readonly absentSiVide: boolean;
  /** L'image du texte, ou `null` s'il n'est pas de ce format. `chemin` : le fichier DANS le dépôt. */
  lire(texte: string, chemin: string): ImageDeStock | null;
  /** Le texte de l'image, collections rangées par `parCleDeSite`. */
  ecrire(image: ImageDeStock): string;
}

export const FORMAT_JSON: FormatDeStock;
export const FORMAT_MJS: FormatDeStock;
export const FORMATS: Readonly<Record<string, FormatDeStock>>;
export function formatDe(chemin: string): FormatDeStock;

export function entreesRegenerees<S extends Site & { famille?: string }>(
  sites: readonly S[],
  p?: { lot?: string | null; date?: string | null; ancien?: Iterable<Record<string, unknown>> },
): (EntreeDeSite & Partial<Echeance> & Omit<S, 'file' | 'ref' | 'famille'>)[];

export function comptesParFamille<F extends string>(
  items: readonly { famille?: string }[],
  familles: readonly F[],
): Record<F, number>;

/** Une collection déclarée par la régénération d'un stock de sites. */
export interface CollectionRegeneree {
  /** La collection dans le format : `export const <nom>` en `.mjs`, `entrees` en JSON. */
  nom: string;
  /** Les sites OBSERVÉS de TOUT le stock de la collection, jamais des entrées. */
  sites: readonly (Site & Record<string, unknown>)[];
  /** La dernière phrase d'un refus décroissant. */
  motif?: string;
}

/** Une POLITIQUE de croissance d'un stock de sites. */
export interface PolitiqueDeCroissance {
  readonly nom: string;
  /** La politique DATE-t-elle une entrée neuve ou accrue du `lot` et de la date du run ? */
  readonly datee: boolean;
  /** La phrase du refus de la collection, ou `null` ; dit aussi ce que l'amorce lui fait. */
  refus(p: {
    chemin: string;
    collection: CollectionRegeneree;
    entrees: readonly EntreeEnPlace[];
    stock: readonly EntreeEnPlace[];
    lot: string | null;
    amorce: boolean;
  }): string | null;
}

export const DECROISSANT: PolitiqueDeCroissance;
export const SOUS_LOT: PolitiqueDeCroissance;
export const REMESURE: PolitiqueDeCroissance;

/** La RÉGÉNÉRATION d'un fichier de stock de sites, que déclare le module qui le mesure. */
export interface RegenerationDeStock {
  /** Le fichier de stock ; son extension choisit le format (`formatDe`). */
  chemin: string;
  politique: PolitiqueDeCroissance;
  collections: readonly CollectionRegeneree[];
  /**
   * La valeur écrite hors des collections (le `quoi` d'un stock JSON) ; absente : celle du fichier en
   * place. Elle ne dépend JAMAIS de la mesure du run : une constante, ou une fonction des comptes À LA
   * NAISSANCE du stock. Un compte du run écrit ici ferait diverger deux soldes disjoints d'un même
   * stock, que le pilote de fusion rendrait en conflit.
   */
  horsCollections?: unknown;
  /**
   * Les phrases de ce que la mesure n'a pas pu lire (absente : vide). Non vide, la régénération refuse
   * d'emblée, sous toute politique et sous l'amorce : rien n'est écrit.
   */
  manque?: readonly string[];
}

export function texteRegenere(
  regeneration: RegenerationDeStock,
  p: { enPlace: string | null; lot?: string | null; date?: string | null; amorce?: boolean },
): { refus: string } | { texte: string | null; tailles: string };

export function ecartDeRegeneration(regeneration: RegenerationDeStock, enPlace: string | null): string | null;
