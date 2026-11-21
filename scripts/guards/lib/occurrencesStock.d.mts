import type { EntreeDeSite } from './stock.mjs';
import type { ChampsDeStructure } from './structuresLocales.mts';
import type { Redeclaration } from '../../docs/lib/structures-scan.mjs';

/** Une entrée mesurée sous la porte. */
export type EntreeDeCompte = { readonly occurrences: number } & Readonly<Record<string, unknown>>;

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
export const STRUCTURES_REDECLARATIONS: VoletSousLaPorte & {
  readonly nom: 'STRUCTURES_REDECLARATIONS';
  readonly mesure: (redeclarations: readonly Redeclaration[]) => readonly EntreeDeCompte[];
};

/** Un site de `DETTE_OPS` : l'op et son motif (`MOTIF_NON_TYPEE`, `motifAPlat`). */
export type SiteDeDetteDOp = { readonly op: string; readonly motif: string };
export const MOTIF_NON_TYPEE: string;
export function motifAPlat(cle: string): string;
export const DETTE_OPS: VoletSousLaPorte;
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
export const HISTOIRE_DE_COMPTE: RegExp;
export function histoiresDeCompte(texte: string, nom: string, rel: string): { ligne: number; commentaire: string }[];
