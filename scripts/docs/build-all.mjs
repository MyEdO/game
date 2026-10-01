// scripts/docs/build-all.mjs — produit TOUS les dérivés (`npm run docs:build`), ou leurs seules cibles
// de CODE (`--code`, `npm run gen`).
// SOURCE UNIQUE de la liste des dérivés : `GENERATORS`. Une cible de `targets` sort EN ENTIER de son
// générateur : elle n'est PAS commitée (#2203 A2 — `ciblesPures`, bloc de `.gitignore`, garde
// scripts/docs/cibles-pures.test.mjs) et se produit là où on la lit. Ses cibles de CODE (`ciblesDeCode`)
// par `genererCode` : `postinstall`, hooks post-checkout / post-merge / post-rewrite, `buildStart` de
// vite.config.ts ; ses docs par `docs:build`. Un fichier où un générateur n'injecte qu'un BLOC
// (`injecte`) est MIXTE : il reste commité, et la CI le juge par `docs:build` puis `Arbre inchangé`.
// `--check` (`npm run docs:check`) rend chaque générateur et compare son rendu au disque sans rien
// écrire.
// Ordre motivé : les registres générés passent EN TÊTE (les générateurs de docs lisent `src/`) ; les
// rapports d'Atlas LISENT les fiches docs/raw (`pagesLues` de coverage.mjs, `computeReconciliation`
// de reconcile.mjs, `scan` de reanchor.mjs), ils passent donc APRÈS build-implemente qui y injecte ;
// leurs catalogues sont le rendu de build-catalogs (`pagesDeLAtlasRendues`). C'est cet ordre qui
// autorise une source elle-même GÉNÉRÉE : une source écrite par un générateur PLUS TARD dans la liste
// serait lue périmée, et se fait refuser par nom.
//
// SOURCES LUES (#1679) : chaque générateur est lancé avec `scripts/docs/lib/enregistreur-lectures.mjs`
// en préchargeur (`NODE_OPTIONS`, donc les sous-processus node en héritent) : ce qu'il lit se MESURE.
// Le set fusionné part dans `docs/.sources-lues.json`, dérivé LOCAL (jamais commité) que lit la
// sélection de scripts/git-hooks/docs-rebuild.mjs ; la lecture d'une source écrite au même rang ou
// plus tard est refusée par nom. Le rendu est DÉTERMINISTE (tout est trié).
// Un générateur `runner: 'tsx'` se lance par `node --import tsx/esm` (`tsx/dist/cli.mjs` re-spawne un
// processus) ; un dumper passe par `resoudreOutilLocal` + `envIsole`, qui transmettent l'env.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { binLocal, envIsole, resoudreOutilLocal } from '../lancer-local.mjs'
import { correspondGlob, listerArbre } from '../guards/lib/lister.mjs'
import { MOTIF_CATALOGUES } from '../raw/motif-catalogues.mjs'
import { SORTIES as SORTIES_DU_REGISTRE } from '../gen-registry.mjs'
import { execFileResilient } from '../guards/lib/spawnResilient.mjs'
import { ENV_CIBLES_RENDUES, estUnDocMarkdown, fusionnerLectures, serialiserSourcesLues } from './lib/ecriture-derives.mjs'
import { ignoresGit } from './lib/chemin-mesure.mjs'

/** `{ runner, script, targets, injecte }` — `runner` = 'node' | 'tsx' ; `targets` = fichiers ÉCRITS
 *  EN ENTIER (glob toléré), jamais commités (`ciblesPures`) ; `injecte` = fichiers commités
 *  dont le générateur ne réécrit QU'UN BLOC (il les relit, ils ne sont donc pas ses sources).
 *  Tout générateur sait `--check` : un de plus coûte une ligne ici, et rien d'autre.
 *  Tout générateur exporte `rendre()` : cible (chemin relatif POSIX) → texte, sans écrire ; il n'écrit
 *  que sous sa porte `import.meta.main`. Un lecteur du texte d'une cible passe par `rendreCible`.
 *  Ordre = ordre d'exécution. */
