// CLASSEMENT DU DÉTECTEUR (#2969) : ce module voyage avec le détecteur de la porte des comptes (`scripts/guards/lib/corpusDesComptes.mts`).
import { descendre } from './descente';
import { conceptDeLaClasse, conceptDuNoeud, conceptsPoses, poseDuConcept, type IdConceptPose, type Pose } from './interne/concepts';
import './interne/poses';
import { classeDeProduit } from './produits';

/**
 * PORTE de lecture des poses de concept (#3012, S1), pour qui vit hors de `grammaire/` ; les écrivains
 * restent derrière le mur (`interne/concepts.ts`), la table dans `interne/poses.ts`.
 */

/** Le concept que porte `noeud` : sa pose de nœud par identité, sinon la pose de sa classe de produit. */
export function conceptDe(noeud: unknown): IdConceptPose | undefined {
  const produit = classeDeProduit(noeud);
  return conceptDuNoeud(noeud) ?? (produit && conceptDeLaClasse(produit));
}

/** Le nœud ou la classe de produit où le concept `id` est posé. */
export function noeudDuConcept(id: IdConceptPose): Pose | undefined {
  return poseDuConcept(id);
}

/** Les concepts POSÉS qu'aucun nœud des schémas `racines` n'atteint, par identité ou par classe de produit (`descendre`). */
export function posesPerdues(racines: readonly unknown[]): IdConceptPose[] {
  const atteints = new Set<IdConceptPose | undefined>();
  descendre(racines, ({ noeud }) => {
    const produit = classeDeProduit(noeud);
    atteints.add(conceptDuNoeud(noeud)).add(produit && conceptDeLaClasse(produit));
  });
  return conceptsPoses().filter((id) => !atteints.has(id));
}
