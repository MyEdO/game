// CLIQUET du CLASSEMENT DU PUSH (#1738) — `ci.yml` confronté à la MESURE `ECRIT_LU`.
//   node --test scripts/gates/classerPush.test.mjs   (chaîné dans `npm run test:hooks`)
//
// `ci.yml` EST la porte : il doit se lire seul (quel step joue sur une fiche de mémoire). Ce banc
// confronte cette DÉCISION à la MESURE — ce que la gate LIT — DANS LES DEUX SENS, comme
// `ruleset-main.test.mjs` confronte le ruleset à `jobsCi()`. Une gate neuve mal classée fait rougir
// en la NOMMANT, qu'elle soit sautée à tort ou jouée pour rien.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { ACTION_PROLOGUE, DOCUMENTAIRE, CI_SEULEMENT_PRODUIT, COMMANDE_CLASSER, CONDITION_PRODUIT, ID_PROLOGUE, classer, classerPush, baseDuDiff, gatesSautables } from './classerPush.mjs'
import { envDeDepotForge, envGitFeint, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { gatesDeCi, jobsRequis, stepsCi, CI_SEULEMENT } from './gatesDeCi.mjs'
import { stepsDu } from './workflowsDuDepot.mjs'
import { ECRIT_LU } from './toutes.mjs'
import { lancerGit } from '../test/gitDeBanc.mjs'
import { jetonNomme } from '../test/lib/bancClasserPush.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))

const CLASSEUR = join(RACINE, 'scripts', 'gates', 'classerPush.mjs')

// (a) — le CLASSEMENT lui-même.

test('une fiche de mémoire seule est un push DOCUMENTAIRE', () => {
  assert.deepEqual(classer(['.claude/memory/x.md']).produit, false)
})

test('un seul fichier hors DOCUMENTAIRE rend le push PRODUIT, et il est NOMMÉ', () => {
  const verdict = classer(['.claude/memory/x.md', 'src/a.ts'])
  assert.equal(verdict.produit, true)
  assert.ok(
    verdict.motifs.some((m) => m.includes('src/a.ts')),
    `le fichier fautif doit être nommé, motifs = ${JSON.stringify(verdict.motifs)}`,
  )
})

test('un diff VIDE est PRODUIT : rien de mesuré, tout se joue', () => {
  assert.equal(classer([]).produit, true)
})

test('`ci.yml` lui-même est PRODUIT : `.github/` n’est pas documentaire', () => {
  assert.equal(classer(['.github/workflows/ci.yml']).produit, true)
})

test('les miroirs de la compat d’agents sont documentaires', () => {
  assert.equal(classer(['AGENTS.md', '.codex/agents/x.toml']).produit, false)
})

test('un préfixe SANS `/` final ne prend que le fichier EXACT : `CLAUDE.md.bak` est produit', () => {
  assert.equal(classer(['CLAUDE.md']).produit, false)
  assert.equal(classer(['CLAUDE.md.bak']).produit, true)
})

// (b) — CONFRONTATION `ci.yml` ↔ `ECRIT_LU`.

const gates = gatesDeCi({ cwd: RACINE })

const sautables = gatesSautables({ gates, ecritLu: ECRIT_LU })

test('chaque gate porte la condition du classement SSI elle est sautable', () => {
  const ecarts = []
  for (const { nom, si } of gates) {
    const conditionnee = (si ?? '').includes(CONDITION_PRODUIT)
    const sautable = sautables.has(nom)
    if (sautable && !conditionnee)
      ecarts.push(
        `${nom} : ne lit RIEN de documentaire (${JSON.stringify(ECRIT_LU[nom]?.lit)}) mais joue toujours — ` +
          `un coût payé sur chaque push de fiche ; ajoute « ${CONDITION_PRODUIT} » à son \`if\` dans ci.yml`,
      )
    if (!sautable && conditionnee)
      ecarts.push(
        `${nom} : LIT un chemin documentaire (${JSON.stringify(ECRIT_LU[nom]?.lit)}) mais est sautée sur un ` +
          'push documentaire — c’est un trou de garde ; retire la condition de son `if` dans ci.yml',
      )
  }
  assert.deepEqual(ecarts, [])
})

test('un push qui ne touche qu’un mod est PRODUIT ; un skill `SKILL.md` reste documentaire (#2278)', () => {
  const mods = ['.claude/skills/harnais/']
  const verdict = classer(['.claude/skills/harnais/hooks/x.ts'], { mods })
  assert.equal(verdict.produit, true)
  assert.match(verdict.motifs[0], /racine de mod/)
  assert.equal(classer(['.claude/skills/m/hooks/x.ts', '.claude/skills/m/.claude-plugin/plugin.json']).produit, true, 'un manifeste du diff fait la racine')
  assert.equal(classer(['.claude/skills/orchestrer/SKILL.md'], { mods }).produit, false)
  assert.equal(classer(['.claude/skills/harnais2/SKILL.md'], { mods }).produit, false, '`harnais2/` n’est pas sous `harnais/`')
})

test('le mur et la garde d’un mod jouent sur un push qui ne touche qu’un mod, en CI comme dans `npm run gates` (#2278)', () => {
  for (const nom of ['lint', 'mods:check']) {
    assert.ok(gates.some((g) => g.nom === nom), `${nom} absente de ci.yml, donc du rejeu local \`npm run gates\``)
    assert.ok(ECRIT_LU[nom].lit.includes('.claude/skills/'), `${nom} : son \`lit\` couvre les mods`)
    assert.equal(sautables.has(nom), false, `${nom} n’est jamais sautée`)
  }
})

test('chaque step CI_SEULEMENT porte la condition SSI il est dans CI_SEULEMENT_PRODUIT', () => {
  const ecarts = []
  for (const { job, commande, si } of stepsCi({ cwd: RACINE })) {
    if (!(commande in CI_SEULEMENT)) continue
    const conditionnee = (si ?? '').includes(CONDITION_PRODUIT)
    const produitSeulement = commande in CI_SEULEMENT_PRODUIT
    if (produitSeulement !== conditionnee)
      ecarts.push(
        `${job} / « ${commande} » : condition ${conditionnee ? 'présente' : 'absente'} dans ci.yml, ` +
          `${produitSeulement ? 'attendue' : 'non attendue'} par CI_SEULEMENT_PRODUIT`,
      )
  }
  assert.deepEqual(ecarts, [])
})

test('chaque job à check requis ouvre sur le PROLOGUE, et le rejeu des migrations porte sa condition', () => {
  const requis = jobsRequis({ cwd: RACINE })
  assert.ok(requis.length >= 2, `jobs requis lus : ${requis.map((b) => b.job).join(', ')}`)
  for (const { job, texte } of requis) {
    const [checkout, prologue] = stepsDu(texte)
    assert.match(checkout?.bloc ?? '', /uses: actions\/checkout@/, `${job} : le premier step n’est pas le checkout`)
    assert.equal(prologue?.id, ID_PROLOGUE, `${job} : le second step n’est pas le prologue (id « ${ID_PROLOGUE} »)`)
    assert.match(
      prologue.bloc,
      new RegExp(`uses: \\./${dirname(ACTION_PROLOGUE).replace(/[./]/g, '\\$&')}\\s*$`, 'm'),
      `${job} est un check REQUIS du ruleset : il doit classer le push lui-même, par ${ACTION_PROLOGUE}`,
    )
  }
  const rejeu = stepsCi({ cwd: RACINE }).find((s) => s.job === 'migrations' && s.commande === 'npm run migrations:replay')
  assert.ok(rejeu, 'le job migrations ne rejoue plus les migrations')
  assert.ok(
    (rejeu.si ?? '').includes(CONDITION_PRODUIT),
    'le rejeu des migrations lit src/data et src/scenes : il ne joue que sur un push produit',
  )
})

test('le prologue classe le push AVANT `npm ci`, et expose ce classement en `produit`', () => {
  const texte = readFileSync(join(RACINE, ACTION_PROLOGUE), 'utf8')
  const commandes = stepsCi({ fichier: join(RACINE, ACTION_PROLOGUE) }).map((s) => s.commande)
  const iClasser = commandes.indexOf(COMMANDE_CLASSER)
  const iInstall = commandes.indexOf('npm ci')
  assert.ok(iClasser >= 0 && iInstall >= 0, `${ACTION_PROLOGUE} : classement ou installation absents (${commandes.join(' · ')})`)
  assert.ok(
    iClasser < iInstall,
    'le classement doit précéder `npm ci` — ses imports n’atteignent aucun paquet, et c’est lui qui décide ' +
      'de ce que le reste du job paie',
  )
  assert.match(texte, /^ {2}produit:\n(?: {4}.*\n)*? {4}value: \$\{\{ steps\.classer\.outputs\.produit \}\}$/m,
    `${ACTION_PROLOGUE} n’expose plus le classement : « ${CONDITION_PRODUIT} » lirait un output vide et TOUT jouerait`)
})

test('jetonNomme : un jeton se nomme comme SEGMENT de chemin entier — jamais dans un sélecteur CSS', () => {
  assert.equal(jetonNomme("const h = join(racine, '.codex/hooks.json')"), '.codex')
  assert.equal(jetonNomme("readFileSync('.codex')"), '.codex')
  assert.equal(jetonNomme("typeInField(session, '.codex-search', entree)"), undefined)
  assert.equal(jetonNomme("document.querySelector('.screen.codex')"), undefined)
  assert.equal(jetonNomme("'.codex-rows button.listrow'"), undefined)
})

test('chaque entrée de DOCUMENTAIRE et de CI_SEULEMENT_PRODUIT porte sa RAISON', () => {
  for (const [chemin, raison] of Object.entries(DOCUMENTAIRE))
    assert.ok(typeof raison === 'string' && raison.length > 30, `« ${chemin} » sans raison lisible`)
  for (const [commande, raison] of Object.entries(CI_SEULEMENT_PRODUIT)) {
    assert.ok(typeof raison === 'string' && raison.length > 30, `« ${commande} » sans raison lisible`)
    assert.ok(commande in CI_SEULEMENT, `« ${commande} » n’est pas un step CI_SEULEMENT de ci.yml`)
  }
})

// (d) — le CLI, sur des dépôts JETABLES de `os.tmpdir()`.

const gitDe = (cwd) => (args) => lancerGit(args, { cwd }).trim()

test('#2285 famille classer callback : diagnostic du merge-base', () => {
  const { racine } = depotJetable()
  try {
    const stderr = 'note callback\n'.repeat(45) + 'cause callback tardive\n'
    const stdout = 'stdout callback distinct'
    assert.ok(stderr.indexOf('cause callback tardive') > 400)
    const vu = sousGitFeint([{ si: ['merge-base'], status: 27, stdout, stderr }], () => baseDuDiff({ sha: 'HEAD', cwd: racine }))
    assert.deepEqual(vu, { base: null, motif: 'merge-base origin/main en échec — git indisponible : refus (status 27) — ' + stderr + '\n' + stdout + ' : conservateur' })
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2285 famille classer fetch : diagnostic de l’union refusée', () => {
  const { racine, git } = depotJetable()
  try {
    git(['update-ref', '-d', 'refs/remotes/origin/main'])
    const stderr = 'note fetch\n'.repeat(45) + 'cause fetch tardive\n'
    const stdout = 'stdout fetch distinct'
    assert.ok(stderr.indexOf('cause fetch tardive') > 400)
    const vu = sousGitFeint([{ si: ['fetch'], status: 28, stdout, stderr }], () => baseDuDiff({ sha: 'HEAD', cwd: racine }))
    assert.deepEqual(vu, { base: null, motif: 'origin/main absent après fetch — git indisponible : refus (status 28) — ' + stderr + '\n' + stdout + ' : conservateur' })
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2285 famille classer CLI : catch Git complet', () => {
  const { racine, git } = depotJetable()
  try {
    const sha = git(['rev-parse', 'HEAD'])
    const stderr = 'note CLI\n'.repeat(45) + 'cause CLI tardive\n'
    const stdout = 'stdout CLI distinct'
    assert.ok(stderr.indexOf('cause CLI tardive') > 400)
    const vu = jouerCli(racine, { BASE: sha, SHA: sha, ...envGitFeint([{ si: ['diff-tree'], status: 29, stdout, stderr }]) })
    assert.equal(vu.code, 1)
    assert.equal(vu.stdout, '')
    assert.ok(vu.stderr.includes('[classerPush] erreur git non prévue : refus (status 29) — ' + stderr + '\n' + stdout + '\n'), vu.stderr)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

/** Un dépôt jetable avec un `main` d'un commit, une branche de travail, et `origin` sur lui-même. */
function depotJetable() {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-classer-'))
  const git = gitDe(racine)
  git(['init', '-q', '-b', 'main'])
  git(['config', 'user.email', 'banc@local'])
  git(['config', 'user.name', 'banc'])
  writeFileSync(join(racine, 'README.md'), 'socle\n')
  git(['add', 'README.md'])
  git(['commit', '-q', '-m', 'socle'])
  git(['remote', 'add', 'origin', racine])
  git(['update-ref', 'refs/remotes/origin/main', 'refs/heads/main'])
  git(['checkout', '-q', '-b', 'chantier/x'])
  return { racine, git }
}

function ecrire(racine, chemin, contenu) {
  mkdirSync(dirname(join(racine, chemin)), { recursive: true })
  writeFileSync(join(racine, chemin), contenu)
}

/** Joue le CLI dans `cwd` et rend `{ code, stdout, stderr }` — le code de sortie est LU, pas deviné. */
function jouerCli(cwd, env) {
  const vu = spawnSync(process.execPath, [CLASSEUR], { cwd, encoding: 'utf8', env: { ...envDeDepotForge(), ...env }, timeout: 10000 })
  return { code: vu.status, stdout: vu.stdout ?? '', stderr: vu.stderr ?? '' }
}

test('CLI — une branche dont le seul commit touche une fiche sort `produit=false`', () => {
  const { racine, git } = depotJetable()
  try {
    ecrire(racine, '.claude/memory/x.md', 'fiche\n')
    git(['add', '.claude/memory/x.md'])
    git(['commit', '-q', '-m', 'fiche'])
    const r = jouerCli(racine, { SHA: 'HEAD' })
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), 'produit=false')

    ecrire(racine, 'src/a.ts', 'export const a = 1\n')
    git(['add', 'src/a.ts'])
    git(['commit', '-q', '-m', 'code'])
    const apres = jouerCli(racine, { SHA: 'HEAD' })
    assert.equal(apres.code, 0)
    assert.equal(apres.stdout.trim(), 'produit=true')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('CLI — une branche qui ne touche qu’un module de mod sort `produit=true` ; un `SKILL.md` seul, `produit=false`', () => {
  const { racine, git } = depotJetable()
  try {
    ecrire(racine, '.claude/skills/m/.claude-plugin/plugin.json', '{}\n')
    ecrire(racine, '.claude/skills/s/SKILL.md', 'skill\n')
    git(['add', '.claude'])
    git(['commit', '-q', '-m', 'mod et skill'])
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    ecrire(racine, '.claude/skills/s/SKILL.md', 'skill retouché\n')
    git(['commit', '-q', '-am', 'skill'])
    assert.equal(jouerCli(racine, { SHA: 'HEAD' }).stdout.trim(), 'produit=false')
    ecrire(racine, '.claude/skills/m/hooks/x.ts', 'export {}\n')
    git(['add', '.claude'])
    git(['commit', '-q', '-m', 'module de mod'])
    const r = jouerCli(racine, { SHA: 'HEAD' })
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), 'produit=true')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('CLI — sur un commit de file, `BASE` (`merge_group.base_sha`) borne le diff, jamais le merge-base', () => {
  const { racine, git } = depotJetable()
  try {
    ecrire(racine, 'src/a.ts', 'export const a = 1\n')
    git(['add', 'src/a.ts'])
    git(['commit', '-q', '-m', 'code'])
    const base = git(['rev-parse', 'HEAD'])
    ecrire(racine, '.claude/memory/x.md', 'fiche\n')
    git(['add', '.claude/memory/x.md'])
    git(['commit', '-q', '-m', 'fiche'])
    // Sans `BASE`, le merge-base avec origin/main voit `src/a.ts` : produit.
    assert.equal(jouerCli(racine, { SHA: 'HEAD' }).stdout.trim(), 'produit=true')
    const r = jouerCli(racine, { BASE: base, SHA: 'HEAD' })
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), 'produit=false')
    assert.equal(jouerCli(racine, { BASE: '', SHA: 'HEAD' }).stdout.trim(), 'produit=true', 'un `BASE` vide (hors merge_group) replie sur le merge-base')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('CLI — un clone `--single-branch` VA CHERCHER `origin/main`, puis classe', () => {
  const { racine, git } = depotJetable()
  const clone = mkdtempSync(join(tmpdir(), 'wfrp-classer-clone-'))
  try {
    ecrire(racine, '.claude/memory/x.md', 'fiche\n')
    git(['add', '.claude/memory/x.md'])
    git(['commit', '-q', '-m', 'fiche'])
    // `--single-branch` sur la branche de TRAVAIL : le clone n'a aucune `refs/remotes/origin/main`.
    lancerGit(['clone', '-q', '--single-branch', '--branch', 'chantier/x', racine, clone])
    assert.throws(
      () => lancerGit(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: clone }),
      'le clone doit bien être SANS origin/main — sinon le cas ne mesure rien',
    )
    const r = jouerCli(clone, { SHA: 'HEAD' })
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), 'produit=false')
    assert.equal(
      lancerGit(['rev-parse', 'refs/remotes/origin/main'], { cwd: clone }).trim(),
      lancerGit(['rev-parse', 'refs/heads/main'], { cwd: racine }).trim(),
      'le fetch doit avoir RAPPORTÉ origin/main',
    )
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(clone, { recursive: true, force: true })
  }
})

test('CLI — sans `origin`, le classement est CONSERVATEUR', () => {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-classer-'))
  const git = gitDe(racine)
  try {
    git(['init', '-q', '-b', 'chantier/x'])
    git(['config', 'user.email', 'banc@local'])
    git(['config', 'user.name', 'banc'])
    ecrire(racine, '.claude/memory/x.md', 'fiche\n')
    git(['add', '.claude/memory/x.md'])
    git(['commit', '-q', '-m', 'fiche'])
    const r = jouerCli(racine, { SHA: 'HEAD' })
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), 'produit=true')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── Avant `npm ci` : la fermeture des imports n'atteint aucun paquet ─────────────────────────────

/** Imports statiques, réexports, imports nus et `import()` dynamiques d'un source. */
const IMPORTS = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

/** La fermeture transitive des imports de `depart` : `{ fichiers, paquets }` (chemins relatifs au dépôt, graphie de l'hôte). */
function fermetureDesImports(depart) {
  const fichiers = new Set()
  const paquets = []
  const visiter = (absolu) => {
    const rel = relative(RACINE, absolu)
    if (fichiers.has(rel)) return
    fichiers.add(rel)
    for (const m of readFileSync(absolu, 'utf8').matchAll(IMPORTS)) {
      const cible = m[1] ?? m[2] ?? m[3]
      if (cible.startsWith('node:')) continue
      if (!cible.startsWith('.')) { paquets.push(`${cible} <- ${rel}`); continue }
      const chemin = resolve(dirname(absolu), cible)
      assert.ok(existsSync(chemin), `${rel} importe \`${cible}\`, introuvable`)
      visiter(chemin)
    }
  }
  visiter(depart)
  return { fichiers: [...fichiers], paquets }
}

test('le classement tourne AVANT `npm ci` : la fermeture de ses imports n’atteint aucun paquet', () => {
  const { fichiers, paquets } = fermetureDesImports(CLASSEUR)
  assert.ok(fichiers.includes(join('scripts', 'guards', 'lib', 'gitPorte.mjs')), 'la fermeture lit bien l’hôte git : sinon ce test ne mesure rien')
  assert.deepEqual(paquets, [], `imports hors node:* et hors dépôt dans la fermeture de ${fichiers.join(', ')}`)
})

// ── Chemins d'ÉCHEC : jamais DOCUMENTAIRE ─────────────────────────────────────────────────────────

test('ÉCHEC — `merge-base` sans ancêtre commun, le tronc présent : classement CONSERVATEUR', () => {
  const { racine, git } = depotJetable()
  try {
    git(['checkout', '-q', '--orphan', 'orpheline'])
    git(['rm', '-q', '-f', 'README.md'])
    ecrire(racine, '.claude/memory/x.md', 'fiche\n')
    git(['add', '.claude/memory/x.md'])
    git(['commit', '-q', '-m', 'fiche orpheline'])
    const v = classerPush({ sha: 'HEAD', cwd: racine })
    assert.deepEqual([v.produit, v.base, v.motifs], [true, null, ['merge-base origin/main en échec : conservateur']])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

for (const [nom, stderr] of [
  ['retour de ligne final', 'fatal: panne simulée\n'],
  ['cause tardive multiligne', `${'note de refus\n'.repeat(50)}fatal: cause tardive de la panne\n`],
]) test(`ÉCHEC — une PANNE de git au merge-base : classement CONSERVATEUR, et la panne est NOMMÉE — ${nom}`, () => {
  const { racine } = depotJetable()
  try {
    const v = sousGitFeint([{ si: ['merge-base'], status: 128, stderr }], () => classerPush({ sha: 'HEAD', cwd: racine }))
    assert.deepEqual([v.produit, v.base, v.motifs], [true, null, [`merge-base origin/main en échec — git indisponible : refus (status 128) — ${stderr} : conservateur`]])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('ÉCHEC — une borne du diff INCONNUE LÈVE `BorneAbsente`, et le CLI sort 1 sans rien écrire sur stdout (le step est rouge)', () => {
  const { racine } = depotJetable()
  try {
    const faux = 'f'.repeat(40)
    assert.throws(() => classerPush({ base: faux, sha: 'HEAD', cwd: racine }), (e) => e.name === 'BorneAbsente' && e.bornes.includes(faux))
    const r = jouerCli(racine, { BASE: faux, SHA: 'HEAD' })
    assert.deepEqual([r.code, r.stdout], [1, ''])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
