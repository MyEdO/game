// LECTEUR UNIQUE DE `.github/workflows/ci.yml` (#1776). Module FEUILLE : il n'importe que Node.
//
// `ci.yml` EST la porte — une gate neuve y est un step, et rien d'autre ne la récite. Ce module rend
// ce que le fichier DIT, à trois lecteurs : `scripts/gates/toutes.mjs` (le rejeu local),
// `scripts/gates/ecrivainsAtteints.mjs` (la table écrit/lu) et `scripts/ops/ruleset-main.mjs` (les
// checks requis du ruleset, par `contextesRequis`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Commande EXACTE du step final « Arbre inchangé » de `ci.yml` et `canari.yml` — le filet des
 *  écrivains par nature (`genererCode` de `build` et de la suite) : l'arbre du runner reste le commit. */
export const COMMANDE_ARBRE_INCHANGE = 'git status --porcelain && test -z "$(git status --porcelain)"'

/**
 * Steps de `ci.yml` qui ne sont PAS une gate locale, chacun avec sa raison. La liste est exhaustive
 * et EXACTE (ligne pour ligne) : c'est elle qui rend le classement fail-CLOSED — un step d'une autre
 * forme fait LEVER `gatesDeCi`, au lieu d'être ignoré en silence.
 */
export const CI_SEULEMENT = {
  'npm --prefix server ci': 'install serveur — posée une fois localement par `npm install`',
  [COMMANDE_ARBRE_INCHANGE]:
    'le lanceur local juge le même invariant par `photoArbre` (scripts/gates/toutes.mjs)',
}

/**
 * Jobs de `ci.yml` dont les steps ne se rejouent PAS localement, avec leur raison. Nominatif : un
 * job neuf est rejoué tant qu'il n'est pas nommé ici.
 */
export const JOBS_HORS_REJEU_LOCAL = {
  migrations:
    'rejeu EN PLACE des migrations : le jouer sur un arbre de travail réécrit src/data et src/scenes ' +
    'et rend un verdict faux (#1613) — localement, il se joue sur un EXPORT de la tête, ' +
    '`npm run migrations:replay:head`',
}

/**
 * Jobs de `ci.yml` qui ne sont PAS une lane du rejeu local : leurs gates se rejouent dans la lane d'un
 * AUTRE job (`lanesDeCi`, scripts/gates/toutes.mjs), avec leur raison. Nominatif : un job absent d'ici
 * est sa propre lane, et `PLAFOND_LANES` refuse le job de trop.
 */
export const LANE_LOCALE_DE_JOB = {
  'types-hooks': {
    lane: 'types',
    raison:
      '`test:hooks` (issuecomment-5924305772 de #2178) a son job pour raccourcir le ' +
      'chemin critique de la CI ; le rejeu local tient `PLAFOND_LANES` lanes, et `types` le porte',
  },
  'docs-tests': {
    lane: 'docs',
    raison:
      '`test:docs` a son job pour raccourcir le chemin critique de la CI (#2178) ; le rejeu local tient ' +
      '`PLAFOND_LANES` lanes, et `docs` le porte',
  },
}

/** Nom de gate d'une commande de step : `npm test` → `test`, `npm run <x>` → `<x>`, sinon `null`. */
export function nomDeGate(commande) {
  if (/^npm test$/.test(commande)) return 'test'
  const script = /^npm run ([A-Za-z0-9:_.-]+)$/.exec(commande)
  return script ? script[1] : null
}

/** Clés de step INERTES pour une gate locale : elles ne changent ni la commande ni son contexte. */
export const CLES_DE_STEP_INERTES = ['name', 'if', 'id']

const cheminCi = ({ cwd = process.cwd(), fichier } = {}) =>
  fichier ?? join(cwd, '.github', 'workflows', 'ci.yml')

/** Lignes de `ci.yml` : le `texte` fourni (une autre révision que l'arbre, lue par l'appelant), sinon
 *  le fichier sur disque. */