export const GENERATORS = [
  { runner: 'node', script: 'scripts/gen-registry.mjs', targets: SORTIES_DU_REGISTRE },
  { runner: 'node', script: 'scripts/raw/build-atlas-index.mjs', targets: [], injecte: ['docs/raw/**/00-index.md'] },
  { runner: 'node', script: 'scripts/raw/build-catalogs.mjs', targets: [MOTIF_CATALOGUES] },
  { runner: 'node', script: 'scripts/raw/build-implemente.mjs', targets: [], injecte: ['docs/raw/**/*.md'] },
  { runner: 'node', script: 'scripts/docs/build-primitives.mjs', targets: ['docs/primitives.md'] },
  { runner: 'node', script: 'scripts/docs/build-systemes.mjs', targets: ['docs/systemes.md'] },
  { runner: 'node', script: 'scripts/docs/build-donnees.mjs', targets: ['docs/donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-sources-vf.mjs', targets: ['docs/sources-vf.md'] },
  { runner: 'node', script: 'scripts/docs/build-effects.mjs', targets: ['docs/campagne-effects.md'] },
  { runner: 'node', script: 'scripts/docs/build-vocabulaire.mjs', targets: ['docs/vocabulaire-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-index-moteur.mjs', targets: ['docs/index-moteur.md'] },
  { runner: 'node', script: 'scripts/docs/build-registre-jets.mjs', targets: ['docs/registre-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-usages-jets.mjs', targets: ['docs/usages-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-entity-orphans.mjs', targets: ['docs/orphelines-donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-test-scenarios.mjs', targets: ['docs/test-scenarios.md'] },
  { runner: 'node', script: 'scripts/docs/build-reprise.mjs', targets: ['docs/reprise-apres-pause.md'] },
  { runner: 'node', script: 'scripts/docs/build-icones.mjs', targets: ['docs/ajouter-une-icone.md'] },
  { runner: 'node', script: 'scripts/docs/build-codex-relations.mjs', targets: ['docs/codex-relations.md'] },
  { runner: 'node', script: 'scripts/docs/build-map-authoring.mjs', targets: ['docs/map-authoring.md'] },
  { runner: 'node', script: 'scripts/docs/build-passifs.mjs', targets: ['docs/systeme-passifs.md'] },
  { runner: 'node', script: 'scripts/docs/build-rendu-pipeline.mjs', targets: ['docs/rendu-pipeline.md'] },
  { runner: 'node', script: 'scripts/docs/build-flux-de-jet.mjs', targets: ['docs/ajouter-un-flux-de-jet.md'] },
  { runner: 'node', script: 'scripts/docs/build-mecanique.mjs', targets: ['docs/ajouter-une-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-sort.mjs', targets: ['docs/ajouter-un-sort.md'] },
  { runner: 'node', script: 'scripts/docs/build-ajouter-donnee.mjs', targets: ['docs/ajouter-une-donnee.md'] },
  { runner: 'node', script: 'scripts/docs/build-regles-optionnelles.mjs', targets: ['docs/regles-optionnelles.md'] },
  { runner: 'node', script: 'scripts/docs/build-doctrines.mjs', targets: ['docs/doctrines.md'] },
  { runner: 'tsx', script: 'scripts/gen-sorts-doc.mts', targets: ['docs/sorts-implementation.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-field-consumers.mts', targets: ['docs/consommateurs-de-champs.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-structures.mts', targets: ['docs/structures-donnees.md'] },
  { runner: 'node', script: 'scripts/raw/coverage.mjs', targets: ['docs/raw/coverage.md'] },
  { runner: 'node', script: 'scripts/raw/reconcile.mjs', targets: ['docs/raw/reconciliation.md'] },
  { runner: 'node', script: 'scripts/raw/reanchor.mjs', targets: ['docs/raw/reanchor.md'] },
]

/** Chemin du dérivé LOCAL qui porte les sets MESURÉS, un par générateur. */
export const SOURCES_LUES = 'docs/.sources-lues.json'

/** Les cibles PURES : chaque `targets` de `generateurs` (un glob déplié sur le disque de `cwd`, un
 *  littéral tel quel), plus `SOURCES_LUES`. Aucune n'est commitée (#2203 A2) : c'est la liste que
 *  `--cibles-pures` imprime pour `git rm --cached`. */
export const ciblesPures = (cwd, generateurs = GENERATORS) =>
  [...new Set([...ciblesSurDisque(generateurs.flatMap((g) => g.targets), cwd), SOURCES_LUES])].sort()

/** `chemin` (relatif POSIX) est-il une cible PURE : `SOURCES_LUES`, ou un chemin qu'un `targets` de
 *  `generateurs` atteint (`generateurParmi`) ? Répond sans disque. `generateurs` sans défaut : les
 *  étapes du train l'importent, et `GENERATORS` n'entre pas dans leur clôture. */
export const estCiblePure = (chemin, generateurs) =>
  chemin === SOURCES_LUES || generateurParmi(chemin, generateurs) !== undefined

/** Les générateurs qui écrivent au moins une cible de CODE (une cible qui n'est pas un doc Markdown,
 *  `estUnDocMarkdown`) : ceux que `genererCode` joue, dans l'ordre de `GENERATORS`. */
export const generateursDeCode = (generateurs = GENERATORS) =>
  generateurs.filter((g) => g.targets.some((t) => !estUnDocMarkdown(t)))

/**
 * Produit les cibles de CODE (`generateursDeCode`), en écriture, sans enregistreur : LA
 * fonction des points de génération du code — `npm run gen`, `postinstall`, les hooks git
 * post-checkout / post-merge / post-rewrite, `buildStart` de vite.config.ts. `quiet` capture la sortie
 * d'un générateur VERT. REND le code de sortie : 0, ou 1 au premier rouge, nommé.
 */
export function genererCode({ cwd, quiet = false, generateurs = GENERATORS }) {
  const deCode = generateursDeCode(generateurs)
  const tsxEsm = deCode.some((g) => g.runner === 'tsx') ? tsxEsmDe(cwd) : null
  for (const g of deCode) {
    try {
      run(g, { cwd, quiet, check: false, tsxEsm })
    } catch (e) {
      transmettreDiagnostic(e, quiet)
      process.stderr.write(`gen — ARRÊT sur ${g.script} (${natureDuRouge(issueDe(e))}) : les cibles de code ne sont PAS à jour.\n`)
      return 1
    }
  }
  return 0
}

/** Étapes de `--check` qui ne GÉNÈRENT rien (vérificateurs purs, sans `--check`) : `build-all.mjs`
 *  les exécute lui-même, après les générateurs. */
export const NON_GENERATOR_CHECKS = [
  'scripts/docs/check-doc-refs.mjs',
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/raw/check-atlas-counts.mjs',
  'scripts/data/check-progression-schemas.mjs',
]

const moduleDeLib = (nom) => pathToFileURL(fileURLToPath(new URL(`lib/${nom}`, import.meta.url))).href

const ENREGISTREUR = moduleDeLib('enregistreur-lectures.mjs')

/**
 * Entrée ESM de `tsx` DANS CET ARBRE (`exports['./esm']`). L'exécutable `tsx` re-spawne un processus
 * node : le générateur y perdrait le préchargeur passé en argument. `resoudreOutilLocal` porte le
 * refus nommé quand l'arbre ne l'a pas installé (porte d'outillage local, #1679 L1c) — la résolution
 * ci-dessous ne peut donc rendre que le paquet de cet arbre, trouvé au premier `node_modules` remonté.
 * Le sous-chemin se résout par le SPÉCIFICATEUR (`import.meta.resolve`), pas en relisant `exports`
 * à la main : c'est la résolution que joue `node --import`, conditions d'import comprises, et elle
 * est LUE STATIQUEMENT par `knip --dependencies` — sans elle `tsx` n'a plus aucune référence de code
 * et est rapporté devDependency inutilisée (CI 33691303703, rouge après le passage de `npx tsx` à la
 * résolution par nom).
 */
function tsxEsmDe(cwd) {
  const { refus } = resoudreOutilLocal(cwd, 'tsx', 'tsx')
  if (refus) {
    console.error(refus)
    process.exit(1)
  }
  return fileURLToPath(import.meta.resolve('tsx/esm'))
}

/** Chemins visés par une liste de `targets`/`injecte` — un glob se déplie sur le disque dans la
 *  grammaire UNIQUE du dépôt (`motifDeGlob` / `correspondGlob`, `scripts/guards/lib/lister.mjs`), et
 *  dans aucune autre : ce site ne lit pas le motif lui-même, il le DONNE à lire.
 *  La marche est bornée DEUX fois, par le motif seul : à la racine, ses segments sans joker ; en
 *  PROFONDEUR, un dossier n'est descendu que si un PRÉFIXE du motif le vise encore — `docs/*.md` ne
 *  marche donc pas `docs/raw/`, et `docs/raw/**\/00-index.md` descend tout `docs/raw/`. */
export function ciblesSurDisque(cibles, cwd) {
  return cibles.flatMap((cible) => {
    if (!cible.includes('*')) return [cible]
    const segments = cible.split('/')
    const dossier = segments.slice(0, segments.findIndex((s) => s.includes('*'))).join('/')
    const sous = (rel) => (dossier ? `${dossier}/${rel}` : rel)
    const prefixes = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'))
    return listerArbre(path.join(cwd, dossier), {
      absent: 'vide',
      descendre: (rel) => prefixes.some((p) => correspondGlob(sous(rel), p)),
    })
      .map(sous)
      .filter((p) => correspondGlob(p, cible))
  })
}

/**
 * Argv et env d'un générateur. L'enregistreur en `NODE_OPTIONS` quand le rendu se mesure, puis
 * `tsx/esm` (argv, joué après `NODE_OPTIONS`). `rendues` : le fichier de `ENV_CIBLES_RENDUES`.
 */
function commandeDe({ runner, script }, { cwd, check, tsxEsm, lectures, ignores, cibles, rendues }) {
  const args = [
    ...(runner === 'tsx' ? ['--import', pathToFileURL(tsxEsm).href] : []),
    script,
    ...(check ? ['--check'] : []),
  ]
  const env = envIsole(process.env, binLocal(cwd))
  if (lectures) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import ${ENREGISTREUR}`.trim()
  if (rendues) env[ENV_CIBLES_RENDUES] = rendues
  if (lectures) {
    env.WFRP_LECTURES_RACINE = cwd
    env.WFRP_LECTURES_SORTIE = path.join(lectures, 'l')
    env.WFRP_LECTURES_IGNORES = ignores
    env.WFRP_LECTURES_CIBLE = cibles.join(',')
  }
  return { args, env }
}

function run(g, options) {
  const { args, env } = commandeDe(g, options)
  // Rejeu si le processus n'a pas DÉMARRÉ : sous quatre lanes de gates, le loader Windows a refusé
  // d'initialiser `build-implemente.mjs` (3221225794) et `docs:check` est sorti ROUGE en 48,6 s sur
  // un arbre sain (mesuré le 2026-09-04). Tout autre code reste un vrai verdict.
  execFileResilient(process.execPath, args, {
    cwd: options.cwd,
    env,
    ...sortiesDe(options.quiet),
  }, { site: `build-all/${g.script}` })
}

/** `--quiet` capture les deux flux au lieu de les jeter : le diagnostic d'un rouge (le cliquet parle
 *  sur stdout, la primitive sur stderr) se rend par `transmettreDiagnostic`. */
const sortiesDe = (quiet) =>
  quiet ? { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 } : { stdio: 'inherit' }

/** `--quiet` tait la sortie d'un processus VERT, jamais le diagnostic d'un rouge. */
function transmettreDiagnostic(e, quiet) {
  if (!quiet) return
  if (e.stdout) process.stdout.write(e.stdout)
  if (e.stderr) process.stderr.write(e.stderr)
}

/** Un générateur lit au MOINS son propre fichier et une source : en dessous, la mesure a échoué. */
export const SEUIL_SOURCES = 2

/**
 * Message d'ARRÊT quand le set mesuré d'un générateur est vide ou minuscule — jamais une mesure
 * rendue sur du vide. Sans les trois mécaniques (`syncBuiltinESMExports`, `NODE_OPTIONS`,
 * `tsx/esm`), 7 générateurs rendaient 10 chemins ou moins (mesure du juge, 2026-09-02).
 */
export function refusSourcesInsuffisantes(script, nombre, cheminsRejetes = 0) {
  return nombre < SEUIL_SOURCES
    ? `docs:build — ARRÊT sur ${script} : ${nombre} source(s) mesurée(s), l'enregistreur de lectures est AVEUGLE sur ce générateur — ${cheminsRejetes} chemin(s) lu(s) hors racine, écarté(s) de la mesure.`
    : null
}

/** Les cibles LITTÉRALES (sans joker) de `g` que son rendu n'a pas produites : absentes du fichier
 *  `ENV_CIBLES_RENDUES` où `ecrireOuVerifier` consigne chaque cible rendue. Une cible littérale existe
 *  par sa déclaration (`check-doc-refs.mjs`) : ce refus la tient. */
function ciblesLitteralesNonRendues(g, fichier) {
  let texte
  try { texte = readFileSync(fichier, 'utf8') } catch { texte = '' }
  const rendues = new Set(texte.split('\n').filter(Boolean))
  return g.targets.filter((t) => !t.includes('*') && !rendues.has(t))
}

/** Le générateur de `GENERATORS` qui écrit `cible` EN ENTIER (chemin relatif, contre ses `targets`),
 *  ou `undefined`. */
export const generateurDe = (cible, generateurs = GENERATORS) => generateurParmi(cible, generateurs)

function generateurParmi(cible, generateurs) {
  return generateurs.find((g) => g.targets.some((motif) => correspondGlob(cible, motif)))
}

/** Le module d'un générateur, chargé comme son `runner` le lance : `tsx` par `tsImport` (`tsx/esm/api`). */
export async function chargerGenerateur(g) {
  const url = pathToFileURL(fileURLToPath(new URL(`../../${g.script}`, import.meta.url))).href
  if (g.runner !== 'tsx') return import(url)
  const { tsImport } = await import('tsx/esm/api')
  return tsImport(url, import.meta.url)
}

const RENDUS = new Map()

/** Le rendu d'un générateur de `GENERATORS` (`rendre()`, cible → texte), calculé une fois par processus. */
export function renduDe(g) {
  if (!RENDUS.has(g.script)) RENDUS.set(g.script, chargerGenerateur(g).then(({ rendre }) => rendre()))
  return RENDUS.get(g.script)
}

/**
 * Le TEXTE d'une cible de `GENERATORS`, par `rendre()` de son générateur : ni lu sur disque, ni écrit.
 * `cible` = chemin relatif POSIX. LÈVE sur une cible qu'aucun générateur n'écrit, ou qu'il ne rend pas.
 */
export async function rendreCible(cible, generateurs = GENERATORS) {
  const g = generateurDe(cible, generateurs)
  if (!g) throw new Error(`rendreCible : ${cible} n'est la cible d'aucun générateur de GENERATORS`)
  const texte = (await renduDe(g)).get(cible)
  if (texte === undefined) throw new Error(`rendreCible : ${g.script} ne rend pas ${cible}`)
  return texte
}

/** Point d'entrée de `mesurerRendu` : il joue `rendre()`, sans écrire. */
const RENDRE_SEUL = fileURLToPath(new URL('lib/rendre-seul.mjs', import.meta.url))

/**
 * Les lectures MESURÉES du rendu de `g` dans `cwd` — son `rendre()` sous l'enregistreur, aucune cible
 * écrite : l'entrée `{ cibles, fichiers, dossiers }` que `docs:build` consigne pour `g` dans
 * `SOURCES_LUES`, sans rien produire.
 */
export function mesurerRendu(g, cwd) {
  const racineLectures = mkdtempSync(path.join(tmpdir(), 'mesure-rendu-'))
  try {
    const ignores = path.join(racineLectures, 'ignores.json')
    writeFileSync(ignores, JSON.stringify([...ignoresGit(cwd)]))
    const lectures = path.join(racineLectures, 'lectures')
    mkdirSync(lectures)
    const ecrites = ciblesSurDisque(g.targets, cwd)
    const cibles = [...new Set([...ecrites, ...ciblesSurDisque(g.injecte ?? [], cwd)])].sort()
    const tsxEsm = g.runner === 'tsx' ? tsxEsmDe(cwd) : null
    const { args, env } = commandeDe({ runner: g.runner, script: RENDRE_SEUL }, { cwd, check: false, tsxEsm, lectures, ignores, cibles })
    execFileSync(process.execPath, [...args, g.script], { cwd, env, stdio: ['ignore', 'ignore', 'inherit'] })
    const lues = fusionnerLectures(lectures)
    return { cibles: ecrites.filter(estUnDocMarkdown), fichiers: lues.fichiers, dossiers: [...lues.dossiers.keys()] }
  } finally {
    rmSync(racineLectures, { recursive: true, force: true })
  }
}

/** `cible` est-elle PRODUITE par son générateur : une clé de son rendu, jamais un chemin que son
 *  motif atteint. `false` hors de `GENERATORS`. */
export async function cibleProduite(cible, generateurs = GENERATORS) {
  const g = generateurDe(cible, generateurs)
  return g !== undefined && (await renduDe(g)).has(cible)
}

/**
 * Cible → générateur qui l'ÉCRIT. Un fichier écrit en entier n'a qu'un auteur : le second rendu
 * effacerait le premier. REND aussi les doublons.
 */
export function proprietairesDeCibles(cwd, generateurs = GENERATORS) {
  const par = new Map()
  const doublons = []
  for (const g of generateurs)
    for (const cible of ciblesSurDisque(g.targets, cwd)) {
      if (par.has(cible)) doublons.push(`${cible} : déclarée par ${par.get(cible)} ET ${g.script}`)
      else par.set(cible, g.script)
    }
  return { par, doublons }
}

/**
 * L'issue d'un générateur rouge, lue sur l'erreur de `execFileResilient` : `status` (code de
 * sortie, `null` pour un processus tué), `signal`, et `code` (errno : `ENOENT` = jamais démarré,
 * `ENOBUFS` = sortie coupée au-delà de `maxBuffer`). PUR.
 */
export const issueDe = (e) => ({
  status: typeof e?.status === 'number' ? e.status : null,
  signal: e?.signal ?? null,
  code: typeof e?.code === 'string' ? e.code : null,
})

/**
 * La nature d'un rouge de générateur, lue sur son issue (`issueDe`) : un processus tué se nomme par
 * son signal, une erreur de lancement par son errno, le reste par son code de sortie. PUR.
 */
export function natureDuRouge({ status = null, signal = null, code = null }) {
  if (code) return signal ? `${code} (tué par ${signal})` : code
  if (signal) return `tué par ${signal}`
  if (typeof status === 'number') return `sortie ${status}`
  return 'sans code de sortie'
}

/** Valeur d'un drapeau à arguments : ceux qui le suivent, jusqu'au drapeau suivant ; `null` s'il est absent. */
function argumentsDe(argv, drapeau) {
  const i = argv.indexOf(drapeau)
  if (i < 0) return null
  const fin = argv.findIndex((a, j) => j > i && a.startsWith('--'))
  return argv.slice(i + 1, fin < 0 ? argv.length : fin)
}

/**
 * `docs:build` (écriture, puis les vérificateurs purs), `--code` (`genererCode`) ou `--check`
 * (vérification). REND (promesse) le code de sortie.
 * En écriture, le premier rouge ARRÊTE : un générateur rouge laisse docs/ à moitié régénéré, et
 * enchaîner les suivants fabriquerait un lot incohérent que le hook annoncerait « à committer ».
 * En `--check`, rien n'est écrit : chaque générateur et chaque vérificateur rend son verdict, et tous
 * les rouges sont nommés à la fin, sortie 1.
 */
export async function executer({
  cwd,
  argv = process.argv,
  generateurs = GENERATORS,
  verificateurs = NON_GENERATOR_CHECKS,
}) {
  const quiet = argv.includes('--quiet')
  if (argv.includes('--code')) return genererCode({ cwd, quiet, generateurs })
  const check = argv.includes('--check')
  const only = argumentsDe(argv, '--only')
  const seulement = only && new Set(only)
  // Refus d'un tsx NON LOCAL avant le premier générateur : à mi-chaîne, docs/ serait à moitié écrit.
  const tsxEsm = generateurs.some((g) => g.runner === 'tsx') ? tsxEsmDe(cwd) : null
  const ignores = ignoresGit(cwd)
  const { doublons } = proprietairesDeCibles(cwd, generateurs)
  if (doublons.length) {
    process.stderr.write(`docs:build — ARRÊT : cible(s) déclarée(s) par DEUX générateurs :\n${doublons.map((d) => `  ${d}`).join('\n')}\n`)
    return 1
  }
  // Cibles DÉPLIÉES une fois : écrites en entier, injectées.
  const cibles = new Map(generateurs.map((g) => [g.script, {
    ecrites: ciblesSurDisque(g.targets, cwd),
    injectees: ciblesSurDisque(g.injecte ?? [], cwd),
  }]))
  const racineLectures = path.join(cwd, 'node_modules', '.cache', 'lectures-docs', String(process.pid))
  rmSync(racineLectures, { recursive: true, force: true })
  // Le cache de lectures de ce run se purge à chaque sortie d'`executer`.
  try {
    // L'ensemble `ignoresGit`, calculé UNE fois, que chaque processus mesuré relit (#1769).
    const ignoresLectures = path.join(racineLectures, 'ignores.json')
    mkdirSync(racineLectures, { recursive: true })
    writeFileSync(ignoresLectures, JSON.stringify([...ignores]))
    const parGenerateur = {}
    // Verdicts de `--check`, TOUS collectés : un générateur rouge ne masque pas les suivants.
    const refus = []
    const refuser = (message) => {
      process.stderr.write(`${message}\n`)
      refus.push(message)
    }
    for (const [rang, g] of generateurs.entries()) {
      // `--only` ne restreint QUE la vérification : un `docs:build` partiel réécrirait
      // `.sources-lues.json` avec les seuls générateurs joués, et effacerait la mesure des autres.
      if (check && seulement && !seulement.has(g.script)) continue
      const { ecrites, injectees } = cibles.get(g.script)
      const dossier = path.join(racineLectures, String(rang))
      mkdirSync(dossier, { recursive: true })
      // Un générateur relit ce qu'il écrit (sa cible en `--check`, le fichier où il injecte un champ) :
      // rien de tout cela n'est une de ses sources.
      try {
        run(g, {
          cwd, quiet, check, tsxEsm, lectures: dossier, ignores: ignoresLectures,
          cibles: [...new Set([...ecrites, ...injectees])].sort(), rendues: path.join(dossier, 'cibles-rendues'),
        })
      } catch (e) {
        transmettreDiagnostic(e, quiet)
        const issue = issueDe(e)
        if (!check) {
          process.stderr.write(`docs:build — ARRÊT sur ${g.script} (${natureDuRouge(issue)}) : docs/ n'est PAS à jour.\n`)
          return 1
        }
        refus.push(`docs:check — ${g.script} — ${natureDuRouge(issue)}`)
        continue
      }
      const nonRendues = ciblesLitteralesNonRendues(g, path.join(dossier, 'cibles-rendues'))
      if (nonRendues.length) {
        const message = `docs:build — ARRÊT sur ${g.script} : cible(s) LITTÉRALE(S) déclarée(s) que son rendu ne produit pas : ${nonRendues.join(', ')}.`
        if (!check) {
          process.stderr.write(`${message}\n`)
          return 1
        }
        refuser(message)
        continue
      }
      const lues = fusionnerLectures(dossier)
      // Un chemin lu hors racine sort de la mesure : dit ici, il cesse d'être indiscernable d'une
      // absence de lecture (un générateur dont les sources vivent derrière une jonction, par exemple).
      if (lues.cheminsRejetes > 0) {
        process.stdout.write(`docs:build — ${g.script} : ${lues.cheminsRejetes} chemin(s) lu(s) hors racine, écarté(s) de la mesure.\n`)
      }
      const aveugle = refusSourcesInsuffisantes(g.script, lues.fichiers.length, lues.cheminsRejetes)
      if (aveugle) {
        if (!check) {
          process.stderr.write(`${aveugle}\n`)
          return 1
        }
        refuser(aveugle)
        continue
      }
      const ecritesAuMemeRangOuPlusTard = new Map(
        generateurs.flatMap((autre, r) => (r >= rang ? cibles.get(autre.script).ecrites.map((c) => [c, autre.script]) : [])),
      )
      const lectureTardive = lues.fichiers.find((source) => ecritesAuMemeRangOuPlusTard.has(source))
      if (lectureTardive) {
        const message = `docs:build — ARRÊT sur ${g.script} : lit « ${lectureTardive} », que ${ecritesAuMemeRangOuPlusTard.get(lectureTardive)} écrit au même rang ou plus tard — cette source serait périmée.`
        if (!check) {
          process.stderr.write(`${message}\n`)
          return 1
        }
        refuser(message)
        continue
      }
      parGenerateur[g.script] = { cibles: ecrites.filter(estUnDocMarkdown), fichiers: lues.fichiers, dossiers: [...lues.dossiers.keys()] }
    }
    if (!check) {
      ecrireSiDifferent(path.join(cwd, SOURCES_LUES), serialiserSourcesLues(parGenerateur))
      console.log(`${SOURCES_LUES} — ${Object.keys(parGenerateur).length} générateur(s) mesuré(s).`)
    }
    // Les vérificateurs purs, en écriture comme en `--check` : ils n'écrivent rien, leur code de sortie
    // est leur verdict, et ils jugent le rendu que `docs:build` vient d'écrire.
    const verificateursJoues = verificateurs.filter((script) => !seulement || seulement.has(script))
    for (const script of verificateursJoues) {
      try {
        execFileResilient(process.execPath, [script], {
          cwd,
          env: envIsole(process.env, binLocal(cwd)),
          ...sortiesDe(quiet),
        }, { site: `build-all/${script}` })
      } catch (e) {
        transmettreDiagnostic(e, quiet)
        refuser(`docs:${check ? 'check' : 'build'} — ${script} — ${natureDuRouge(issueDe(e))}`)
      }
    }
    if (!check) return refus.length ? 1 : 0
    if (refus.length) {
      process.stderr.write(`docs:check — ROUGE (${refus.length}) :\n${refus.map((m) => `  ${m}`).join('\n')}\n`)
      return 1
    }
    console.log(
      `docs:check — OK (${Object.keys(parGenerateur).length} générateur(s) rejoué(s), ${verificateursJoues.length} vérificateur(s))`,
    )
    return 0
  } finally {
    rmSync(racineLectures, { recursive: true, force: true })
  }
}

/** Écrit `texte` dans `chemin` seulement s'il diffère : un lecteur d'une autre lane ne lit jamais un
 *  fichier réécrit à l'identique. */
function ecrireSiDifferent(chemin, texte) {
  let actuel
  try { actuel = readFileSync(chemin, 'utf8') } catch { actuel = null }
  if (actuel !== texte) writeFileSync(chemin, texte)
}

async function main() {
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  if (process.argv.includes('--cibles-pures')) {
    process.stdout.write(`${ciblesPures(cwd).join('\n')}\n`)
    return
  }
  process.exitCode = await executer({ cwd })
}

if (import.meta.main) main()
