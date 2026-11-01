---
paths:
  - ".claude/agents/**"
  - ".claude/skills/**"
  - ".claude/workflows/**"
  - ".claude/memory/**"
  - ".claude/rules/**"
  - "AGENTS.md"
  - ".codex/**"
---

# Agents, skills, workflows, mémoire, règles

- Une consigne neuve va au porteur de son déclencheur : règle `.claude/rules/<thème>.md` (endroit du code), skill (procédure), définition `.claude/agents/<x>.md` (rôle), doc vivant `docs/` (référence). L'état d'un ticket, le livré, les restes et les arbitrages propres à un ticket vivent sur le ticket et dans les commits.
- Le verbatim daté d’un arbitrage utilisateur vit au ticket ou dans une fiche `.claude/memory/user-*.md` ; aucune autre fiche mémoire ne se crée. Règles, skills, agents et docs vivants portent la consigne seule, avec au plus le nom de la fiche ou `#N`. #3175 `scripts/docs/build-doctrines.mjs`
- Une règle sans `paths` se charge au démarrage, sous-agents compris ; avec `paths` (globs picomatch vérifiés par `git ls-files`), sur un Read/Write/Edit NATIF d'un fichier qui correspond, et sur les lectures lean-ctx et `ctx_patch` par la projection `scripts/hooks/regles-projection-guard.mjs`. 4 Ko maximum par fichier.
- Ce qui entre dans le contexte d'un agent (définition, skill, règle, brief) porte la consigne seule ; mesures, tableaux et justifications vivent au ticket, cité `#N` (#2683). La pierre tombale en prose suit `.claude/rules/docs-et-generes.md`.
- Un type sans outil utile (`joueur`) déclare un outil inerte du pool, `tools: CronList` : sans `tools`, il hériterait de tout (`scripts/guards/lib/typesDAgent.mjs`), et `OUTILS_NON_RESOLUS` (`scripts/agents/compat-core.mjs`) refuse les autres candidats. #2726
- Un type d'agent neuf (`.claude/agents/<x>.md`) n'existe pour `Agent` et `agent()` qu'une fois publié dans l'arbre principal et la session relancée ; avant, chaque appel échoue sans lancer d'agent (`failed`, `agentId` vide). La liste des types du rappel système fait foi.
- Ne sauvegarde un workflow sous `.claude/workflows/` que s'il porte une méthode lancée pour de vrai et de façon répétée ; une revue ou un jugement passe par des agents `juge` dépêchés, ou par un workflow inline non sauvegardé. Avant de corriger un workflow, vérifie qu'un skill ou un doc le lance encore ; orphelin, propose sa suppression. Une suppression choisie par l'utilisateur n'est faite que publiée : `git ls-tree origin/main .claude/workflows/`. `scripts/ops/workflows.test.mjs`
- Dans un `.claude/workflows/*.js`, `pipeline()`/`parallel()` rendent des COPIES : apparie par clé (label, titre normalisé), jamais par identité. `agent()` rend `null` sur échec : filtre-le et dis le lot perdu au journal. Les doublures de test clonent items et résultats ; tout changement de workflow passe par un juge de diff, lentille « hypothèses de harnais ».
