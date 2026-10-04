// STOCK CLIQUETÉ des fichiers de test qui laissent des nœuds ÉLÉMENTS dans `document.body` après
// leur dernier test — consommé par la barrière de `src/test-setup.ts` et gardé par
// `src/dom-residu-stock.test.ts`. Patron whitelist-en-lib du dépôt (`tableConsumerStock.mjs`,
// `rigPartViewStock.mjs`).
//
// CONTRAT : sous `test.isolate: false` (vite.config.ts), react-dom est PARTAGÉ par tous les fichiers
// d'un même worker. Une racine React laissée MONTÉE par un fichier continue de se mettre à jour hors
// `act()` pendant les fichiers suivants — « Attempted to synchronously unmount a root while React was
// already rendering » / « Should not already be working » — et le rendu devient VIDE pour tous les
// suivants (#1619, déclencheur B). La barrière échoue AU FICHIER FAUTIF ; les fichiers listés ici sont
// les fuites CONNUES au 2026-09-01, tolérées le temps de leur extinction.
//
// Une ligne se solde en DÉMONTANT ce que le fichier monte (`act(() => root.unmount())` en `afterEach`,
// ou `cleanup()` de la bibliothèque de rendu) puis en retirant la ligne — jamais en retirant la ligne
// seule. Un fichier NEUF qui fuit échoue : il n'a rien à faire ici.
//
// Périmètre mesuré : nœuds ÉLÉMENTS enfants directs de `document.body` observés au `afterEach` LE PLUS
// EXTERNE (donc après les `afterEach` du fichier). Angles morts déclarés : un nœud attaché à
// `document.head` ou hors `body` n'est pas vu ; une racine React démontée dont le conteneur reste
// attaché est comptée comme fuite (elle l'est pour la barrière, pas pour react-dom) ; un fichier qui
// fuit seulement sous un filtre de test partiel n'apparaît pas si la mesure ne l'a pas joué.
//
// RE-MESURE : `WFRP_DOM_RESIDU_COLLECTE=<fichier> npm test -- <chemins>` n'échoue pas et écrit
// l'inventaire (`fichier<TAB>nombre<TAB>nœuds`) — c'est ainsi que cette liste se re-établit.

/**
 * Entrées du stock devenues PÉRIMÉES : le fichier a JOUÉ dans cette suite et n'a PAS fui — sa ligne
 * ne protège plus rien et doit partir (sans quoi une fuite re-née y passerait inaperçue). Un fichier
 * qui n'a pas joué (run filtré, suite rouge avant lui) n'est PAS jugé : il est absent du registre.
 * PURE — le registre est lu par `scripts/test/run.mjs` à la fin d'une suite complète VERTE.
 * @param {Iterable<string>} lignes lignes `fichier<TAB>fui|propre` du registre de passage.
 * @param {ReadonlySet<string>} [stock]
 * @returns {string[]} entrées du stock à retirer, en ordre de stock.
 */
export function entreesPerimees(lignes, stock = DOM_RESIDU_STOCK) {
  const aFui = new Set()
  const aJoue = new Set()
  for (const ligne of lignes) {
    const [fichier, verdict] = String(ligne).split('\t')
    if (!fichier || !verdict) continue
    aJoue.add(fichier)
    if (verdict === 'fui') aFui.add(fichier)
  }
  return [...stock].filter((f) => aJoue.has(f) && !aFui.has(f))
}

/** Message d'échec du verdict de péremption, ou `null` s'il n'y a rien à dire. */
export function messagePeremption(perimees) {
  if (!perimees.length) return null
  return (
    `Stock des fuites DOM — ${perimees.length} entrée(s) PÉRIMÉE(S) : ces fichiers ont joué SANS fuir.\n`
    + `Retirer ces lignes de scripts/guards/lib/domResiduStock.mjs (le stock est en EXTINCTION) :\n`
    + perimees.map((f) => `  ${f}`).join('\n')
  )
}

/** @type {ReadonlySet<string>} */
export const DOM_RESIDU_STOCK = new Set([
  // 2026-09-01 — population MESURÉE en mode collecte sur `src/ui` (250 fichiers) PUIS sur les 49
  // fichiers à docblock jsdom hors `src/ui` : 12 fuites. Lot d'extinction #1619. Le nœud noté est
  // celui resté enfant de `document.body`.
  'src/ui/CampaignView.test.tsx', // <div>
  'src/ui/compendium/codex-edit-cases-a-cocher.test.tsx', // <div class="codex-edit-form">
  'src/ui/creator/creator-step-scroll-cue.test.tsx', // <div class="split creator-step">
  'src/ui/jetProps/defense-forcage-annule.test.tsx', // <div>
  'src/gameIso/stage/plan-volumique.test.tsx', // <div>
]);
