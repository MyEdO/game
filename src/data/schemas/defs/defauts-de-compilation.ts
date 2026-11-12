/**
 * Schéma de `defauts-de-compilation.json` (#1716/#1789) — ce que le COMPILATEUR de scène pose quand
 * l'auteur ne dit rien. Objet RACINE unique (famille `config`), même emballage que
 * `semences-de-scene.json` : la SEMENCE dit ce qu'une scène NEUVE reçoit, ces défauts-ci disent ce
 * qu'une SECTION d'un `MapSpec` déjà écrit rend quand elle laisse le terrain implicite. Deux
 * documents parce que ce sont deux moments : créer une scène, compiler une déclaration.
 *
 * Chaque champ est un `ref('terrain')` : un défaut hors registre est refusé AU PARSE, jamais au
 * premier rendu. N+1 défaut de compilateur = un champ de plus ici, zéro littéral de plus en code.
 */
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'defauts-de-compilation.json';
export const famille = 'config';

const doc = document(
  'defauts-de-compilation',
  famille,
  {
    cheminDeRonde: ref('terrain'),
    masse: ref('terrain'),
    pont: ref('terrain'),
  },
  {
    cheminDeRonde: { label: 'Chemin de ronde', hint: 'Terrain MARCHABLE du chemin de ronde auto-posé par une `cells` d’enceinte (dessus du mur plein)' },
    masse: { label: 'Masse d’un mur plein', hint: 'Terrain de la MASSE d’un mur plein `cells` — le bloc dont le moteur dérive toutes les faces' },
    pont: { label: 'Pont de navire', hint: 'Tuile de base d’une scène de bord compilée sans terrain authoré (abordage)' },
  },
  { codex: { keys: ['defautsDeCompilation'] }, edit: { object: 'unique' } },
  { exiges: ['maison'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
