import type { z } from 'zod';
import type { ProduitDeFabrique } from './produits';
import type { IdConceptPose } from './poses';

export type { IdConceptPose };

/**
 * POSE DE CONCEPT (#3012, S1) : le registre qui dit quel concept du lexique des structures un nœud de
 * la grammaire porte. Deux sortes de pose : sur un NŒUD, constante de module, par son identité exacte
 * (un clone, même à enfants identiques, n'est pas lu) ; sur une CLASSE de produit de fabrique
 * `(fabrique, rôle, clés d'extra)`, pour une instance rendue neuve à chaque appel, lue par la marque
 * de `produits.ts` sans second registre.
 *
 * Les écrivains vivent sous `interne/` : seule la grammaire pose (mur `murs/interne`). La table des
 * poses est `poses.ts` ; la porte de lecture, `grammaire/concepts.ts`.
 */

/** Une CLASSE de produit de fabrique : sa fabrique, les rôles qu'elle couvre, ses clés d'extra. */
export interface ClasseDePose {
  readonly fabrique: string;
  readonly roles: readonly string[];
  readonly clesDExtra: readonly string[];
}

/** La pose d'un concept : un nœud de la grammaire, ou une classe de produit. */
export type Pose = z.ZodType | ClasseDePose;

const cleDeClasse = (fabrique: string, role: string, cles: readonly string[]): string => `${fabrique}:${role}:${[...cles].sort().join(',')}`;
const clesDeLaClasse = (classe: ClasseDePose): string[] => classe.roles.map((role) => cleDeClasse(classe.fabrique, role, classe.clesDExtra));

const POSES = new WeakMap<object, IdConceptPose>();
const POSES_DE_CLASSE = new Map<string, IdConceptPose>();
const POSE_DU_CONCEPT = new Map<IdConceptPose, Pose>();

function reserver(id: IdConceptPose, pose: Pose, deja: IdConceptPose | undefined, ou: string): void {
  if (deja !== undefined && deja !== id) throw new Error(`Concept « ${id} » : ${ou} porte déjà le concept « ${deja} ».`);
  const ailleurs = POSE_DU_CONCEPT.get(id);
  if (ailleurs !== undefined && ailleurs !== pose) throw new Error(`Concept « ${id} » : déjà posé sur un autre nœud ou une autre classe.`);
}

/** Pose le concept `id` sur le nœud `noeud`, par son identité. Lève si le nœud porte un autre concept, ou si `id` est posé ailleurs. */
export function marquerConcept(id: IdConceptPose, noeud: z.ZodType): void {
  reserver(id, noeud, POSES.get(noeud), 'le nœud');
  POSES.set(noeud, id);
  POSE_DU_CONCEPT.set(id, noeud);
}

/** Pose le concept `id` sur la classe de produit `classe`. Lève si l'une de ses clés porte un autre concept, ou si `id` est posé ailleurs. */
export function marquerConceptDeClasse(id: IdConceptPose, classe: ClasseDePose): void {
  const cles = clesDeLaClasse(classe);
  for (const cle of cles) reserver(id, classe, POSES_DE_CLASSE.get(cle), `la classe ${cle}`);
  for (const cle of cles) POSES_DE_CLASSE.set(cle, id);
  POSE_DU_CONCEPT.set(id, classe);
}

/** Le concept posé sur `noeud` par son identité, `undefined` sinon. */
export const conceptDuNoeud = (noeud: unknown): IdConceptPose | undefined => (noeud !== null && typeof noeud === 'object' ? POSES.get(noeud) : undefined);

/** Le concept posé sur la classe du produit `produit`, `undefined` sinon. */
export const conceptDeLaClasse = (produit: ProduitDeFabrique): IdConceptPose | undefined =>
  POSES_DE_CLASSE.get(cleDeClasse(produit.fabrique, produit.role, Object.keys(produit.clesDExtra)));

/** Le nœud ou la classe où `id` est posé. */
export const poseDuConcept = (id: IdConceptPose): Pose | undefined => POSE_DU_CONCEPT.get(id);

/** Les concepts posés, dans l'ordre de leur pose. */
export const conceptsPoses = (): IdConceptPose[] => [...POSE_DU_CONCEPT.keys()];
