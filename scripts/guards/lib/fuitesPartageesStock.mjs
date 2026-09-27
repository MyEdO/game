// STOCK NOMINATIF des FUITES DE DOMAINE en couche partagée — consommé par le cliquet (xiii) de
// `src/ui/ui-ratchets.test.ts` (#371, forme nominative #1806).
//
// Une ENTRÉE par classe définie dans une feuille partagée (`FEUILLES_PARTAGEES`, `styles.css`) qui
// n'est ni cataloguée à `docs/charte-ui.md` ni posée par au moins deux modules `.tsx` :
// `{ fichier, ref: '.<classe>', occurrence }`, la forme de tout stock nominatif du dépôt (`cleDeSite`,
// `stock.mjs`). DÉCROISSANT : une entrée se solde en déplaçant la classe dans le
// module de sa primitive, ou en la cataloguant ; une entrée neuve se déclare par `CLIQUET:`.

/** @type {import('./stock.mjs').EntreeNominative[]} */
export const FUITES_COUCHE_PARTAGEE = [
  { fichier: 'src/ui/styles.css', ref: '.combat-cursor', occurrence: 1 },
  { fichier: 'src/ui/styles.css', ref: '.error-collector-badge', occurrence: 1 },
  { fichier: 'src/ui/styles.css', ref: '.error-collector-list', occurrence: 1 },
  { fichier: 'src/ui/styles.css', ref: '.error-collector-meta', occurrence: 1 },
  { fichier: 'src/ui/styles.css', ref: '.error-collector-msg', occurrence: 1 },
  { fichier: 'src/ui/styles.css', ref: '.error-collector-stack', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.footnote', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.hero-present-amb', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.hero-present-aside', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.hero-present-body', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.hero-present-detail', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.hero-present-fig', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.hero-present-sub', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.lore-chip', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.menu-link', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.menu-tools', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.menu-tools-rule', occurrence: 1 },
  { fichier: 'src/ui/styles/base.css', ref: '.no-scrollbar', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.alert', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.col-buy', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.col-emph', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.col-enc', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.col-name', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.col-price', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.col-stat', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.detail-row', occurrence: 1 },
  { fichier: 'src/ui/styles/components.css', ref: '.group-row', occurrence: 1 },
  { fichier: 'src/ui/styles/tabs.css', ref: '.tabs-trailing', occurrence: 1 },
];
