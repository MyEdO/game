import type { EcartsDeStock, EntreeDeSite } from './stock.mjs';
import type { ChampsDeStructure } from './structuresLocales.mts';
import type { Redeclaration } from '../../docs/lib/structures-scan.mjs';

export function occurrencesDe(e: { occurrences: number }): number;
export const COMMANDE_D_ECRITURE: string;

/** Le corpus que mesure une collection à compte (`corpusDesComptes`). */
export type CorpusDesComptes = { redeclarations: readonly Redeclaration[] };

/** Ce que mesure chaque collection à compte dans son corpus. */
export type MesureDe = {
  STRUCTURES_REDECLARATIONS: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string; occurrences: number };
};
export type NomDeCollectionACompte = keyof MesureDe;

/** Une entrée de collection à compte, mesurée ou au stock. */
export type EntreeDeCompte = { readonly occurrences: number } & Readonly<Record<string, unknown>>;

export type CollectionACompte<N extends NomDeCollectionACompte = NomDeCollectionACompte> = {
  readonly porteur: string;
  readonly nom: N;
  readonly site: (e: EntreeDeCompte) => string;
  readonly cible: (cle: string, e: EntreeDeCompte) => string;
  readonly mesure: (corpus: CorpusDesComptes) => readonly (MesureDe[N] & EntreeDeCompte)[];
};
export const COLLECTIONS_A_COMPTE: readonly CollectionACompte[];
/** Un volet SOUS LA PORTE des comptes : son porteur quand un stock le porte, son nom, l'identité d'un site, la cible qui
 *  solde sa naissance ou sa hausse, son compte, les sites nés qu'il apparie à un disparu (`renommages`, rendus par leur
 *  `site`), et, pour un PLANCHER, ce qu'il tient (`tient`) et son juge (`cede`), qui remplace la règle de naissance et
 *  de hausse. */
export type VoletSousLaPorte = {
  readonly porteur?: string;
  readonly nom: string;
  readonly site: (e: EntreeDeCompte) => string;
  readonly cible: (cle: string, e: EntreeDeCompte) => string;
  readonly nombre: (e: EntreeDeCompte) => number;
  readonly renommages?: (base: readonly EntreeDeCompte[], tete: readonly EntreeDeCompte[]) => ReadonlySet<string>;
  readonly plancher?: {
    readonly tient: (e: EntreeDeCompte) => boolean;
    readonly cede: (base: readonly EntreeDeCompte[], tete: readonly EntreeDeCompte[]) => string[];
  };
};
/** Un site de `DETTE_OPS` : l'op et son motif (`MOTIF_NON_TYPEE`, `motifAPlat`). */
export type SiteDeDetteDOp = { readonly op: string; readonly motif: string };
export const MOTIF_NON_TYPEE: string;
export function motifAPlat(cle: string): string;
export const DETTE_OPS: VoletSousLaPorte;
export const DETTE_ENVELOPPE: VoletSousLaPorte;
export const FEUILLES_D_ID: VoletSousLaPorte & { readonly plancher: NonNullable<VoletSousLaPorte['plancher']> };
/** Une entrée mesurée du volet `STRUCTURES_LOCALES` : entrée de site, classe et empreinte hors clé. */
export type EntreeDeStructure = EntreeDeSite & ChampsDeStructure;
export function empreinteDeChamps(champs: readonly (readonly [string, string])[]): string;
export function renommagesDeStructure(base: readonly EntreeDeStructure[], tete: readonly EntreeDeStructure[]): Set<string>;
export const STRUCTURES_LOCALES: Omit<VoletSousLaPorte, 'cible'> & {
  readonly cible: (cle: string, e: unknown) => string;
  readonly renommages: NonNullable<VoletSousLaPorte['renommages']>;
};
export const SOUS_LA_PORTE: readonly VoletSousLaPorte[];
export const COLLECTIONS_A_COMPTE_PAR_NOM: { readonly [N in NomDeCollectionACompte]: CollectionACompte<N> };

export function ecartsDeCollection<O extends { occurrences: number }, S extends { occurrences: number }>(p: {
  nom: NomDeCollectionACompte;
  observe: Iterable<O>;
  stock: Iterable<S>;
  cle: (entree: O | S) => string;
  remede?: { neuve?: (cle: string, entree: O) => string; perimee?: (cle: string, entree: S) => string };
}): EcartsDeStock;

export type CollectionOccurrences = {
  texte: string; rel: string; nom: string; observe: readonly EntreeDeCompte[]; stock: readonly EntreeDeCompte[];
  site: (e: EntreeDeCompte) => string; cible: (cle: string, e: EntreeDeCompte) => string;
};
export function actualiserOccurrences(collections: readonly CollectionOccurrences[]):
  | { refus: string }
  | { ecritures: { rel: string; texte: string; changements: string[] }[] };

export function collectionsACompteDe(modules: readonly { fichier: string; module: Record<string, unknown> }[]): string[];
export const HISTOIRE_DE_COMPTE: RegExp;
export function histoiresDeCompte(texte: string, nom: string, rel: string): { ligne: number; commentaire: string }[];
