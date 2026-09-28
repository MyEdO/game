// LE MOTIF DES CATALOGUES DE L'ATLAS, écrit UNE fois (#1825). Module FEUILLE : aucun import.
//
// Les catalogues sont générés (`scripts/raw/build-catalogs.mjs`), vérifiés comme tout dérivé par
// `build-all.mjs --check`. Le motif est la cible du générateur (`GENERATORS`, scripts/docs/build-all.mjs)
// et l'aiguillage de fusion (`.gitattributes`) — ce dernier ne pouvant rien importer, le banc
// `scripts/raw/catalogues-aiguillage.test.mjs` confronte CE littéral à `.gitattributes` et à
// l'énumération réelle de la couture.
//
// La forme suit la partition de l'Atlas par CŒUR : `**` vaut zéro ou plusieurs dossiers, donc le
// motif atteint tout catalogue quel que soit son cœur, sans nommer aucun cœur.

/** Le MOTIF, une seule écriture : `scripts/guards/lib/lister.mjs` (`motifDeGlob`, `correspondGlob`),
 *  `.gitattributes` et la cible du générateur le lisent tel quel. */
export const MOTIF_CATALOGUES = 'docs/raw/**/catalogue-*.md'
