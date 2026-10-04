import type { Declaration, Node, SourceFile } from 'typescript/unstable/ast';
import type { Checker } from 'typescript/unstable/sync';
import type { SessionProgramme } from './tsProgram.mjs';

/** Un champ du document de scène, dérivé du type `Scene`. */
export interface SceneField {
  /** Identité stable `Porteur.champ` (`WallSeg.window`, `Scene.rest.auberge`) — un homonyme d'un
   *  autre porteur est une entrée DISTINCTE. */
  id: string;
  /** Nom du type porteur, ou le chemin depuis `Scene` pour un type littéral anonyme. */
  owner: string;
  field: string;
  decl: Declaration;
}

export interface FieldEditability {
  id: string;
  owner: string;
  field: string;
  /** `fichier:ligne` de la DÉCLARATION du champ. */
  at: string;
  /** Fichiers du chemin de l'AUTEUR qui l'écrivent : `src/ui/**` (interface), et `src/state/sceneEdit.ts`
   *  pour les seules écritures dont la fonction porteuse est APPELÉE depuis l'interface. */
  authors: string[];
  /** Fichiers du PIPELINE d'authoring (compilateur MapSpec, scènes en dur) qui l'écrivent. */
  pipeline: string[];
}

/** Registre NOMINATIF des fossiles tolérés au parse et hors périmètre éditable — gate bidirectionnel. */
export const FOSSILES: string[];

/** Gate `@fossile` : un tag hors registre, une entrée sans tag — les deux sens sont des rouges. */
export function fossileAudit(
  program: SessionProgramme,
  root: string
): { taguesHorsListe: string[]; entreesSansTag: string[] };

/** Ensemble d'IDENTITÉS du document : les déclarations de propriété des shapes atteints depuis
 *  `sceneSchema`, nœuds-frontière exclus. */
export function documentDeclarations(program: SessionProgramme, root: string): Set<Node>;

/** Le Program du périmètre de cette garde, bâti à chaque appel : l'appelant le tient et le libère. */
export function programmeDuPerimetre(root: string): SessionProgramme;
export function sceneScope(program: SessionProgramme, root: string): SceneField[];
/** Portées d'exécution atteintes depuis `src/ui/**` par fermeture transitive des appels. */
export function uiReachableScopes(checker: Checker, program: SessionProgramme, root: string): Set<Node>;
export function fieldsWrittenIn(
  checker: Checker,
  sourceFile: SourceFile,
  declToId: Map<Declaration, string>,
  fieldNames: Set<string>,
  creditable?: (node: Node) => boolean
): Set<string>;
/** `program` absent : bâti pour CET appel (~8 s). */
export function auditSceneFieldEditability(root: string, program?: SessionProgramme): FieldEditability[];
export function orphanFields(rows: FieldEditability[]): FieldEditability[];
