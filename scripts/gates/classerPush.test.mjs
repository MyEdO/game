// CLIQUET du CLASSEMENT DU PUSH (#1738) — `ci.yml` confronté à la MESURE `ECRIT_LU`.
//   node --test scripts/gates/classerPush.test.mjs   (chaîné dans `npm run test:hooks`)
//
// `ci.yml` EST la porte : il doit se lire seul (quel step joue sur une fiche de mémoire). Ce banc
// confronte cette DÉCISION à la MESURE — ce que la gate LIT — DANS LES DEUX SENS, comme
// `ruleset-main.test.mjs` confronte le ruleset à `jobsCi()`. Une gate neuve mal classée fait rougir
// en la NOMMANT, qu'elle soit sautée à tort ou jouée pour rien.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  ACTION_PROLOGUE,
  DOCUMENTAIRE,
  CI_SEULEMENT_PRODUIT,
  COMMANDE_CLASSER,
  CONDITION_PRODUIT,
  ID_PROLOGUE,
  classer,
  classerPush,
  gatesSautables,
} from './classerPush.mjs'
import { envDeDepotForge, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { gatesDeCi, jobsRequis, stepsCi, CI_SEULEMENT } from './gatesDeCi.mjs'
import { stepsDu } from './workflowsDuDepot.mjs'
import { corpusParGate, inerte } from './ecrivainsAtteints.mjs'
import { ECRIT_LU } from './toutes.mjs'

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

test('un push de mod (`.claude/skills/<x>/`) est documentaire pour le produit, mais `mods:check` n’est jamais sautée (#2278)', () => {
  assert.equal(classer(['.claude/skills/harnais/hooks/register.ts']).produit, false)
  assert.ok(gates.some((g) => g.nom === 'mods:check'), '`mods:check` absente de ci.yml')
  assert.equal(sautables.has('mods:check'), false)
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

// (c1) — chaque gate SAUTABLE confrontée à son CORPUS : la classe « `lit` sous-déclaré ».
//
// Le trou vécu (2026-09-16) : `ECRIT_LU['test:agents'].lit` disait `['scripts/agents/']` alors que
// `scripts/agents/compat.test.mjs` (ses tests « CONTRAT — … ») lit `.claude/settings.json`,
// `.codex/hooks.json`, `CLAUDE.md` et `AGENTS.md` sur l'arbre réel — la gate était donc SAUTÉE sur le push qui touche
// exactement ces fichiers. La mesure `lit` est déclarative ; ce cas la confronte au CODE ATTEINT.
//
// ANGLES MORTS, dits : le grain est la LIGNE d'un module local, et le corpus vient de la fermeture
// transitive d'imports de `ecrivainsAtteints.mjs` — un chemin CONSTRUIT dynamiquement (`join(base,
// nom)`, une variable, un `require`) n'est pas vu, ni ce qu'un sous-processus NON-node fait de son
// côté (git, tsc, eslint, knip, vite). Même déclaration que `ecrivainsAtteints.mjs` : c'est une
// lecture statique, jamais une preuve d'absence.

/** Les jetons de `DOCUMENTAIRE` tels qu'une ligne de code les NOMME (sans le `/` final). */
const JETONS = Object.keys(DOCUMENTAIRE).map((p) => p.replace(/\/$/, ''))

/** Le premier jeton documentaire NOMMÉ par cette ligne, dans une chaîne ou un `new URL(`. */
function jetonNomme(ligne) {
  return JETONS.find((jeton) => {
    const echappe = jeton.replace(/\./g, '\\.')
    return new RegExp(`(?:['"\`]|new URL\\(\\s*['"\`])[^'"\`\\n]*${echappe}`).test(ligne)
  })
}

test('aucune gate SAUTABLE ne nomme un chemin DOCUMENTAIRE dans le code qu’elle atteint', () => {
  const corpus = corpusParGate(RACINE)
  const trous = []
  for (const gate of sautables) {
    for (const fichier of corpus[gate] ?? []) {
      const lignes = readFileSync(join(RACINE, fichier), 'utf8').split('\n')
      lignes.forEach((ligne, i) => {
        if (inerte(ligne)) return
        const jeton = jetonNomme(ligne)
        if (jeton)
          trous.push(
            `gate ${gate} est sautée mais \`${fichier}:${i + 1}\` nomme \`${jeton}\` : ` +
              'mesure son `lit` (sonde fs) et déclare-le dans ECRIT_LU',
          )
      })
    }
  }
  assert.deepEqual(trous, [])
})

// (c2) — la liste DOCUMENTAIRE confrontée à ce que le RUNTIME lit : un sens DISTINCT de (c1). Une
// gate peut ne rien lire de documentaire alors que `src/` le lirait à l'exécution — le classement
// lui-même serait faux, pas seulement le `lit` d'une gate.

/** Les sources de `src/` et `server/src/` SUIVIES par git, hors bancs de test. */
function sourcesDeProduction() {
  return execFileSync('git', ['ls-files', '--', 'src', 'server/src'], { cwd: RACINE, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter((f) => /\.(ts|tsx|mts|js|jsx)$/.test(f) && !f.includes('.test.'))
}

/**
 * Les cibles que le fichier LIT vraiment : spécificateur d'`import`/`export … from`, argument de
 * `readFileSync`/`readFile`, de `fetch(`, motif d'`import.meta.glob`. Jamais une regex sur le texte
 * nu : un chemin cité en commentaire n'est pas une lecture (mesuré 2026-09-16 — 64 mentions de
 * `.claude`/`.codex`/`CLAUDE.md` sous src/, toutes en commentaire ou classe CSS).
 */
function ciblesLues(texte) {
  const cibles = []
  const motifs = [
    /(?:^|\n)\s*(?:import|export)[^\n;]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\bimport\.meta\.glob\s*\(\s*\[?\s*['"]([^'"]+)['"]/g,
    /\breadFileSync?\s*\(\s*['"]([^'"]+)['"]/g,
    /\breadFile\s*\(\s*['"]([^'"]+)['"]/g,
    /\bfetch\s*\(\s*['"]([^'"]+)['"]/g,
  ]
  for (const motif of motifs) for (const m of texte.matchAll(motif)) cibles.push(m[1])
  return cibles
}

test('aucune entrée de DOCUMENTAIRE n’est LUE par du code de production', () => {
  const prefixes = Object.keys(DOCUMENTAIRE)
  const lectures = []
  for (const fichier of sourcesDeProduction()) {
    const texte = readFileSync(join(RACINE, fichier), 'utf8')
    for (const cible of ciblesLues(texte)) {
      const nue = cible.replace(/^\.\.?\//, '').replace(/^[a-z]+:/, '')
      const fautif = prefixes.find((p) => nue.startsWith(p) || cible.includes(`/${p}`) || cible.startsWith(p))
      if (fautif) lectures.push(`${fichier} LIT « ${cible} » — « ${fautif} » n’est donc pas documentaire`)
    }
  }
  assert.deepEqual(lectures, [])
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

const gitDe = (cwd) => (args) => execFileSync('git', args, { cwd, env: envDeDepotForge(), encoding: 'utf8' }).trim()

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
  try {
    const stdout = execFileSync(process.execPath, [CLASSEUR], {
      cwd,
      encoding: 'utf8',
      env: { ...envDeDepotForge(), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout }
  } catch (erreur) {
    return { code: erreur.status, stdout: erreur.stdout ?? '' }
  }
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
    execFileSync('git', ['clone', '-q', '--single-branch', '--branch', 'chantier/x', racine, clone], {
      env: envDeDepotForge(), encoding: 'utf8',
    })
    assert.throws(
      () => execFileSync('git', ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: clone, env: envDeDepotForge() }),
      'le clone doit bien être SANS origin/main — sinon le cas ne mesure rien',
    )
    const r = jouerCli(clone, { SHA: 'HEAD' })
    assert.equal(r.code, 0)
    assert.equal(r.stdout.trim(), 'produit=false')
    assert.equal(
      execFileSync('git', ['rev-parse', 'refs/remotes/origin/main'], { cwd: clone, env: envDeDepotForge(), encoding: 'utf8' }).trim(),
      execFileSync('git', ['rev-parse', 'refs/heads/main'], { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' }).trim(),
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

test('ÉCHEC — une PANNE de git au merge-base : classement CONSERVATEUR, et la panne est NOMMÉE', () => {
  const { racine } = depotJetable()
  try {
    const v = sousGitFeint([{ si: ['merge-base'], status: 128, stderr: 'fatal: panne simulée\n' }], () => classerPush({ sha: 'HEAD', cwd: racine }))
    assert.deepEqual([v.produit, v.base, v.motifs], [true, null, ['merge-base origin/main en échec — git indisponible : fatal: panne simulée : conservateur']])
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