const lignesCi = ({ cwd, fichier, texte } = {}) => (texte ?? texteDeCi({ cwd, fichier })).split(/\r?\n/)

/** Texte de `ci.yml` sur disque. */
export const texteDeCi = ({ cwd, fichier } = {}) => readFileSync(cheminCi({ cwd, fichier }), 'utf8')

/**
 * Plafond de durée de CHAQUE job de `ci.yml`, en minutes — la clé `timeout-minutes` de niveau JOB,
 * jamais de step. Course la plus longue mesurée : 18,5 min sur 40 runs (audit CI du 2026-09-29, #2178).
 * Sans plafond, un job bloqué tient son runner jusqu'au défaut de GitHub (360 min).
 */
export const TIMEOUT_JOB_MINUTES = 30

/**
 * Steps de `ci.yml`, dans l'ordre du fichier. Un scalaire de bloc (`run: |`) est réduit à ses lignes
 * jointes par ` ; ` — une forme, donc, qui doit être classée comme les autres au lieu de disparaître.
 * `cles` porte les AUTRES clés du step (`working-directory`, `env`, `shell`…) : une gate locale ne
 * les reproduit pas, donc leur présence doit LEVER plutôt que créditer la commande racine.
 * `si` rend la VALEUR de la clé `if` (ou `null`) — c'est la DÉCISION que `ci.yml` écrit sur le step,
 * celle que la garde du classement confronte à la MESURE `lit` (scripts/gates/classerPush.test.mjs) ;
 * `if` reste dans `cles`, où il est INERTE pour le rejeu local.
 * REND `[{ job, commande, cles, si }]`.
 */
export function stepsCi({ cwd = process.cwd(), fichier } = {}) {
  const lignes = lignesCi({ cwd, fichier })
  const steps = []
  let job = null
  let courant = null
  const poser = () => {
    if (courant && courant.commande !== null) steps.push(courant)
    courant = null
  }
  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i]
    const entete = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(ligne)
    if (entete) {
      poser()
      job = entete[1]
      continue
    }
    if (/^\s*-\s/.test(ligne)) poser()
    const cle = /^\s*-?\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(ligne)
    if (!cle) continue
    const [, nomCle, valeur] = cle
    if (!courant) courant = { job, commande: null, cles: [], si: null }
    if (nomCle !== 'run') {
      courant.cles.push(nomCle)
      if (nomCle === 'if') courant.si = valeur
      continue
    }
    if (!/^[|>]/.test(valeur)) {
      courant.commande = valeur
      continue
    }
    const blanc = /^\s*/.exec(ligne)[0]
    const corps = []
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (lignes[j].trim() === '') continue
      if (/^\s*/.exec(lignes[j])[0].length <= blanc.length) break
      corps.push(lignes[j].trim())
      i = j
    }
    courant.commande = corps.join(' ; ')
  }
  poser()
  return steps
}

/**
 * Gates de `.github/workflows/ci.yml`, DANS L'ORDRE DU FICHIER, hors `JOBS_HORS_REJEU_LOCAL`. Aucun
 * nom n'est recopié ici : un step ajouté à la CI devient rejouable localement sans qu'on touche au
 * lanceur. Un step qui n'est ni `npm test`/`npm run <x>` ni une entrée de `CI_SEULEMENT`, ou qui
 * porte une clé non inerte, LÈVE : le classement est une décision, pas un silence.
 * `si` est la condition `if` écrite sur le step, telle quelle — la porte du classement du push la lit.
 * Une gate présente dans DEUX jobs LÈVE : `job` est son groupe, et une gate n'en a qu'un. La lane locale
 * de ce groupe est le job lui-même, ou celle que `LANE_LOCALE_DE_JOB` lui donne (`lanesDeCi`,
 * scripts/gates/toutes.mjs).
 * REND `[{ nom, commande, job, si }]`.
 */
