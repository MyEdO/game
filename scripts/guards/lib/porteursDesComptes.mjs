// Les PORTEURS de la porte des comptes (#2705, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) : le fichier
// de stock de chaque volet de `SOUS_LA_PORTE` (`occurrencesStock.mjs`), qui le nomme par `PORTEURS`. Module SANS
// import : la porte du commit et la porte de plage (`stocksNominatifs.mjs`) les lisent sans charger ce que la mesure lit.

/** Le porteur de chaque famille de volets : `STRUCTURES_*`, `SLOTS_*`, et `SOURCE_FORMAT` (`scripts/raw/check-source-format.mjs`). */
export const PORTEURS = Object.freeze({
  STRUCTURES: 'scripts/guards/lib/structuresStock.mjs',
  SLOTS: 'scripts/guards/lib/slotsStock.mjs',
  SOURCE_FORMAT: 'scripts/raw/source-format-stock.json',
})

/** Les porteurs sous la porte : aucun `CLIQUET:` n'y admet une croissance (`nonCouvertesDuBilan`, `stocksNominatifs.mjs`). */
export const PORTEURS_SOUS_LA_PORTE = Object.freeze(Object.values(PORTEURS))
