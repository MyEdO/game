// Tests de la GARDE des plans datés (`check-plans-anchors.mjs`), jouée sur un dépôt git JETABLE :
// la garde lit l'arbre par `git ls-files` et l'historique par `git log`, donc seul un vrai dépôt —
// avec ses commits, dont une SUPPRESSION de plan — la met en situation. Un faux dépôt sans commits
// ne prouverait rien : `git ls-files` y rend zéro fichier et la garde serait verte à vide.
// Chaque famille de violation est jouée SEULE, sur un dépôt neuf, et le VERT de référence est joué
// en premier : une garde qui rougirait déjà à vide rendrait tous les rouges suivants illisibles.
// Les plans nommés ici sont FICTIFS, et la garde s'exclut elle-même de ses SENS 2 et 3 (script + ce
// test, `FICHIERS_DE_LA_GARDE`) : le dépôt jetable les matérialise à la demande de chaque cas.
// Lancé par `npm run test:docs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const GARDE = join(ICI, 'check-plans-anchors.mjs')
/** Libs que la garde importe en RELATIF : le dépôt jetable doit les porter au même chemin. */
const LIBS = [['scripts', 'guards', 'lib', 'lister.mjs'], ['src', 'lib', 'ordre.mjs']]
/** La garde et ses libs, LUES : le dépôt jetable les porte aux mêmes chemins relatifs. */
const CODE_DE_LA_GARDE = {
  'scripts/docs/check-plans-anchors.mjs': readFileSync(GARDE, 'utf8'),
  ...Object.fromEntries(LIBS.map((parts) => [parts.join('/'), readFileSync(join(ICI, '..', '..', ...parts), 'utf8')])),
}

