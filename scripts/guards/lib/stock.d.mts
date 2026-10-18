export interface EcartsDeStock {
  /** Clés OBSERVÉES absentes du stock (décorées par `remede.neuve`). */
  neuves: string[];
  /** Clés du STOCK que l'observé ne porte plus (décorées par `remede.perimee`). */
  perimees: string[];
  /** Clés des deux côtés dont le compte OBSERVÉ dépasse celui du stock : phrase FIXE de la primitive. */
  accrues: string[];
  /** Clés des deux côtés dont le compte OBSERVÉ est plus petit (décorées par `remede.baisse`). */
  baisses: string[];
  /** Clés DISTINCTES du stock. */
  taille: number;
}

type RemedesDeCle<O, S> = {
  neuve?: (cle: string, entree: O) => string;
  perimee?: (cle: string, entree: S) => string;
};

/** Sans `nombre` : la clé seule se compare, `accrues` et `baisses` restent vides. */
export function ecartsDeStock<O, S>(p: {
  observe: Iterable<O>;
  stock: Iterable<S>;
  cle: (entree: O | S) => string;
  nombre?: undefined;
  cible?: undefined;
  remede?: RemedesDeCle<O, S>;
}): EcartsDeStock;
/** Avec `nombre` : le compte sort de la clé, et la `cible` qui solde une hausse est exigée. */
export function ecartsDeStock<O, S>(p: {
  observe: Iterable<O>;
  stock: Iterable<S>;
  cle: (entree: O | S) => string;
  nombre: (entree: O | S) => number;
  cible: (cle: string, entree: O) => string;
  remede?: RemedesDeCle<O, S> & { baisse?: (cle: string, entree: O) => string };
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
export function cleDeContenu(rel: string, texte: string, ligne: number): string;
export function lignesDuContenu(rel: string, texte: string, cle: string): number[];
export function groupeDeSite(e: EntreeDeSite): string;
export function estEntreeDeSite(e: unknown): e is EntreeDeSite;

export function sitesEnEntrees<S extends Site & { famille?: string }>(
  sites: readonly S[],
): (EntreeDeSite & Omit<S, 'file' | 'ref' | 'famille'>)[];

export function estNeuveOuAccrue<E>(mesuree: E, tenue: E | undefined, nombre?: (entree: E) => number | undefined): boolean;

export function survieDeLecheance<E extends Record<string, unknown>>(
  mesurees: Iterable<E>,
  p: Partial<Echeance> & { ancien?: Iterable<Record<string, unknown>> },
): (E & Partial<Echeance>)[];

export function remedeDeNaissance<E>(cible: (cle: string, entree: E) => string): (cle: string, entree: E) => string;

export function ecartDuVolet(p: {
  sites: readonly Site[];
  stock: Iterable<Partial<EntreeDeSite>>;
  ou?: string;
  remede?: { neuve?: (cle: string, entree: EntreeDeSite) => string };
}): EcartsDeStock;

export function remedeNomme(lignes: readonly string[], cle: string): boolean;

export function refusDeCroissance<M, S>(
  mesurees: Iterable<M>,
  stock: Iterable<S>,
  p: { cle: (entree: M | S) => string; nombre?: (entree: M | S) => number | undefined; nom: string; motif: string },
): string | null;
export function refusDeCroissance(
  mesurees: Iterable<EntreeDeSite>,
  stock: Iterable<Partial<EntreeDeSite>>,
  p: { cle?: (entree: EntreeDeSite) => string; nombre?: (entree: EntreeDeSite) => number | undefined; nom: string; motif: string },
): string | null;

export function champsAveugles<E extends Record<string, unknown>>(
  stock: Iterable<E>,
  cle: (entree: E) => string,
  champs: readonly (keyof E & string)[],
  nombre?: (entree: E) => number,
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
