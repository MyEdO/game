// STOCK CLIQUETÉ des documents de `docs/` encore MANUSCRITS (#903 — toute la documentation est
// GÉNÉRÉE depuis le code, jamais écrite à la main). Patron whitelist-en-lib du dépôt
// (`folioRatchetStock.mjs`, `rollSeamWhitelist.mjs`).
//
// Périmètre : `docs/*.md` À PLAT (hors sous-dossiers — `docs/plans/`, `docs/raw/`, `docs/retours/`,
// `docs/superpowers/`…), même frontière que `scripts/docs/check-doc-refs.mjs`
// (`listerDossier(DOCS_DIR)` non récursif). Un doc est GÉNÉRÉ quand son ouverture porte, dans ses
// premières lignes, un marqueur `GÉNÉRÉ par` (deux formes mesurées dans le dépôt : « ⚠️ Fichier
// GÉNÉRÉ par … » et « GÉNÉRÉ par `npx tsx …` ») — cf. `scripts/corpus/docs/manual-docs-ratchet.test.mjs`.
//
// CLIQUET, pas absolution — trois verrous, tous dans le test :
//   (a) tout doc manuscrit ABSENT de cette liste échoue : un doc neuf se GÉNÈRE, il ne s'inscrit pas
//       ici ;
//   (b) toute entrée de cette liste devenue GÉNÉRÉE échoue : le stock se solde en retirant sa ligne,
//       jamais en la laissant traîner ;
//   (c) la TAILLE du stock est plafonnée (`MANUAL_DOCS_MAX` dans le test) : sans ce plafond, « le
//       stock ne peut que décroître » n'était qu'un commentaire — la voie la plus courte pour
//       « solder » un doc manuscrit neuf restait d'ajouter une ligne ici, CI verte. Faire croître ce
//       stock impose donc de relever le plafond DANS la garde : un geste visible en revue, jamais un
//       append discret.
//
// Chaque ligne porte le chemin du doc et un fait bref (son sujet) — jamais une formulation qui se
// donne une permission.
/** @type {ReadonlySet<string>} */
export const MANUAL_DOCS_STOCK = new Set([
  'docs/ajouter-un-livre-source.md', // recette : ajouter un livre source (pipeline complet)
  'docs/architecture.md', // carte d'architecture — où trouver quoi
  'docs/campagne-authoring.md', // carte des coutures d'auteur de campagne
  'docs/charte-ui.md', // charte UI
  'docs/combat-events-coherence.md', // doctrine des événements de combat
  'docs/recette-navigateur.md', // recette de validation navigateur (Playwright MCP)
])