const git = (base, ...args) => {
  const r = spawnSync('git', args, { cwd: base, encoding: 'utf8' })
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`)
  return r.stdout
}

const ecrire = (base, rel, texte) => {
  mkdirSync(join(base, dirname(rel)), { recursive: true })
  writeFileSync(join(base, rel), texte, 'utf8')
}

/** Dépôt jetable : la garde y est COPIÉE (elle se résout par `git rev-parse --show-toplevel`, donc
 *  elle juge le dépôt courant, pas celui d'où elle vient). */
function depot(fichiers = {}) {
  // Le gabarit ne porte que le code de la garde (INVARIANT, donc partagé par tous les cas) ; les
  // fichiers du cas entrent dans le MÊME et unique commit `socle` que l'histoire jugée attend.
  const { racine: base } = instanceDeDepot({ fichiers: CODE_DE_LA_GARDE, commit: false })
  for (const [rel, texte] of Object.entries(fichiers)) ecrire(base, rel, texte)
  git(base, 'add', '-A')
  git(base, 'commit', '-q', '-m', 'socle')
  return base
}

/** Supprime un plan EN HISTOIRE : c'est de ce commit que le registre des noms morts est calculé. */
function tuerLePlan(base, rel) {
  git(base, 'rm', '-q', rel)
  git(base, 'commit', '-q', '-m', `purge ${rel}`)
}

function lancer(base, ...args) {
  const r = spawnSync(process.execPath, [join(base, 'scripts', 'docs', 'check-plans-anchors.mjs'), ...args], {
    cwd: base,
    encoding: 'utf8',
  })
  return { code: r.status, sortie: r.stdout + r.stderr }
}

const PLAN_SAIN = '# Plan vivant\n\nTicket: #1\n\nCorps.\n'

test('VERT de référence : un plan ancré, aucune citation morte', () => {
  const base = depot({ 'docs/plans/2026-01-01-vivant.md': PLAN_SAIN })
  try {
    const { code, sortie } = lancer(base)
    assert.equal(code, 0, `garde rouge à vide : ${sortie}`)
    assert.equal(sortie.trim(), '', `garde bavarde au vert : ${sortie}`)
    const stats = lancer(base, '--stats')
    // Tous les plans du dépôt jetable sont ancrés : le compte des deux nombres se suit lui-même.
    assert.match(stats.sortie, /(\d+) plan\(s\) suivi\(s\), \1 ancré\(s\)/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SENS 1 — plan sans ancre `Ticket:`/`Instrument:`', () => {
  const base = depot({ 'docs/plans/2026-01-01-flottant.md': '# Plan flottant\n\nAucune ancre.\n' })
  try {
    const { code, sortie } = lancer(base)
    assert.equal(code, 1, `plan sans ancre accepté : ${sortie}`)
    assert.match(sortie, /docs\/plans\/2026-01-01-flottant\.md:1\s+\[plan sans ancre\]/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SENS 1 — `Instrument:` dont la cible n’existe pas', () => {
  const base = depot({
    'docs/plans/2026-01-01-outil.md': '# Entrée d’outil\n\nInstrument: scripts/outil-absent.mjs\n',
  })
  try {
    const { code, sortie } = lancer(base)
    assert.equal(code, 1, `instrument fantôme accepté : ${sortie}`)
    assert.match(sortie, /\[instrument absent\]\s+scripts\/outil-absent\.mjs/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SENS 2 — un fichier suivi cite un chemin `docs/plans/…` qui n’existe pas', () => {
  const base = depot({
    'docs/plans/2026-01-01-vivant.md': PLAN_SAIN,
    'src/module.ts': '// Voir docs/plans/2026-01-01-jamais-ne.md pour le détail.\nexport const x = 1\n',
  })
  try {
    const { code, sortie } = lancer(base)
    assert.equal(code, 1, `chemin mort accepté : ${sortie}`)
    assert.match(sortie, /src\/module\.ts:1\s+\[plan cité mais absent\]\s+docs\/plans\/2026-01-01-jamais-ne\.md/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SENS 1 en ligne (`--online`) — ancre Ticket dont TOUTES les issues sont fermées', () => {
  const base = depot({ 'docs/plans/2026-01-01-vivant.md': PLAN_SAIN })
  try {
    ecrire(base, 'ouvertes.json', JSON.stringify([{ number: 42 }]))
    const { code, sortie } = lancer(base, '--online', join(base, 'ouvertes.json'))
    assert.equal(code, 1, `plan exécuté conservé : ${sortie}`)
    assert.match(sortie, /\[plan exécuté, à supprimer\]\s+#1 fermée/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SENS 3 — un plan SUPPRIMÉ cité par son NOM NU, sans son dossier', () => {
  const base = depot({
    'docs/plans/2026-01-01-vivant.md': PLAN_SAIN,
    'docs/plans/planche-defunte.html': '<!-- Ticket: #1 -->\n<p>maquette</p>\n',
    'src/ui/Ecran.tsx': '// Étalon `planche-defunte.html`.\nexport const E = 1\n',
  })
  try {
    assert.equal(lancer(base).code, 0, 'le nom est vivant tant que le plan existe')
    tuerLePlan(base, 'docs/plans/planche-defunte.html')
    const { code, sortie } = lancer(base)
    assert.equal(code, 1, `nom nu d’un plan supprimé accepté : ${sortie}`)
    assert.match(sortie, /src\/ui\/Ecran\.tsx:1\s+\[plan supprimé cité par son nom\]\s+cite « planche-defunte\.html » \(SUPPRIMÉ\)/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SENS 3 — une commande de RÉCUPÉRATION d’historique nomme légitimement le plan mort', () => {
  const base = depot({
    'docs/plans/2026-01-01-vivant.md': PLAN_SAIN,
    'docs/plans/planche-defunte.html': '<!-- Ticket: #1 -->\n<p>maquette</p>\n',
    'docs/note.md': 'Récupérable : `git log --diff-filter=D -- docs/plans/planche-defunte.html`.\n',
  })
  try {
    tuerLePlan(base, 'docs/plans/planche-defunte.html')
    const { code, sortie } = lancer(base)
    assert.equal(code, 0, `commande de récupération prise pour une citation morte : ${sortie}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
