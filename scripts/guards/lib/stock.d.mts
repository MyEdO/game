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

/** Un SITE MESURÉ : le FICHIER fautif et la RÉF qui l'identifie dedans. C'est l'entrée de
 *  `sitesEnEntrees`, donc la forme que TOUT audit de garde rend — elle appartient à la primitive de
 *  cliquet, pas à l'un de ses audits. */
export interface Site {
  file: string;
  ref: string;
}

/** Une ENTRÉE de stock nominatif : ce qu'un stock GRAVE (la clé, elle, se calcule). */
export interface EntreeNominative {
  famille?: string;
  fichier: string;
  ref: string;
  occurrence: number;
}

export function cleDeSite(e: EntreeNominative): string;

export function sitesEnEntrees(
  sites: readonly { file: string; ref: string }[],
  p?: { famille?: string },
): EntreeNominative[];

export function survieDeLecheance<E extends Record<string, unknown>>(
  mesurees: Iterable<E>,
  p: {
    lot: string;
    date: string;
    ancien?: Iterable<Record<string, unknown>>;
  },
): (E & { lot: string; date: string })[];

export function ecartDuVolet(p: {
  sites: readonly { file: string; ref: string }[];
  stock: Iterable<Partial<EntreeNominative>>;
  famille?: string;
  ou?: string;
}): EcartsDeStock;

export function remedeNomme(lignes: readonly string[], cle: string): boolean;

export function refusDeCroissance<M, S>(
  mesurees: Iterable<M>,
  stock: Iterable<S>,
  p: { cle: (entree: M | S) => string; nom: string; motif: string },
): string | null;
export function refusDeCroissance(
  mesurees: Iterable<EntreeNominative>,
  stock: Iterable<Partial<EntreeNominative>>,
  p: { cle?: (entree: EntreeNominative) => string; nom: string; motif: string },
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
  stock: Iterable<readonly [string, { lot?: string; date?: string }]>,
  opts?: { lotsConnus?: Iterable<string> },
): string[];
