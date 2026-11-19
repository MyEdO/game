import type { FeuilleDeSpec } from '../ref';

/**
 * REGISTRE DES FEUILLES `specDe` (#4056), sur le patron des feuilles `idDe` (`interne/feuilles.ts`) : la fabrique
 * (`grammaire/ref.ts`) y déclare chaque feuille de spécialisation qu'elle construit, avec l'entrée qu'elle spécialise.
 * L'écrivain vit sous `interne/` : seule la grammaire déclare une feuille (mur `murs/interne`). La porte de lecture
 * est `grammaire/ref.ts`.
 */
const FEUILLES_DE_SPEC = new WeakMap<object, FeuilleDeSpec>();

/** Déclare `feuille`, construite par `specDe`, et la rend. */
export function declarerFeuilleDeSpec<N extends object>(feuille: N, declaration: FeuilleDeSpec): N {
  FEUILLES_DE_SPEC.set(feuille, declaration);
  return feuille;
}

/** La déclaration (`FeuilleDeSpec`) d'une feuille construite par `specDe`, `undefined` si le nœud n'en est pas une. */
export const declarationDeFeuilleDeSpec = (noeud: unknown): FeuilleDeSpec | undefined =>
  typeof noeud === 'object' && noeud !== null ? FEUILLES_DE_SPEC.get(noeud) : undefined;
