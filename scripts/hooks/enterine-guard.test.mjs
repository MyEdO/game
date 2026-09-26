// Garde du tag `[entériné AAAA-MM-JJ]` (credo 6b, mot RÉSERVÉ à l'utilisateur) : le hook est lancé
// POUR DE VRAI (spawnSync + stdin JSON). L'invariant tenu ici est celui que le hook PROMET en tête :
// seule une écriture qui INTRODUIT un tag absent du fichier SUR DISQUE demande une validation —
// re-sauver un fichier qui portait déjà ses tags ne redemande rien (#1754), pour `Write` comme pour
// `Edit`. Les fichiers-cibles sont des fixtures jetables posées dans un dépôt forgé sous `os.tmpdir()`
// (le hook garde le contenu d'un DÉPÔT, #1973) ; l'arbre versionné n'est jamais écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'enterine-guard.mjs')
const TAG = '[entériné 2026-09-14]'
const TAG2 = '[entériné 2026-09-15]'

function lanceBrut(entree, env = process.env) {
  const r = spawnSync(process.execPath, [HOOK], { input: entree, encoding: 'utf8', cwd: REPO, env })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}
const lance = (tool_input, env) => lanceBrut(JSON.stringify({ tool_input }), env)
const demande = (r) => {
  assert.equal(r.code, 0, 'le hook ne bloque jamais : il DEMANDE')
  if (r.out.trim() === '') return false
  return JSON.parse(r.out).hookSpecificOutput?.permissionDecision === 'ask'
}

/** Joue `fn(chemin)` sur un fichier-fixture (contenu `avant`, ou absent) posé dans un DÉPÔT forgé —
 *  ou, `horsDepot`, dans un dossier jetable qu'aucun arbre git ne contient (le scratchpad). */
function avecFichier(avant, fn, { horsDepot = false } = {}) {
  const dossier = horsDepot ? mkdtempSync(join(tmpdir(), 'wfrp-enterine-')) : instanceDeDepot().racine
  const cible = join(dossier, 'cible.ts')
  if (avant !== null) writeFileSync(cible, avant)
  try { return fn(cible) } finally { rmSync(dossier, { recursive: true, force: true }) }
}

test('Write plein-fichier d’un fichier portant DÉJÀ son tag → silence (#1754)', () => {
  const contenu = `// raison ${TAG}\nexport const a = 1\n`
  avecFichier(contenu, (cible) => {
    assert.equal(demande(lance({ file_path: cible, content: contenu })), false)
    // Et même si le RESTE du fichier change : seul l'ensemble des tags compte.
    assert.equal(demande(lance({ file_path: cible, content: contenu + 'export const b = 2\n' })), false)
  })
})

test('Write qui AJOUTE un tag (2ᵉ tag, ou 2ᵉ occurrence du même) → ask', () => {
  const avant = `// raison ${TAG}\n`
  avecFichier(avant, (cible) => {
    assert.equal(demande(lance({ file_path: cible, content: `${avant}// autre ${TAG2}\n` })), true)
    assert.equal(demande(lance({ file_path: cible, content: `${avant}// copie ${TAG}\n` })), true)
  })
})

test('Write d’un fichier NEUF portant un tag → ask ; sans tag → silence', () => {
  avecFichier(null, (cible) => {
    assert.equal(demande(lance({ file_path: cible, content: `// raison ${TAG}\n` })), true)
    assert.equal(demande(lance({ file_path: cible, content: '// sans tag\n' })), false)
  })
  // `file_path` absent (écriture dont la cible est inconnue) : on ne peut rien soustraire → ask.
  assert.equal(demande(lance({ content: `// raison ${TAG}\n` })), true)
})

test('HORS DÉPÔT (scratchpad) : le même tag introduit ne demande rien (#1973)', () => {
  avecFichier(null, (cible) => {
    assert.equal(demande(lance({ file_path: cible, content: `// raison ${TAG}\n` })), false, 'Write de création')
  }, { horsDepot: true })
  avecFichier('// raison\n', (cible) => {
    assert.equal(demande(lance({ file_path: cible, old_string: '// raison', new_string: `// raison ${TAG}` })), false, 'Edit')
  }, { horsDepot: true })
})

