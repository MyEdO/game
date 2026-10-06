/** Règle ayant produit un finding : `label-logic` = les formes `.label` historiques (#142, tolérance
 *  ZÉRO) ; `collection-key` = `.label`/`.name` en clé de collection (#602) ; `display-key` = un champ
 *  d'AFFICHAGE interpolé dans une CLÉ (#598) ; `label-as-id-arg` = `.label` passé en ARGUMENT à un
 *  paramètre de déclaration nommé `id` (#142 LOT 5). */
export type LabelRule = 'label-logic' | 'collection-key' | 'display-key' | 'label-as-id-arg';

/** Règle du scan des libellés HORS champ `label` (#142 LOT 7) : `label-literal` = égalité entre une
 *  valeur de champ (ou son alias) et un littéral de libellé ; `label-switch` = même aiguillage en
 *  `switch` ; `label-record` = table indexée par des libellés. */
export type LabelLiteralRule = 'label-literal' | 'label-switch' | 'label-record';

export interface Finding {
  line: number;
  detail: string;
  rule: LabelRule;
}

export interface LabelLiteralFinding {
  line: number;
  detail: string;
  rule: LabelLiteralRule;
}

export const BY_LABEL_RX: RegExp;
export const LABEL_EQ_RX: RegExp;
export const LABEL_PREDICATE_RX: RegExp;
export const LABEL_SWITCH_RX: RegExp;
export const DISPLAY_KEY_TEMPLATE_RX: RegExp;
export function scanLabelLogic(relPath: string, contenu: string): Finding[];
export function collectIdParamFunctions(contenu: string): Map<string, number>;
export function collectDeclaredNames(contenu: string): Set<string>;
/** Recherche nom → rang du paramètre `id` (une `Map` en est une). */
export interface RangsDuParametreId {
  get(nom: string): number | undefined;
}
export function scanLabelAsIdArg(relPath: string, contenu: string, idParamFns: RangsDuParametreId): Finding[];
export function effectiveIdParamFns(contenu: string, globalIdParamFns: RangsDuParametreId): RangsDuParametreId;
export const CORPUS_RACINE: string;
export function estDansLeCorpus(rel: string): boolean;
export const RATCHET_EXCEPTIONS: Record<string, string>;
export function ratchetShortKey(finding: { rel: string; line: number }): string;
export function isLabelLiteral(text: string): boolean;
export function scanLabelLiteralCompare(relPath: string, contenu: string): LabelLiteralFinding[];
export const DETTES_DE_LIBELLE: Readonly<Record<string, number>>;
export function cleDeDette(site: { rel: string; rule: string }): string;
export function fichierDeDette(cle: string): string;
export const VOLETS_SANS_STOCK: ReadonlySet<string>;
export function stockDe(cle: string): number;
export function clesInterditesAuStock(stock?: Readonly<Record<string, number>>): string[];
/** Finding « retour d'APPEL comparé à un littéral FR » (#1694 B3). */
export interface LabelCallLiteralFinding {
  line: number;
  detail: string;
  rule: 'label-call-literal';
}
export function scanCallResultLiteralCompare(relPath: string, contenu: string): LabelCallLiteralFinding[];
export function ecartsAuxDettesDeLibelle(measured: Map<string, number> | Record<string, number>): string[];

/** Finding d'index CONSTRUIT sur un champ d'affichage (#909). */
export interface LabelKeyedIndexFinding {
  line: number;
  detail: string;
  rule: 'label-keyed-index';
}
export function scanLabelKeyedIndex(relPath: string, contenu: string): LabelKeyedIndexFinding[];

/** Finding d'appel à un résolveur d'entité par libellé (#909). */
export interface LabelResolverCallFinding {
  line: number;
  detail: string;
  rule: 'label-entity-resolver-call';
  fn: string;
}
export function collectLabelEntityResolvers(contenu: string): Set<string>;
export function scanLabelResolverCalls(relPath: string, contenu: string, resolverNames: Set<string>): LabelResolverCallFinding[];

/** Finding de la garde de FACE D'AFFICHAGE (#1988 §7) — (b) identité, (c) face de donnée en `string`,
 *  (d) liant littéral. `face` : la fonction en cause. */
export interface FaceFinding {
  line: number;
  detail: string;
  rule: 'face-affichage-identite' | 'face-donnee-string' | 'liant-litteral-de-face';
  face: string;
}
export function collectFacesDAffichage(fichiers: readonly { rel: string; text: string }[]): Map<string, string>;
export function scanFaceDAffichageIdentite(relPath: string, contenu: string, faces: ReadonlyMap<string, string>): FaceFinding[];
export function scanFaceDeDonneeString(relPath: string, contenu: string): FaceFinding[];
export function scanLiantsLitterauxDesFaces(relPath: string, contenu: string): FaceFinding[];

/** Le corpus de la garde lu sur le disque (`readCorpus` de `src/`). */
export function corpusDeLaGarde(): readonly { rel: string; text: string }[];
/** Contexte inter-fichiers de la garde, sur le corpus ; les rangs du paramètre `id` à la demande. */
export interface GardeContexte {
  idParamFns: RangsDuParametreId;
  faces: Map<string, string>;
  resolveurs: Set<string>;
}
export function contexteDeLaGarde(fichiers: readonly { rel: string; text: string }[]): GardeContexte;
/** Un site de la garde, tous volets : `couture` (RATCHET_EXCEPTIONS), `dette` (clé `fichier#règle` au stock), `nu`. */
export interface SiteDeLaGarde {
  rel: string;
  line: number;
  detail: string;
  rule: string;
  face?: string;
  fn?: string;
  statut: 'couture' | 'dette' | 'nu';
}
export function scanLabelLogicFichier(rel: string, text: string, ctx: GardeContexte): SiteDeLaGarde[];
export function scanLabelLogicCorpus(fichiers: readonly { rel: string; text: string }[]): { fichiers: string[]; sites: SiteDeLaGarde[] };
export function dettesParVolet(balayage: { fichiers: readonly string[]; sites: readonly { rel: string; rule: string; statut: string }[] }): Map<string, number>;
