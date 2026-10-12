import { test } from 'node:test'

import assert from 'node:assert/strict'

import { DEPOT } from './ticketsGh.mjs'

import { spawnSync } from 'node:child_process'

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import { isAbsolute, join, sep } from 'node:path'

import { envDeDepotForge, envGitFeint, gabaritDeDepot, instanceDeDepot, sousGitFeint } from './depotGabarit.mjs'

import { ENV_GIT_FEINT, GitIndisponible, depotDe, shaDe } from './gitPorte.mjs'

import { listerDossier } from './lister.mjs'

import { readCorpus } from './sourceCorpus.mjs'

import { tableTotale } from '../../../src/lib/tableTotale.ts'

import { lancerGit, resultatDeGit } from '../../test/gitDeBanc.mjs'

const git = (cwd) => (args) => lancerGit(args, { cwd, net: true })

const PARAMS = {
  fichiers: { 'src/a.ts': 'export const a = 1\n', 'lu/b.txt': 'b\n' },
  branche: 'principale',
  origin: `https://github.com/${DEPOT}.git`,
  message: 'fondation',
  refs: { 'refs/remotes/origin/main': 'HEAD' },
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

test('deux instances du même contenu : même sha, racines distinctes, arbre identique', () => {
  const un = instanceDeDepot(PARAMS)
  const deux = instanceDeDepot(PARAMS)
  try {
    assert.notEqual(un.racine, deux.racine)
    assert.equal(un.sha, deux.sha)
    assert.equal(git(un.racine)(['rev-parse', 'HEAD']), un.sha)
    assert.equal(git(deux.racine)(['rev-parse', 'HEAD']), un.sha)
    assert.equal(readFileSync(join(deux.racine, 'src/a.ts'), 'utf8'), 'export const a = 1\n')
    assert.equal(git(un.racine)(['rev-parse', '--abbrev-ref', 'HEAD']), 'principale')
    assert.equal(git(un.racine)(['status', '--porcelain']), '', 'une instance neuve est un arbre PROPRE')
    assert.equal(git(un.racine)(['remote', 'get-url', 'origin']), PARAMS.origin)
  } finally {
    jeter(un.racine)
    jeter(deux.racine)
  }
})

test('muter une instance (commit) ne touche ni le gabarit ni l’autre instance', () => {
  const gabarit = gabaritDeDepot(PARAMS)
  const un = instanceDeDepot(PARAMS)
  const deux = instanceDeDepot(PARAMS)
  try {
    writeFileSync(join(un.racine, 'src/a.ts'), 'export const a = 2\n', 'utf8')
    const g = git(un.racine)
    g(['add', '-A'])
    g(['commit', '-q', '-m', 'mutation'])

    assert.notEqual(g(['rev-parse', 'HEAD']), un.sha, 'l’instance mutée doit avoir avancé')
    assert.equal(git(deux.racine)(['rev-parse', 'HEAD']), un.sha, 'l’autre instance a bougé')
    assert.equal(git(gabarit.racine)(['rev-parse', 'HEAD']), gabarit.sha, 'le gabarit a bougé')
    assert.equal(
      readFileSync(join(gabarit.racine, 'src/a.ts'), 'utf8'),
      'export const a = 1\n',
      'le contenu du gabarit a été réécrit par une instance',
    )
    assert.equal(git(deux.racine)(['status', '--porcelain']), '', 'l’autre instance a été salie')
  } finally {
    jeter(un.racine)
    jeter(deux.racine)
  }
})

test('les refs demandées sont posées dans l’instance', () => {
  const { racine, sha } = instanceDeDepot(PARAMS)
  try {
    assert.equal(git(racine)(['rev-parse', 'refs/remotes/origin/main']), sha)
  } finally {
    jeter(racine)
  }
})

test('`core.hooksPath` pointe hors de tout hook, DANS l’instance : aucun hook de la machine hôte ne tire', () => {
  const { racine } = instanceDeDepot(PARAMS)
  try {
    const hooks = git(racine)(['config', '--default', '', '--get', 'core.hooksPath'])
    assert.notEqual(hooks, '', 'aucun `core.hooksPath` : les hooks du dépôt hôte pourraient tirer')
    assert.equal(isAbsolute(hooks), false, `\`core.hooksPath\` = ${hooks} : un chemin ABSOLU sort de l’instance`)
    const resolu = git(racine)(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'])
    assert.equal(
      resolu.replace(/\//g, sep).startsWith(racine + sep), true,
      `le dossier de hooks ${resolu} est résolu HORS de l’instance ${racine}`,
    )
    assert.equal(existsSync(join(racine, hooks)), false, `le dossier de hooks ${hooks} existe dans l’instance`)
    assert.equal(existsSync(join(racine, '.git', 'hooks', 'pre-commit')), false)
  } finally {
    jeter(racine)
  }
})

test('`commit: false` : un dépôt initialisé, fichiers sur le disque, HORS index et sans HEAD', () => {
  const { racine, sha } = instanceDeDepot({ ...PARAMS, refs: {}, commit: false })
  try {
    assert.equal(sha, null)
    assert.equal(readFileSync(join(racine, 'src/a.ts'), 'utf8'), 'export const a = 1\n')
    assert.deepEqual(
      git(racine)(['status', '--porcelain']).split('\n').sort(),
      ['?? lu/', '?? src/'],
      'les fichiers devraient être NON SUIVIS',
    )
    assert.throws(() => git(racine)(['rev-parse', '--verify', 'HEAD']), /git rev-parse --verify HEAD en échec/, 'un dépôt sans commit ne doit résoudre AUCUN HEAD')
  } finally {
    jeter(racine)
  }
})

test('MÉMO : deux appels de mêmes paramètres ne construisent qu’UN gabarit', () => {
  const un = gabaritDeDepot(PARAMS)
  const deux = gabaritDeDepot({ ...PARAMS })
  assert.equal(deux.racine, un.racine, 'un second gabarit a été construit pour le même contenu')
  assert.equal(deux.sha, un.sha)

  const autre = gabaritDeDepot({ ...PARAMS, fichiers: { 'src/a.ts': 'export const a = 9\n' } })
  assert.notEqual(autre.racine, un.racine, 'un contenu différent doit avoir SON gabarit')
  assert.notEqual(autre.sha, un.sha)
})

function constructionIsolee(params) {
  const isole = mkdtempSync(join(tmpdir(), 'isole-'))
  try {
    const module = new URL('./depotGabarit.mjs', import.meta.url).href
    const source = `import { gabaritDeDepot } from ${JSON.stringify(module)}\n`
      + `try { gabaritDeDepot(${JSON.stringify(params)}); console.log('AUCUNE ERREUR') }\n`
      + 'catch (e) { console.log(\'ERREUR \' + e.message.split(\'\\n\')[0]) }\n'
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      encoding: 'utf8', env: { ...process.env, TEMP: isole, TMP: isole, TMPDIR: isole },
    })
    assert.equal(r.status, 0, `l’enfant a quitté en ${r.status} : ${r.stderr}`)
    return { sortie: r.stdout.trim(), restes: listerDossier(isole) }
  } finally {
    rmSync(isole, { recursive: true, force: true })
  }
}

test('A : `refs` sans `commit` est REFUSÉ en nommant, et aucun gabarit n’est fabriqué', () => {
  const { sortie, restes } = constructionIsolee({
    fichiers: { 'a.txt': 'sonde A\n' }, refs: { 'refs/heads/x': 'HEAD' }, commit: false,
  })
  assert.match(sortie, /^ERREUR .*`refs`.*`commit: true`$/)
  assert.deepEqual(restes, [], 'un gabarit a été fabriqué pour une demande REFUSÉE')
})

test('A : une construction qui ÉCHOUE en vol efface son dossier avant de relancer l’erreur', () => {
  // `refs` visant une cible que le dépôt ne résout pas : l'échec tombe APRÈS `git init`, donc après
  // que le dossier existe — c'est le seul cas qui éprouve le nettoyage.
  const { sortie, restes } = constructionIsolee({
    fichiers: { 'a.txt': 'sonde A2\n' }, refs: { 'refs/heads/x': 'jamais-vu' },
  })
  assert.match(sortie, /^ERREUR /)
  assert.deepEqual(restes, [], 'le dossier du gabarit en échec est resté sous os.tmpdir()')
})

test('une copie qui ÉCHOUE dit, DANS son message, l’erreur d’origine et l’état mesuré des deux côtés (#2155)', () => {
  const params = { fichiers: { 'a.txt': 'sonde copie\n' } }
  const { racine: gabarit } = gabaritDeDepot(params)
  jeter(gabarit)
  assert.throws(() => instanceDeDepot(params), (e) => {
    assert.equal(e.cause?.code, 'ENOENT')
    assert.match(e.message, /code ENOENT/)
    assert.ok(e.message.includes(`chemin ${e.cause.path}`), e.message)
    assert.ok(e.message.includes(e.cause.message), e.message)
    assert.match(e.message, /gabarit absent/)
    assert.match(e.message, /objets du gabarit absent/)
    assert.match(e.message, /objets de l’instance absent/)
    assert.match(e.message, /contenu du \.git de l’instance aucun/)
    return true
  })
})

test('B : l’instance est un dépôt HISTORIQUE complet (objets, refs, graphe) et sain', () => {
  const { racine, sha } = instanceDeDepot(PARAMS)
  try {
    const g = git(racine)
    assert.equal(g(['cat-file', '-t', sha]), 'commit', 'le sha de fondation n’est pas un objet commit de l’instance')
    assert.equal(g(['show', `${sha}:src/a.ts`]), 'export const a = 1', 'le contenu ne se relit pas DEPUIS l’objet')
    assert.equal(g(['rev-list', '--count', 'HEAD']), '1')
    assert.equal(g(['merge-base', 'HEAD', 'refs/remotes/origin/main']), sha, 'les deux refs ne partagent pas l’histoire')
    assert.equal(g(['log', '-1', '--format=%s']), PARAMS.message)

    const fsck = resultatDeGit(['fsck', '--no-progress'], { cwd: racine })
    assert.equal(fsck.status, 0, `git fsck a refusé l’instance : ${fsck.stderr}`)
    assert.doesNotMatch(fsck.stderr + fsck.stdout, /missing|broken|corrupt/i)

    // Une histoire VIVANTE : l'instance sait committer par-dessus sa fondation, qui reste son parent.
    writeFileSync(join(racine, 'src/a.ts'), 'export const a = 3\n', 'utf8')
    g(['add', '-A'])
    g(['commit', '-q', '-m', 'suite'])
    assert.equal(g(['rev-list', '--count', 'HEAD']), '2')
    assert.equal(g(['rev-parse', 'HEAD~1']), sha)
  } finally {
    jeter(racine)
  }
})

test('C : sous `GIT_DIR`/`GIT_INDEX_FILE` d’un TÉMOIN, la fabrication ne le touche pas et l’instance est AUTONOME', () => {
  const temoin = mkdtempSync(join(tmpdir(), 'temoin-'))
  const avant = { GIT_DIR: process.env.GIT_DIR, GIT_INDEX_FILE: process.env.GIT_INDEX_FILE }
  try {
    const gitTemoin = git(temoin)
    gitTemoin(['init', '-q', '-b', 'main'])
    writeFileSync(join(temoin, 'a.txt'), 'témoin\n', 'utf8')
    gitTemoin(['add', 'a.txt'])
    const empreinte = () => ['config', 'index'].map((f) => readFileSync(join(temoin, '.git', f)).toString('hex'))
    const octets = empreinte()

    process.env.GIT_DIR = join(temoin, '.git')
    process.env.GIT_INDEX_FILE = join(temoin, '.git', 'index')
    // Paramètres UNIQUES : sur un gabarit déjà mémoïsé, l'instance serait une copie de fichiers, et
    // pas un seul processus git ne serait lancé sous ces variables.
    // L'intégrité du témoin se mesure que la fabrication aboutisse ou NON — un forgeur qui vise
    // ailleurs meurt souvent en vol, après avoir écrit.
    let forge = null
    let echec = null
    try { forge = instanceDeDepot({ fichiers: { 'forge/x.txt': 'x\n' }, message: 'forgé sous GIT_DIR' }) } catch (e) { echec = e }
    try {
      assert.deepEqual(empreinte(), octets, 'la fabrication a ÉCRIT dans le dépôt désigné par GIT_DIR / GIT_INDEX_FILE')
      assert.equal(echec, null, `la fabrication a échoué sous GIT_DIR : ${echec?.message}`)
      const { racine } = forge
      const gitLa = git(racine)
      assert.equal(
        gitLa(['rev-parse', '--path-format=absolute', '--git-dir']).replace(/\//g, sep), join(racine, '.git'),
        'l’instance ne résout pas SON dépôt',
      )
      assert.equal(gitLa(['log', '-1', '--format=%s']), 'forgé sous GIT_DIR', 'le commit de fondation est allé ailleurs')
    } finally {
      if (forge) rmSync(forge.racine, { recursive: true, force: true })
    }
  } finally {
    for (const [nom, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[nom]
      else process.env[nom] = valeur
    }
    rmSync(temoin, { recursive: true, force: true })
  }
})

const PRIMITIVE = 'scripts/guards/lib/depotGabarit.mjs'

const FORGE_UN_DEPOT = /[([]\s*['"]init['"]/

const SITE_GIT = /(?:execFileSync|spawnSync)\(\s*['"]git['"]/

const IMPORTE_L_ENV = /import\s*\{[^}]*\benvDeDepotForge\b[^}]*\}\s*from\s*['"][^'"]*depotGabarit\.mjs['"]/

function forgeurs() {
  const corpus = readCorpus(['scripts', 'src'], { exts: ['.mjs', '.mts', '.js', '.ts', '.tsx'], tests: true })
  return corpus.filter((f) => f.rel !== PRIMITIVE && FORGE_UN_DEPOT.test(f.text) && SITE_GIT.test(f.text))
}

function sitesGit(texte) {
  const lignes = texte.split('\n')
  return lignes.flatMap((ligne, i) =>
    SITE_GIT.test(ligne) ? [{ ligne: i + 1, texte: ligne.trim(), fenetre: lignes.slice(i, i + 3).join('\n') }] : [])
}

const ENV_ISOLE = /\benv\s*:[^\n]*\benvDeDepotForge\(/

function fautesDe({ rel, text }) {
  if (!FORGE_UN_DEPOT.test(text) || !SITE_GIT.test(text)) return []
  const fautes = []
  if (!IMPORTE_L_ENV.test(text)) fautes.push(`${rel} : forge un dépôt sans importer \`envDeDepotForge\``)
  for (const site of sitesGit(text)) {
    if (ENV_ISOLE.test(site.fenetre)) continue
    fautes.push(`${rel}:${site.ligne} : lanceur git sans \`env: envDeDepotForge()\` — ${site.texte}`)
  }
  return fautes
}

test('D : le détecteur MORD sur un forgeur à env hérité, à env quelconque, et se tait sur un forgeur isolé', () => {
  const importe = "import { envDeDepotForge } from '../guards/lib/depotGabarit.mjs'\n"
  // Le lanceur des échantillons s'écrit en DEUX morceaux : ce banc est lui-même au corpus du détecteur.
  const lance = (args, options) => `${'execFileSync'}('git', ${args}, { cwd: d${options} })\n`
  const forge = (options) => lance("['init', '-q']", options)
  assert.equal(fautesDe({ rel: 'x.test.mjs', text: forge('') }).length, 2)
  assert.equal(fautesDe({ rel: 'x.test.mjs', text: importe + forge(', env: process.env') }).length, 1)
  assert.deepEqual(fautesDe({ rel: 'x.test.mjs', text: importe + forge(', env: envDeDepotForge()') }), [])
  assert.deepEqual(fautesDe({ rel: 'x.test.mjs', text: lance("['status']", '') }), [])
})

test('D : tout fichier qui FORGE un dépôt passe l’env isolé à CHACUN de ses lanceurs git', () => {
  assert.deepEqual(forgeurs().flatMap(fautesDe), [])
})

test('ÉCRIVAIN sous environnement HOSTILE : la fondation est signée `mesure`, non signée GPG, sur la branche demandée', () => {
  const mesure = mkdtempSync(join(tmpdir(), 'forge-hostile-'))
  const globale = join(mesure, 'globale.gitconfig')
  writeFileSync(globale, '[user]\n\tname = Utilisatrice Hostile\n\temail = hostile@example.invalid\n[commit]\n\tgpgsign = true\n[init]\n\tdefaultBranch = autre\n')
  const intrus = {
    GIT_AUTHOR_NAME: 'Intrus', GIT_AUTHOR_EMAIL: 'intrus@example.invalid', GIT_COMMITTER_NAME: 'Intrus',
    GIT_COMMITTER_EMAIL: 'intrus@example.invalid', GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z', GIT_CONFIG_GLOBAL: globale,
  }
  const avant = tableTotale(Object.keys(intrus), (k) => process.env[k])
  Object.assign(process.env, intrus)
  let racine = null
  try {
    racine = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, branche: 'principale', message: 'identité de la forge, env intrus' }).racine
    assert.equal(git(racine)(['log', '-1', '--format=%an <%ae>|%cn <%ce>|%G?|%s']), 'mesure <mesure@example.invalid>|mesure <mesure@example.invalid>|N|identité de la forge, env intrus')
    assert.notEqual(git(racine)(['log', '-1', '--format=%aI']).slice(0, 4), '2001')
    assert.equal(git(racine)(['symbolic-ref', '--short', 'HEAD']), 'principale')
  } finally {
    for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    if (racine) jeter(racine)
    jeter(mesure)
  }
})

test('envDeDepotForge : aucune variable `GIT_*` du processus ne passe, hors les deux qui isolent la configuration', () => {
  const avant = process.env.GIT_AUTHOR_NAME
  process.env.GIT_AUTHOR_NAME = 'Intrus'
  try {
    const env = envDeDepotForge()
    assert.deepEqual(Object.keys(env).filter((k) => k.startsWith('GIT_')).sort(), ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM'])
    assert.equal(readFileSync(env.GIT_CONFIG_GLOBAL, 'utf8'), '')
  } finally {
    if (avant === undefined) delete process.env.GIT_AUTHOR_NAME
    else process.env.GIT_AUTHOR_NAME = avant
  }
})

for (const [nom, stderr] of [
  ['newline', 'fatal: panne simulée\n'],
  ['cause tardive', `${'note de refus\n'.repeat(50)}fatal: cause tardive\n`],
]) test(`sousGitFeint : la feinte vaut dans CE processus pendant \`fn\`, et se retire même sur une levée — ${nom}`, async () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  try {
    const depot = depotDe(racine, { env: envDeDepotForge })
    const avant = shaDe(depot, 'HEAD')
    assert.match(avant, /^[0-9a-f]{40}$/)
    assert.throws(() => sousGitFeint([{ si: ['rev-parse'], status: 128, stderr }], () => shaDe(depot, 'HEAD')),
      (e) => e instanceof GitIndisponible && e.raison === stderr)
    assert.equal(process.env[ENV_GIT_FEINT], undefined)
    assert.equal(shaDe(depot, 'HEAD'), avant)
    assert.deepEqual(envGitFeint([{ si: [], status: 1 }]), { [ENV_GIT_FEINT]: '[{"si":[],"status":1}]' })
    const enVol = sousGitFeint([{ si: ['rev-parse'], status: 128, stderr }], async () => {
      await new Promise((fin) => setImmediate(fin))
      return shaDe(depot, 'HEAD')
    })
    assert.ok(process.env[ENV_GIT_FEINT], 'une promesse en vol garde la feinte')
    await assert.rejects(enVol, (e) => e instanceof GitIndisponible && e.raison === stderr)
    assert.equal(process.env[ENV_GIT_FEINT], undefined, 'la feinte est retirée quand la promesse se règle')
  } finally {
    jeter(racine)
  }
})
