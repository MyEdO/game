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
  /** La déclaration du champ ; pour une propriété synthétique, celle du champ qui porte le type mappé. */
  decl: Declaration;
  /** L'id du type PORTEUR d'une propriété sans déclaration propre : clé LITTÉRALE d'un type mappé, ou propriété
   *  produite par une fabrique (une déclaration pour tous ses produits). */
  porteur?: number;
}

export interface FieldEditability {
  id: string;
  owner: string;
  field: string;
  /** `fichier:ligne` de la DÉCLARATION du champ. */
  at: string;
  /** Fichiers du chemin de l'AUTEUR qui l'écrivent : `src/ui/**` (interface), et les primitives d'édition (pont Godot,
   *  `src/hote/`, modules d'édition du noyau) pour les seules écritures dont la fonction porteuse est APPELÉE depuis
   *  l'interface ou la méthode `editer` du pont. */
  authors: string[];
  /** Fichiers du PIPELINE d'authoring (compilateur MapSpec, scènes en dur) qui l'écrivent. */
  pipeline: string[];
}

/** Ensemble d'IDENTITÉS du document : les déclarations de propriété des shapes atteints depuis
 *  `sceneSchema`, corps des fabriques et annotations de type de la donnée compris, `z.custom` et types du moteur
 *  exclus. */
export function documentDeclarations(program: SessionProgramme, root: string): Set<Node>;

/** Le Program du périmètre de cette garde, bâti à chaque appel : l'appelant le tient et le libère. */
export function programmeDuPerimetre(root: string): SessionProgramme;
export function sceneScope(program: SessionProgramme, root: string): SceneField[];
/** Clé d'identité d'un champ : sa déclaration, ou `id du porteur#nom` pour une propriété synthétique ou produite par
 *  une fabrique. */
export function cleDuChamp(champ: SceneField): Declaration | string;
/** Portées d'exécution atteintes depuis `src/ui/**` ou la méthode `editer` du pont Godot par fermeture transitive des
 *  appels. */
export function auteurReachableScopes(checker: Checker, program: SessionProgramme, root: string): Set<Node>;
export function fieldsWrittenIn(
  checker: Checker,
  sourceFile: SourceFile,
  cles: Map<Declaration | string, string>,
  fieldNames: Set<string>,
  creditable?: (node: Node) => boolean
): Set<string>;
/** Une écriture que l'aller-retour de l'éditeur joue : le document avant et après, le chemin écrit depuis la scène, la
 *  valeur jouée et la saisie qui l'a portée. */
export interface EcritureJouee { avant: unknown; apres: unknown; chemin: (string | number)[]; valeur: unknown; saisie: string }
/** La marque d'un crédit par aller-retour dans la colonne `authors`. */
export const ALLER_RETOUR: string;
/** Ids de champ du périmètre auxquels la propriété `name` de `type` se rattache. */
export function idsOf(checker: Checker, cles: Map<Declaration | string, string>, type: unknown, name: string): Set<string>;
/** Ids de champ du périmètre que le dernier pas de `chemin` écrit dans `doc`, marché sur le type `Scene`. */
export function idsDuChemin(checker: Checker, cles: Map<Declaration | string, string>, scene: unknown, doc: unknown, chemin: readonly (string | number)[]): Set<string>;
/** Le document a changé au chemin, la valeur relue est la jouée, la saisie n'est pas du JSON. */
export function ecritureCreditee(e: EcritureJouee): boolean;
/** `program` absent : bâti pour CET appel (~8 s). `ecrituresJouees` : créditées par aller-retour (`ALLER_RETOUR`). */
export function auditSceneFieldEditability(root: string, program?: SessionProgramme, options?: { ecrituresJouees?: readonly EcritureJouee[] }): FieldEditability[];
export function orphanFields(rows: FieldEditability[]): FieldEditability[];
