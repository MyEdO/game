<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/publication.md -->
# Publication

Annexe du skill `orchestrer-des-agents` (`.agents/skills/orchestrer-des-agents/SKILL.md`).

**7. Publication au fil de l’eau (#2626).** Le lot est l’unité de composition et de jugement ; chaque
tête committée à CI verte se publie aussitôt par `npm run ops:publier -- --detache`, lot fini ou non.
Commits intermédiaires `refs #N`, seul le solde clôt.
- **Un lot = un chantier** (`npm run ops:chantier -- <N>`), même urgent pendant un train : jamais deux
  lots dans un worktree. Une sonde non suivie sort de l'arbre avant `ops:publier`.
- **Fusionner main seulement en CONFLIT, ou pour amener un fichier qu'une porte exige** (le train fusionne
  seul sur éjection) : index STAGÉ → `git restore --staged` d'abord ; `git fetch`, `git merge --no-commit
  origin/main`, jamais un rebase (#2178) ; aucune reconstruction des dérivés sous `MERGE_HEAD` ; `git rm`
  d'une cible pure → `npm run gen` ; gardes du périmètre rejouées sur l'arbre fusionné. Fusion propre ou
  non substantielle : SANS trailers ; `CLIQUET:` pour le seul apport de la résolution ; 10 lignes ou plus
  sous `src/` → `JUGE:`/`REFUTATION:` (+ `JUGE-VISION:` si un écran change) au message, ou dans un commit
  DESCENDANT ou le solde `.claude/soldes/ref-<N>.md` ou `<N>.md` d'un ticket cité qui NOMME son sha
  (`npm run livraison:plage`).
- **Jamais une veille, un train ou un outil `scripts/ops/` lancé depuis un worktree où un agent édite cet
  outil** : il exécute le WIP. Publier avant de dispatcher, ou suivre par `gh pr view` ; un « train mort »
  se recoupe par le pid réel et `git ls-remote` avant toute relance.
- **Sur l'arbre partagé, aucun `checkout`/`restore`/`reset`/`stash` n'est sûr**, même sur un généré ou ma
  propre écriture : un stray se défait en supprimant ou recréant les fichiers puis en rejouant le
  générateur ; un WIP écrasé se récupère par `git stash apply <sha>`, jamais `pop` ; du travail à porter
  sur la branche d'une autre session, c'est elle qui le porte, à l'arrêt.

Le verdict d'une suite en fond se LIT puis se DÉCIDE, jamais `tail … && git push`. Une branche
`chantier/**` se pousse LIBREMENT ; après CHAQUE push, attendre son run EN FOND par `npm run ops:ci --
--attendre` (`Monitor`), `--echecs <run>` pour relire une course, jamais `gh run` ni `sleep` ; un rouge se
rejoue par `npm run gates -- --gates <noms>`. Un train `--detache` se suit par la commande `veille=`
qu'il imprime (`Monitor`, ré-armée par `--depuis <dernier #seq>`), jamais par un filtre de son log.
Migrations : le job `migrations` de `ci.yml` les joue sur la branche, aucun rejeu local.