// Un fichier IGNORÉ par git n'est pas du contenu versionné (#1973). Le voisin que `.gitignore`
// ré-inclut reste gardé.
test('fichier IGNORÉ par git dans un dépôt → silence ; voisin ré-inclus → ask ; git indisponible → ask', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'node_modules/\n.superpowers/\n.claude/*\n!.claude/memory/\n' } })
  const ecrit = (rel, env) => demande(lance({ file_path: join(racine, ...rel.split('/')), content: `// raison ${TAG}\n` }, env))
  try {
    assert.equal(ecrit('node_modules/.cache/brief.md'), false, 'node_modules/.cache')
    assert.equal(ecrit('.superpowers/sdd/x.md'), false, '.superpowers/')
    assert.equal(ecrit('.claude/worktrees/agent-x/src/a.ts'), false, 'worktree mort sans `.git`')
    assert.equal(ecrit('.claude/memory/x.md'), true, '`!.claude/memory/` : versionné')
    const sansGit = { ...process.env, PATH: dirname(process.execPath), Path: dirname(process.execPath) }
    assert.equal(ecrit('node_modules/.cache/brief.md', sansGit), true, 'git indisponible : aucune preuve, le hook garde')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Graphie MSYS (`/c/Users/…`) d'un chemin win32 absolu. */
const versMsys = (p) => '/' + p[0].toLowerCase() + p.slice(2).replace(/\\/g, '/')

test('graphie MSYS `/c/…` d’un fichier DANS un dépôt → la garde reste active (ask)', { skip: process.platform !== 'win32' }, () => {
  avecFichier(null, (cible) => {
    assert.equal(demande(lance({ file_path: versMsys(cible), content: `// raison ${TAG}\n` })), true)
  })
})

test('graphie MSYS : re-sauver un fichier qui porte DÉJÀ son tag décide comme le natif (silence, #1754)', { skip: process.platform !== 'win32' }, () => {
  const contenu = `// raison ${TAG}\nexport const a = 1\n`
  avecFichier(contenu, (cible) => {
    assert.equal(demande(lance({ file_path: cible, content: contenu })), false, 'natif')
    assert.equal(demande(lance({ file_path: versMsys(cible), content: contenu })), false, 'MSYS')
  })
})

test('le message de la demande NOMME le credo et ce que confirmer VAUT', () => {
  const r = lance({ content: `${TAG}` })
  const raison = JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason
  assert.match(raison, /credo 6b/)
  assert.match(raison, /VAUT validation/)
})

test('Edit : inchangé — introduit → ask, old_string qui portait déjà le tag → silence', () => {
  avecFichier(`// raison ${TAG}\n`, (cible) => {
    assert.equal(demande(lance({ file_path: cible, old_string: '// raison', new_string: `// raison ${TAG2}` })), true)
    assert.equal(demande(lance({ file_path: cible, old_string: `// raison ${TAG}`, new_string: `// motif ${TAG}` })), false)
    assert.equal(demande(lance({ file_path: cible, old_string: '// a', new_string: '// b' })), false)
  })
})

test('stdin illisible ou vide → silence (jamais de demande au hasard)', () => {
  for (const brut of ['', '{ ceci n’est pas du JSON', '{}', 'null'])
    assert.equal(demande(lanceBrut(brut)), false, brut)
})

test('le hook est câblé sur Write ET Edit dans les DEUX surfaces (sinon il passe à vide)', () => {
  for (const surface of ['.claude/settings.json', '.codex/hooks.json']) {
    const config = JSON.parse(readFileSync(join(REPO, surface), 'utf8'))
    const matchers = (config.hooks?.PreToolUse ?? [])
      .filter((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes('enterine-guard.mjs')))
      .map((e) => String(e.matcher ?? ''))
    assert.ok(matchers.length > 0, `${surface} : hook non câblé`)
    for (const canal of ['Write', 'Edit'])
      assert.ok(matchers.some((m) => m.split('|').includes(canal)), `${surface} : canal ${canal} non matché`)
  }
})
