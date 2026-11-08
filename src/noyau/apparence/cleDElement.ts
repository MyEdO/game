/**
 * LA CLÉ D'UN ÉLÉMENT 3D résolue contre la donnée (#2972 v4, « `cle` par catégorie » ; #3114, #3113) : chaque champ de clé
 * résolu y trouve son entrée, dont le libellé nomme l'élément à l'écran. Une ligne par champ de clé résolu (`CHAMPS`),
 * jamais par catégorie.
 */
import { findApparenceById, findCoiffureById, findFicheDeVehicule, findNavalTrait, findTeteById } from '../../data';
import { pieceOuVariante } from './gardeRobe';

export type CodeDEcartDeCle = 'cle-inconnue' | 'piece-hors-categorie';

interface EcartDeCle {
  readonly code: CodeDEcartDeCle;
  /** Le champ de clé fautif. */
  readonly champ: string;
  readonly detail: string;
}

interface ChampDeCle {
  readonly find: (id: string) => { readonly label: string; readonly categorie?: string } | undefined;
  /** Ce que l'id désigne, dans le détail d'un écart. */
  readonly quoi: string;
}

/** Chaque champ de clé résolu, et l'entrée de la donnée que son id désigne. */
const CHAMPS = {
  tete: { find: findTeteById, quoi: 'tête de `garde-robe.json`' },
  coiffure: { find: findCoiffureById, quoi: 'coiffure de `garde-robe.json`' },
  piece: { find: pieceOuVariante, quoi: 'pièce ni variante de `garde-robe.json`' },
  apparence: { find: findApparenceById, quoi: 'apparence de `apparences.json`' },
  definition: { find: findFicheDeVehicule, quoi: 'coque de `vehicles.json` ni engin `armes-de-siege` de `trappings.json`' },
  amelioration: { find: (id: string) => { const t = findNavalTrait(id); return t?.kind === 'amelioration' ? t : undefined; }, quoi: 'Amélioration de `naval-traits.json`' },
} as const satisfies Readonly<Record<string, ChampDeCle>>;

/** Un champ de clé résolu (`CHAMPS`). */
export type ChampDeCleResolu = keyof typeof CHAMPS;

const champDeCle = (champ: string): ChampDeCle | undefined => (Object.prototype.hasOwnProperty.call(CHAMPS, champ) ? CHAMPS[champ as ChampDeCleResolu] : undefined);

/** Les écarts de la clé `cle` d'un élément de catégorie `categorie` à la donnée du jeu : un id qu'aucune entrée ne porte, ou
 *  une pièce d'une autre catégorie. */
export function ecartsDeCleDElement(categorie: string, cle: Readonly<Record<string, string>>): EcartDeCle[] {
  return Object.entries(cle).flatMap(([champ, id]): EcartDeCle[] => {
    const resolu = champDeCle(champ);
    if (!resolu) return [];
    const entree = resolu.find(id);
    if (!entree) return [{ code: 'cle-inconnue', champ, detail: `${id} n’est aucune ${resolu.quoi}` }];
    return entree.categorie === undefined || entree.categorie === categorie ? [] : [{ code: 'piece-hors-categorie', champ, detail: `${id} est une pièce \`${entree.categorie}\`, pas \`${categorie}\`` }];
  });
}

/** Le libellé de l'entrée que désigne le premier champ résolu de la clé `cle`, `undefined` si aucun ne résout. */
export function libelleDeCleDElement(cle: Readonly<Record<string, string | undefined>>): string | undefined {
  for (const [champ, id] of Object.entries(cle)) {
    const entree = id === undefined ? undefined : champDeCle(champ)?.find(id);
    if (entree) return entree.label;
  }
  return undefined;
}
