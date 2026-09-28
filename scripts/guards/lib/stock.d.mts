export interface EcartsDeStock {
  /** Clés OBSERVÉES absentes du stock (décorées par `remede.neuve`). */
  neuves: string[];
  /** Clés du STOCK que l'observé ne porte plus (décorées par `remede.perimee`). */
  perimees: string[];
  /** Clés DISTINCTES du stock — le plafond, lui, reste au test. */
  taille: number;
}

export function ecartsDeStock<O, S>(p: {
  observe: Iterable<O>;
  stock: Iterable<S>;
  cle: (entree: O | S) => string;
  remede?: {
    neuve?: (cle: string, entree: O) => string;
    perimee?: (cle: string, entree: S) => string;
  };
}): EcartsDeStock;

export const CHAMPS_DE_GROUPE: readonly ['famille', 'fichier', 'ref'];
export const CHAMP_D_OCCURRENCE: 'occurrence';
export const CHAMPS_DE_CLE: readonly [...typeof CHAMPS_DE_GROUPE, typeof CHAMP_D_OCCURRENCE];
export const CHAMPS_REQUIS: readonly ['fichier', 'ref', 'occurrence'];
export const SEPARATEUR_DE_CLE: ' :: ';
export const SEPARATEUR_DE_REMEDE: ' — ';
export const CHAMPS_D_ECHEANCE: readonly ['lot', 'date'];
export const CHAMPS_DE_SITE_OBSERVE: readonly ['file', 'ref'];

type ChampRequis = (typeof CHAMPS_REQUIS)[number];
type ChampFacultatif = Exclude<(typeof CHAMPS_DE_CLE)[number], ChampRequis>;

/** Une ENTRÉE DE SITE : ce qu'un stock de sites GRAVE (la clé, elle, se calcule). */
export type EntreeDeSite = { [C in Exclude<ChampRequis, typeof CHAMP_D_OCCURRENCE>]: string } & {
  [C in typeof CHAMP_D_OCCURRENCE]: number;
} & { [C in ChampFacultatif]?: string };

/** Un SITE OBSERVÉ : le FICHIER fautif et la RÉF qui l'identifie dedans. C'est l'entrée de
 *  `sitesEnEntrees`, donc la forme que TOUT audit de garde rend — elle appartient à la primitive de
 *  cliquet, pas à l'un de ses audits. */
export type Site = { [C in (typeof CHAMPS_DE_SITE_OBSERVE)[number]]: string };

/** L'ÉCHÉANCE d'une entrée : le chantier qui l'éteint (`lot`), la mesure d'origine (`date`). */
export type Echeance = { [C in (typeof CHAMPS_D_ECHEANCE)[number]]: string };

export function cleDeSite(e: EntreeDeSite): string;
export function groupeDeSite(e: EntreeDeSite): string;
export function estEntreeDeSite(e: unknown): e is EntreeDeSite;

export function sitesEnEntrees<S extends Site & { famille?: string }>(
  sites: readonly S[],
): (EntreeDeSite & Omit<S, 'file' | 'ref' | 'famille'>)[];

export function estNeuveOuAccrue(mesuree: unknown, tenue: unknown): boolean;

export function survieDeLecheance<E extends Record<string, unknown>>(
  mesurees: Iterable<E>,
  p: Partial<Echeance> & { ancien?: Iterable<Record<string, unknown>> },
): (E & Partial<Echeance>)[];

export function ecartDuVolet(p: {
  sites: readonly Site[];
  stock: Iterable<Partial<EntreeDeSite>>;
  ou?: string;
}): EcartsDeStock;

export function nombresAccrus(observe: Iterable<object>, stock: Iterable<object>, ou?: string): string[];
export function remedeNomme(lignes: readonly string[], cle: string): boolean;

export function refusDeCroissance<M, S>(
  mesurees: Iterable<M>,
  stock: Iterable<S>,
  p: { cle: (entree: M | S) => string; nom: string; motif: string },
): string | null;
export function refusDeCroissance(
  mesurees: Iterable<EntreeDeSite>,
  stock: Iterable<Partial<EntreeDeSite>>,
  p: { cle?: (entree: EntreeDeSite) => string; nom: string; motif: string },
): string | null;

export function champsAveugles<E extends Record<string, unknown>>(
  stock: Iterable<E>,
  cle: (entree: E) => string,
  champs: readonly (keyof E & string)[],
): string[];

export function couvertureDuBalayage(p: {
  nom: string;
  stock: Iterable<string>;
  balayes: Iterable<string>;
  gisements: Iterable<string>;
}): { gisementsMuets: string[]; entreesDeStockAbsentes: string[] };

export function lignesMalQualifiees(
  stock: Iterable<readonly [string, Partial<Echeance>]>,
  opts?: { lotsConnus?: Iterable<string> },
): string[];
