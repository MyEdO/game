// STOCK CLIQUETÉ des appels EXISTANTS, depuis `src/engine`/`src/state`, à un résolveur d'entité par
// LIBELLÉ de `src/data/index.ts`, entité ou identifiant (`…By…Label`) — détection structurelle,
// `collectLabelEntityResolvers` de `labelLogic.mjs` — consommé par `src/state/label-logic-guard.test.ts` (#909). Patron
// whitelist-en-lib du dépôt (`folioRatchetStock.mjs`/`entityOrphanStock.mjs`/`manualDocsStock.mjs`).
//
// Compte PAR FICHIER (jamais `fichier:ligne` : la ligne dérive à chaque commit voisin — même
// justification que `LABEL_LITERAL_STOCK`, `labelLogic.mjs`).
//
// CE QUE CE STOCK NE COUVRE PAS (cf. aussi l'en-tête de `scanLabelResolverCalls`,
// `labelLogic.mjs`) : un appel PAR MÉTHODE (`obj.findSpell(...)`) — seul l'appel BARE (identifiant
// nu) est scanné ; un résolveur importé sous un ALIAS (`import { findSpell as fs }`) — le scan lit
// le nom appelé tel quel, pas la provenance de l'import.
// ÉTAT (#1924) : les résolveurs libellé→IDENTIFIANT (`…By…Label`) entrent au volet ; leurs appels
// préexistants depuis `src/engine` sont le stock ci-dessous, qui ne fait que décroître. Tout appel
// neuf est une `neuve` du volet consommateur. L'écart se calcule chez le consommateur par la
// primitive partagée `ecartsDeStock` (`stock.mjs`), jamais par un calcul local.
/** @type {Readonly<Record<string, number>>} */
export const LABEL_RESOLVER_CALL_STOCK = {
  'src/engine/qualities/normalize.ts': 1,
  'src/engine/traits/dispatch.ts': 1,
};
