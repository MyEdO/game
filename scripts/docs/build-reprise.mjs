/**
 * Génère docs/reprise-apres-pause.md — runbook de reprise à froid (nouvelle machine, clone frais).
 * La part FACTUELLE (scripts npm et leur contenu, `git config` posés par `postinstall`, hooks Git,
 * hooks de session déclarés dans `.claude/settings.json`, workflows GitHub et leurs déclencheurs,
 * motifs de `.gitignore`, seuil de partage de la suite) est DÉRIVÉE des fichiers réels, fail-fast
 * si l'un disparaît/est renommé ; la part ÉDITORIALE (pourquoi un non-versionné l'est, cadence
 * d'archivage, conseils de vérification) N'EST PAS dérivable — elle vit ICI, en dur, exactement
 * comme les préambules de `scripts/docs/build-sources-vf.mjs`.
 *
 * Patron retenu : « éditorial EN DUR dans le générateur » (build-sources-vf.mjs), et non
 * « éditorial en donnée » (build-donnees.mjs) — il n'existe aucun manifeste de reprise à froid, et
 * en fabriquer un pour six phrases de motivation créerait une source de vérité de plus.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-reprise.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'
import { repartitionWorkers } from '../test/partition.mjs'
import { ECRIT_LU, lanesDeCi } from '../gates/toutes.mjs'
import { gatesDeCi } from '../gates/gatesDeCi.mjs'
import { ETATS as ETATS_PORTE, PORTE, WORKFLOWS as REGISTRE_WORKFLOWS, corpsRun, declencheursDe } from '../gates/workflowsDuDepot.mjs'
import { DOCUMENTAIRE, gatesSautables } from '../gates/classerPush.mjs'
import { REGEN_RECIPE } from '../guards/lib/npmLockHoisted.mjs'
import { SURFACE_CLAUDE, aplatirHooks } from '../agents/compat-core.mjs'

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const OUTIL = 'build-reprise'

  function abandon(msg) {
    console.error(`${OUTIL} — ${msg}`)
    process.exit(1)
  }

  // ── Sources FACTUELLES ───────────────────────────────────────────────────────────────────────────

  const PKG = JSON.parse(readFileSync('package.json', 'utf8'))

  /** Contenu d'un script npm (fail-fast : un script renommé casse ici, pas dans le .md). */
  function script(nom) {
    const v = PKG.scripts?.[nom]
    if (!v) abandon(`script npm « ${nom} » absent de package.json (renommé/supprimé ?)`)
    return v
  }

  /** Chemin qui doit exister sur disque (fail-fast). */
  function chemin(p) {
    if (!existsSync(p)) abandon(`chemin « ${p} » introuvable (déplacé/supprimé ?)`)
    return p
  }

  // Clés `git config` posées par `postinstall` — dédupliquées sur leur préfixe `<section>.<nom>`.
  const POSTINSTALL = script('postinstall')
  const CONTRAT_TYPESCRIPT = chemin('scripts/guards/contrat-typescript.mjs')
  const PATCH_TYPESCRIPT = chemin(`patches/typescript+${PKG.devDependencies.typescript}.patch`)
  const CYCLE_PATCH_TYPESCRIPT = chemin('patches/README.md')
  if (!POSTINSTALL.startsWith(`node ${CONTRAT_TYPESCRIPT} && `)) {
    abandon('`postinstall` ne vérifie plus le contrat TypeScript avant les réglages Git et les générateurs')
  }
  const CONFIGS = [...new Set([...POSTINSTALL.matchAll(/git config ([\w.-]+)/g)].map((m) => m[1]))]
  if (!CONFIGS.includes('core.hooksPath')) {
    abandon('`postinstall` ne pose plus `core.hooksPath` — le runbook de reprise repose dessus')
  }
  if (!/node scripts\/docs\/build-all\.mjs --code\b/.test(POSTINSTALL)) {
    abandon('`postinstall` ne produit plus les cibles de code (`build-all.mjs --code`) — le runbook de reprise repose dessus')
  }
  /** Pilotes de fusion posés par `postinstall` : nom → MODULE qui les sert. */
  const PILOTES_DE_FUSION = new Map(
    [...POSTINSTALL.matchAll(/git config merge\.([\w-]+)\.driver "node (\S+)/g)].map((m) => [m[1], m[2]]),
  )
  /** Les noms des pilotes servis par `module`. */
  const pilotesDe = (module) => [...PILOTES_DE_FUSION].filter(([, m]) => m === module).map(([nom]) => nom)
  /** Vrai si `c` est une clé `merge.<nom>.driver` ou `.name` d'un pilote servi par `module`. */
  const clePiloteDe = (module) => (c) => {
    const m = /^merge\.([\w-]+)\.(?:driver|name)$/.exec(c)
    return m !== null && PILOTES_DE_FUSION.get(m[1]) === module
  }

  // Hooks Git : les fichiers SANS extension sont ceux que git invoque par nom. La liste est DÉRIVÉE du
  // dossier — un hook posé ou retiré change le runbook sans qu'on touche à ce script. Ce qui est exigé,
  // c'est qu'il y en ait, et que `pre-commit` (le seul qui puisse REFUSER un commit) en soit.
  const HOOKS_GIT = listerDossier(chemin('scripts/git-hooks')).filter((f) => !f.includes('.'))
  if (!HOOKS_GIT.includes('pre-commit')) abandon('hook Git « pre-commit » absent de scripts/git-hooks/')

  // Hooks de session Claude Code déclarés dans `.claude/settings.json` (versionné).
  const HOOKS_SESSION = aplatirHooks(JSON.parse(readFileSync(chemin(SURFACE_CLAUDE), 'utf8')), SURFACE_CLAUDE)

  function hooksDeSession(evenement) {
    const hooks = HOOKS_SESSION.filter((h) => h.phase === evenement)
    if (!hooks.length) abandon(`${SURFACE_CLAUDE} ne déclare plus d'événement « ${evenement} »`)
    return hooks.map((h) => {
      if (!h.script) abandon(`hook « ${evenement} » sans script scripts/hooks/*.mjs : ${h.command}`)
      const script = `scripts/hooks/${h.script}`
      chemin(script)
      return { matcher: h.matcher || '(tous)', script, role: h.statusMessage ?? '' }
    })
  }

  /** Événements de session que la surface Claude DOIT déclarer. Son `SessionStart` porte la mise en
   *  conformité du conteneur distant (#1803) et le suivi de vague (#2132), pas le credo : celui-ci entre
   *  dans le contexte de Claude par l'IMPORT `@.claude/credo.md` en tête de CLAUDE.md, et seule la
   *  surface Codex — qui n'a pas d'import — l'INJECTE (`scripts/agents/compat-core.mjs`, `HOOKS_DE_SESSION`). */
  const EVENEMENTS = ['SessionStart', 'PreToolUse', 'PostToolUse']

  // Workflows GitHub Actions : nom, déclencheurs (`declencheursDe`), portes npm exécutées.

  /** Une invocation `npm` COMPLÈTE : sous-projet (`--prefix <dir>`) optionnel, verbe
   *  (`ci`/`install`/`test`/`audit`/`run <script>`), options longues comprises. */
  const NPM = /\bnpm\s+(?:--prefix\s+\S+\s+)?(?:ci|install|test|audit|run\s+[\w:-]+)(?:\s+--[\w-]+(?:=\S+)?)*/g

  /** Portes `npm` d'un workflow, dédupliquées dans l'ordre de première apparition. Fail-fast : une
   *  occurrence du mot `npm` que `NPM` ne capture pas est une forme inconnue — le compte mentirait. */
  function portesNpm(fichier, texte) {
    const portes = []
    for (const ligne of corpsRun(texte)) {
      const vues = [...ligne.matchAll(NPM)].map((m) => m[0].replace(/\s+/g, ' '))
      const mots = (ligne.match(/\bnpm\b/g) ?? []).length
      if (vues.length !== mots) {
        abandon(
          `.github/workflows/${fichier} : forme d'invocation npm non reconnue — « ${ligne} » (${mots} occurrence(s) de \`npm\`, ${vues.length} capturée(s)). Étendre le motif \`NPM\` de ce script plutôt que laisser le runbook sous-compter ses portes.`,
        )
      }
      for (const v of vues) if (!portes.includes(v)) portes.push(v)
    }
    return portes
  }

  const WORKFLOWS = listerDossier(chemin('.github/workflows')).filter((f) => f.endsWith('.yml')).map((f) => {
    const texte = readFileSync(`.github/workflows/${f}`, 'utf8')
    const nom = (texte.match(/^name:\s*(.+)$/m) ?? [])[1]
    if (!nom) abandon(`.github/workflows/${f} n'a pas de champ « name: »`)
    const declencheurs = declencheursDe(texte, `.github/workflows/${f}`)
    const crons = [...texte.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1])
    const portes = portesNpm(f, texte)
    // Comment un rouge de CE workflow est-il vu ? Le registre le DÉCLARE, et sa garde le MESURE sur le
    // YAML (scripts/gates/workflowsDuDepot.mjs, scripts/gates/workflowsDuDepot.test.mjs, #1779).
    const etat = REGISTRE_WORKFLOWS[f]
    if (!etat) {
      abandon(
        `.github/workflows/${f} n'a pas d'entrée au registre des workflows (scripts/gates/workflowsDuDepot.mjs) : ` +
          `donne-lui son état (${Object.keys(ETATS_PORTE).join(', ')}) et sa raison.`,
      )
    }
    return { fichier: f, nom, declencheurs, crons, portes, etat: etat.etat, raison: etat.raison }
  })

  function workflow(fichier) {
    const w = WORKFLOWS.find((x) => x.fichier === fichier)
    if (!w) abandon(`.github/workflows/${fichier} introuvable (renommé/supprimé ?)`)
    return w
  }

  // Motifs de `.gitignore` — le tableau des non-versionnés est keyé dessus (fail-fast si un motif
  // disparaît : le runbook cesserait de décrire l'arbre réel).
  const IGNORES = readFileSync(chemin('.gitignore'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  function motif(m) {
    if (!IGNORES.includes(m)) abandon(`motif « ${m} » absent de .gitignore (le runbook le décrit encore)`)
    return m
  }

  // Seuil de partage de la suite — DÉRIVÉ de la logique pure du lanceur, jamais recopié.
  function seuilPartage() {
    for (let n = 1; n <= 256; n += 1) if (repartitionWorkers(n).split) return n
    abandon('scripts/test/partition.mjs ne partage jamais la suite — seuil indérivable')
  }

  const SEUIL = seuilPartage()

  // Comptes d'inventaire du clone.
  const NB_GUARD_LIBS = listerDossier(chemin('scripts/guards/lib')).filter((f) => f.endsWith('.mjs')).length
  const NB_HOOKS_SESSION = listerDossier(chemin('scripts/hooks')).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).length
  /** Scripts de `scripts/hooks/` que la surface Claude DÉCLARE. Le dossier en porte davantage : une
   *  lib importée par un hook n'est pas un hook, et un hook propre à Codex n'est déclaré que là-bas
   *  (`scripts/agents/compat-core.mjs`, `HOOKS_DE_SESSION`). Compter les FICHIERS en disant
   *  « déclarés » faisait mentir cet inventaire. */
  const NB_HOOKS_DECLARES = new Set(EVENEMENTS.flatMap((e) => hooksDeSession(e).map((h) => h.script))).size
  const NB_DEFS = listerDossier(chemin('src/data/schemas/defs')).filter((f) => f.endsWith('.ts')).length
  const NB_DEFS_SCENES = listerDossier(chemin('src/data/schemas/defs-scenes')).filter((f) => f.endsWith('.ts')).length
  const NB_DATA_JSON = listerDossier(chemin('src/data')).filter((f) => f.endsWith('.json')).length
  const ART_REF = listerDossier(chemin('scripts/art-ref')).filter((f) => f.endsWith('.py'))

  const CANARI = workflow('canari.yml')
  const CI = workflow(PORTE)
  const DEPLOY = workflow('deploy.yml')

  const listeCode = (xs) => xs.map((x) => `\`${x}\``).join(', ')

  // ── Gates et livraison : DÉRIVÉ du code, jamais recopié ──────────────────────────────────────────
  // Le régime de livraison, le plan des gates et la recette du lock vivaient en prose dans CLAUDE.md,
  // donc ils y mentaient dès que le code bougeait. Ici, chaque fait a sa source exécutable :
  // `scripts/gates/toutes.mjs` (plan et options), `scripts/guards/lib/npmLockHoisted.mjs` (recette du
  // lock), `scripts/git-hooks/pre-push.mjs` (le régime), `.github/workflows/ci.yml` (les lanes, un job
  // par lane). Aucune MESURE de durée n'est reprise : chaque run du lanceur la remesure.

  const SRC_GATES = readFileSync(chemin('scripts/gates/toutes.mjs'), 'utf8')
  const SRC_PREPUSH = readFileSync(chemin('scripts/git-hooks/pre-push.mjs'), 'utf8')
  const SRC_RULESET = readFileSync(chemin('scripts/ops/ruleset-main.mjs'), 'utf8')

  /** Options de `npm run gates`, DÉRIVÉES du lanceur : `argv.includes` (drapeau) ET `argv.indexOf`
   *  (option à valeur, comme `--gates a,b`) — ne lire que le premier en oubliait la moitié. */
  const OPTIONS_GATES = [...new Set(
    [...SRC_GATES.matchAll(/argv\.(?:includes|indexOf)\('(--[\w-]+)'\)/g)].map((m) => m[1]),
  )].sort()
  if (!OPTIONS_GATES.length) abandon('scripts/gates/toutes.mjs ne lit plus aucune option `--x` — le runbook en annonce')

  /** Variable qui borne la suite pendant les lanes (nommée par le lanceur lui-même). */
  const BORNE_SUITE = (SRC_GATES.match(/\bWFRP_[A-Z_]+COEURS\b/) ?? [])[0]
  if (!BORNE_SUITE) abandon('scripts/gates/toutes.mjs ne borne plus la suite par une variable `WFRP_*COEURS`')

  /** Régime de push : sa date et son verbatim, lus AU RULESET — c'est lui la porte (#1776). */
  const REGIME = /Décision utilisateur du (\d{4}-\d{2}-\d{2}), verbatim : «\s*([^»]+?)\s*»/.exec(
    SRC_RULESET.replace(/^\/\/ ?/gm, '').replace(/\s*\n\s*/g, ' '),
  )
  if (!REGIME) abandon('scripts/ops/ruleset-main.mjs ne porte plus la décision utilisateur datée en verbatim')

  /** Nombre de refus que le hook `pre-push` NOMME — lu au hook, jamais recopié. */
  const NB_REFUS_PREPUSH = (SRC_PREPUSH.match(/^\/\/\s+\d\.\s/gm) ?? []).length
  if (!NB_REFUS_PREPUSH) abandon('scripts/git-hooks/pre-push.mjs ne numérote plus ses refus')

  /** Version de npm exigée pour régénérer le lock — lue DANS la recette, jamais écrite deux fois.
   *  Le module est aussi LU sur disque, pour que les sources mesurées du doc le couvrent. */
  readFileSync(chemin('scripts/guards/lib/npmLockHoisted.mjs'), 'utf8')
  const NPM_LOCK = (REGEN_RECIPE.match(/npm@[\d.]+/) ?? [])[0]
  if (!NPM_LOCK) abandon('REGEN_RECIPE (npmLockHoisted.mjs) ne nomme plus de version de npm')

  // Le classement du push (#1738) est DÉRIVÉ, jamais recopié : `lit` (ECRIT_LU) décide, la liste
  // `DOCUMENTAIRE` (classerPush.mjs) est la référence, et `ci.yml` porte la condition par step.
  const GATES_CI = gatesDeCi({ cwd: chemin('.') })
  const SAUTABLES = gatesSautables({ gates: GATES_CI, ecritLu: ECRIT_LU })
  const GATES_TOUJOURS = GATES_CI.filter((g) => !SAUTABLES.has(g.nom)).map((g) => g.nom)
  const NB_GATES_TOUJOURS = GATES_TOUJOURS.length
  const NB_GATES_SAUTABLES = SAUTABLES.size

  const LANES_CI = lanesDeCi(GATES_CI)
  const lignesLanes = LANES_CI.map((l) => `| \`${l.nom}\` | ${listeCode(l.gates)} |`).join('\n')
  const NB_GATES_CLASSEES = LANES_CI.reduce((n, l) => n + l.gates.length, 0)
  const NB_GATES_MESUREES = Object.keys(ECRIT_LU).length
  /** Écrivain = gate qui écrit à chaque run (`ecrit`) OU qui PEUT écrire, porte nommée (`ecritFerme`). */
  const NB_ECRIVAINS = Object.values(ECRIT_LU).filter(
    (v) => (v.ecrit ?? []).length || Object.keys(v.ecritFerme ?? {}).length,
  ).length

  // ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

  /** Familles de mécanismes posés par `postinstall` : le PRÉDICAT est dérivé des clés `git config`
   *  réellement posées, le texte est ÉDITORIAL. Une clé sans famille déclarée casse ici, nominativement
   *  — plutôt qu'un compte en dur qui mentirait au premier réglage ajouté. */
  const FAMILLES_POSTINSTALL = [
    {
      porte: (c) => c === 'core.hooksPath',
      texte: () =>
        `\`core.hooksPath\` → \`scripts/git-hooks\` : les hooks ${listeCode(HOOKS_GIT)} ne tournent plus. Le
   \`pre-commit\` REFUSE au nom de l'intégrité (arbre imbriqué, lock npm amputé, fins de ligne) et
    AVERTIT sur la forme, que la CI refuse ; les tests liés au diff se jouent à la main
    (\`npm run test:lies\`). \`post-checkout\`,
    \`post-merge\` et \`post-rewrite\` lisent d'abord la plage Git reçue. \`post-commit\` traite les
    commits de fusion résolus manuellement, depuis l'ancien HEAD du reflog vers le nouveau HEAD ;
    un amend du seul message ne réinstalle rien. Un reflog absent impose la réparation conservatrice
    annoncée ; un commit ordinaire ne lance aucun équipement. Un lockfile modifié impose
    \`npm ci\` dans sa racine (racine ou \`server/\`) avant toute génération ; un échec nomme la
    réparation à rejouer et arrête les générations, sans annuler la fusion déjà effectuée. Les docs
    se régénèrent par sélection des sources mesurées, préalables et lecteurs aval ; une mesure
    absente/incomplète, une cible absente ou un outil de mesure modifié impose le lot complet,
    annoncé. Les générateurs de CODE suivent eux aussi cette sélection et ses préalables ; un lot
    vide ou sans source pertinente ne les rejoue pas. Un changement de toolchain impose le lot
    complet, car les lectures de dépendances ne sont pas mesurées. Les cibles de code déjà produites
    se vérifient sans réécriture pendant cette passe.
    Chaque étape annonce début, fin et durée. La fermeture des issues suit la PUBLICATION : job
   \`fermetures\` de
   \`.github/workflows/fermetures.yml\`, sur chaque push de \`main\` dont les checks requis sont verts, qui joue
   \`${script('ops:fermer')} --rattraper <before>..<sha>\` : la base recule jusqu'à la dernière course
   réussie de ce workflow (\`baseDeLaPlage\`, #2155).`,
    },
    {
      module: 'scripts/git-hooks/merge-docs.mjs',
      texte: (module) =>
        `Le pilote de fusion des fiches MIXTES de l'Atlas (${listeCode(pilotesDe(module))}), déclaré par
   \`.gitattributes\` et servi par \`${module}\` : fusion de la prose, champ \`Implémente\` réinjecté ;
   sans lui, chaque rebase rouvre un conflit sur un champ que \`npm run raw:implemente\` régénère seul.`,
    },
    {
      module: 'scripts/git-hooks/merge-stocks.mjs',
      texte: (module) =>
        `Le pilote de fusion des stocks de sites (${listeCode(pilotesDe(module))}), déclaré par
   \`.gitattributes\` et servi par \`${module}\` : fusion par groupe de site ; sans lui, deux soldes
   de groupes disjoints d'un même stock rouvrent un conflit. Un stock se régénère par la commande
   \`npx tsx scripts/guards/lib/regenStock.mts <module qui mesure>\`, jamais par \`docs:build\`.`,
    },
  ].map((f) => ({ ...f, porte: f.porte ?? clePiloteDe(f.module) }))
  for (const c of CONFIGS) {
    if (!FAMILLES_POSTINSTALL.some((f) => f.porte(c))) {
      abandon(
        `clé \`git config ${c}\` posée par postinstall sans famille déclarée dans ce script — la classer dans \`FAMILLES_POSTINSTALL\` avant que le runbook n'annonce un compte faux`,
      )
    }
  }
  const FAMILLES = FAMILLES_POSTINSTALL.filter((f) => CONFIGS.some(f.porte))
  const lignesFamilles = FAMILLES.map((f, i) => `${i + 1}. ${f.texte(f.module)}`).join('\n')

  /** Une porte vise le sous-projet `server/` sous DEUX formes : l'invocation directe
   *  (`npm --prefix server ci`) et le script racine qui la délègue (`npm run server:<x>` — package.json
   *  `server:typecheck` = `npm --prefix server run typecheck`). Ne lire que la première faisait
   *  sous-compter le bucket, qui annonçait alors 1 porte là où le canari en joue deux. */
  const VISE_SERVEUR = /--prefix\s+server\b|\brun\s+server:/
  const PORTES_SERVEUR = CANARI.portes.filter((p) => VISE_SERVEUR.test(p))

  const lignesHooksSession = EVENEMENTS.flatMap((e) =>
    hooksDeSession(e).map(
      (h) => `| \`${e}\` | ${h.matcher.replaceAll('|', ' \\| ')} | \`${h.script}\` | ${h.role} |`,
    ),
  ).join('\n')

  const lignesWorkflows = WORKFLOWS.map(
    (w) =>
      `| \`.github/workflows/${w.fichier}\` | ${w.nom} | ${w.declencheurs.join(', ')}${
        w.crons.length ? ` (cron \`${w.crons.join('`, `')}\`)` : ''
      } | **${w.etat}** — ${w.raison} |`,
  ).join('\n')

  const lignesEtatsPorte = Object.entries(ETATS_PORTE)
    .map(([etat, definition]) => `- **${etat}** — ${definition}`)
    .join('\n')

  /** Non-versionnés : motif de `.gitignore` (DÉRIVÉ) × pourquoi/regénération (ÉDITORIAL). */
  const NON_VERSIONNES = [
    {
      quoi: `PDFs de \`Source/*.pdf\` (\`${motif('*.pdf')}\`)`,
      pourquoi: 'droits Cubicle 7, taille (limite GitHub 100 Mo/fichier)',
      acces:
        'conservés LOCALEMENT ; ré-extraction via `bash scripts/raw/reextract-all.sh <id>…` (Marker, staging `Source/_marker/split/`, **ne promeut pas** — revue manuelle avant d\'écraser `Source/`)',
    },
    {
      quoi: `Staging Marker (\`${motif('Source/_marker/')}\`)`,
      pourquoi: 'intermédiaire de pipeline ; seuls les chapitres curés `Source/<Livre>/NN - *.md` sont committés',
      acces: 'régénéré par le pipeline `scripts/raw/marker-*`',
    },
    {
      quoi: `Images extraites des PDF (\`${motif('/art-ref/')}\`)`,
      pourquoi: 'droits Cubicle 7, ce sont des sorties ; le pipeline lui-même reste tracké sous `scripts/art-ref/`',
      acces: `régénérables via ${listeCode(ART_REF.map((f) => `scripts/art-ref/${f}`))} + les PDFs locaux`,
    },
    {
      quoi: `Sorties de QC (\`${motif('public/qc/*')}\`)`,
      pourquoi: 'planches de revue régénérables — pas du source',
      acces: `régénérables par les scripts \`scripts/qc/\` ; deux exceptions restent VERSIONNÉES : \`${motif('!public/qc/baseline-affine/')}\` (baseline affine, #1176 C3) et \`${motif('!public/qc/soldes/')}\` (les captures que cite le champ \`capture:\` d'un solde — la porte \`verifierCapture\` de \`scripts/hooks/solde-ticket-guard.mjs\` refuse une capture ignorée par git)`,
    },
    {
      quoi: `Réglages Claude Code personnels (\`${motif('.claude/*')}\`)`,
      pourquoi: 'environnement local',
      acces: `exceptions VERSIONNÉES : ${listeCode(
        IGNORES.filter((l) => l.startsWith('!.claude/')).map((l) => l.slice(1)),
      )}`,
    },
  ]

  const lignesNonVersionnes = NON_VERSIONNES.map((n) => `| ${n.quoi} | ${n.pourquoi} | ${n.acces} |`).join('\n')

  const out = `# Reprise après pause

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-reprise.mjs\` (\`npm run docs:reprise\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — la part FACTUELLE est lue aux fichiers réels : scripts npm et
leur contenu (\`package.json\`), clés \`git config\` posées par \`postinstall\`, hooks Git présents sous
\`scripts/git-hooks/\`, hooks de session déclarés dans \`.claude/settings.json\`, workflows de
\`.github/workflows/\` (nom, déclencheurs, portes \`npm\` exécutées — lues aux corps \`run:\`, forme
inline ET blocs \`run: |\`, \`--prefix\` et \`audit\`/\`ci\` compris ; une forme d'invocation npm inconnue
y fait ÉCHOUER le script plutôt que sous-compter), motifs de \`.gitignore\`, seuil de
partage de la suite calculé sur \`repartitionWorkers\` (\`scripts/test/partition.mjs\`). Un renommage
casse ce script au lieu de laisser le \`.md\` mentir. **Angles morts** : ce runbook ne mesure PAS
l'état de la machine (auth \`gh\`, PDFs présents, compte Cloudflare) — il dit où ça vit, pas si c'est
là ; une invocation \`npm\` posée AILLEURS que dans un corps \`run:\` (action composite \`uses:\`, script
appelé par une étape) reste hors mesure ; les motivations (« pourquoi ce fichier n'est pas versionné »), la cadence d'archivage et les
conseils de vérification sont de l'ÉDITORIAL fixé dans le script, non re-dérivé à chaque run ; les
secrets d'Actions ne sont pas lisibles depuis le dépôt (leur nom seul est cité).

Référence vivante : que faire pour repartir de zéro (nouvelle machine, clone frais) après une
longue pause. Chaque chemin/symbole cité existe dans le repo — vérifié via \`npm run docs:check\`.

## 1. Redémarrage code (clone nu → jeu qui tourne)

\`\`\`bash
git clone <url> && cd Game
npm install     # vérifie le contrat TypeScript, pose ${CONFIGS.length} réglages git et produit les cibles de code (script "postinstall" de package.json)
npm test        # suite du moteur — deux processus Vitest (node + jsdom) si ≥ ${SEUIL} cœurs, sinon un seul
npm run dev     # http://localhost:5173 (un CLONE garde le port historique)
\`\`\`

**Chantier et publication.** \`npm run ops:chantier -- <N>\` (\`${script('ops:chantier')}\`) ouvre le
chantier du ticket \`<N>\` depuis n'importe quel worktree du dépôt (le chantier se pose à côté de
l'arbre principal) : il pose le worktree lié \`.wt-<N>\` sur \`origin/main\`, crée la branche
\`chantier/<N>\`, y joue \`npm ci\` et imprime le port dev dérivé. \`npm run ops:publier -- --detache\`
(\`${script('ops:publier')}\`) joue ensuite le train de publication ENTIER depuis ce worktree, détaché
du harnais, et imprime son \`pid\`, son \`log\` et sa \`veille\` : la commande exacte
(\`node <racine>/scripts/ops/publier.mjs --veiller <run>\`) qui SUIT ce run jusqu'au verdict — elle lit le
journal JSON, émet une ligne par transition d'étape, finit sur la ligne \`PUBLICATION:\` et sort en 0
(vert), 1 (rouge) ou sur un code nommé (indéterminée, arrêt moteur, borne dépassée). C'est la seule
veille d'un train : jamais un filtre du log texte écrit à la main. Chaque ligne porte le numéro
\`#<seq>\` de sa transition ; une veille interrompue se RÉ-ARME par la même commande suivie de
\`--depuis <dernier seq lu>\`, sans rien ré-émettre, et sa borne court depuis le LANCEMENT du run. La CI d'une
branche poussée s'attend de même, en fond : \`npm run ops:ci -- --attendre [<sha>]\` (\`${script('ops:ci')}\`)
attend la course \`CI\` du sha poussé et sort sur son verdict, un code par verdict (verte 0, rouge 1, annulée,
absente, borne dépassée), en nommant sur un rouge les tests en échec de chaque job rouge ; \`--echecs <run>\`
rend cette extraction pour une course nommée. Le train régénère et commet les docs MIXTES (\`node scripts/docs/build-all.mjs --mixtes\`), POUSSE la branche
de chantier, ouvre sa PR vers \`main\` et l'ARME ; la FILE DE FUSION du serveur la juge sur son commit de
file et la fusionne, et le train attend cette fusion (borné par \`--file-timeout-min\`). Aucun rebase : une
PR éjectée de la file pour un conflit ou un dérivé périmé se reprend par une FUSION d'\`origin/main\`
dans la branche, une fois ; un run neuf rotationne le log
précédent en \`<branche>.<AAAAMMJJ-HHMMSS>.log\` (péremption 7 jours) — ce n'est pas une archive, le
\`npm ci\` d'\`ops:chantier\` efface \`node_modules/.cache/\`.

**Reprise serveur de file.** Le workflow \`reprise-file.yml\` reprend les PR ouvertes par le train de \`chantier/**\` vers \`main\` après une CI verte, même après la mort du train et un rerun. Leur corps porte la signature canonique écrite par le train. Il lit exclusivement le code de \`main\`, relit la tête avant la demande REST \`merge-async\`, suit une réponse \`pending\` pendant au plus 12 sondes espacées de 5 secondes et ne dit « en file » que sur \`enqueued\`. Une réconciliation toutes les 10 minutes couvre une PR ouverte après la CI ; GitHub peut retarder une course planifiée. Le résumé du run et les commentaires sur la PR et ses tickets cités portent le SHA, le run/attempt et le résultat ; les commentaires lient la course CI et la veille serveur. Un refus ou une indétermination donne la commande \`npm run ops:publier -- --detache\`. La sonde \`node scripts/ops/reprendre-file.mjs --lecture-seule\` lit les candidates sans demander de fusion ni commenter.

**Suivi de vague.** Toute reprise (compaction, lendemain, pause) commence par RELIRE
\`.git/suivi/<N>.md\`, le suivi de l'épique \`<N>\` : seule source du plan et du prochain geste, il vit
dans le répertoire git COMMUN, hors versionnement — un clone frais ne l'a pas.
\`npm run ops:suivi -- <N>\` (\`${script('ops:suivi')}\`) en rafraîchit la zone mesurée (branche,
avance, état d'issue de chaque ticket prévu) et l'imprime ; \`-- <N> --creer\` pose le suivi d'une
vague neuve, et sans \`<N>\` il liste les suivis présents.

\`ops:chantier\` annonce le fetch, la création du worktree et chaque équipement avant de les
lancer ; \`ops:suivi\` annonce chaque geste de sa mesure, puis imprime son profil final. Ces
annonces portent début, fin et durée sur stderr ; la sortie des équipements reste visible.
Lors du \`post-checkout\` initial d'un worktree (ancien SHA de quarante zéros et mesure absente),
le hook annonce cet équipement requis et laisse \`ops:chantier\` le jouer une seule fois.

Le port n'est historique QUE pour un arbre principal ou un clone : un **worktree lié** en dérive un
autre (5174-5272, \`scripts/port-dev.mjs\`) pour que deux arbres servis en même temps ne se recouvrent
jamais. \`npm run dev\` imprime celui qu'il sert.

\`npm install\` déclenche le script \`postinstall\`, qui joue d'abord \`${CONTRAT_TYPESCRIPT}\` :
version exacte, application de \`${PATCH_TYPESCRIPT}\`, puis vérification du contrat UTF-16 natif
(texte, littéraux, positions et diagnostics). Le cycle de mise à jour et de retrait du correctif
est décrit dans \`${CYCLE_PATCH_TYPESCRIPT}\`. Il pose ensuite : ${listeCode(CONFIGS)} ; puis il produit les
cibles de CODE, jamais commitées (\`npm run gen\`, #2203) — les docs dérivés, eux, se produisent par
\`npm run docs:build\`.

**Sans ce postinstall, ${FAMILLES.length} familles de mécanismes Git sont MORTES.**

${lignesFamilles}

Le partage de la suite (\`${script('test')}\`) est décidé par \`repartitionWorkers\` : en dessous de
${SEUIL} cœurs, un seul processus Vitest ; au-delà, un processus \`node\` et un processus \`jsdom\`. Les
cœurs servis sont bornés par la mémoire DISPONIBLE au lancement (\`capacite\`) : autant de workers que
la mémoire en porte, à l'empreinte mesurée d'un worker sous sa borne de tas, une réserve déduite par
processus Vitest. Les variables
d'environnement \`WFRP_TEST_COEURS\` et \`WFRP_TEST_MEMOIRE_MO\` forcent ces deux mesures (seule façon
de jouer l'autre chemin sur une machine quelconque).

\`src/data/*.json\` (${NB_DATA_JSON} fichiers) est la **SOURCE app-owned** : rien à régénérer après le clone.

Le canari (\`.github/workflows/canari.yml\`, ${CANARI.declencheurs.join(' + ')}, cron
\`${CANARI.crons.join('`, `')}\`) rejoue exactement ce chemin en CI, sur un runner propre, en
${CANARI.portes.length} portes :

${CANARI.portes.map((p) => `- \`${p}\``).join('\n')}

