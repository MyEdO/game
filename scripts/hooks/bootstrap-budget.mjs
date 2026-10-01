// Budgets de temps du hook `bootstrap-conteneur.mjs` (#1803), en secondes. Module SANS effet ni import :
// `scripts/agents/compat-core.mjs` en dérive le `timeout` déclaré aux surfaces (`BUDGET_TOTAL`) sans
// charger le hook, ses gestes ni leur clôture.

/** Budget d'un CONSTAT : trois commandes courtes (`git rev-parse`, `git config`, `gh --version`). */
export const BUDGET_CONSTAT = 10

/** Budget de POSE de chaque prérequis de `PREREQUIS` (bootstrap-conteneur.mjs), par `id`. */
export const BUDGETS_DE_POSE = Object.freeze({ histoire: 90, hooks: 90, docs: 5, gh: 90 })

/** Budget de bout en bout du hook : les constats de toute la table, plus les poses. C'est la valeur
 *  que le `timeout` déclaré aux surfaces doit couvrir — jamais un nombre recopié. */
export const BUDGET_TOTAL = Object.values(BUDGETS_DE_POSE).reduce((somme, budget) => somme + budget + BUDGET_CONSTAT, 0)
