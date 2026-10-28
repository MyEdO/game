// Les PORTEURS de la porte des comptes (#2705, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) : le fichier
// de stock de chaque volet à stock de `SOUS_LA_PORTE` (`occurrencesStock.mjs`), qui le nomme par `PORTEURS`. Module SANS
// import : la porte du commit et la porte de plage (`stocksNominatifs.mjs`) les lisent sans charger ce que la mesure lit.

/** Le porteur de chaque volet à stock : `STRUCTURES_REDECLARATIONS`, `STRUCTURES_LOCALES` (`structuresLocales.mts`) et
 *  `SOURCE_FORMAT` (`scripts/raw/check-source-format.mjs`) ; les volets sans stock n'en nomment aucun. */
export const PORTEURS = Object.freeze({
  STRUCTURES: 'scripts/guards/lib/structuresStock.mjs',
  STRUCTURES_LOCALES: 'scripts/guards/lib/horsStrateStock.mjs',
  SOURCE_FORMAT: 'scripts/raw/source-format-stock.json',
})

/** Les porteurs sous la porte : aucun `CLIQUET:` n'y admet une croissance (`nonCouvertesDuBilan`, `stocksNominatifs.mjs`). */
export const PORTEURS_SOUS_LA_PORTE = Object.freeze(Object.values(PORTEURS))
