// Sélection des générateurs ARMÉS par un diff stagé (#1679 L1b) — mécanique PARTAGÉE entre le hook
// `scripts/git-hooks/pre-commit.mjs` et son test, jamais recopiée dans l'un des deux.
//
// UN SEUL déclencheur : une CIBLE du générateur est stagée. La classe visée est « un doc STAGÉ,
// généré depuis un arbre ≠ index » — pour ce doc-là, les blobs que son pied a figés doivent être
// ceux que l'index porte. Une SOURCE stagée n'arme rien ici : le pied du doc non stagé qu'elle
// périme est inoffensif (ce doc ne part pas dans ce commit), et c'est `docs:check:tout` qui vérifie en
// CI — chaque générateur rejoué en `--check`, et le pied de chaque doc confronté aux sources mesurées. Armer sur les sources coûterait un
// `docs:build` complet à 59,3 % des commits (3 893 des 6 563 fichiers suivis sont une source
// mesurée ; `src/engine/combat.ts` en arme 13) pour une divergence de blob qui ne ment sur rien.
// Le pied qu'une source périme est re-signé UNE fois par train, à l'étape docs de `ops:publier` ; la
// gate `docs:empreinte` reste la porte.

/** Scripts de `docs/.sources-lues.json` dont un doc STAGÉ est à confronter à l'index, triés. */
export function generateursArmes(sourcesLues, stages) {
  const staged = new Set([...stages].map((f) => f.split('\\').join('/')))
  return Object.entries(sourcesLues)
    .filter(([, e]) => e.cibles.some((c) => staged.has(c)))
    .map(([script]) => script)
    .sort()
}

/** Les cibles des générateurs armés, triées et dédupliquées — ce qu'un refus doit NOMMER. */
export function ciblesDesArmes(sourcesLues, armes) {
  return [...new Set(armes.flatMap((script) => sourcesLues[script]?.cibles ?? []))].sort()
}
