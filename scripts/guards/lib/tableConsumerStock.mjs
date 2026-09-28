// STOCK CLIQUETÉ des tables d'effets SANS CONSOMMATEUR (« donnée écrite, non tirée = dette ») —
// consommé par `src/data/tables.test.ts`. Patron whitelist-en-lib du dépôt
// (`paletteLiteralStock.mjs`, `rigPartViewStock.mjs`).
//
// Une entrée de `tables.json` que NI une autre donnée (`src/data/*.json`, y compris une AUTRE table
// via son `tableId`) NI le code de prod (`src/**/*.ts(x)` hors tests, hors commentaires) ne porte
// par son id en toutes lettres — jeton de chaîne CITÉ complet (`"<id>"`/`'<id>'`), jamais une
// sous-chaîne nue — est un ornement : elle ne sera jamais tirée au runtime et fait mentir les
// compteurs d'obtenabilité (#734).
//
// Périmètre mesuré : détection TEXTUELLE du jeton cité complet. Angles morts déclarés : un id
// construit par concaténation dynamique dont aucun fichier ne porte la forme complète serait compté
// orphelin à tort ; un consommateur MORT (code jamais appelé) compte comme un consommateur ; une
// chaîne de donnée (`desc`, `label`, note…) qui vaut EXACTEMENT l'id, sans être une op de tirage
// réelle, compte à tort comme consommatrice.
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : `fichier` = le dataset où la table est
// DÉCLARÉE (c'est lui que la porte de plage voit, et celui que l'auteur ouvre), `ref` = l'id de la
// table. Une clé nue (`'vdm-siphonnage-de-sort'`) est INVISIBLE à `croissanceDesStocks`, et un
// append n'y coûte rien. Aucun PLAFOND : ce qu'une dette ne peut pas faire, c'est croître SANS SE
// DÉCLARER, et c'est l'entrée nommée qui le dit — la garde compare par `ecartDuVolet`.
//
// GÉNÉRÉ par `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/tableConsumerAudit.ts`
// (`--check` en garde) depuis la MESURE de `scripts/guards/lib/tableConsumerAudit.ts`, la SEULE
// lecture du corpus — la même que celle de la garde `src/data/tables.test.ts`. Sa politique est
// `DECROISSANT`.
//
// Un id se solde en CÂBLANT sa table (op `rollTable`, clé de rôle de Domaine, appel code) puis en
// retirant sa ligne ici — jamais en retirant la ligne seule.
//
// DISPOSITION de la seule entrée : `vdm-siphonnage-de-sort` est bloquée par #862 — le trait se
// déclenche quand un TIERS incante, et aucun `EffectTrigger` n'observe l'incantation d'AUTRUI
// (`src/engine/traits/parity.test.ts`, entrée « Siphonnage de sort »).

export const TABLE_ORPHAN_RATCHET = [
  { fichier: 'src/data/tables.json', ref: 'vdm-siphonnage-de-sort', occurrence: 1 },
];