${
    PORTES_SERVEUR.length
      ? `Dont ${PORTES_SERVEUR.length} porte${PORTES_SERVEUR.length > 1 ? 's' : ''} sur le sous-projet \`server/\` (relay coop) :
${listeCode(PORTES_SERVEUR)} — son \`node_modules\` et son typecheck sont indépendants de ceux de la
racine, un clone frais doit les poser AUSSI.

`
      : ''
  }Son step de résumé poste le rapport en commentaire sur l'issue \`canari\` la plus ANCIENNE encore
ouverte — il n'en crée une que s'il n'y en a aucune, et la FERME quand toutes les mesures sont vertes.
C'est le signal qu'un geste manuel a dévié de ce que \`npm install\` pose seul.

## 2. Ce que le clone CONTIENT

- \`${chemin('Source')}/\` — texte des livres en \`.md\`, **citable** (réfs \`LDB <chap> l.<ligne>\`).
- \`src/data/\` — données app-owned (${NB_DATA_JSON} fichiers JSON commités, éditables au Compendium).
- Les gardes de données : ${NB_GUARD_LIBS} modules
  sous \`scripts/guards/lib/\` (dont \`scripts/guards/lib/commentPoison.mjs\`,
  \`scripts/guards/lib/emojiAffordance.mjs\`, \`scripts/guards/lib/hardcode.mjs\`,
  \`scripts/guards/lib/labelLogic.mjs\`).
- Les gardes de SESSION : ${NB_HOOKS_DECLARES} scripts déclarés dans \`.claude/settings.json\`
  (versionné), sur ${NB_HOOKS_SESSION} fichiers \`.mjs\` hors test sous \`scripts/hooks/\` — détail au § 5.
- Les schémas de données : \`src/data/schemas/\` (\`src/data/schemas/types.ts\`,
  \`src/data/schemas/validate.ts\`, \`src/data/schemas/_registry.generated.ts\`,
  \`src/data/schemas/_ids.generated.ts\`, \`src/data/schemas/grammaire/\` — le vocabulaire partagé —
  \`src/data/schemas/defs/\` : ${NB_DEFS} fichiers, un par catalogue, et
  \`src/data/schemas/defs-scenes/\` : ${NB_DEFS_SCENES} fichiers pour les documents de scène).
- \`scripts/art-ref/\` — le PIPELINE d'extraction d'images (${listeCode(ART_REF)}) : le code est
  tracké, ses SORTIES (images) ne le sont pas (§ 3).

## 3. Ce que le clone NE contient PAS — et où ça vit

| Non-versionné | Pourquoi (\`.gitignore\`) | Régénération / accès |
|---|---|---|
${lignesNonVersionnes}

Ne sont pas non plus dans le clone, parce que ce ne sont pas des fichiers :

- **Compte Cloudflare du relay coop** — URL de prod dans \`src/net/relay.ts\` (\`RELAY_URL_PROD\`) ;
  redéployable via \`npm run relay:deploy\` (\`${script('relay:deploy')}\`).
- **Publication du jeu en prod** — workflow \`.github/workflows/deploy.yml\` (« ${DEPLOY.nom} »,
  ${DEPLOY.declencheurs.join(', ')}) ; il build le COMMIT de \`main\` sur un runner propre. Secret
  Actions \`PROD_DEPLOY_KEY\` (deploy key SSH) requis côté dépôt ; aucun clone local du dépôt prod
  nécessaire.
- **Auth \`gh\` (CLI GitHub)** — credentials locales, nécessaires aux commandes \`gh\` manuelles et aux
  gestes \`ops:*\` joués à la main (\`${script('ops:fermer')}\`, \`${script('ops:fermetures-non-citees')}\`).
  La fermeture des issues tourne en CI (job \`fermetures\`, \`GITHUB_TOKEN\`), comme l'export hebdomadaire.

## 4. Archivage des non-versionnés

Cadence recommandée : **à chaque nouveau livre importé** (PDF + art-ref associé), archiver vers
un stockage externe (l'utilisateur y consolide déjà les PDFs sources).

\`\`\`powershell
Compress-Archive -Path "Source\\*.pdf","art-ref" -DestinationPath "<stockage-externe>\\game-sources-$(Get-Date -Format yyyy-MM-dd).zip"
\`\`\`

Adapter \`<stockage-externe>\` (disque externe, cloud perso) — cette commande ne fait QUE lire
les non-versionnés locaux, elle ne touche pas au repo.

## 5. Portes de qualité — où elles vivent, comment vérifier qu'elles tournent

**Hooks Git locaux** (${listeCode(HOOKS_GIT)}) : posés par \`npm install\` via \`core.hooksPath\`.
Vérifier : \`git config core.hooksPath\` doit répondre \`scripts/git-hooks\`. Si vide → hooks MORTS,
refaire \`npm install\`.

**Hooks de session Claude Code** (mise en conformité au démarrage, gardes anti-dérive à l'écriture), déclarés dans
\`.claude/settings.json\` :

| Événement | Déclencheur (matcher) | Script | Rôle |
|---|---|---|---|
${lignesHooksSession}

**CI GitHub Actions** :

| Fichier | Nom | Déclencheurs | État |
|---|---|---|---|
${lignesWorkflows}

La colonne « État » vient du registre \`scripts/gates/workflowsDuDepot.mjs\`, et chaque état y est
MESURÉ sur le YAML (garde \`scripts/gates/workflowsDuDepot.test.mjs\`) :

${lignesEtatsPorte}

Vérifier qu'elles tournent : onglet Actions du dépôt, ou \`gh run list --workflow=canari.yml\`. LA
PORTE est \`.github/workflows/ci.yml\` (« ${CI.nom} », ${CI.declencheurs.join(', ')}) : elle joue les
gates sur CHAQUE branche \`chantier/**\` et sur chaque commit de la file de fusion, et c'est son verdict —
jamais un artefact local — qui autorise une PR à entrer dans \`main\`. Elle CLASSE d'abord le push
(\`scripts/gates/classerPush.mjs\`) : un push dont tous les fichiers changés tombent sous
${listeCode(Object.keys(DOCUMENTAIRE))} ne joue que les ${NB_GATES_TOUJOURS} gates qui LISENT un de
ces chemins (${listeCode(GATES_TOUJOURS)}) ; les ${NB_GATES_SAUTABLES} autres sont sautées.

\`npm run ops:publier\` joue le train : docs dérivés, push de la BRANCHE, PR armée, attente de la fusion
par la file, pilotage. Il refuse à la première étape rouge en la nommant,
et son journal sépare le temps machine LOCAL du temps d'ATTENTE de GitHub.

## 6. Gates et livraison

**Régime** (arbitrage utilisateur ${REGIME[1]} : « ${REGIME[2]} ») : une branche \`chantier/**\` se
pousse **LIBREMENT**, aussi souvent qu'on veut — c'est le push qui déclenche la CI, et la CI joue les
mêmes gates que la file. \`main\` n'avance que par la **FILE DE FUSION**, et c'est le SERVEUR qui la
tient et la SÉRIALISE : le ruleset \`main\` (\`${script('ops:ruleset')}\`, mode \`active\`) exige une PR,
la file (méthode MERGE) et les checks requis sur chaque commit de file, refuse le non-fast-forward et la
suppression. Un push de PLUSIEURS commits est jugé par sa **TÊTE** — c'est la seule unité que la CI joue.

Le hook \`scripts/git-hooks/pre-push.mjs\` est le MIROIR LISIBLE de ce ruleset, jamais la porte : il
nomme ${NB_REFUS_PREPUSH} refus, dont celui de TOUT push vers la ref \`main\`.
Ajouter une gate, c'est ajouter UN step à \`ci.yml\` — rien d'autre ne la récite.

**Rejeu LOCAL \`npm run gates\`** (\`${script('gates')}\`), un confort de diagnostic, jamais une porte :
${NB_GATES_CLASSEES} gates en ${LANES_CI.length} lanes parallèles de LECTEURS — aucune gate
n'écrit dans l'arbre hors de sa porte (\`ecritFerme\`) :

| Lane | Gates |
|---|---|
${lignesLanes}

Une lane est un job de \`ci.yml\` (\`lanesDeCi\`), ou plusieurs quand \`LANE_LOCALE_DE_JOB\`
(\`scripts/gates/gatesDeCi.mjs\`) rattache un job à la lane d'un autre ; le job matrice \`suite\` joue la
gate \`test\` en parties disjointes (\`WFRP_TEST_PARTIE\`), la lane locale la joue entière. \`ECRIT_LU\` (\`scripts/gates/toutes.mjs\`) dit ce
que CHAQUE gate écrit et lit (${NB_GATES_MESUREES} gates mesurées, dont
${NB_ECRIVAINS} écrivain(s) — écriture de chaque run ou écriture POSSIBLE à porte nommée) ; c'est elle
qui rend le classement vérifiable plutôt que déclaratif. La suite est BORNÉE par \`${BORNE_SUITE}\`
pendant que les autres lanes tournent. Options : ${listeCode(OPTIONS_GATES)}. Une gate de \`ci.yml\`
sans entrée ÉCRIT/LU, ou jouée par deux jobs, fait REFUSER le run, avec son nom.

**\`package-lock.json\`** : le régénérer TOUJOURS avec ${NPM_LOCK}, recette exacte de
\`scripts/guards/lib/npmLockHoisted.mjs\` — ${REGEN_RECIPE}. npm 11 ampute les entrées hoistées
\`@emnapi/*\` que \`npm ci\` exige en CI ; la garde (pre-commit +
\`src/npm-lock-hoisted-guard.test.ts\`) refuse un lock amputé.
`
  return {
    out,
    path: 'docs/reprise-apres-pause.md',
    staleMsg:
      'docs:reprise — docs/reprise-apres-pause.md est PÉRIMÉ (diverge de package.json, .gitignore, .claude/settings.json, .github/workflows/, scripts/git-hooks/ ou du script).',
    rerunMsg: '  → relancer `npm run docs:reprise` (dérivé jamais commité, #2203).',
    okMsg: 'docs:reprise — OK (docs/reprise-apres-pause.md à jour)',
    writeMsg: `docs/reprise-apres-pause.md — ${WORKFLOWS.length} workflows, ${HOOKS_GIT.length} hooks Git, ${NB_HOOKS_SESSION} gardes de session référencés.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })
