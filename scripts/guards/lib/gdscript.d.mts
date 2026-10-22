/** La lecture lexicale d'un script GDScript : le code (commentaires et contenu des chaînes blanchis, lignes et colonnes
 *  préservées), ses chaînes, et ses commentaires sous la forme de `commentPoison.mjs`. Contrat : en-tête de
 *  `gdscript.mjs`. */
export function lexemesGdscript(src: string): {
  code: string;
  chaines: { texte: string; ligne: number }[];
  commentaires: { text: string; line: number; start: number; end: number }[];
};
