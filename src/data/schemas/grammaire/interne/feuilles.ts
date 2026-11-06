// CLASSEMENT DU DÉTECTEUR (#2969) : ce module voyage avec le détecteur de la porte des comptes (`scripts/guards/lib/corpusDesComptes.mts`).
import type { FeuilleDId, TypeEntite } from '../ref';

/**
 * REGISTRE DES FEUILLES `idDe` (#1466, #2969) : la fabrique `idDe` (`grammaire/ref.ts`) y déclare chaque feuille
 * qu'elle construit, avec sa déclaration ; les lecteurs (`declarationDeFeuilleDId`, `estFeuilleDId`) la classent.
 * L'écrivain vit sous `interne/` : seule la grammaire déclare une feuille (mur `murs/interne`). La porte de lecture
 * est `grammaire/ref.ts`.
 */
const FEUILLES_D_ID = new WeakMap<object, FeuilleDId>();

/** Déclare `feuille`, construite par `idDe`, et la rend. */
export function declarerFeuilleDId<N extends object>(feuille: N, declaration: FeuilleDId): N {
  FEUILLES_D_ID.set(feuille, declaration);
  return feuille;
}

/** La déclaration (`FeuilleDId`) d'une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une. */
export const declarationDeFeuilleDId = (noeud: unknown): FeuilleDId | undefined =>
  typeof noeud === 'object' && noeud !== null ? FEUILLES_D_ID.get(noeud) : undefined;

/** Le type référencé par une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une. */
export const typeDeFeuilleDId = (noeud: unknown): TypeEntite | undefined => declarationDeFeuilleDId(noeud)?.type;

/** Le nœud est-il une feuille construite par `idDe` ? */
export const estFeuilleDId = (noeud: unknown): boolean => typeDeFeuilleDId(noeud) !== undefined;
