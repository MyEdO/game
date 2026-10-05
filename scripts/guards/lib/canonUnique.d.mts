import type ts from 'typescript';
import type { CorpusFile } from './sourceCorpus.mjs';
import type { sitesDeModule, liaisonsDe } from './importGraph.mjs';

export interface ContexteImports {
  readonly source: ts.SourceFile;
  readonly sites: () => ReturnType<typeof sitesDeModule>;
  readonly liaisons: () => ReturnType<typeof liaisonsDe>;
  readonly liaisonsDuNom: (nom: string) => ReturnType<typeof liaisonsDe>;
  readonly checker: () => ts.TypeChecker;
  readonly module: (spec: string) => string | null;
}

export function contexteImports(sf: ts.SourceFile): ContexteImports;

/** Fichier lu, tel que rendu par `readCorpus` (`sourceCorpus.mjs`) ou fabriqué par une fixture. */
type FichierLu = Pick<CorpusFile, 'rel' | 'text'>;

/** Mécanique d'une construction réservée : son nom, son coupe-circuit et son prédicat. */
export interface Construction {
  readonly nom: string;
  /** Faux quand la construction ne peut pas apparaître dans le texte du fichier : le scan ne parse pas. */
  readonly indice?: (texte: string) => boolean;
  /** La phrase de la trouvaille sur ce nœud, ou `null`. */
  readonly reconnait: (noeud: ts.Node, sf: ts.SourceFile, contexte: ContexteImports) => string | null;
}

/** Construction DÉCLARÉE : sa mécanique et son périmètre, lu par `sAppliqueA` (`sourceCorpus.mjs`). */
export interface ConstructionGardee extends Construction {
  readonly foyer?: string | readonly string[];
  readonly domaine?: (rel: string) => boolean;
}

export interface Trouvaille {
  line: number;
  /** Le `nom` de la déclaration. */
  construction: string;
  detail: string;
}

export const SCHEMAS_DU_CANON: Readonly<Record<string, readonly string[]>>;
export function estTableTotale(valeur: ts.Expression): boolean;
export const FORMES_DE_RECOPIE: readonly string[];
export function recopieDeCanon(p: {
  nom: string;
  membres: readonly string[];
  complet?: boolean;
  formes?: readonly string[];
}): Construction & { readonly indice: (texte: string) => boolean };
export const FORMULE_DE_CHEBYSHEV: Construction;
export const ECHAPPEUR_DE_LITTERAL: Construction;
export const CONSTRUCTION_DE_PROGRAMME: Construction;
export const ECRITURE_DE_STOCK_JSON: Construction;
export const CONSTRUCTION_DE_TABLE_TOTALE: Construction;
export function constructionDeFragment(p: {
  nom: string;
  natures: readonly string[];
  designation: readonly string[];
  designationLiee?: readonly string[];
  constructeurs: Readonly<Record<string, readonly string[]>>;
}): Construction & { readonly indice: (texte: string) => boolean };
export function origineImportee(identifiant: string, sf: ts.SourceFile, contexte: ContexteImports): { module: string; nom: string } | null;
export function liaisonImportee(occurrence: ts.Identifier, sf: ts.SourceFile, contexte: ContexteImports): { spec: string; nom: string } | null;
export function estAppelDeclare(
  appel: ts.CallExpression,
  sf: ts.SourceFile,
  fonctions: Readonly<Record<string, readonly string[]>>,
  contexte: ContexteImports,
): string | null;
export function tableDesExports(fichiers: readonly FichierLu[], noms: Iterable<string>): Record<string, string[]>;
export function cleEnLigne(p: {
  nom: string;
  champsDeGroupe: readonly string[];
  occurrence: string;
  separateur: string;
  separateurDeRemede: string;
  fonctionsDeCle: Readonly<Record<string, readonly string[]>>;
}): Construction & { readonly indice: (texte: string) => boolean };
/** Un site où l'appel au seam est ADMIS : fichier, déclarations englobantes (`englobanteDe`), fonction appelée. */
export interface SiteAdmis {
  readonly rel: string;
  readonly englobante: string;
  readonly appele: string;
}
export function lectureBruteDeCollection(p: {
  nom: string;
  liaisons: readonly { readonly module: string; readonly exporte: string }[];
  json: string;
  seam: { readonly module: string; readonly fonctions: readonly string[] };
  dataset: string;
  sitesAdmis?: readonly SiteAdmis[];
}): Construction & { readonly indice: (texte: string) => boolean };
export function comparaisonDAppel(p: {
  nom: string;
  fonctions: Readonly<Record<string, readonly string[]>>;
}): Construction & { readonly indice: (texte: string) => boolean };
export function scanConstructionsReservees(fichier: FichierLu, constructions: readonly ConstructionGardee[]): Trouvaille[];
export function constructionsReserveesDuCorpus(
  corpus: readonly FichierLu[],
  constructions: Parameters<typeof scanConstructionsReservees>[1],
): readonly ({ rel: string } & Trouvaille)[];
