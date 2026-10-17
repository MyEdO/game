// La TABLE des prérequis du hook `bootstrap-conteneur.mjs` (#1803), et ses budgets de temps, en
// secondes. Module SANS import : `scripts/agents/compat-core.mjs` en dérive le `timeout` déclaré aux
// surfaces (`TIMEOUT_DU_HOOK`) sans charger le hook, ses gestes ni leur clôture. Chaque geste arrive
// par le contexte (`run`, `gestes`), et rend la forme de `lancer` : `{ ok, valeur, rapport }`.

/** Budget d'un CONSTAT : une commande courte (`git rev-parse`, `git config`, `gh --version`, `claude plugin list`). */
export const BUDGET_CONSTAT = 10

/** Ce que le canon exige d'un arbre de travail, et comment le poser. `manque` MESURE (`{ nonMesure }` quand la
 *  mesure échoue), `poser` agit :
 *  un prérequis déjà satisfait ne fait rien. `budget` borne le temps total de `poser`, en secondes.
 *  Un prérequis sans `poser` est hors de portée du hook : son manque se dit avec sa `consequence`. */
export const PREREQUIS = [
  {
    nom: 'histoire git complète',
    // Le conteneur clone à une profondeur bornée (50 commits mesurés). Dix gardes de `test:hooks`
    // LISENT l'histoire — `fermetures-sans-solde`, `soldes-stock`, `stocks-nominatifs`,
    // `segments-profonds` — et refusent NOMMÉMENT un dépôt superficiel.
    manque: ({ depot, gestes }) => gestes.estSuperficiel(depot) === true,
    poser: ({ depot, gestes, budget }) => gestes.approfondir(depot, { timeout: budget * 1000 }),
    geste: 'git fetch --unshallow origin',
    budget: 90,
  },
  {
    nom: 'hooks git du dépôt',
    // Le script `postinstall` de `package.json` pose `core.hooksPath` et les deux pilotes de
    // fusion (fiches MIXTES, stocks), puis produit les cibles de code ; sans lui, aucune garde de
    // commit ne joue.
    manque: ({ depot, gestes }) => gestes.dossierDesHooks(depot) !== 'scripts/git-hooks',
    // Sous le verrou d'outillage de l'arbre (#2187) : la barrière des hooks d'outil l'attend.
    poser: ({ racine, run, budget, gestes }) =>
      gestes.sousOutillage(racine, () => run('npm', ['install', '--no-audit', '--no-fund'], { cwd: racine, budget })),
    geste: 'npm install',
    budget: 90,
  },
  {
    nom: 'docs dérivés',
    // Les docs PURS ne sont pas commités (#2203) : un clone neuf ne les porte pas, et `docs:build`
    // dépasse le budget du hook — la reconstruction part DÉTACHÉE, son journal nommé.
    manque: ({ racine, gestes }) => !gestes.docsMesures(racine),
    poser: ({ racine, gestes }) => gestes.demanderLesDerives(racine),
    geste: 'reconstruction détachée des dérivés (journal .git/hooks-git/reconstruction/<pid>.log)',
    budget: 5,
  },
  {
    nom: 'exécutable gh',
    // Le dépôt officiel `cli.github.com` est refusé par la politique de sortie du conteneur (403 au
    // proxy) : le paquet de la distribution est la seule source atteignable.
    manque: ({ run }) => !run('gh', ['--version']).ok,
    poser: ({ run, budget }) => {
      const env = { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
      const maj = run('apt-get', ['update', '-qq'], { env, budget: Math.round(budget / 3) })
      const pose = run('apt-get', ['install', '-y', '-qq', 'gh'], { env, budget: budget - Math.round(budget / 3) })
      if (pose.ok) return pose
      return { ...pose, rapport: [maj.ok ? '' : `apt-get update : ${maj.rapport}`, pose.rapport].filter(Boolean).join(' — ') }
    },
    geste: 'apt-get update puis apt-get install -y gh',
    budget: 90,
  },
  {
    nom: 'mod harnais',
    // `.claude/skills/harnais` se charge en plugin du dossier des skills, et Claude Code ne le charge
    // que dans un espace de travail approuvé : le conteneur distant ne l'est pas (`claude plugin list`).
    manque: ({ run }) => {
      const vu = run('claude', ['plugin', 'list'])
      return vu.ok ? /skipped because this workspace was not trusted/.test(vu.valeur) : { nonMesure: `\`claude plugin list\` a échoué — ${vu.rapport}` }
    },
    // Sans `poser` : l'approbation de l'espace de travail appartient à l'utilisateur, le hook la CONSTATE.
    consequence: '`.claude/skills/harnais/hooks` ne joue pas dans cette session : ni `suivi` (synchronisation du principal sur origin/main, suivi de vague), ni `vigie` (état de la CI et du train)',
    budget: 0,
  },
]

/** Budget de bout en bout de la table : chaque constat, plus chaque pose. */
export const BUDGET_TOTAL = PREREQUIS.reduce((somme, p) => somme + p.budget + BUDGET_CONSTAT, 0)

/** Démarrage de node et imports du hook, avant son premier constat : 1,7 s mesurées le 2026-10-01
 *  (Windows, cache disque chaud), bornées ici à 10 s. */
export const MARGE_DE_DEMARRAGE = 10

/** Le `timeout` déclaré aux surfaces pour le hook : la table entière, plus son démarrage. */
export const TIMEOUT_DU_HOOK = BUDGET_TOTAL + MARGE_DE_DEMARRAGE
