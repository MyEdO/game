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
export function scanLabelAsIdArg(relPath: string, contenu: string, idParamFns: Map<string, number>): Finding[];
export function collectIdParamFnsAcrossDirs(root: string, dirs: string[]): Map<string, number>;
export function effectiveIdParamFns(contenu: string, globalIdParamFns: Map<string, number>): Map<string, number>;
export const STRICT_DIRS: string[];
export const RATCHET_DIRS: string[];
export const DATA_DIRS: string[];
export const RATCHET_EXCEPTIONS: Record<string, string>;
export function ratchetShortKey(finding: { rel: string; line: number }): string;
export function isLabelLiteral(text: string): boolean;
export function scanLabelLiteralCompare(relPath: string, contenu: string): LabelLiteralFinding[];
export const LABEL_LITERAL_STOCK: Readonly<Record<string, number>>;
/** Finding « retour d'APPEL comparé à un littéral FR » (#1694 B3), dans `src/engine`/`src/state`. */
export interface LabelCallLiteralFinding {
  line: number;
  detail: string;
  rule: 'label-call-literal';
}
export function scanCallResultLiteralCompare(relPath: string, contenu: string): LabelCallLiteralFinding[];
export const LABEL_CALL_LITERAL_STOCK: Readonly<Record<string, number>>;
export function labelCallLiteralStockDrift(measured: Map<string, number> | Record<string, number>): string[];
export function labelLiteralStockDrift(measured: Map<string, number> | Record<string, number>): string[];

/** Finding d'index CONSTRUIT sur un champ d'affichage (#909), dans `src/engine`/`src/state`. */
export interface LabelKeyedIndexFinding {
  line: number;
  detail: string;
  rule: 'label-keyed-index';
}
export function scanLabelKeyedIndex(relPath: string, contenu: string): LabelKeyedIndexFinding[];
export const LABEL_KEYED_INDEX_STOCK: Readonly<Record<string, number>>;

/** Finding d'appel à un résolveur d'entité par libellé (#909), depuis `src/engine`/`src/state`. */
export interface LabelResolverCallFinding {
  line: number;
  detail: string;
  rule: 'label-entity-resolver-call';
  fn: string;
}
export function collectLabelEntityResolvers(contenu: string): Set<string>;
export function labelEntityResolverNames(root: string): Set<string>;
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
export function estDansLeCorpusDeFace(rel: string): boolean;
export function scanGardeDeFace(fichiers: readonly { rel: string; text: string }[]): (FaceFinding & { rel: string })[];
