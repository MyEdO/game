/**
 * LA CLÉ D'UN ÉLÉMENT 3D résolue contre la donnée (#2972 v4, « `cle` par catégorie » ; #3114, #3113) : chaque champ de clé
 * résolu y trouve son id. Une ligne par champ de clé résolu (`RESOLUTIONS`), jamais par catégorie.
 */
import { findApparenceById, findCoiffureById, findPieceById, findTeteById } from '../../data';

export type CodeDEcartDeCle = 'cle-inconnue' | 'piece-hors-categorie';

interface EcartDeCle {
  readonly code: CodeDEcartDeCle;
  /** Le champ de clé fautif. */
  readonly champ: string;
  readonly detail: string;
}

type Resolution = (id: string, categorie: string) => Omit<EcartDeCle, 'champ'> | undefined;

/** La résolution de chaque champ de clé résolu. */
const RESOLUTIONS: Readonly<Record<string, Resolution>> = {
  tete: (id) => (findTeteById(id) ? undefined : { code: 'cle-inconnue', detail: `${id} n’est aucune tête de \`garde-robe.json\`` }),
  coiffure: (id) => (findCoiffureById(id) ? undefined : { code: 'cle-inconnue', detail: `${id} n’est aucune coiffure de \`garde-robe.json\`` }),
  piece: (id, categorie) => {
    const piece = findPieceById(id);
    if (!piece) return { code: 'cle-inconnue', detail: `${id} n’est aucune pièce de \`garde-robe.json\`` };
    return piece.categorie === categorie ? undefined : { code: 'piece-hors-categorie', detail: `${id} est une pièce \`${piece.categorie}\`, pas \`${categorie}\`` };
  },
  apparence: (id) => (findApparenceById(id) ? undefined : { code: 'cle-inconnue', detail: `${id} n’est aucune apparence de \`apparences.json\`` }),
};

/** Les écarts de la clé `cle` d'un élément de catégorie `categorie` à la donnée du jeu. */
export function ecartsDeCleDElement(categorie: string, cle: Readonly<Record<string, string>>): EcartDeCle[] {
  return Object.entries(cle).flatMap(([champ, id]) => {
    const resolution = Object.prototype.hasOwnProperty.call(RESOLUTIONS, champ) ? RESOLUTIONS[champ] : undefined;
    const ecart = resolution?.(id, categorie);
    return ecart ? [{ ...ecart, champ }] : [];
  });
}