export function gatesDeCi({ cwd = process.cwd(), fichier } = {}) {
  const gates = []
  const vus = new Map()
  for (const { job, commande, cles, si } of stepsCi({ cwd, fichier })) {
    if (job in JOBS_HORS_REJEU_LOCAL) continue
    const nom = nomDeGate(commande)
    const parasites = cles.filter((c) => !CLES_DE_STEP_INERTES.includes(c))
    if (nom && parasites.length)
      throw new Error(
        `step non classé : ${commande} — il porte ${parasites.join(', ')}, que « npm run ${nom} » ne ` +
          'reproduit pas ; donne-lui un script de package.json qui le porte, ou classe-le en CI_SEULEMENT',
      )
    if (!nom) {
      if (commande in CI_SEULEMENT) continue
      throw new Error(
        `step non classé : ${commande} — ajoute-le à package.json comme script (« npm run <x> ») ou à ` +
          'CI_SEULEMENT (scripts/gates/gatesDeCi.mjs) avec sa raison',
      )
    }
    if (vus.has(nom))
      throw new Error(
        `gate ${nom} jouée par deux jobs de ci.yml (${vus.get(nom)} ET ${job}) — une gate appartient à UN groupe : ` +
          'retire-la de l’un des deux',
      )
    vus.set(nom, job)
    gates.push({ nom, commande, job, si })
  }
  return gates
}

/**
 * Jobs de `ci.yml`, dans l'ordre du fichier, avec leurs clés de NIVEAU JOB (`if`, `needs`,
 * `timeout-minutes`…) et leur valeur sur la ligne telle quelle (`''` pour un bloc). `texte` lit une
 * autre révision que l'arbre (le ruleset lit celle du tronc, scripts/ops/ruleset-main.mjs). `texte`
 * du bloc : les lignes du job sous son en-tête, que `stepsDu` (scripts/gates/workflowsDuDepot.mjs)
 * découpe en steps.
 * REND `[{ job, cles: { [cle]: valeur }, texte }]`.
 */
