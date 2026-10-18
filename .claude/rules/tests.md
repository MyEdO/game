---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.test.mjs"
  - "**/*.testkit.ts"
  - "scripts/test/**"
---

# Tests Vitest et bancs node

- Un test verrouille le CONTRAT, jamais une implémentation. N'écris ni l'assertion qui commémore un retrait (`not.toContain('<retiré>')`), ni le test qui fige l'ancienne mécanique d'une refonte. L'absence n'est assertable que pour un invariant PERMANENT de classe. Un arbitrage se verrouille par un contrat structurel POSITIF (« contient EXACTEMENT : … »).
- Un rouge après refonte s'ATTRIBUE avant toute retouche : contrat (RAW, invariant du ticket, design jugé), on le respecte ; ancienne mécanique, on réécrit le test depuis le nouveau contrat. Ne le fais jamais passer par skip, mock ou timeout (utilisateur, 2026-08-23 : « dès qu'on fait une refonte, on a les tests qui nous pousse a revenir a l'ancien comportement ou faire des hacks »).
- Le pilotage d'un mécanisme transverse vit dans UN helper partagé (`*.testkit.ts`), jamais recopié dans N tests. `src/monterRacine.testkit.ts`
- Asserte une règle sur une fixture nommée, et sur le corpus réel seulement un invariant stable. Proscris le cardinal vivant d'un stock ou d'un magasin, la lecture d'un magasin partagé entre sessions (tmpdir, `.git/suivi`), la mutation en place d'un registre importé et la photographie d'une donnée éditable (murs, pièces, scènes). Un chiffre vivant va au message de diagnostic.
- Un régime se POSE par le seam sur une fixture, puis se restaure. Une fenêtre de commits à shas figés est une fixture, un stock réel à HEAD ne l'est pas. La contre-épreuve sur le magasin réel est une sonde jouée au rendu, pas un test.
- Une clé de ctx que N sites construisent à la main exige un test de CÂBLAGE au niveau state (flux réel), qui rougit quand la clé disparaît du site d'appel. Un test qui forge le ctx passé à `applyOps` ne le couvre pas. En revue, compare les N sites clé par clé et mutualise la construction du ctx. `.claude/agents/codeur.md` (preuve par MUTATION)
- Un banc qui forge un dépôt (`git init`) lance git sous `envDeDepotForge()` (env purgé de tout `GIT_*`) : sous un hook, le `GIT_DIR` hérité réinitialise le VRAI dépôt en `core.bare = true` et tue tous les worktrees. Ne pointe jamais `GIT_DIR` sur le vrai dépôt pour reproduire ; un tel banc vert hors hook n'est pas prouvé. `scripts/guards/lib/depotGabarit.mjs` #1825
- Relever un plafond codé en dur dans un test de contrat (`toBeLessThanOrEqual(36)`, `src/data/plage-bornes-contrat.test.ts:236`) est invisible aux portes (net 0). Ne relève que si le réel le DÉPASSE, et porte au message `CLIQUET: <fichier> +N — <motif>` pour chaque fichier dont un cran bouge. `scripts/guards/lib/stocksNominatifs.mjs:25-26`
