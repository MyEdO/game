// STOCK CLIQUETÉ des documents de `docs/` encore MANUSCRITS (#903 — toute la documentation est
// GÉNÉRÉE depuis le code, jamais écrite à la main). Patron whitelist-en-lib du dépôt
// (`folioRatchetStock.mjs`, `rollSeamWhitelist.mjs`).
//
// Périmètre : `docs/*.md` À PLAT (hors sous-dossiers — `docs/plans/`, `docs/raw/`, `docs/decisions/`,
// `docs/retours/`, `docs/superpowers/`…), même frontière que `scripts/docs/check-doc-refs.mjs`
// (`listerDossier(DOCS_DIR)` non récursif). Un doc est GÉNÉRÉ quand son ouverture porte, dans ses
// premières lignes, un marqueur `GÉNÉRÉ par` (deux formes mesurées dans le dépôt : « ⚠️ Fichier
// GÉNÉRÉ par … » et « GÉNÉRÉ par `npx tsx …` ») — cf. `src/data/manual-docs-ratchet.test.ts`.
//
// CLIQUET, pas absolution — deux verrous, tous deux dans le test :
//   (a) tout doc manuscrit ABSENT de cette liste échoue : un doc neuf se GÉNÈRE, il ne s'inscrit pas
//       ici ;
//   (b) toute entrée de cette liste devenue GÉNÉRÉE échoue : le stock se solde en retirant sa ligne,
//       jamais en la laissant traîner.
// Ce qu'un append coûte : chaque entrée NOMME son chemin `docs/*.md`, donc la porte de plage
// (`croissanceDesStocks`, `stocksNominatifs.mjs`) la voit — une ligne de plus ici se DIT au message
// par `CLIQUET: scripts/guards/lib/manualDocsStock.mjs +N — <motif>`, jamais en silence.
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
  'docs/creer-une-creature.md', // recette : créer une créature (rig)
  'docs/qc-reconnaissabilite-sprites.md', // runbook QC sprites
  'docs/recette-navigateur.md', // recette de validation navigateur (Playwright MCP)
])
