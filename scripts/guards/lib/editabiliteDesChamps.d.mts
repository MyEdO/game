import type { Declaration, Node } from 'typescript/unstable/ast';
import type { SessionProgramme } from './tsProgram.mjs';

/** Une racine auditée : le schéma d'où part la marche d'identité, le type d'où part le périmètre. */
export interface Racine { fichierSchema: string; schema: string; fichierType: string; type: string }
/** Les racines auditées : la scène, la carte du monde, le narratif. */
export const RACINES: { scene: Racine; carte: Racine; narratif: Racine };

/** Un champ du document d'une racine, dérivé de son type. */
export interface ChampDuDocument {
  /** Identité stable `Porteur.champ` (`WallSeg.window`, `Scene.rest.auberge`) — un homonyme d'un
   *  autre porteur est une entrée DISTINCTE. */
  id: string;
  /** Nom du type porteur, ou le chemin depuis le type de la racine pour un type littéral anonyme. */
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
  /** Fichiers du chemin de l'AUTEUR qui l'écrivent : les primitives d'édition (pont Godot, `src/hote/`, modules
   *  d'édition du noyau) pour les seules écritures dont la fonction porteuse est APPELÉE depuis la méthode `editer` du
   *  pont ; et `ALLER_RETOUR` pour une écriture jouée. */
  authors: string[];
  /** Fichiers du PIPELINE d'authoring (compilateur MapSpec, scènes en dur) qui l'écrivent. */
  pipeline: string[];
}

/** Ensemble d'IDENTITÉS du document : les déclarations de propriété des shapes atteints depuis
 *  le schéma de la racine, corps des fabriques et annotations de type de la donnée compris, `z.custom` et types du
 *  moteur exclus. */
export function documentDeclarations(program: SessionProgramme, root: string, racine: Racine): Set<Node>;

/** Le Program du périmètre de cette garde pour les `racines`, bâti à chaque appel : l'appelant le tient et le libère. */
export function programmeDuPerimetre(root: string, racines: readonly Racine[]): SessionProgramme;
/** Les champs du document de la `racine`, dérivés de son type (sa frontière : point 1 de l'en-tête du module). */
export function perimetreDeLaRacine(program: SessionProgramme, root: string, racine: Racine): ChampDuDocument[];
/** Une écriture que l'aller-retour de l'éditeur joue : le document avant et après, le chemin écrit depuis la racine du
 *  document, la valeur jouée, la saisie qui l'a portée et, issue du choix d'une variante, la clé de son discriminant. */
export interface EcritureJouee { avant: unknown; apres: unknown; chemin: (string | number)[]; valeur: unknown; saisie: string; variante?: string }
/** Les chemins que créditent des écritures jouées, chacun avec le document d'après où il se lit, sur tout porteur. */
export function cheminsCreditesJoues(ecrituresJouees: readonly EcritureJouee[]): { apres: unknown; chemin: (string | number)[] }[];
/** La marque d'un crédit par aller-retour dans la colonne `authors`. */
export const ALLER_RETOUR: string;
/** `program` absent : bâti pour CET appel (~8 s). `ecrituresJouees` : créditées par aller-retour (`ALLER_RETOUR`). */
export function auditerLEditabilite(root: string, program: SessionProgramme | undefined, options: { racine: Racine; ecrituresJouees?: readonly EcritureJouee[] }): FieldEditability[];
export function orphanFields(rows: FieldEditability[]): FieldEditability[];
