import type { EcartsDeStock } from './stock.mjs';
import type { DivergenceEnveloppe, FormeObservee, OpObservee, Redeclaration, SignatureOrpheline, scannerDonnees } from '../../docs/lib/structures-scan.mjs';
import type { CoupleDeReference, CoupleInatteignable } from '../../docs/lib/slots-registre.mjs';

export type SiteForme = { concept: string; dataset: string; champ: string; signature: string };
export type SiteSlot = { dataset: string; champ: string };
export function siteDeForme(f: SiteForme): string;
export function siteDeSlot(s: SiteSlot): string;
export function siteDEnveloppe(e: { role: string; cle: string; motif: string; detail: string; document: string; chemin: string }): string;
export function occurrencesDe(e: { occurrences: number }): number;
export const COMMANDE_D_ECRITURE: string;

/** Le corpus que mesure une collection à compte (`corpusDesComptes`). */
export type CorpusDesComptes = {
  scan: ReturnType<typeof scannerDonnees>;
  sansSlot: readonly CoupleDeReference[];
  inatteignables: readonly CoupleInatteignable[];
  redeclarations: readonly Redeclaration[];
  /** Les ops de `OP_DEFS` (`types`), de `OPS_NON_TYPEES` et les références à plat de chaque payload (`aPlat`) du schéma mesuré. */
  typage: TypageDesOps;
};
export type TypageDesOps = { types: readonly string[]; nonTypees: readonly string[]; aPlat: Readonly<Record<string, readonly string[]>> };
export function estDetteDOp(o: { op: string; signature: string }, typage: TypageDesOps): boolean;

/** Ce que mesure chaque collection à compte dans son corpus. */
export type MesureDe = {
  STRUCTURES_FORMES: FormeObservee;
  STRUCTURES_OPS: OpObservee;
  STRUCTURES_HOMONYMES: { cle: string; classes: readonly string[]; occurrences: number };
  STRUCTURES_ENVELOPPE: DivergenceEnveloppe & { occurrences: number };
  STRUCTURES_REDECLARATIONS: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string; occurrences: number };
  STRUCTURES_ORPHELINES: SignatureOrpheline;
  SLOTS_SANS_DECLARATION: CoupleDeReference;
  SLOTS_INATTEIGNABLES: CoupleInatteignable;
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
