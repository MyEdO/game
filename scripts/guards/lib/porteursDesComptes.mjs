// Les PORTEURS de la porte des comptes (#2705, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) : le fichier
// de stock de chaque volet à stock de `SOUS_LA_PORTE` (`occurrencesStock.mjs`), qui le nomme par `PORTEURS`. Module SANS
// import : la porte du commit et la porte de plage (`stocksNominatifs.mjs`) les lisent sans charger ce que la mesure lit.

/** Fichiers de stock protégés par les volets de `SOUS_LA_PORTE` : les signatures `STRUCTURES_CIBLES`,
 *  le stock de `STRUCTURES_LOCALES` et celui de `SOURCE_FORMAT`. */
export const PORTEURS = Object.freeze({
  STRUCTURES: 'scripts/guards/lib/structuresStock.mjs',
  STRUCTURES_LOCALES: 'scripts/guards/lib/horsStrateStock.mjs',
  SOURCE_FORMAT: 'scripts/raw/source-format-stock.json',
})

/** Les porteurs sous la porte : aucun `CLIQUET:` n'y admet une croissance (`nonCouvertesDuBilan`, `stocksNominatifs.mjs`). */
export const PORTEURS_SOUS_LA_PORTE = Object.freeze(Object.values(PORTEURS))
