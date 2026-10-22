/** Le code d'un script GDScript (commentaires `#` et contenu des chaînes blanchis en espaces, lignes et colonnes
 *  préservées) et ses chaînes, chacune avec sa ligne. Contrat : en-tête de `gdscriptSansRegle.mjs`. */
export function lexemesGdscript(src: string): { code: string; chaines: { texte: string; ligne: number }[] };

/** Les calculs de règle d'un script GDScript (`hasard`, `chemin`, `mesure`), chacun avec sa ligne et son extrait.
 *  Familles et formes : en-tête de `gdscriptSansRegle.mjs`. */
export function calculsDeRegle(src: string): { famille: 'hasard' | 'chemin' | 'mesure'; ligne: number; extrait: string }[];