export function blocsDeJobs({ cwd = process.cwd(), fichier, texte } = {}) {
  const lignes = lignesCi({ cwd, fichier, texte })
  const iJobs = lignes.findIndex((l) => /^jobs:\s*$/.test(l))
  if (iJobs === -1) throw new Error('ci.yml sans bloc `jobs:` — le ruleset ne peut pas nommer ses checks')
  const blocs = []
  for (const ligne of lignes.slice(iJobs + 1)) {
    if (/^[^\s#]/.test(ligne)) break
    const entete = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(ligne)
    if (entete) {
      blocs.push({ job: entete[1], cles: {}, lignes: [] })
      continue
    }
    const bloc = blocs.at(-1)
    if (!bloc) continue
    bloc.lignes.push(ligne)
    const cle = /^ {4}([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(ligne)
    if (cle) bloc.cles[cle[1]] = cle[2]
  }
  return blocs.map(({ job, cles, lignes: l }) => ({ job, cles, texte: l.join('\n') }))
}

/** Noms des jobs de `ci.yml`, dans l'ordre du fichier — jamais recopiés à la main : un job renommé
 *  change le nom de son check, et le ruleset doit suivre le fichier. */
export const jobsCi = (source = {}) => blocsDeJobs(source).map((b) => b.job)

/** Valeur d'un scalaire YAML d'une ligne, guillemets retirés. */
const scalaire = (v) => v.replace(/^(['"])(.*)\1$/, '$2')

/**
 * Matrice d'un bloc de job : `null` sans `strategy:`, sinon `{ cle, valeurs }`. Seule forme lue : une
 * clé, une liste en ligne, et `fail-fast: false` — sans lui, le premier rouge ANNULE les jobs sœurs
 * (`fail-fast` « defaults to `true` », section-using-a-build-matrix-for-your-jobs-failfast.md) et leurs
 * verdicts sont perdus. Toute autre forme LÈVE : le nom de ses checks ne serait pas lu.
 */
export function matriceDe({ job, texte }) {
  const lignes = texte.split('\n')
  const i = lignes.findIndex((l) => /^ {4}strategy:\s*$/.test(l))
  if (i === -1) return null
  const fin = lignes.findIndex((l, j) => j > i && /^ {0,4}\S/.test(l))
  const corps = lignes.slice(i + 1, fin === -1 ? undefined : fin).filter((l) => l.trim() && !/^\s*#/.test(l))
  const attendu = /^ {6}(fail-fast: false|matrix:)\s*$|^ {8}([A-Za-z][A-Za-z0-9_-]*): \[([^\]]*)\]\s*$/
  const formes = corps.map((l) => attendu.exec(l))
  const cles = formes.filter((m) => m?.[2])
  if (formes.some((m) => !m) || cles.length !== 1 || !corps.some((l) => /fail-fast: false/.test(l)) || !corps.some((l) => /^ {6}matrix:/.test(l)))
    throw new Error(
      `ci.yml / job ${job} : \`strategy\` hors de la forme lue (\`fail-fast: false\` + \`matrix:\` d'UNE clé à liste en ligne) — ` +
        'ses checks ne se nomment pas, ou une sœur rouge annulerait les autres',
    )
  const [, , cle, liste] = cles[0]
  return { cle, valeurs: liste.split(',').map((v) => scalaire(v.trim())).filter(Boolean) }
}

/**
 * Contextes de check d'UN job : son `name:` (à défaut son id), déplié sur sa matrice. Un check-run de
 * workflow porte le nom du job (« The name format is `<job name>` », troubleshooting-rules.md,
 * section « Troubleshooting required status checks »), et `jobs.<job_id>.name` lit les contextes
 * `matrix` et `strategy` (contexts.md, section « Context availability »). Seules expressions évaluées :
 * `${{ matrix.<clé> }}` et `${{ strategy.job-total }}` (1 hors matrice) ; un job matrice dont le
 * `name:` ne porte pas `${{ matrix.<clé> }}` LÈVE — le nom que GitHub lui donnerait alors n'est pas
 * documenté.
 */
export function contextesDuJob(bloc) {
  const nom = bloc.cles.name === undefined ? bloc.job : scalaire(bloc.cles.name)
  const matrice = matriceDe(bloc)
  const evaluer = (valeur) => {
    const rendu = nom
      .replaceAll(`\${{ matrix.${matrice?.cle} }}`, valeur)
      .replaceAll('${{ strategy.job-total }}', String(matrice?.valeurs.length ?? 1))
    if (rendu.includes('${{'))
      throw new Error(`ci.yml / job ${bloc.job} : expression non évaluée dans \`name: ${nom}\` — son check ne se nomme pas`)
    return rendu
  }
  if (!matrice) return [evaluer('')]
  if (!nom.includes(`\${{ matrix.${matrice.cle} }}`))
    throw new Error(`ci.yml / job ${bloc.job} : job matrice dont le \`name:\` ne porte pas \`\${{ matrix.${matrice.cle} }}\``)
  return matrice.valeurs.map(evaluer)
}

/** Blocs des jobs de `ci.yml` à check REQUIS : SANS `if:` ni `needs:` de niveau job (les citations
 *  GitHub vivent en tête de `jobs:` dans `ci.yml`) — de l'arbre (`cwd`/`fichier`) ou d'un `texte` lu
 *  ailleurs (`ciALaRef`, scripts/ops/ruleset-main.mjs). */
export const jobsRequis = (source = {}) => blocsDeJobs(source).filter((b) => !('if' in b.cles) && !('needs' in b.cles))

/** Contextes de check requis = les checks des `jobsRequis`, matrices dépliées (`contextesDuJob`). */
export const contextesRequis = (source = {}) => jobsRequis(source).flatMap(contextesDuJob)
